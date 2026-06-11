const path = require('path');
const { createRequire } = require('module');

const rootDir = __dirname;
const adminDbPath = path.join(rootDir, '10-统一平台admin-platform', 'admin.db');
const sourceServerDir = path.join(rootDir, '03-学员管理系统', '学员管理系统', 'server');
const sourceDbPath = path.join(sourceServerDir, 'dance.db');
const serverRequire = createRequire(path.join(sourceServerDir, 'package.json'));
const Database = serverRequire('better-sqlite3');

const adminDb = new Database(adminDbPath);
const sourceDb = new Database(sourceDbPath, { readonly: true });

adminDb.pragma('foreign_keys = ON');
adminDb.prepare('ATTACH DATABASE ? AS source').run(sourceDbPath);

function columns(db, table) {
    return db.prepare(`PRAGMA table_info(${table})`).all().map(col => col.name);
}

function assertSameColumns(table) {
    const adminColumns = columns(adminDb, table);
    const sourceColumns = columns(sourceDb, table);
    const missingInAdmin = sourceColumns.filter(col => !adminColumns.includes(col));
    const missingInSource = adminColumns.filter(col => !sourceColumns.includes(col));

    if (missingInAdmin.length || missingInSource.length) {
        throw new Error(`${table} columns differ. missingInAdmin=${missingInAdmin.join(',')} missingInSource=${missingInSource.join(',')}`);
    }

    return adminColumns;
}

function insertRow(table, cols, row) {
    const names = cols.join(', ');
    const params = cols.map(col => `@${col}`).join(', ');
    return adminDb.prepare(`INSERT INTO ${table} (${names}) VALUES (${params})`).run(row);
}

function insertMissingById(table, rows, insertedLabels) {
    const cols = assertSameColumns(table);
    const exists = adminDb.prepare(`SELECT 1 FROM ${table} WHERE id = ?`);
    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
        if (exists.get(row.id)) {
            skipped += 1;
            continue;
        }
        insertRow(table, cols, row);
        inserted += 1;
        if (insertedLabels) insertedLabels.push(row.id);
    }

    return { inserted, skipped };
}

function count(table) {
    return adminDb.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

function paymentTotal() {
    return adminDb.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM Payment').get().total;
}

function verifyExactCount(table, expected) {
    const actual = count(table);
    if (actual !== expected) {
        throw new Error(`${table} count expected ${expected}, got ${actual}`);
    }
}

function verifySourceRowsExist(table, ids) {
    const stmt = adminDb.prepare(`SELECT 1 FROM ${table} WHERE id = ?`);
    const missing = ids.filter(id => !stmt.get(id));
    if (missing.length) {
        throw new Error(`${table} missing expected IDs: ${missing.join(', ')}`);
    }
}

const before = {
    Member: count('Member'),
    Course: count('Course'),
    Payment: count('Payment'),
    ConsumeRecord: count('ConsumeRecord'),
    OperationLog: count('OperationLog'),
    OnlineCourse: count('OnlineCourse'),
    paymentTotal: paymentTotal()
};

const result = adminDb.transaction(() => {
    const insertedCourseIds = [];
    const insertedPaymentIds = [];
    const insertedLogIds = [];

    const newCourses = sourceDb.prepare('SELECT * FROM Course WHERE id BETWEEN 60 AND 63 ORDER BY id').all();
    const courseResult = insertMissingById('Course', newCourses, insertedCourseIds);

    const newPayments = sourceDb.prepare('SELECT * FROM Payment WHERE id BETWEEN 27 AND 33 ORDER BY id').all();
    const paymentResult = insertMissingById('Payment', newPayments, insertedPaymentIds);

    const sourceConsumeCount = sourceDb.prepare('SELECT COUNT(*) AS count FROM ConsumeRecord').get().count;
    const existingConsumeIds = adminDb.prepare(`
        SELECT COUNT(*) AS count
        FROM source.ConsumeRecord s
        JOIN ConsumeRecord a ON a.id = s.id
    `).get().count;
    const contentDiffCount = adminDb.prepare(`
        SELECT COUNT(*) AS count
        FROM ConsumeRecord a
        JOIN source.ConsumeRecord s ON s.id = a.id
        WHERE COALESCE(a.memberId, '') != COALESCE(s.memberId, '')
           OR COALESCE(a.memberName, '') != COALESCE(s.memberName, '')
           OR COALESCE(a.courseId, '') != COALESCE(s.courseId, '')
           OR COALESCE(a.courseName, '') != COALESCE(s.courseName, '')
           OR COALESCE(a.count, '') != COALESCE(s.count, '')
           OR COALESCE(a.consumeDate, '') != COALESCE(s.consumeDate, '')
    `).get().count;

    if (existingConsumeIds !== sourceConsumeCount) {
        throw new Error(`ConsumeRecord IDs not fully present: source=${sourceConsumeCount}, existing=${existingConsumeIds}`);
    }

    return {
        course: courseResult,
        payment: paymentResult,
        consumeRecord: { verifiedExistingIds: existingConsumeIds, contentDiffCount },
        operationLog: insertMissingById(
            'OperationLog',
            sourceDb.prepare('SELECT * FROM OperationLog ORDER BY id').all(),
            insertedLogIds
        ),
        insertedCourseIds,
        insertedPaymentIds,
        insertedLogIds
    };
})();

const after = {
    Member: count('Member'),
    Course: count('Course'),
    Payment: count('Payment'),
    ConsumeRecord: count('ConsumeRecord'),
    OperationLog: count('OperationLog'),
    OnlineCourse: count('OnlineCourse'),
    paymentTotal: paymentTotal()
};

verifyExactCount('Member', 273);
verifyExactCount('Course', 13);
verifyExactCount('Payment', 42);
verifyExactCount('ConsumeRecord', 25);
verifyExactCount('OnlineCourse', 222);
if (after.OperationLog < 666) {
    throw new Error(`OperationLog count expected >= 666, got ${after.OperationLog}`);
}
verifySourceRowsExist('Course', [60, 61, 62, 63]);
verifySourceRowsExist('Payment', [27, 28, 29, 30, 31, 32, 33]);
verifySourceRowsExist('OperationLog', Array.from({ length: 156 }, (_, i) => i + 511));

const memberIssues = adminDb.prepare(`
    SELECT COUNT(*) AS count
    FROM Payment p
    LEFT JOIN Member m ON m.id = p.memberId
    WHERE m.id IS NULL
`).get().count;

if (memberIssues !== 0) {
    throw new Error(`Payment rows with missing memberId: ${memberIssues}`);
}

console.log(JSON.stringify({ before, result, after }, null, 2));

adminDb.prepare('DETACH DATABASE source').run();
sourceDb.close();
adminDb.close();
