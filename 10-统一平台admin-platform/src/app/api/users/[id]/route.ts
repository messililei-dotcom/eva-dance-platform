import { NextRequest } from 'next/server';
import { openAdminDb } from '@/lib/server/admin-db';
import { ensureLocalAuthTables, hashPassword } from '../../_local-auth';
import { hasAuth, unauthorized, jsonError } from '../../training-db';

// GET /api/users/[id] - 获取单个用户
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const user = db.prepare(`
      SELECT id, username, name, role, status,
             permCourseView, permCourseCreate, permCourseEdit, permCourseDelete,
             permMemberView, permMemberCreate, permMemberEdit, permMemberDelete,
             permTeacherView, permTeacherCreate, permTeacherEdit, permTeacherDelete,
             permPaymentView, permPaymentCreate, permPaymentEdit, permPaymentDelete,
             permConsumeView, permConsumeCreate, permConsumeEdit, permConsumeDelete,
             permOnlineAuthView, permOnlineAuthCreate, permOnlineAuthCancel, permOnlineAuthPhone,
             permLogView,
             bonusTraining, bonusCard, bonusYearly, bonusDisciple
      FROM User WHERE id = ?
    `).get(routeParams.id);

    if (!user) {
      return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    return Response.json({ success: true, data: user });
  } catch (err: any) {
    return jsonError(err?.message, 500, '获取用户信息失败');
  } finally {
    db.close();
  }
}

// PUT /api/users/[id] - 更新用户
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const db = openAdminDb();

  try {
    ensureLocalAuthTables(db);
    const current = db.prepare('SELECT * FROM User WHERE id = ?').get(routeParams.id) as any;
    if (!current) {
      return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 构建更新语句 - 只更新提供的字段
    const sets: string[] = [];
    const values: any[] = [];

    if (body.username !== undefined) {
      // 检查用户名是否重复（排除自己）
      if (body.username !== current.username) {
        const dup = db.prepare('SELECT id FROM User WHERE username = ? AND id != ?').get(body.username, routeParams.id);
        if (dup) {
          return Response.json(
            { success: false, error: `用户名 "${body.username}" 已被占用` },
            { status: 409 }
          );
        }
      }
      sets.push('username = ?');
      values.push(body.username);
    }

    if (body.password !== undefined && body.password !== '') {
      sets.push('password = ?');
      values.push(hashPassword(String(body.password)));
    }

    if (body.name !== undefined) {
      sets.push('name = ?');
      values.push(body.name);
    }

    if (body.role !== undefined) {
      sets.push('role = ?');
      values.push(body.role);
    }

    if (body.status !== undefined) {
      sets.push('status = ?');
      values.push(body.status);
    }

    // 权限字段
    const permFields = [
      'permCourseView', 'permCourseCreate', 'permCourseEdit', 'permCourseDelete',
      'permMemberView', 'permMemberCreate', 'permMemberEdit', 'permMemberDelete',
      'permTeacherView', 'permTeacherCreate', 'permTeacherEdit', 'permTeacherDelete',
      'permPaymentView', 'permPaymentCreate', 'permPaymentEdit', 'permPaymentDelete',
      'permConsumeView', 'permConsumeCreate', 'permConsumeEdit', 'permConsumeDelete',
      'permOnlineAuthView', 'permOnlineAuthCreate', 'permOnlineAuthCancel', 'permOnlineAuthPhone',
      'permLogView',
      'bonusTraining', 'bonusCard', 'bonusYearly', 'bonusDisciple',
    ];

    for (const field of permFields) {
      if (body[field] !== undefined) {
        sets.push(`${field} = ?`);
        values.push(body[field] ? 1 : 0);
      }
    }

    if (sets.length === 0) {
      return Response.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    values.push(routeParams.id);

    db.prepare(`UPDATE User SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    // 返回更新后的用户
    const user = db.prepare(`
      SELECT id, username, name, role, status,
             permCourseView, permCourseCreate, permCourseEdit, permCourseDelete,
             permMemberView, permMemberCreate, permMemberEdit, permMemberDelete,
             permTeacherView, permTeacherCreate, permTeacherEdit, permTeacherDelete,
             permPaymentView, permPaymentCreate, permPaymentEdit, permPaymentDelete,
             permConsumeView, permConsumeCreate, permConsumeEdit, permConsumeDelete,
             permOnlineAuthView, permOnlineAuthCreate, permOnlineAuthCancel, permOnlineAuthPhone,
             permLogView,
             bonusTraining, bonusCard, bonusYearly, bonusDisciple
      FROM User WHERE id = ?
    `).get(routeParams.id);

    return Response.json({ success: true, data: user });
  } catch (err: any) {
    return jsonError(err?.message, 500, '更新用户失败');
  } finally {
    db.close();
  }
}

// DELETE /api/users/[id] - 删除用户
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const current = db.prepare('SELECT username FROM User WHERE id = ?').get(routeParams.id) as any;
    if (!current) {
      return Response.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 禁止删除 lilei（超级管理员）
    if (current.username === 'lilei') {
      return Response.json(
        { success: false, error: '超级管理员不能删除' },
        { status: 403 }
      );
    }

    db.prepare('DELETE FROM User WHERE id = ?').run(routeParams.id);
    return Response.json({ success: true, message: '用户已删除' });
  } catch (err: any) {
    return jsonError(err?.message, 500, '删除用户失败');
  } finally {
    db.close();
  }
}
