import assert from 'node:assert/strict';
import test from 'node:test';
import { requestStudentJson } from '../src/lib/student-connection.ts';
import { extractStudentLoginPayload } from '../src/lib/student-login-payload.ts';
import {
  SmsRateLimiter,
  SmsSendGuard,
  isSmsProviderRateLimitCode,
  smsRetryAfterSeconds,
  smsSendErrorMessage,
} from '../src/lib/sms-verification.ts';

test('连续点击获取验证码时只允许第一条请求进入', () => {
  const guard = new SmsSendGuard();
  assert.equal(guard.tryStart(1_000), true);
  assert.equal(guard.tryStart(1_001), false);
});

test('验证码发送成功后执行60秒倒计时', () => {
  const guard = new SmsSendGuard();
  assert.equal(guard.tryStart(1_000), true);
  guard.succeed(2_000);
  assert.equal(guard.remainingSeconds(2_000), 60);
  assert.equal(guard.tryStart(61_999), false);
  assert.equal(guard.tryStart(62_000), true);
});

test('服务端同一手机号限流且发送失败后可释放锁', () => {
  const limiter = new SmsRateLimiter();
  assert.deepEqual(limiter.acquire('13800000000', 1_000), { allowed: true, retryAfter: 0 });
  assert.deepEqual(limiter.acquire('13800000000', 2_000), { allowed: false, retryAfter: 59 });
  limiter.release('13800000000');
  assert.deepEqual(limiter.acquire('13800000000', 2_001), { allowed: true, retryAfter: 0 });
});

test('短信平台限流错误显示为明确的中文提示', () => {
  assert.equal(isSmsProviderRateLimitCode('isv.BUSINESS_LIMIT_CONTROL'), true);
  const error = Object.assign(new Error('个人中心服务暂时异常'), {
    failure: {
      logs: [{
        responsePreview: JSON.stringify({
          success: false,
          code: 'SMS_RATE_LIMIT',
          message: '操作过于频繁，请稍后重试',
          retryAfter: 60,
        }),
      }],
    },
  });
  assert.equal(smsSendErrorMessage(error), '操作过于频繁，请稍后重试');
  assert.equal(smsRetryAfterSeconds(error), 60);

  const guard = new SmsSendGuard();
  assert.equal(guard.tryStart(1_000), true);
  guard.cooldown(smsRetryAfterSeconds(error), 2_000);
  assert.equal(guard.tryStart(61_999), false);
});

test('验证码登录成功响应可正确提取令牌和学员', async () => {
  const payload = await requestStudentJson('/api/mini/student-login', {
    method: 'POST',
  }, {
    fetchImpl: async () => new Response(JSON.stringify({
      success: true,
      data: {
        token: 'signed-student-token',
        member: { id: 930, name: '测试学员', phone: '13800000000' },
      },
    })),
  });
  const login = extractStudentLoginPayload(payload);
  assert.equal(login.token, 'signed-student-token');
  assert.deepEqual(login.member, { id: 930, name: '测试学员', phone: '13800000000' });
});
