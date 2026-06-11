import { NextRequest } from 'next/server';
import { openAdminDb } from '@/lib/server/admin-db';
import { ensureLocalAuthTables, hashPassword } from '../_local-auth';
import { hasAuth, unauthorized, jsonError } from '../training-db';

// GET /api/users - 获取所有用户（不含password字段）
export async function GET(request: NextRequest) {
  if (!hasAuth(request)) return unauthorized();

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    const rows = db.prepare(`
      SELECT id, username, name, role, status,
             permCourseView, permCourseCreate, permCourseEdit, permCourseDelete,
             permMemberView, permMemberCreate, permMemberEdit, permMemberDelete,
             permTeacherView, permTeacherCreate, permTeacherEdit, permTeacherDelete,
             permPaymentView, permPaymentCreate, permPaymentEdit, permPaymentDelete,
             permConsumeView, permConsumeCreate, permConsumeEdit, permConsumeDelete,
             permLogView,
             bonusTraining, bonusCard, bonusYearly, bonusDisciple
      FROM User
      ORDER BY id
    `).all();

    return Response.json({ success: true, data: rows });
  } catch (err: any) {
    return jsonError(err?.message, 500, '获取用户列表失败');
  } finally {
    db.close();
  }
}

// POST /api/users - 创建新用户
export async function POST(request: NextRequest) {
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { username, password, name, role = 'teacher', status = 'active' } = body;

  if (!username || !password || !name) {
    return Response.json(
      { success: false, error: '用户名、密码和姓名为必填项' },
      { status: 400 }
    );
  }

  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    // 检查用户名是否重复
    const existing = db.prepare('SELECT id FROM User WHERE username = ?').get(username);
    if (existing) {
      return Response.json(
        { success: false, error: `用户名 "${username}" 已存在` },
        { status: 409 }
      );
    }

    const info = db.prepare(`
      INSERT INTO User (username, password, name, role, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashPassword(String(password)), name, role, status);

    const user = db.prepare(`
      SELECT id, username, name, role, status,
             permCourseView, permCourseCreate, permCourseEdit, permCourseDelete,
             permMemberView, permMemberCreate, permMemberEdit, permMemberDelete,
             permTeacherView, permTeacherCreate, permTeacherEdit, permTeacherDelete,
             permPaymentView, permPaymentCreate, permPaymentEdit, permPaymentDelete,
             permConsumeView, permConsumeCreate, permConsumeEdit, permConsumeDelete,
             permLogView,
             bonusTraining, bonusCard, bonusYearly, bonusDisciple
      FROM User WHERE id = ?
    `).get(info.lastInsertRowid);

    return Response.json({ success: true, data: user }, { status: 201 });
  } catch (err: any) {
    return jsonError(err?.message, 500, '创建用户失败');
  } finally {
    db.close();
  }
}
