const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = require('../../03-学员管理系统/学员管理系统/server/node_modules/better-sqlite3');
}

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const sourcePdf = path.join(workspaceRoot, '证书-伊娃东方舞', 'SWOD.pdf');
const outputDir = path.join(projectRoot, 'public', 'uploads', 'certificates', 'swod-20260530');
const dbPath = process.env.ADMIN_DB_PATH || path.join(projectRoot, 'admin.db');

const seriesName = 'SWOD国际埃及舞蹈师资教育培训证书';
const issueDate = '2026-05-30';
const description = '2026年5月11日至5月30日全日制第五届国际门徒班（基础进阶级）弟子班课程结业证书';

const certificates = [
  { page: 1, name: '择天', englishName: 'Mary' },
  { page: 2, name: '包包', englishName: 'Baobao' },
  { page: 3, name: '玲珑', englishName: 'Linglong' },
  { page: 4, name: '武玉红', englishName: 'Ruby' },
  { page: 5, name: '斩彩卫', englishName: 'Thalia' },
  { page: 6, name: '王玉霞', englishName: 'Esme' },
  { page: 7, name: '周倩', englishName: 'Zhou Qian' },
  { page: 8, name: '胡莹', englishName: 'Hu Ying' },
  { page: 9, name: '刘赟', englishName: 'Liu Yun' },
  { page: 10, name: '钱清', englishName: 'Qian Qing' },
  { page: 11, name: '张艳', englishName: 'Mia' },
  { page: 12, name: '吴翠英', englishName: 'Ying' },
  { page: 13, name: '伍燕子', englishName: 'Wu Yanzi' },
  { page: 14, name: '大凤凤', englishName: 'Da FengFeng' },
  { page: 15, name: '卓溪', englishName: 'Zhuo Xi' },
  { page: 16, name: '王林', englishName: 'Linia' },
  { page: 17, name: '黄峥', englishName: 'Huang Zheng' },
  { page: 18, name: '五粮液 杨利琼', englishName: 'Yang Liqiong' },
  { page: 19, name: '张俊', englishName: 'Zhang Jun' },
  { page: 20, name: '嘉雯', englishName: 'Javen' },
  { page: 21, name: '丁然', englishName: 'Fuqeenie' },
  { page: 22, name: '伊莎', englishName: 'ISA' },
  { page: 23, name: '李红春', englishName: 'Li Hongchun' },
  { page: 24, name: '张秀玲', englishName: 'Zhang Xiuling' },
  { page: 25, name: '谢红辉', englishName: 'Xie Honghui' },
  { page: 26, name: '美羊羊', englishName: 'Mei Yangyang' },
];

function certificateNo(page) {
  return `SWOD-20260530-${String(page).padStart(3, '0')}`;
}

function ensureColumn(db, table, column, ddl) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Member (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      gender TEXT DEFAULT '女',
      birthday TEXT DEFAULT '',
      level TEXT DEFAULT '体验学员',
      remark TEXT DEFAULT '',
      register_date TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS CourseSeries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      source_type TEXT DEFAULT '',
      source_id TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS Certificate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_no TEXT NOT NULL UNIQUE,
      series_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      pdf_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  [
    ['Member', 'status', "TEXT DEFAULT 'active'"],
    ['Member', 'source', "TEXT DEFAULT 'manual'"],
    ['CourseSeries', 'subtitle', "TEXT DEFAULT ''"],
    ['CourseSeries', 'description', "TEXT DEFAULT ''"],
    ['CourseSeries', 'status', "TEXT DEFAULT 'published'"],
    ['CourseSeries', 'source_type', "TEXT DEFAULT ''"],
    ['CourseSeries', 'source_id', "TEXT DEFAULT ''"],
    ['Certificate', 'pdf_url', "TEXT DEFAULT ''"],
    ['Certificate', 'status', "TEXT DEFAULT 'active'"],
  ].forEach(([table, column, ddl]) => ensureColumn(db, table, column, ddl));
}

if (!fs.existsSync(sourcePdf)) {
  throw new Error(`Source PDF not found: ${sourcePdf}`);
}

fs.mkdirSync(outputDir, { recursive: true });
execFileSync('pdfseparate', [
  sourcePdf,
  path.join(outputDir, 'SWOD-20260530-%02d.pdf'),
], { stdio: 'inherit' });

const db = new Database(dbPath);
ensureTables(db);

const series = db.prepare('SELECT id FROM CourseSeries WHERE (source_type = ? AND source_id = ?) OR name = ? ORDER BY id LIMIT 1')
  .get('certificate-import', 'SWOD-20260530', seriesName);
const seriesId = series?.id || db.prepare(`
  INSERT INTO CourseSeries (name, subtitle, description, price, status, source_type, source_id, updated_at)
  VALUES (?, '第五届国际门徒班（基础进阶级）', ?, 0, 'published', 'certificate-import', 'SWOD-20260530', datetime('now','localtime'))
`).run(seriesName, description).lastInsertRowid;

const findMember = db.prepare('SELECT id FROM Member WHERE name = ? ORDER BY id LIMIT 1');
const createMember = db.prepare(`
  INSERT INTO Member (name, phone, gender, level, remark, register_date, status, source)
  VALUES (?, NULL, '女', '体验学员', ?, ?, 'active', 'certificate-import')
`);
const findCertificate = db.prepare('SELECT id FROM Certificate WHERE certificate_no = ? LIMIT 1');
const insertCertificate = db.prepare(`
  INSERT INTO Certificate (certificate_no, series_id, member_id, issue_date, pdf_url, status)
  VALUES (?, ?, ?, ?, ?, 'active')
`);
const updateCertificate = db.prepare(`
  UPDATE Certificate
  SET series_id = ?, member_id = ?, issue_date = ?, pdf_url = ?, status = 'active'
  WHERE id = ?
`);

const importOne = db.transaction((cert) => {
  const member = findMember.get(cert.name);
  const memberId = member?.id || createMember.run(cert.name, `由SWOD证书导入，英文名：${cert.englishName}`, issueDate).lastInsertRowid;
  const no = certificateNo(cert.page);
  const pdfUrl = `/uploads/certificates/swod-20260530/SWOD-20260530-${String(cert.page).padStart(2, '0')}.pdf`;
  const existing = findCertificate.get(no);
  if (existing) {
    updateCertificate.run(seriesId, memberId, issueDate, pdfUrl, existing.id);
    return 'updated';
  }
  insertCertificate.run(no, seriesId, memberId, issueDate, pdfUrl);
  return 'inserted';
});

const summary = certificates.reduce((acc, cert) => {
  acc[importOne(cert)] += 1;
  return acc;
}, { inserted: 0, updated: 0 });

console.log(JSON.stringify({
  dbPath,
  outputDir,
  seriesId,
  total: certificates.length,
  inserted: summary.inserted,
  updated: summary.updated,
}, null, 2));
