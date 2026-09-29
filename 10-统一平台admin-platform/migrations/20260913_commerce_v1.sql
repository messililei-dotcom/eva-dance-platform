-- Explicit migration. Never run migrations from a GET or replace existing orders.
CREATE TABLE IF NOT EXISTS CommerceProduct (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
 price_cent INTEGER NOT NULL CHECK(typeof(price_cent)='integer' AND price_cent>0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','archived')),
 refund_policy TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CommerceOrder (
 id TEXT PRIMARY KEY, member_id INTEGER NOT NULL, member_name TEXT NOT NULL,
 product_id TEXT NOT NULL REFERENCES CommerceProduct(id), title TEXT NOT NULL,
 kind TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 amount_cent INTEGER NOT NULL CHECK(typeof(amount_cent)='integer' AND amount_cent>0),
 refunded_cent INTEGER NOT NULL DEFAULT 0 CHECK(refunded_cent BETWEEN 0 AND amount_cent),
 merchant_name TEXT NOT NULL DEFAULT '伊娃文化公司', refund_policy TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','partial_refunded','refunded','cancelled')),
 fulfillment TEXT NOT NULL DEFAULT 'not_started' CHECK(fulfillment IN ('not_started','pending','completed','review_required')),
 channel TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT,
 expires_at TEXT NOT NULL, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commerce_order_member ON CommerceOrder(member_id,created_at);
CREATE TABLE IF NOT EXISTS CommerceReceipt (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES CommerceOrder(id),
 method TEXT NOT NULL CHECK(method IN ('bank','cash','pos','wechat_offline','alipay_offline','wechat')),
 reference TEXT NOT NULL, amount_cent INTEGER NOT NULL CHECK(typeof(amount_cent)='integer' AND amount_cent>0),
 actor TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(method,reference)
);
CREATE TABLE IF NOT EXISTS CommerceRefund (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES CommerceOrder(id),
 amount_cent INTEGER NOT NULL CHECK(typeof(amount_cent)='integer' AND amount_cent>0),
 reason TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, actor TEXT NOT NULL,
 created_at TEXT NOT NULL, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CommerceLedger (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES CommerceOrder(id),
 event_id TEXT NOT NULL UNIQUE, amount_cent INTEGER NOT NULL CHECK(typeof(amount_cent)='integer'),
 kind TEXT NOT NULL CHECK(kind IN ('receipt','refund')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CommerceAudit (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 details TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CommercePayment (
 order_id TEXT PRIMARY KEY REFERENCES CommerceOrder(id),
 state TEXT NOT NULL CHECK(state IN ('creating','ready','succeeded','unknown')),
 code_url TEXT, created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS commerce_ledger_no_update BEFORE UPDATE ON CommerceLedger BEGIN SELECT RAISE(ABORT,'Ledger is append only'); END;
CREATE TRIGGER IF NOT EXISTS commerce_ledger_no_delete BEFORE DELETE ON CommerceLedger BEGIN SELECT RAISE(ABORT,'Ledger is append only'); END;
CREATE TRIGGER IF NOT EXISTS commerce_audit_no_update BEFORE UPDATE ON CommerceAudit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
CREATE TRIGGER IF NOT EXISTS commerce_audit_no_delete BEFORE DELETE ON CommerceAudit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
