import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  hasAuth,
  hasPermission,
  authPayloadFromRequest,
  openTrainingDb,
  unauthorized,
} from "../../../training-db";
import { bonusPermissions } from "@/lib/server/bonus-permissions";
import { findLocalUser } from "../../../_local-auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  if (!hasAuth(request)) return unauthorized();
  const payload = authPayloadFromRequest(request),
    user = payload ? findLocalUser(payload.username) : null,
    p = bonusPermissions(user);
  if (!hasPermission(request, "permPaymentView") && !p.canReview && !p.canPay)
    return Response.json({ error: "无权查看凭证" }, { status: 403 });
  const { filename } = await context.params;
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
    return Response.json({ error: "凭证链接无效" }, { status: 400 });
  const db = openTrainingDb();
  try {
    if (
      !db
        .prepare("SELECT filename FROM BonusVoucher WHERE filename=?")
        .get(filename)
    )
      return Response.json({ error: "凭证不存在" }, { status: 404 });
    const bytes = await readFile(
      path.join(process.cwd(), "data", "bonus-vouchers", filename),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "凭证不存在" }, { status: 404 });
  } finally {
    db.close();
  }
}
