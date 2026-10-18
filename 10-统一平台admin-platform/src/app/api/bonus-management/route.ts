import {
  authPayloadFromRequest,
  hasAuth,
  hasPermission,
  isSuperAdminRequest,
  openTrainingDb,
  unauthorized,
} from "../training-db";
import { findLocalUser } from "../_local-auth";
import {
  assertBonusUnlocked,
  bonusSummary,
  confirmBonus,
  ensureBonusTables,
  payBonus,
  saveBonusEntry,
  saveBonusStandard,
  validMonth,
} from "@/lib/server/bonus-management";
import { bonusCatalog, syncBonusStock } from "@/lib/server/bonus-registration";
import { bonusPermissions } from "@/lib/server/bonus-permissions";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const payload = authPayloadFromRequest(request);
  const user = payload ? findLocalUser(payload.username) : null;
  const permissions = bonusPermissions(user);
  if (
    !hasPermission(request, "permPaymentView") &&
    !permissions.canReview &&
    !permissions.canPay
  )
    return Response.json({ error: "无权查看结算" }, { status: 403 });
  const db = openTrainingDb();
  try {
    ensureBonusTables(db);
    const period = validMonth(new URL(request.url).searchParams.get("period"));
    return Response.json({
      rows: bonusSummary(db, period),
      entries: db
        .prepare(
          "SELECT * FROM BonusEntry WHERE period=? ORDER BY date DESC,id DESC",
        )
        .all(period)
        .map((r: any) => ({ ...r, ...JSON.parse(r.data) })),
      standards: db
        .prepare("SELECT * FROM BonusStandard ORDER BY effectiveDate DESC")
        .all(),
      logs: db
        .prepare("SELECT * FROM BonusAudit WHERE period=? ORDER BY id DESC")
        .all(period),
      ...bonusCatalog(db),
      admin: isSuperAdminRequest(request),
      ...permissions,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  } finally {
    db.close();
  }
}
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const input = await request.json().catch(() => null);
  if (!input) return Response.json({ error: "请求格式无效" }, { status: 400 });
  const admin = isSuperAdminRequest(request);
  const payload = authPayloadFromRequest(request);
  const user = payload ? findLocalUser(payload.username) : null;
  const permissions = bonusPermissions(user);
  if (input.action === "confirm" && !permissions.canReview)
    return Response.json({ error: "仅李雷和伊琳可审核确认" }, { status: 403 });
  if (input.action === "pay" && !permissions.canPay)
    return Response.json({ error: "仅李雷可标记发放" }, { status: 403 });
  if (["standard", "adjustment"].includes(input.action || input.kind) && !admin)
    return Response.json(
      { error: "仅管理员可调整金额或修改标准" },
      { status: 403 },
    );
  if (
    !admin &&
    !["confirm", "pay"].includes(input.action) &&
    !hasPermission(
      request,
      input.action === "delete"
        ? "permPaymentDelete"
        : input.id
          ? "permPaymentEdit"
          : "permPaymentCreate",
    )
  )
    return Response.json({ error: "无权登记或修改" }, { status: 403 });
  const actor = {
    id: payload?.id || 0,
    name: user?.name || payload?.username || "本地管理员",
  };
  const db = openTrainingDb();
  try {
    ensureBonusTables(db);
    const result = db.transaction(() => {
      if (input.action === "confirm") {
        if (typeof input.expectedSnapshot !== "string")
          throw new Error("请刷新结算明细后确认");
        return confirmBonus(
          db,
          validMonth(input.period),
          String(input.person),
          actor.name,
          input.expectedSnapshot,
        );
      }
      if (input.action === "pay")
        return payBonus(
          db,
          input.period,
          String(input.person),
          actor.name,
          input.paidDate,
          input.voucher,
        );
      if (input.action === "standard")
        return saveBonusStandard(db, input, actor.name);
      if (input.action === "delete") {
        const row = db
          .prepare("SELECT * FROM BonusEntry WHERE id=?")
          .get<any>(input.id);
        if (!row) throw new Error("记录不存在");
        if (!admin && row.creatorId !== actor.id)
          throw new Error("只能删除本人登记");
        assertBonusUnlocked(db, row.period, row.person);
        if (row.kind === "product")
          syncBonusStock(
            db,
            JSON.parse(row.data).productLines,
            [],
            actor.name,
            JSON.parse(row.data).channel,
            row.id,
          );
        db.prepare("DELETE FROM BonusRegistrationKey WHERE entryId=?").run(
          row.id,
        );
        db.prepare("DELETE FROM BonusOrderKey WHERE entryId=?").run(row.id);
        db.prepare("DELETE FROM BonusEntry WHERE id=?").run(row.id);
        db.prepare(
          "INSERT INTO BonusAudit(period,person,action,actor,detail,createdAt) VALUES(?,?,?,?,?,?)",
        ).run(
          row.period,
          row.person,
          "删除登记",
          actor.name,
          JSON.stringify(row),
          new Date().toISOString(),
        );
        return;
      }
      if (input.action === "import") {
        if (
          !Array.isArray(input.rows) ||
          !input.rows.length ||
          input.rows.length > 500
        )
          throw new Error("每次导入1至500条");
        const results = input.rows.map((r: any, index: number) => {
          try {
            return saveBonusEntry(
              db,
              {
                ...r,
                reason: r.reason || r.remark,
                kind: "product",
                requireCatalog: false,
                productLines: undefined,
                salesperson: r.salesperson || actor.name,
              },
              actor,
              admin,
            );
          } catch (e: any) {
            throw new Error(`第${index + 2}行：${e.message}`);
          }
        });
        return {
          created: results.filter((r: any) => !r.updated).length,
          updated: results.filter((r: any) => r.updated).length,
        };
      }
      return saveBonusEntry(
        db,
        {
          ...input,
          requireCatalog: input.kind === "product",
          requireCourse: input.kind === "lesson",
          requireScreenshots: input.kind === "reimbursement",
        },
        actor,
        admin,
      );
    })();
    return Response.json({ success: true, result });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  } finally {
    db.close();
  }
}
