import { cleanText, jsonError, withDb } from '../_helpers';
import { apiErrorMessage } from '@/lib/data-shape';
import { devWarn } from '@/lib/logger';

const rateLimitMap = new Map<string, number>();
const PHONE_COOLDOWN_MS = 60_000;
const MAX_PER_IP = 5;

function clientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(phone: string, ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const lastPhoneSend = rateLimitMap.get(`phone:${phone}`) || 0;
  if (now - lastPhoneSend < PHONE_COOLDOWN_MS) {
    return { allowed: false, error: '发送太频繁，请60秒后再试' };
  }

  const ipPrefix = `ip:${ip}:`;
  const ipCount = Array.from(rateLimitMap.entries())
    .filter(([key, time]) => key.startsWith(ipPrefix) && now - time < PHONE_COOLDOWN_MS)
    .length;
  if (ipCount >= MAX_PER_IP) {
    return { allowed: false, error: '发送太频繁，请60秒后再试' };
  }

  rateLimitMap.set(`phone:${phone}`, now);
  rateLimitMap.set(`${ipPrefix}${now}`, now);
  if (rateLimitMap.size > 1000) {
    for (const [key, time] of Array.from(rateLimitMap.entries())) {
      if (now - time > PHONE_COOLDOWN_MS) rateLimitMap.delete(key);
    }
  }
  return { allowed: true };
}

function codeForEnv() {
  if (process.env.MINI_LOGIN_DEV_CODE) return process.env.MINI_LOGIN_DEV_CODE;
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendSms(phone: string, code: string): Promise<boolean> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || '东方舞圈平台';
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_505940264';
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    devWarn(`[mini/send-code] SMS unavailable, code for ${phone}: ${code}`);
    return false;
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
    
    await new Promise<void>((resolve, reject) => {
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
              resolve();
            } else {
              devWarn('[mini/send-code] SMS API error:', result.Message || data);
              reject(new Error(result.Message));
            }
          } catch {
            devWarn('[mini/send-code] SMS response:', data);
            reject(new Error('SMS response parse failed'));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    
    return true;
  } catch (err: unknown) {
    devWarn('[mini/send-code] SMS failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = cleanText(body.phone);
    if (!/^1\d{10}$/.test(phone)) return jsonError('请输入正确的手机号', 400);
    const rateLimit = checkRateLimit(phone, clientIp(request));
    if (!rateLimit.allowed) return jsonError(rateLimit.error || '发送太频繁，请60秒后再试', 429);
    const code = codeForEnv();
    const smsSent = await sendSms(phone, code);
    if (!smsSent && process.env.NODE_ENV === 'production') {
      return jsonError('短信服务未配置或发送失败，请联系管理员', 503);
    }

    return withDb((db) => {
      db.prepare("UPDATE MiniSmsCode SET used=1 WHERE phone=? AND used=0").run(phone);
      db.prepare(
        `INSERT INTO MiniSmsCode (phone, code, expires_at, used, created_at)
         VALUES (?, ?, datetime('now','localtime','+5 minutes'), 0, datetime('now','localtime'))`
      ).run(phone, code);
      return Response.json({
        success: true,
        message: smsSent ? '验证码已发送' : '本地预览验证码已生成',
        smsSent,
        ...(smsSent || process.env.NODE_ENV === 'production' ? {} : { devCode: code }),
      });
    });
  } catch (err: unknown) {
    return jsonError(apiErrorMessage(err));
  }
}
