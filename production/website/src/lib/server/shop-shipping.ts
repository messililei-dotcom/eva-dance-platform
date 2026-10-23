import { createHash } from 'node:crypto';
import type { AdminDb } from './admin-db';
import { ShopError } from './shop-core';
function ensureShipping(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS shop_member_shipping (
    member_id INTEGER PRIMARY KEY, recipient TEXT NOT NULL, phone TEXT NOT NULL,
    address_hash TEXT NOT NULL, updated_at INTEGER NOT NULL
  )`);
}
export function getShipping(db: AdminDb, memberId: number) {
  ensureShipping(db);
  const member = db.prepare('SELECT name,phone,province,city,address FROM Member WHERE id=?').get<any>(memberId);
  if (!member) throw new ShopError('请重新登录',401);
  const saved = db.prepare('SELECT recipient,phone,address_hash FROM shop_member_shipping WHERE member_id=?').get<any>(memberId);
  let address = String(member.address || '').trim();
  // An empty personal address is not a usable delivery address.
  if (address && saved?.address_hash !== createHash('sha256').update(address).digest('hex')) {
    const prefix = [member.province,member.city].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join('');
    if (prefix && !address.startsWith(String(member.province || member.city || ''))) address = prefix + address;
  }
  return {recipient: saved?.recipient || member.name || '', phone: saved?.phone || member.phone || '', address};
}
export function saveShipping(db: AdminDb, memberId: number, input: any) {
  const recipient = String(input.recipient || '').trim();
  const phone = String(input.phone || '').trim();
  const address = String(input.address || '').trim();
  if (!recipient || recipient.length>40) throw new ShopError('请填写正确的收件人');
  if (!/^\+?[\d -]{7,25}$/.test(phone)) throw new ShopError('请填写正确的收件手机号');
  if (address.length<8 || address.length>300) throw new ShopError('请填写省、市、区及街道门牌号');
  ensureShipping(db);
  return db.transaction(() => {
    if (!db.prepare('SELECT id FROM Member WHERE id=?').get(memberId)) throw new ShopError('请重新登录',401);
    // Member.address remains the single source used by both personal centers.
    db.prepare('UPDATE Member SET address=? WHERE id=?').run(address,memberId);
    db.prepare(`INSERT INTO shop_member_shipping(member_id,recipient,phone,address_hash,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(member_id) DO UPDATE SET recipient=excluded.recipient,phone=excluded.phone,address_hash=excluded.address_hash,updated_at=excluded.updated_at`).run(memberId,recipient,phone,createHash('sha256').update(address).digest('hex'),Date.now());
    return {recipient,phone,address};
  })();
}
