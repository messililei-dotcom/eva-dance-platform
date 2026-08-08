BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS WechatIdentity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  app_id TEXT NOT NULL,
  openid TEXT NOT NULL,
  unionid TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '',
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS WechatIdentityAudit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL DEFAULT 0,
  related_member_id INTEGER NOT NULL DEFAULT 0,
  action TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  app_id TEXT NOT NULL DEFAULT '',
  openid_suffix TEXT NOT NULL DEFAULT '',
  unionid_suffix TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wechat_identity_app_openid
  ON WechatIdentity(app_id, openid);
CREATE INDEX IF NOT EXISTS idx_wechat_identity_unionid
  ON WechatIdentity(unionid)
  WHERE unionid <> '';
CREATE INDEX IF NOT EXISTS idx_wechat_identity_member
  ON WechatIdentity(member_id, channel, app_id);
CREATE INDEX IF NOT EXISTS idx_wechat_identity_audit_member
  ON WechatIdentityAudit(member_id, created_at);

COMMIT;
