import { createHmac, randomUUID } from 'node:crypto';
import type { PushDelivery } from './app-push';

const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/** Single-device service notifications only; never broadcast or accept a client-supplied target. */
export function notificationParameters(value: PushDelivery) {
  const expected = process.env[`APP_PUSH_${value.platform.toUpperCase()}_APP_KEY`];
  if (!expected || expected !== value.appKey || !/^[A-Za-z0-9_:-]{16,256}$/.test(value.deviceId)) throw new Error('Push target rejected');
  const extra = JSON.stringify({ recipientId: value.recipientId, deliveryId: value.deliveryId });
  const params: Record<string, string> = { AppKey: value.appKey, PushType: 'NOTICE', DeviceType: { ios: 'iOS', android: 'ANDROID', harmony: 'HARMONY' }[value.platform], Target: 'DEVICE', TargetValue: value.deviceId, Title: value.title, Body: value.body, StoreOffline: 'true', JobKey: value.deliveryId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0,32), ExpireTime: new Date(Date.now()+3600000).toISOString().replace(/\.\d{3}Z$/, 'Z') };
  if (value.platform === 'ios') Object.assign(params, { iOSApnsEnv: 'PRODUCT', iOSBadge: String(value.badge), iOSBadgeAutoIncrement: 'false', iOSMusic: 'default', iOSExtParameters: extra, iOSNotificationCollapseId: value.deliveryId });
  if (value.platform === 'android') Object.assign(params, { AndroidOpenType: 'APPLICATION', AndroidNotificationChannel: 'swod_learning', AndroidExtParameters: extra, AndroidNotifyType: 'BOTH', AndroidPopupActivity: 'cn.com.swod.app.PushPopupActivity', AndroidPopupTitle: value.title, AndroidPopupBody: value.body });
  if (value.platform === 'harmony') {
    // Only the audited teaching-reminder scenario may use this service class.
    if (value.harmonyCategory !== 'WORK' || process.env.APP_PUSH_HARMONY_WORK_APPROVED !== 'true') throw new Error('Harmony notification category not approved');
    Object.assign(params, { HarmonyCategory: value.harmonyCategory, HarmonyNotificationSlotType: 'SERVICE_INFORMATION', HarmonyActionType: 'APP_HOME_PAGE', HarmonyExtParameters: extra, HarmonyBadgeSetNum: String(value.badge) });
  }
  return params;
}
export async function sendAliyunPush(value: PushDelivery) {
  const id = process.env.APP_PUSH_ACCESS_KEY_ID, secret = process.env.APP_PUSH_ACCESS_KEY_SECRET;
  if (!id || !secret || process.env.APP_PUSH_ENABLED !== 'true') throw new Error('Push not configured');
  const params: Record<string, string> = { ...notificationParameters(value), Action: 'Push', Version: '2016-08-01', Format: 'JSON', AccessKeyId: id, SignatureMethod: 'HMAC-SHA1', SignatureVersion: '1.0', SignatureNonce: randomUUID(), Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
  const canonical = Object.keys(params).sort().map(k => `${encode(k)}=${encode(params[k])}`).join('&');
  params.Signature = createHmac('sha1', `${secret}&`).update(`POST&%2F&${encode(canonical)}`).digest('base64');
  const response = await fetch('https://cloudpush.aliyuncs.com/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.Code || !result.MessageId) throw new Error('Push delivery outcome unknown');
  return { requestId: String(result.MessageId) };
}
