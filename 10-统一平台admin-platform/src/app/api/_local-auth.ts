import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { openAdminDb } from '@/lib/server/admin-db';

type LocalUserRow = {
  id: number;
  username: string;
  password: string;
  name: string;
  role: string;
  status: string;
};

const PERMISSION_COLUMNS = [
  'permCourseView', 'permCourseCreate', 'permCourseEdit', 'permCourseDelete',
  'permMemberView', 'permMemberCreate', 'permMemberEdit', 'permMemberDelete',
  'permTeacherView', 'permTeacherCreate', 'permTeacherEdit', 'permTeacherDelete',
  'permPaymentView', 'permPaymentCreate', 'permPaymentEdit', 'permPaymentDelete',
  'permConsumeView', 'permConsumeCreate', 'permConsumeEdit', 'permConsumeDelete',
  'permLogView',
  'bonusTraining', 'bonusCard', 'bonusYearly', 'bonusDisciple',
] as const;

export function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV !== 'production') return 'admin-platform-local-dev-session-secret';
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not configured');
  return secret;
}

function base64url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function isLocalAuthEnabled() {
  return process.env.ADMIN_LOCAL_AUTH === 'true' || process.env.NODE_ENV !== 'production';
}

function defaultAdminPassword() {
  return process.env.ADMIN_LOCAL_DEV_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'messi0314' : '');
}

function ensureUserColumn(db: ReturnType<typeof openAdminDb>, column: string, definition: string) {
  const columns = db.prepare('PRAGMA table_info(User)').all<{ name: string }>().map(row => row.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE User ADD COLUMN ${column} ${definition}`).run();
  }
}

export function ensureLocalAuthTables(db: ReturnType<typeof openAdminDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'teacher',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  ensureUserColumn(db, 'name', "TEXT NOT NULL DEFAULT ''");
  ensureUserColumn(db, 'role', "TEXT NOT NULL DEFAULT 'teacher'");
  ensureUserColumn(db, 'status', "TEXT NOT NULL DEFAULT 'active'");
  // created_at/updated_at 在 CREATE TABLE 中已包含，无需再次 ALTER
  // SQLite 3.37 不支持 ALTER TABLE ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP
  PERMISSION_COLUMNS.forEach(column => ensureUserColumn(db, column, 'INTEGER NOT NULL DEFAULT 0'));

  const existingAdmin = db.prepare('SELECT id FROM User WHERE username = ?').get('lilei');
  const password = defaultAdminPassword();
  if (!existingAdmin && password) {
    const values = PERMISSION_COLUMNS.map(() => 1);
    db.prepare(`
      INSERT INTO User (
        username, password, name, role, status,
        ${PERMISSION_COLUMNS.join(', ')}
      )
      VALUES (?, ?, ?, ?, ?, ${PERMISSION_COLUMNS.map(() => '?').join(', ')})
    `).run('lilei', hashPassword(password), '李蕾', 'admin', 'active', ...values);
  }
}

export function createLocalToken(user: LocalUserRow) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24,
  }));
  return `local.${payload}.${sign(payload)}`;
}

export function verifyLocalToken(token: string) {
  if (!token.startsWith('local.')) return null;
  const [, payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.username || Date.now() > Number(data.exp || 0)) return null;
    return data as { id: number; username: string; role: string };
  } catch {
    return null;
  }
}

export function findLocalUser(username: string) {
  const db = openAdminDb();
  try {
    ensureLocalAuthTables(db);
    return db.prepare(`
      SELECT id, username, password, name, role, status
      FROM User
      WHERE username = ?
      LIMIT 1
    `).get<LocalUserRow>(username);
  } finally {
    db.close();
  }
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function verifyPassword(password: string, storedPassword: string) {
  if (!storedPassword) return false;
  if (isBcryptHash(storedPassword)) return bcrypt.compareSync(password, storedPassword);
  return password === storedPassword;
}

export function hashPassword(password: string) {
  if (isBcryptHash(password)) return password;
  return bcrypt.hashSync(password, 10);
}

export function localLogin(username: string, password: string) {
  if (!isLocalAuthEnabled()) return null;
  const user = findLocalUser(username);
  if (!user || user.status !== 'active') return null;

  const expectedPassword = process.env.ADMIN_LOCAL_DEV_PASSWORD;
  const passwordMatches = verifyPassword(password, user.password)
    || Boolean(expectedPassword && password === expectedPassword);
  if (!passwordMatches) return null;

  return {
    token: createLocalToken(user),
    user: {
      id: user.id,
      username: user.username,
      name: user.name || user.username,
      role: user.role,
    },
  };
}
