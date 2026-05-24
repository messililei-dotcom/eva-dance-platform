const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3201);
const PUBLIC_DIR = path.join(ROOT, 'public');
const SHARED_DB_PATH = process.env.SHARED_DB_PATH || path.resolve(ROOT, '../03-学员管理系统/学员管理系统/server/dance.db');
const STUDENT_NODE_MODULES = path.resolve(ROOT, '../03-学员管理系统/学员管理系统/server/node_modules');
const COMMERCE_STORE_PATH = process.env.COMMERCE_STORE_PATH || path.resolve(ROOT, '../07-电商系统/data/inventory-store.json');
const TOKEN_TTL_MS = Number(process.env.FINANCE_TOKEN_TTL_MS || 12 * 60 * 60 * 1000);
const SESSION_SECRET = process.env.FINANCE_SESSION_SECRET || 'eva-finance-dev-secret';
const ADMINS = parseAdmins();

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = require(path.join(STUDENT_NODE_MODULES, 'better-sqlite3'));
}

if (!fs.existsSync(SHARED_DB_PATH)) {
  throw new Error(`共享数据库不存在: ${SHARED_DB_PATH}`);
}

const db = new Database(SHARED_DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
initFinanceTables();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function parseAdmins() {
  if (process.env.FINANCE_ADMINS) {
    return process.env.FINANCE_ADMINS.split(',').map(item => {
      const [username, password, name] = item.split(':').map(part => String(part || '').trim());
      return username && password ? { username, password, name: name || username } : null;
    }).filter(Boolean);
  }
  return [
    { username: process.env.FINANCE_ADMIN_USERNAME || 'lilei', password: process.env.FINANCE_ADMIN_PASSWORD || 'messi0314', name: process.env.FINANCE_ADMIN_NAME || '李磊' },
    { username: process.env.FINANCE_SECONDARY_ADMIN_USERNAME || 'yilin', password: process.env.FINANCE_SECONDARY_ADMIN_PASSWORD || 'yilin123', name: process.env.FINANCE_SECONDARY_ADMIN_NAME || '伊琳' }
  ].filter(admin => admin.username && admin.password);
}

function initFinanceTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS FinanceIncome (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incomeNo TEXT,
      incomeDate TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      account TEXT,
      payer TEXT,
      memberId INTEGER DEFAULT 0,
      memberName TEXT,
      orderId INTEGER DEFAULT 0,
      handler TEXT,
      remark TEXT,
      voucherPath TEXT,
      createdBy TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS FinanceExpense (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expenseNo TEXT,
      expenseDate TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      account TEXT,
      payee TEXT,
      handler TEXT,
      paidStatus TEXT DEFAULT '已付款',
      remark TEXT,
      voucherPath TEXT,
      createdBy TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS FinanceAccount (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT '收款账户',
      status TEXT DEFAULT '启用',
      remark TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_finance_income_date ON FinanceIncome(incomeDate);
    CREATE INDEX IF NOT EXISTS idx_finance_expense_date ON FinanceExpense(expenseDate);
  `);
  const accountCount = db.prepare('SELECT COUNT(*) AS count FROM FinanceAccount').get().count || 0;
  if (!accountCount) {
    const stmt = db.prepare('INSERT INTO FinanceAccount (name, type) VALUES (?, ?)');
    ['微信', '支付宝', '银行卡', '现金', '抖音/小程序'].forEach(name => stmt.run(name, '收付款账户'));
  }
}

function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}

function createToken(admin) {
  const payload = Buffer.from(JSON.stringify({
    username: admin.username,
    name: admin.name || admin.username,
    role: 'finance_admin',
    exp: Date.now() + TOKEN_TTL_MS
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error('请求内容过大'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON 格式不正确'));
      }
    });
  });
}

function sanitizeText(value, fallback = '') {
  return String(value ?? fallback).trim().replace(/<[^>]*>/g, '').slice(0, 500);
}

function numberValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function monthBounds(month) {
  const now = new Date();
  const safe = /^\d{4}-\d{2}$/.test(month || '') ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, monthNo] = safe.split('-').map(Number);
  const prev = new Date(year, monthNo - 2, 1);
  const lastYear = `${year - 1}-${String(monthNo).padStart(2, '0')}`;
  return {
    month: safe,
    prevMonth: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`,
    lastYearMonth: lastYear
  };
}

function sum(sql, params = []) {
  return numberValue(db.prepare(sql).get(...params)?.total);
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function getCommerceSales() {
  try {
    if (!fs.existsSync(COMMERCE_STORE_PATH)) return [];
    const store = JSON.parse(fs.readFileSync(COMMERCE_STORE_PATH, 'utf8'));
    return Array.isArray(store.sales) ? store.sales : [];
  } catch {
    return [];
  }
}

function commerceRevenue(month) {
  const sales = getCommerceSales();
  const rows = sales.filter(s => String(s.date || s.createdAt || '').startsWith(month));
  const revenue = rows.reduce((total, sale) => total + numberValue(sale.amount || sale.total || sale.totalAmount), 0);
  const cost = rows.reduce((total, sale) => total + numberValue(sale.cost || sale.costAmount || sale.totalCost), 0);
  return { revenue, cost, count: rows.length };
}

function getMonthlySnapshot(month) {
  const like = `${month}-%`;
  const offlineIncome = sum("SELECT COALESCE(SUM(amount),0) AS total FROM Payment WHERE date LIKE ? AND COALESCE(paymentStatus,'paid') != 'refunded'", [like]);
  const onlineIncome = tableExists('CourseOrder') ? sum("SELECT COALESCE(SUM(amount),0) AS total FROM CourseOrder WHERE status='paid' AND COALESCE(substr(paid_at,1,10), substr(created_at,1,10)) LIKE ?", [like]) : 0;
  const manualIncome = sum('SELECT COALESCE(SUM(amount),0) AS total FROM FinanceIncome WHERE incomeDate LIKE ?', [like]);
  const commerce = commerceRevenue(month);
  const expense = sum('SELECT COALESCE(SUM(amount),0) AS total FROM FinanceExpense WHERE expenseDate LIKE ?', [like]) + commerce.cost;
  const newMembers = sum('SELECT COUNT(*) AS total FROM Member WHERE COALESCE(register_date, substr(created_at,1,10)) LIKE ?', [like]);
  const activeMembers = sum('SELECT COUNT(DISTINCT memberId) AS total FROM ConsumeRecord WHERE consumeDate LIKE ?', [like]);
  const consumedSessions = sum('SELECT COALESCE(SUM(count),0) AS total FROM ConsumeRecord WHERE consumeDate LIKE ?', [like]);
  const learningViews = tableExists('VideoProgress') ? sum('SELECT COUNT(*) AS total FROM VideoProgress WHERE substr(COALESCE(last_play_at, created_at),1,7) = ?', [month]) : 0;
  const income = offlineIncome + onlineIncome + manualIncome + commerce.revenue;
  return { month, income, offlineIncome, onlineIncome, manualIncome, commerceIncome: commerce.revenue, expense, profit: income - expense, newMembers, activeMembers, consumedSessions, learningViews, commerceOrders: commerce.count };
}

function tableExists(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function percent(current, base) {
  if (!base && !current) return 0;
  if (!base) return 100;
  return Math.round(((current - base) / base) * 1000) / 10;
}

function buildSummary(month) {
  const { prevMonth, lastYearMonth } = monthBounds(month);
  const current = getMonthlySnapshot(month);
  const previous = getMonthlySnapshot(prevMonth);
  const lastYear = getMonthlySnapshot(lastYearMonth);
  const trends = [];
  const [year, monthNo] = month.split('-').map(Number);
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(year, monthNo - 1 - i, 1);
    trends.push(getMonthlySnapshot(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`));
  }
  const like = `${month}-%`;
  const incomeBreakdown = [
    { label: '线下课程', value: current.offlineIncome },
    { label: '线上课程', value: current.onlineIncome },
    { label: '电商销售', value: current.commerceIncome },
    { label: '其他收入', value: current.manualIncome }
  ];
  const expenseBreakdown = all('SELECT category AS label, COALESCE(SUM(amount),0) AS value FROM FinanceExpense WHERE expenseDate LIKE ? GROUP BY category ORDER BY value DESC LIMIT 8', [like]);
  const topStudents = all(`
    SELECT memberName AS name, memberPhone AS phone, COALESCE(SUM(amount),0) AS spend, COUNT(*) AS orders
    FROM Payment
    WHERE date LIKE ? AND COALESCE(paymentStatus,'paid') != 'refunded'
    GROUP BY memberId, memberName, memberPhone
    ORDER BY spend DESC
    LIMIT 10
  `, [like]);
  const learningRank = all(`
    SELECT memberName AS name, memberPhone AS phone, COALESCE(SUM(count),0) AS sessions, COUNT(*) AS checkins, MAX(consumeDate) AS lastDate
    FROM ConsumeRecord
    WHERE consumeDate LIKE ?
    GROUP BY memberId, memberName, memberPhone
    ORDER BY sessions DESC, checkins DESC
    LIMIT 10
  `, [like]);
  const courseRank = all(`
    SELECT p.courseName AS name, c.type AS type, COALESCE(SUM(p.amount),0) AS revenue, COUNT(*) AS orders, COUNT(DISTINCT p.memberId) AS students
    FROM Payment p
    LEFT JOIN Course c ON c.id = p.courseId
    WHERE p.date LIKE ? AND COALESCE(p.paymentStatus,'paid') != 'refunded'
    GROUP BY p.courseId, p.courseName, c.type
    ORDER BY revenue DESC
    LIMIT 10
  `, [like]);
  const courseType = all(`
    SELECT COALESCE(c.type, '未分类') AS label, COALESCE(SUM(p.amount),0) AS value
    FROM Payment p
    LEFT JOIN Course c ON c.id = p.courseId
    WHERE p.date LIKE ? AND COALESCE(p.paymentStatus,'paid') != 'refunded'
    GROUP BY COALESCE(c.type, '未分类')
    ORDER BY value DESC
  `, [like]);
  const memberGrowth = all(`
    SELECT substr(COALESCE(register_date, substr(created_at,1,10)),1,7) AS month, COUNT(*) AS count
    FROM Member
    WHERE COALESCE(register_date, created_at) IS NOT NULL
    GROUP BY substr(COALESCE(register_date, substr(created_at,1,10)),1,7)
    ORDER BY month DESC
    LIMIT 12
  `).reverse();
  const activityByStudent = all(`
    SELECT m.name, m.phone, COUNT(cr.id) AS checkins, COALESCE(SUM(cr.count),0) AS sessions,
           ROUND(COUNT(cr.id) / 4.0, 1) AS weeklyFrequency
    FROM Member m
    LEFT JOIN ConsumeRecord cr ON cr.memberId = m.id AND cr.consumeDate LIKE ?
    GROUP BY m.id
    HAVING checkins > 0
    ORDER BY weeklyFrequency DESC, sessions DESC
    LIMIT 10
  `, [like]);
  return {
    current,
    compare: {
      incomeMom: percent(current.income, previous.income),
      incomeYoy: percent(current.income, lastYear.income),
      profitMom: percent(current.profit, previous.profit),
      membersMom: percent(current.newMembers, previous.newMembers),
      activityMom: percent(current.consumedSessions, previous.consumedSessions)
    },
    trends,
    incomeBreakdown,
    expenseBreakdown,
    courseType,
    courseRank,
    topStudents,
    learningRank,
    memberGrowth,
    activityByStudent,
    unpaidExpense: sum("SELECT COALESCE(SUM(amount),0) AS total FROM FinanceExpense WHERE paidStatus != '已付款'"),
    totalMembers: sum("SELECT COUNT(*) AS total FROM Member"),
    activeCourseCount: sum("SELECT COUNT(*) AS total FROM Course WHERE COALESCE(status,'active') != 'inactive'")
  };
}

function listRecords(type, month) {
  const isExpense = type === 'expenses';
  const table = isExpense ? 'FinanceExpense' : 'FinanceIncome';
  const dateColumn = isExpense ? 'expenseDate' : 'incomeDate';
  const like = `${month}-%`;
  return all(`SELECT * FROM ${table} WHERE ${dateColumn} LIKE ? ORDER BY ${dateColumn} DESC, id DESC LIMIT 500`, [like]);
}

function insertRecord(type, body, user) {
  const isExpense = type === 'expenses';
  if (isExpense) {
    const stmt = db.prepare(`INSERT INTO FinanceExpense (expenseNo, expenseDate, category, amount, account, payee, handler, paidStatus, remark, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    return stmt.run(
      financeNo('E'),
      sanitizeText(body.date || body.expenseDate, today()),
      sanitizeText(body.category, '其他支出'),
      numberValue(body.amount),
      sanitizeText(body.account, '微信'),
      sanitizeText(body.payee),
      sanitizeText(body.handler, user.name),
      sanitizeText(body.paidStatus, '已付款'),
      sanitizeText(body.remark),
      user.name
    );
  }
  const stmt = db.prepare(`INSERT INTO FinanceIncome (incomeNo, incomeDate, category, amount, account, payer, memberName, handler, remark, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return stmt.run(
    financeNo('R'),
    sanitizeText(body.date || body.incomeDate, today()),
    sanitizeText(body.category, '其他收入'),
    numberValue(body.amount),
    sanitizeText(body.account, '微信'),
    sanitizeText(body.payer),
    sanitizeText(body.memberName),
    sanitizeText(body.handler, user.name),
    sanitizeText(body.remark),
    user.name
  );
}

function updateRecord(type, id, body) {
  const isExpense = type === 'expenses';
  if (isExpense) {
    return db.prepare(`UPDATE FinanceExpense SET expenseDate=?, category=?, amount=?, account=?, payee=?, handler=?, paidStatus=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(sanitizeText(body.date || body.expenseDate, today()), sanitizeText(body.category, '其他支出'), numberValue(body.amount), sanitizeText(body.account, '微信'), sanitizeText(body.payee), sanitizeText(body.handler), sanitizeText(body.paidStatus, '已付款'), sanitizeText(body.remark), id);
  }
  return db.prepare(`UPDATE FinanceIncome SET incomeDate=?, category=?, amount=?, account=?, payer=?, memberName=?, handler=?, remark=?, updated_at=datetime('now','localtime') WHERE id=?`)
    .run(sanitizeText(body.date || body.incomeDate, today()), sanitizeText(body.category, '其他收入'), numberValue(body.amount), sanitizeText(body.account, '微信'), sanitizeText(body.payer), sanitizeText(body.memberName), sanitizeText(body.handler), sanitizeText(body.remark), id);
}

function financeNo(prefix) {
  return `${prefix}${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(Date.now()).slice(-6)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const admin = ADMINS.find(item => item.username === body.username && item.password === body.password);
    if (!admin) return sendJson(res, 401, { success: false, message: '账号或密码不正确' });
    return sendJson(res, 200, { success: true, token: createToken(admin), user: { username: admin.username, name: admin.name, role: 'finance_admin' } });
  }

  const user = verifyToken(req);
  if (!user) return sendJson(res, 401, { success: false, message: '请先登录财务系统' });

  if (url.pathname === '/api/me') return sendJson(res, 200, { user, dbPath: SHARED_DB_PATH, commerceStorePath: COMMERCE_STORE_PATH });
  if (url.pathname === '/api/summary') return sendJson(res, 200, buildSummary(monthBounds(url.searchParams.get('month')).month));
  if (url.pathname === '/api/accounts') return sendJson(res, 200, all("SELECT * FROM FinanceAccount WHERE status='启用' ORDER BY id"));

  const recordMatch = url.pathname.match(/^\/api\/(expenses|incomes)(?:\/(\d+))?$/);
  if (recordMatch) {
    const [, type, id] = recordMatch;
    const month = monthBounds(url.searchParams.get('month')).month;
    if (req.method === 'GET') return sendJson(res, 200, listRecords(type, month));
    if (req.method === 'POST') {
      const result = insertRecord(type, await readBody(req), user);
      return sendJson(res, 200, { success: true, id: Number(result.lastInsertRowid) });
    }
    if (id && req.method === 'PUT') {
      updateRecord(type, Number(id), await readBody(req));
      return sendJson(res, 200, { success: true });
    }
    if (id && req.method === 'DELETE') {
      db.prepare(`DELETE FROM ${type === 'expenses' ? 'FinanceExpense' : 'FinanceIncome'} WHERE id=?`).run(Number(id));
      return sendJson(res, 200, { success: true });
    }
  }

  return sendJson(res, 404, { success: false, message: '接口不存在' });
}

function serveStatic(req, res, url) {
  const safePath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { success: false, message: error.message || '服务器异常' });
  }
});

server.listen(PORT, () => {
  console.log(`伊娃东方舞财务系统已启动: http://127.0.0.1:${PORT}`);
  console.log(`共享数据库: ${SHARED_DB_PATH}`);
});
