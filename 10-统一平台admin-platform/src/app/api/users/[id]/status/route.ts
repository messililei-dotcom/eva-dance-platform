import { NextRequest } from 'next/server';
import { openAdminDb } from '@/lib/server/admin-db';
import { ensureLocalAuthTables } from '../../../_local-auth';
import { hasAuth, unauthorized, jsonError } from '../../../training-db';

// PUT /api/users/[id]/status - 切换用户状态 active/inactive
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const current = db.prepare('SELECT username, status FROM User WHERE id = ?').get(routeParams.id) as any;
    if (!current) {
      return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 禁止修改 lilei 的状态
    if (current.username === 'lilei') {
      return Response.json(
        { success: false, error: '超级管理员状态不可修改' },
        { status: 403 }
      );
    }

    const newStatus = current.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE User SET status = ? WHERE id = ?').run(newStatus, routeParams.id);

    return Response.json({
      success: true,
      data: { id: routeParams.id, status: newStatus },
      message: `用户状态已切换为 ${newStatus}`,
    });
  } catch (err: any) {
    return jsonError(err?.message, 500, '切换用户状态失败');
  } finally {
    db.close();
  }
}
