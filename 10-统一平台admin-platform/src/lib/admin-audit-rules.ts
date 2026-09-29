export type AdminAuditKind = 'access' | 'operation' | 'security';

export type AdminAuditDetail = {
  auditVersion: 1;
  kind: AdminAuditKind;
  method: string;
  path: string;
  status: number;
  result: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  label: string;
};

export function cleanAuditText(value: unknown, maxLength = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeAuditPath(value: unknown) {
  const raw = cleanAuditText(value, 600);
  if (!raw) return '/';
  try {
    const parsed = new URL(raw, 'https://admin.swod.com.cn');
    const pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return pathname.startsWith('/') ? pathname.slice(0, 300) : `/${pathname}`.slice(0, 300);
  } catch {
    const pathname = raw.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/');
    return (pathname.startsWith('/') ? pathname : `/${pathname}`).slice(0, 300);
  }
}

export function adminModuleForPath(value: unknown) {
  const path = normalizeAuditPath(value).replace(/^\/(?:local-)?api(?=\/|$)/, '');
  const rules: Array<[RegExp, string]> = [
    [/^\/(dashboard)?$/, '首页总览'], [/^\/members(?:\/|$)/, '学员信息'],
    [/^\/(orders|order-center)(?:\/|$)/, '订单中心'], [/^\/student-growth(?:\/|$)/, '成长体系'],
    [/^\/access-records(?:\/|$)/, '访问记录'], [/^\/(training|courses|course-templates|offline)(?:\/|$)/, '线下课程'],
    [/^\/(online-course|course)(?:\/|$)/, '线上课程'], [/^\/certificates(?:\/|$)/, '证书管理'],
    [/^\/events?(?:\/|$)/, '赛事管理'], [/^\/ecommerce(?:\/|$)/, '电商系统'],
    [/^\/(finance|bonus-commission)(?:\/|$)/, '财务中心'], [/^\/marketing(?:\/|$)/, '营销工具'],
    [/^\/(messages|inbox)(?:\/|$)/, '站内消息'], [/^\/live(?:\/|$)/, '直播管理'],
    [/^\/content(?:\/|$)/, '内容管理'], [/^\/mini(program)?(?:\/|$)/, '小程序'],
    [/^\/data(?:\/|$)/, '数据分析'], [/^\/crm(?:\/|$)/, 'CRM'],
    [/^\/(permissions|settings)(?:\/|$)/, '系统设置'], [/^\/(login|logout|validate-token)(?:\/|$)/, '系统'],
  ];
  return rules.find(([pattern]) => pattern.test(path))?.[1] || '后台系统';
}

export function adminActionForAudit(kind: AdminAuditKind, methodValue: unknown, statusValue: unknown) {
  const method = cleanAuditText(methodValue, 12).toUpperCase() || 'GET';
  const failed = Number(statusValue || 0) >= 400;
  if (kind === 'access') return failed ? '页面访问失败' : '页面访问';
  if (kind === 'security') return failed ? '登录失败' : '登录成功';
  const action = method === 'DELETE' ? '删除' : method === 'PATCH' || method === 'PUT' ? '更新' : method === 'POST' ? '提交' : '操作';
  return failed ? `${action}失败` : action;
}

export function parseAdminAuditDetail(value: unknown): AdminAuditDetail | null {
  const text = String(value ?? '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text) as Partial<AdminAuditDetail>;
    if (parsed.auditVersion !== 1 || !parsed.kind || !parsed.path) return null;
    return {
      auditVersion: 1, kind: parsed.kind,
      method: cleanAuditText(parsed.method, 12).toUpperCase() || 'GET',
      path: normalizeAuditPath(parsed.path), status: Math.max(0, Math.floor(Number(parsed.status || 0))),
      result: parsed.result === 'failure' ? 'failure' : 'success',
      ipAddress: cleanAuditText(parsed.ipAddress, 80), userAgent: cleanAuditText(parsed.userAgent, 300),
      label: cleanAuditText(parsed.label, 120),
    };
  } catch { return null; }
}
