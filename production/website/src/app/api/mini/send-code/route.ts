import { jsonError, normalizeInternationalPhone, withDb } from '../_helpers';
import { apiErrorMessage } from '@/lib/data-shape';
import { isSmsProviderRateLimitCode, SmsRateLimiter } from '@/lib/sms-verification';

type SmsDeliveryResult =
  | { ok: true }
  | { ok: false; providerCode: string; providerMessage: string };

const globalSmsState = globalThis as typeof globalThis & {
  __websiteSmsRateLimiter?: SmsRateLimiter;
};
const smsRateLimiter = globalSmsState.__websiteSmsRateLimiter ||= new SmsRateLimiter();

function codeForEnv() {
  if (process.env.MINI_LOGIN_DEV_CODE) return process.env.MINI_LOGIN_DEV_CODE;
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskedPhone(phone: string) {
  if (phone.length < 7) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function logSmsFailure(requestId: string, phone: string, providerCode: string, providerMessage: string) {
  console.error(JSON.stringify({
    event: 'sms_send_failed',
    requestId,
    phone: maskedPhone(phone),
    providerCode,
    providerMessage,
  }));
}

function smsErrorResponse(message: string, status: number, code: string, retryAfter?: number) {
  return Response.json(
    { success: false, message, code, ...(retryAfter ? { retryAfter } : {}) },
    { status, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined },
  );
}

async function sendSms(phone: string, code: string): Promise<SmsDeliveryResult> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '湖南雷震子咨询';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_505940264';
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return { ok: false, providerCode: 'SMS_CONFIG_MISSING', providerMessage: '短信服务配置不完整' };
  }

  try {
    // 使用阿里云短信API直调（避免SDK兼容问题）
    const crypto = require('crypto');
    
    // 构造请求参数
    const params: Record<string, string> = {
      Action: 'SendSms',
      Version: '2017-05-25',
      PhoneNumbers: phone,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ code }),
      RegionId: 'cn-hangzhou',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: String(Date.now()) + String(Math.random()),
      AccessKeyId: accessKeyId,
      Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
    };

    // 按字典序排序参数
    const sortedKeys = Object.keys(params).sort();
    
    // 构造待签名字符串
    let canonicalizedQuery = '';
    for (const key of sortedKeys) {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(params[key]);
      canonicalizedQuery += '&' + encodedKey + '=' + encodedValue;
    }
    canonicalizedQuery = canonicalizedQuery.slice(1);
    
    const stringToSign = 'POST&' + encodeURIComponent('/') + '&' + encodeURIComponent(canonicalizedQuery);
    
    // 计算签名
    const signature = crypto.createHmac('sha1', accessKeySecret + '&')
      .update(stringToSign)
      .digest('base64');
    
    params.Signature = signature;

    // 发送HTTP请求
    const https = require('https');
    const body = new URLSearchParams(params).toString();
    
    const providerResult = await new Promise<SmsDeliveryResult>((resolve) => {
      const req = https.request({
        hostname: 'dysmsapi.aliyuncs.com',
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.Code === 'OK') {
              resolve({ ok: true });
            } else {
              resolve({
                ok: false,
                providerCode: String(result.Code || 'SMS_PROVIDER_ERROR'),
                providerMessage: String(result.Message || '短信平台返回异常'),
              });
            }
          } catch {
            resolve({
              ok: false,
              providerCode: 'SMS_RESPONSE_PARSE_FAILED',
              providerMessage: '短信平台响应无法解析',
            });
          }
        });
      });
      req.on('error', (error: Error) => resolve({
        ok: false,
        providerCode: 'SMS_NETWORK_ERROR',
        providerMessage: error.message,
      }));
      req.write(body);
      req.end();
    });

    return providerResult;
  } catch (err: unknown) {
    return {
      ok: false,
      providerCode: 'SMS_UNEXPECTED_ERROR',
      providerMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let normalized;
    try {
      normalized = normalizeInternationalPhone(body.phone, body.countryCode);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : '请输入正确的手机号', 400);
    }
    const phone = normalized.phone;
    const requestId = request.headers.get('x-client-request-id') || crypto.randomUUID();
    const persistedRetryAfter = withDb((db) => {
      const recent = db.prepare(
        `SELECT CAST(MAX(0, 60 - (julianday('now','localtime') - julianday(created_at)) * 86400) AS INTEGER) AS retry_after
         FROM MiniSmsCode
         WHERE phone=? AND created_at > datetime('now','localtime','-60 seconds')`
      ).get<{ retry_after?: number }>(phone);
      return Number(recent?.retry_after || 0);
    });
    if (persistedRetryAfter > 0) {
      return smsErrorResponse('操作过于频繁，请稍后重试', 429, 'SMS_RATE_LIMIT', persistedRetryAfter);
    }
    const rateLimit = smsRateLimiter.acquire(phone);
    if (!rateLimit.allowed) {
      return smsErrorResponse('操作过于频繁，请稍后重试', 429, 'SMS_RATE_LIMIT', rateLimit.retryAfter);
    }

    const code = codeForEnv();
    const delivery = await sendSms(phone, code);
    if (!delivery.ok) {
      logSmsFailure(requestId, phone, delivery.providerCode, delivery.providerMessage);
      if (isSmsProviderRateLimitCode(delivery.providerCode)) {
        return smsErrorResponse('操作过于频繁，请稍后重试', 429, 'SMS_RATE_LIMIT', 60);
      }
      smsRateLimiter.release(phone);
      if (process.env.NODE_ENV === 'production') {
        return smsErrorResponse('验证码发送失败，请稍后重试', 503, 'SMS_PROVIDER_ERROR');
      }
    }

    return withDb((db) => {
      db.prepare("UPDATE MiniSmsCode SET used=1 WHERE phone=? AND used=0").run(phone);
      db.prepare(
        `INSERT INTO MiniSmsCode (phone, code, expires_at, used, created_at)
         VALUES (?, ?, datetime('now','localtime','+5 minutes'), 0, datetime('now','localtime'))`
      ).run(phone, code);
      return Response.json({
        success: true,
        message: delivery.ok ? '验证码已发送' : '本地预览验证码已生成',
        smsSent: delivery.ok,
        ...(delivery.ok ? {} : { devCode: code }),
      });
    });
  } catch (err: unknown) {
    return jsonError(apiErrorMessage(err));
  }
}
