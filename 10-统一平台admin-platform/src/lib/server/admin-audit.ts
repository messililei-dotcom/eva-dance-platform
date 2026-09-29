import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';
import { clientIpFromRequest, displayClientIp } from '@/lib/server/client-ip';
import {
  adminActionForAudit, adminModuleForPath, cleanAuditText, normalizeAuditPath,
  parseAdminAuditDetail, type AdminAuditDetail, type AdminAuditKind,
} from '@/lib/admin-audit-rules';

export { adminActionForAudit, adminModuleForPath, normalizeAuditPath, parseAdminAuditDetail } from '@/lib/admin-audit-rules';

type WriteAdminAuditInput = {
  actor: string;
  kind: AdminAuditKind;
  method?: string;
  path?: string;
  status?: number;
  label?: string;
  request?: Request;
  ipAddress?: string;
  userAgent?: string;
  dedupeSeconds?: number;
};

export function ensureAdminAuditTable(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS OperationLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      operator TEXT NOT NULL,
      type TEXT NOT NULL,
      module TEXT NOT NULL,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_operation_log_time ON OperationLog(time);
    CREATE INDEX IF NOT EXISTS idx_operation_log_operator_time ON OperationLog(operator, time);
  `);
}

function shanghaiDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

export function writeAdminAudit(db: AdminDb, input: WriteAdminAuditInput) {
  ensureAdminAuditTable(db);
  const actor = cleanAuditText(input.actor, 80) || '未知管理员';
  const method = cleanAuditText(input.method, 12).toUpperCase() || (input.kind === 'access' ? 'GET' : 'POST');
  const path = normalizeAuditPath(input.path);
  const status = Math.max(0, Math.min(999, Math.floor(Number(input.status || 200))));
  const ipAddress = displayClientIp(input.ipAddress || clientIpFromRequest(input.request));
  const userAgent = cleanAuditText(input.userAgent || input.request?.headers.get('user-agent'), 300);
  const detail: AdminAuditDetail = {
    auditVersion: 1,
    kind: input.kind,
    method,
    path,
    status,
    result: status >= 400 ? 'failure' : 'success',
    ipAddress,
    userAgent,
    label: cleanAuditText(input.label, 120),
  };
  const type = adminActionForAudit(input.kind, method, status);
  const auditModule = adminModuleForPath(path);

  if ((input.dedupeSeconds || 0) > 0) {
    const cutoff = shanghaiDateTime(new Date(Date.now() - Math.floor(input.dedupeSeconds || 0) * 1000));
    const recentRows = db.prepare(`
      SELECT detail FROM OperationLog
      WHERE operator = ? AND type = ? AND module = ?
        AND datetime(replace(time, '/', '-')) >= datetime(?)
      ORDER BY id DESC LIMIT 10
    `).all<Record<string, unknown>>(actor, type, auditModule, cutoff);
    if (recentRows.some(row => parseAdminAuditDetail(row.detail)?.path === path)) return { inserted: false };
  }

  const result = db.prepare('INSERT INTO OperationLog (time, operator, type, module, detail) VALUES (?, ?, ?, ?, ?)')
    .run(shanghaiDateTime(), actor, type, auditModule, JSON.stringify(detail));
  return { inserted: true, id: Number(result?.lastInsertRowid || 0) };
}

export function safelyRecordAdminAudit(input: WriteAdminAuditInput) {
  const db = openAdminDb();
  try {
    return writeAdminAudit(db, input);
  } catch (error) {
    console.error('Admin audit write failed:', error);
    return { inserted: false };
  } finally {
    db.close();
  }
}
