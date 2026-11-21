import { createHash, randomBytes } from 'node:crypto';
import { formatMemberPhoneForDisplay } from '@/lib/member-phone-display';
import { normalizeEventPhone } from '@/lib/event-phone';
import type { AdminDb } from '@/lib/server/admin-db';
import { findPhoneMembers } from '@/lib/server/event-phone-member';
import { ensureWechatIdentityTables } from '@/lib/server/wechat-identity';
import { normalizePhoneIdentity, normalizedPhoneSql } from '../../../course/series/[id]/_authorization';
import { POST as sendCode } from '../../send-code/route';
import { canonicalMember, loginData, mergeConfirmedProfilePhone } from '../../_auth';
import { cleanText, getMemberId, jsonError, memberAccountAvailable, withDb } from '../../_helpers';

type Member = Record<string, any> & { id: number };
const conflictMessage = '该手机号已绑定其他账号，请使用其他号码或联系客服';
const headers = { 'Cache-Control': 'private, no-store' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function ensureMergeTable(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS MiniProfilePhoneMerge (
    member_id INTEGER PRIMARY KEY, target_id INTEGER NOT NULL, phone TEXT NOT NULL, country_code TEXT NOT NULL,
    token_hash TEXT NOT NULL, session_hash TEXT NOT NULL, expires_at_ms INTEGER NOT NULL
  )`);
}

function mergeTarget(db: AdminDb, member: Member, owners: Member[]) {
  const target = owners[0];
  if (owners.length !== 1 || !target || target.id === member.id || cleanText(member.phone) || cleanText(member.phone_national_number)
    || canonicalMember(db, target)?.id !== target.id || !memberAccountAvailable(db, target.id)) return null;
  ensureWechatIdentityTables(db);
  const hasWechat = (row: Member) => Boolean(cleanText(row.wx_openid) || cleanText(row.wx_unionid)
    || db.prepare('SELECT 1 FROM WechatIdentity WHERE member_id=? LIMIT 1').get(row.id));
  return hasWechat(member) && !hasWechat(target) ? target : null;
}

function decideMerge(db: AdminDb, request: Request, member: Member, body: Record<string, unknown>) {
  const token = cleanText(body.mergeToken);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return jsonError('合并确认已失效，请重新验证手机号', 400);
  ensureMergeTable(db);
  const pending = db.prepare(`SELECT target_id, phone, country_code FROM MiniProfilePhoneMerge
    WHERE member_id=? AND token_hash=? AND session_hash=? AND expires_at_ms>?`)
    .get<{ target_id: number; phone: string; country_code: string }>(member.id, hash(token), hash(request.headers.get('Authorization') || ''), Date.now());
  if (!pending) return jsonError('合并确认已失效，请重新验证手机号', 400);
  db.prepare('DELETE FROM MiniProfilePhoneMerge WHERE member_id=?').run(member.id);
  if (body.action === 'cancel-merge') return Response.json({ success: true, data: { cancelled: true } }, { headers });
  const target = mergeTarget(db, member, findPhoneMembers(db, pending.phone));
  if (!target || target.id !== pending.target_id) return jsonError('账号资料已变化，请重新验证手机号', 409);
  const number = normalizeEventPhone(pending.phone, pending.country_code);
  mergeConfirmedProfilePhone(db, member, target, number.phone);
  db.prepare('UPDATE Member SET phone=?, phone_country_code=?, phone_national_number=? WHERE id=?')
    .run(number.internationalPhone, number.countryCode, number.nationalNumber, target.id);
  db.prepare('DELETE FROM MiniProfilePhoneCode WHERE member_id=?').run(member.id);
  const merged = db.prepare('SELECT * FROM Member WHERE id=?').get<Member>(target.id)!;
  return Response.json({ success: true, data: { ...loginData(merged), merged: true } }, { headers });
}

export async function POST(request: Request) {
  try {
    const memberId = getMemberId(new URL(request.url).searchParams, request);
    if (!memberId) return jsonError('未登录', 401);
    const body = await request.json().catch(() => ({}));
    if (body.action === 'send-code') {
      return sendCode(new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ phone: body.phone, countryCode: body.countryCode, purpose: 'profile-phone' }),
      }));
    }
    if (body.action === 'confirm-merge' || body.action === 'cancel-merge') {
      return withDb(db => db.transaction(() => {
        const member = db.prepare('SELECT * FROM Member WHERE id=?').get<Member>(memberId);
        if (!member || canonicalMember(db, member)?.id !== memberId || !memberAccountAvailable(db, memberId)) {
          return jsonError('账号资料已更新，请重新登录后重试', 409);
        }
        return decideMerge(db, request, member, body);
      }).immediate());
    }
    let number;
    try {
      number = normalizeEventPhone(body.phone, body.countryCode);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '手机号格式错误', 400);
    }
    const { phone, internationalPhone, countryCode, nationalNumber } = number;
    const code = cleanText(body.code);
    if (!/^\d{6}$/.test(code)) return jsonError('请输入六位短信验证码', 400);

    return withDb(db => db.transaction(() => {
      const member = db.prepare('SELECT * FROM Member WHERE id=?').get<Member>(memberId);
      if (!member || canonicalMember(db, member)?.id !== memberId || !memberAccountAvailable(db, memberId)) {
        return jsonError('账号资料已更新，请重新登录后重试', 409);
      }
      const challenge = db.prepare(`SELECT code, attempts FROM MiniProfilePhoneCode
        WHERE member_id=? AND phone=? AND expires_at > datetime('now','localtime')`)
        .get<{ code: string; attempts: number }>(memberId, phone);
      if (!challenge) return jsonError('验证码已过期或号码已更改，请重新获取', 400);
      if (challenge.attempts >= 5) return jsonError('验证码尝试次数过多，请重新获取', 429);
      if (challenge.code !== code) {
        db.prepare('UPDATE MiniProfilePhoneCode SET attempts=attempts+1 WHERE member_id=?').run(memberId);
        return jsonError('验证码错误', 400);
      }
      const owners = findPhoneMembers(db, phone) as Member[];
      if (owners.some(row => row.id !== memberId)) {
        if (body.supportsMerge !== true || request.headers.get('x-client-platform') !== 'miniprogram') return jsonError(conflictMessage, 409);
        const target = mergeTarget(db, member, owners);
        if (!target) return jsonError(conflictMessage, 409);
        ensureMergeTable(db);
        const token = randomBytes(32).toString('base64url');
        const now = Date.now();
        db.prepare('DELETE FROM MiniProfilePhoneMerge WHERE member_id=? OR expires_at_ms<=?').run(memberId, now);
        db.prepare('INSERT INTO MiniProfilePhoneMerge VALUES (?,?,?,?,?,?,?)')
          .run(memberId, target.id, phone, countryCode, hash(token), hash(request.headers.get('Authorization') || ''), now + 5 * 60 * 1000);
        db.prepare('DELETE FROM MiniProfilePhoneCode WHERE member_id=?').run(memberId);
        return Response.json({ success: true, data: { mergeRequired: true, mergeToken: token, phoneSuffix: nationalNumber.slice(-4) } }, { headers });
      }

      db.prepare('UPDATE Member SET phone=?, phone_country_code=?, phone_national_number=? WHERE id=?')
        .run(internationalPhone, countryCode, nationalNumber, memberId);
      const oldPhone = normalizePhoneIdentity(member.phone);
      if (oldPhone && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='CourseAuthorization'").get()) {
        db.prepare(`UPDATE CourseAuthorization SET phone=? WHERE member_id=? AND ${normalizedPhoneSql('phone')}=?`)
          .run(phone, memberId, oldPhone);
      }
      db.prepare('DELETE FROM MiniProfilePhoneCode WHERE member_id=?').run(memberId);
      return Response.json({ success: true, data: { phone: formatMemberPhoneForDisplay(phone, countryCode), countryCode } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }).immediate());
  } catch (error) {
    if ((error as { code?: string } | null)?.code?.startsWith('SQLITE_CONSTRAINT')) {
      return jsonError('账号记录存在冲突，请联系客服核对后合并', 409);
    }
    return jsonError('手机号保存失败，请稍后重试');
  }
}
