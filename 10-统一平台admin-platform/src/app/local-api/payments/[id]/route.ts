import { openAdminDb } from '@/lib/server/admin-db';

export const dynamic = 'force-dynamic';

function openDb() {
  return openAdminDb();
}

function hasAuth(request: Request) {
  return Boolean(request.headers.get('authorization'));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return Response.json({ success: false, error: '未登录' }, { status: 401 });

  const db = openDb();
  try {
    const payment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(routeParams.id);
    if (!payment) {
      return Response.json({ success: false, error: '缴费记录不存在' }, { status: 404 });
    }

    const tx = db.transaction((id: string) => {
      db.prepare('DELETE FROM ConsumeRecord WHERE paymentId = ?').run(id);
      db.prepare('DELETE FROM Payment WHERE id = ?').run(id);
    });
    tx(routeParams.id);

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ success: false, error: err?.message || '删除缴费记录失败' }, { status: 500 });
  } finally {
    db.close();
  }
}
