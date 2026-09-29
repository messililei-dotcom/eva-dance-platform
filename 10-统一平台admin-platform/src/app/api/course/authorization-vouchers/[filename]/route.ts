import { readFile } from 'fs/promises';
import { requirePermission } from '../../../training-db';
import { authorizationVoucherDiskPath } from '@/lib/server/authorization-vouchers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const permissionError = requirePermission(request, 'permOnlineAuthView');
  if (permissionError) return permissionError;

  const { filename } = await context.params;
  const diskPath = authorizationVoucherDiskPath(`/api/course/authorization-vouchers/${encodeURIComponent(filename)}`);
  if (!diskPath) return Response.json({ success: false, error: '凭证链接无效' }, { status: 400 });

  try {
    const image = await readFile(diskPath);
    return new Response(image, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, max-age=0',
        'Content-Type': 'image/webp',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return Response.json({ success: false, error: '凭证文件不存在' }, { status: 404 });
    }
    return Response.json({ success: false, error: '读取凭证失败' }, { status: 500 });
  }
}
