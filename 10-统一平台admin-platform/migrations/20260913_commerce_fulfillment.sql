CREATE TABLE IF NOT EXISTS CommerceProductFulfillment (
 product_id TEXT PRIMARY KEY REFERENCES CommerceProduct(id),
 series_id INTEGER, course_id INTEGER, current_session_id INTEGER,
 sessions_count INTEGER NOT NULL DEFAULT 1 CHECK(sessions_count>0),
 access_days INTEGER NOT NULL DEFAULT 0 CHECK(access_days>=0)
);
CREATE TABLE IF NOT EXISTS CommerceDelivery (
 order_id TEXT PRIMARY KEY REFERENCES CommerceOrder(id),
 contact_name TEXT NOT NULL, contact_phone TEXT NOT NULL, contact_address TEXT NOT NULL,
 series_id INTEGER, course_id INTEGER, session_id INTEGER,
 sessions_count INTEGER NOT NULL DEFAULT 1, access_days INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK(state IN ('awaiting_payment','pending','authorized','booked','awaiting_shipment','shipped','needs_support','refund_review')),
 authorization_id INTEGER, enrollment_id INTEGER, entitlement_id INTEGER, booking_id INTEGER,
 carrier TEXT, tracking_no TEXT, shipped_at TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CommerceRescheduleRequest (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES CommerceOrder(id),
 member_id INTEGER NOT NULL, message TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_one_pending_reschedule ON CommerceRescheduleRequest(order_id) WHERE status='pending';
