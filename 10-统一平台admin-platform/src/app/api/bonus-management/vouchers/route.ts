import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  hasAuth,
  hasPermission,
  authPayloadFromRequest,
  openTrainingDb,
  unauthorized,
} from "../../training-db";
import { compressVoucherImage } from "@/lib/server/voucher-image";
import { ensureBonusTables } from "@/lib/server/bonus-management";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  if (
    !hasPermission(request, "permPaymentCreate") &&
    !hasPermission(request, "permPaymentEdit")
  )
    return Response.json({ error: "无权上传凭证" }, { status: 403 });
  const db = openTrainingDb();
  let diskPath = "";
  try {
    const form = await request.formData(),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size <= 0 ||
      file.size > 12 * 1024 * 1024
    )
      return Response.json(
        { error: "请选择12MB以内的 JPG、PNG 或 WebP 截图" },
        { status: 400 },
      );
    const owner = authPayloadFromRequest(request);
    if (!owner) return unauthorized();
    const image = await compressVoucherImage(
      Buffer.from(await file.arrayBuffer()),
    );
    const filename = `${randomUUID()}.webp`,
      dir = path.join(process.cwd(), "data", "bonus-vouchers");
    await mkdir(dir, { recursive: true });
    diskPath = path.join(dir, filename);
    await writeFile(diskPath, image, { flag: "wx" });
    ensureBonusTables(db);
    db.prepare(
      "INSERT INTO BonusVoucher(filename,ownerId,originalName,createdAt) VALUES(?,?,?,?)",
    ).run(
      filename,
      owner.id,
      String(file.name).slice(0, 200),
      new Date().toISOString(),
    );
    return Response.json({
      success: true,
      data: {
        filename,
        name: file.name,
        url: `/api/bonus-management/vouchers/${filename}`,
      },
    });
  } catch (e: any) {
    if (diskPath) await unlink(diskPath).catch(() => {});
    return Response.json(
      { error: e.message || "上传截图失败" },
      { status: 400 },
    );
  } finally {
    db.close();
  }
}
