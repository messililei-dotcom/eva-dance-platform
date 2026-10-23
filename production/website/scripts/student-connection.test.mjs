import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudentConnectionDiagnostics,
  normalizeStudentConnectionFailure,
  requestStudentJson,
  StudentConnectionError,
} from '../src/lib/student-connection.ts';

async function expectFailure(run, type, code) {
  await assert.rejects(run, error => {
    assert.ok(error instanceof StudentConnectionError);
    assert.equal(error.failure.type, type);
    assert.equal(error.failure.code, code);
    assert.match(error.failure.requestId, /^profile-/);
    return true;
  });
}

test('网络中断会终止连接并生成网络错误', async () => {
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, {
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }),
    'network',
    'PROFILE_NETWORK_001',
  );
});

test('悬挂请求超过阈值会中止并生成超时错误', async () => {
  const hangingFetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, { timeoutMs: 20, fetchImpl: hangingFetch }),
    'timeout',
    'PROFILE_TIMEOUT_002',
  );
});

test('旧版 iOS WebView 忽略 AbortController 时仍会硬超时', async () => {
  const ignoresAbort = () => new Promise(() => {});
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, { timeoutMs: 20, fetchImpl: ignoresAbort }),
    'timeout',
    'PROFILE_TIMEOUT_002',
  );
});

test('响应头已返回但响应正文永久挂起时仍会硬超时', async () => {
  const hangingBodyFetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: () => new Promise(() => {}),
  });
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, { timeoutMs: 20, fetchImpl: hangingBodyFetch }),
    'timeout',
    'PROFILE_TIMEOUT_002',
  );
});

test('服务器异常会保留状态码、服务端请求ID和响应摘要', async () => {
  await assert.rejects(
    () => requestStudentJson('/api/mini/member/profile', {}, {
      fetchImpl: async () => new Response('{"message":"服务不可用"}', {
        status: 503,
        headers: { 'x-request-id': 'profile-server-503' },
      }),
    }),
    error => {
      assert.equal(error.failure.type, 'http');
      assert.equal(error.failure.code, 'PROFILE_HTTP_503');
      assert.equal(error.failure.logs[0].status, 503);
      assert.equal(error.failure.logs[0].serverRequestId, 'profile-server-503');
      assert.match(error.failure.logs[0].responsePreview, /服务不可用/);
      return true;
    },
  );
});

test('验证码过期时显示接口返回的可操作提示', async () => {
  await assert.rejects(
    () => requestStudentJson('/api/mini/student-login', { method: 'POST' }, {
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        message: '验证码错误或已过期',
      }), { status: 400 }),
    }),
    error => {
      assert.equal(error.failure.type, 'http');
      assert.equal(error.failure.code, 'PROFILE_HTTP_400');
      assert.equal(error.message, '验证码错误或已过期');
      return true;
    },
  );
});

test('5xx 不向学员暴露服务器内部错误', async () => {
  await assert.rejects(
    () => requestStudentJson('/api/mini/student-login', { method: 'POST' }, {
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        message: 'SQLITE_ERROR: no such column',
      }), { status: 500 }),
    }),
    error => {
      assert.equal(error.message, '服务器未能正常返回个人中心数据，请稍后重新连接。');
      return true;
    },
  );
});

test('401 会提示登录状态失效', async () => {
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, {
      fetchImpl: async () => new Response('{"message":"unauthorized"}', { status: 401 }),
    }),
    'auth',
    'PROFILE_AUTH_401',
  );
});

test('无法解析的响应会生成数据解析错误', async () => {
  await expectFailure(
    () => requestStudentJson('/api/mini/member/profile', {}, {
      fetchImpl: async () => new Response('<html>bad gateway</html>'),
    }),
    'parse',
    'PROFILE_PARSE_004',
  );
});

test('本地存储权限异常会被识别为存储错误', () => {
  const failure = normalizeStudentConnectionFailure(new DOMException('Access denied', 'SecurityError'));
  assert.equal(failure.type, 'storage');
  assert.equal(failure.code, 'PROFILE_STORAGE_005');
});

test('排查文本包含错误类型、接口日志和用户端环境', async () => {
  let failure;
  try {
    await requestStudentJson('/api/mini/member/profile?member_id=128', {}, {
      fetchImpl: async () => new Response('bad json'),
    });
  } catch (error) {
    failure = error.failure;
  }
  const diagnostics = buildStudentConnectionDiagnostics(failure, {
    memberId: '128',
    pageUrl: 'https://www.swod.com.cn/dashboard/profile',
  });
  assert.match(diagnostics, /错误类型: parse/);
  assert.match(diagnostics, /错误编码: PROFILE_PARSE_004/);
  assert.match(diagnostics, /请求ID: profile-/);
  assert.match(diagnostics, /用户端环境:/);
  assert.match(diagnostics, /接口请求日志:/);
  assert.match(diagnostics, /member\/profile/);
});

test('失败后重新连接可以成功返回个人中心数据', async () => {
  let attempt = 0;
  const fetchImpl = async () => {
    attempt += 1;
    if (attempt === 1) throw new TypeError('connection reset');
    return new Response('{"success":true,"data":{"id":"128","name":"测试学员"}}');
  };
  await assert.rejects(() => requestStudentJson('/api/mini/member/profile', {}, { fetchImpl }));
  const payload = await requestStudentJson('/api/mini/member/profile', {}, { fetchImpl });
  assert.equal(payload.data.name, '测试学员');
  assert.equal(attempt, 2);
});
