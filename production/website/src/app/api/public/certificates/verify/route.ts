import { noStoreJson } from '@/lib/http-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN
  || process.env.NEXT_PUBLIC_ADMIN_ORIGIN
  || 'https://admin.swod.com.cn';
const API_BASE = (process.env.INTERNAL_STUDENT_API_URL
  || process.env.STUDENT_API_URL
  || `${ADMIN_ORIGIN}/api`).replace(/\/$/, '');

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const key = params.has('q') ? 'q' : 'no';
  const certificateNumber = params.get(key)?.trim() || '';
  if (certificateNumber.length < 1 || certificateNumber.length > 80) {
    return noStoreJson({ success: false, error: '请输入证书编号、姓名或手机号码' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE}/certificates/verify?${key}=${encodeURIComponent(certificateNumber)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) },
    );
    const payload = await response.json().catch(() => ({ success: false, error: '查询失败' }));
    return noStoreJson(payload, { status: response.status });
  } catch {
    return noStoreJson({ success: false, error: '证书查询服务暂不可用' }, { status: 503 });
  }
}
