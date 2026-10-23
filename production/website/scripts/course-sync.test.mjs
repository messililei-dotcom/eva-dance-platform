import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCourseSyncDiagnostics,
  CourseSyncError,
  syncCourseData,
} from '../src/lib/course-sync.ts';

const noStorage = null;

async function expectFailure(run, type, code) {
  await assert.rejects(run, error => {
    assert.ok(error instanceof CourseSyncError);
    assert.equal(error.failure.type, type);
    assert.equal(error.failure.code, code);
    assert.ok(error.failure.requestId.startsWith('web-'));
    return true;
  });
}

test('网络中断会生成网络错误与请求日志', async () => {
  await expectFailure(
    () => syncCourseData('/api/courses/1', {
      storage: noStorage,
      fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
    }),
    'network',
    'COURSE_SYNC_NETWORK_001',
  );
});

test('悬挂请求超过阈值会被中止并生成超时错误', async () => {
  const hangingFetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  await expectFailure(
    () => syncCourseData('/api/courses/1', {
      storage: noStorage,
      timeoutMs: 20,
      fetchImpl: hangingFetch,
    }),
    'timeout',
    'COURSE_SYNC_TIMEOUT_002',
  );
});

test('异常状态码会保留 HTTP 状态、服务端请求 ID 和响应摘要', async () => {
  await assert.rejects(
    () => syncCourseData('/api/courses/1', {
      storage: noStorage,
      fetchImpl: async () => new Response('{"message":"服务不可用"}', {
        status: 503,
        headers: { 'x-request-id': 'server-trace-503' },
      }),
    }),
    error => {
      assert.equal(error.failure.type, 'http');
      assert.equal(error.failure.code, 'COURSE_SYNC_HTTP_503');
      assert.equal(error.failure.logs[0].status, 503);
      assert.equal(error.failure.logs[0].serverRequestId, 'server-trace-503');
      assert.match(error.failure.logs[0].responsePreview, /服务不可用/);
      return true;
    },
  );
});

test('无法解析的响应会生成数据解析错误', async () => {
  await expectFailure(
    () => syncCourseData('/api/courses/1', {
      storage: noStorage,
      fetchImpl: async () => new Response('<html>bad gateway</html>', { status: 200 }),
    }),
    'parse',
    'COURSE_SYNC_PARSE_004',
  );
});

test('本地存储权限不足会在发起接口请求前终止', async () => {
  let requested = false;
  const deniedStorage = {
    setItem() { throw new DOMException('Access denied', 'SecurityError'); },
    removeItem() {},
  };
  await expectFailure(
    () => syncCourseData('/api/courses/1', {
      storage: deniedStorage,
      fetchImpl: async () => {
        requested = true;
        return new Response('{}');
      },
    }),
    'storage',
    'COURSE_SYNC_STORAGE_005',
  );
  assert.equal(requested, false);
});

test('排查文本包含错误类型、接口日志和用户端环境', async () => {
  let failure;
  try {
    await syncCourseData('/api/courses/128', {
      storage: noStorage,
      fetchImpl: async () => new Response('bad json'),
    });
  } catch (error) {
    failure = error.failure;
  }
  const diagnostics = buildCourseSyncDiagnostics(failure, {
    courseId: '128',
    pageUrl: 'https://www.swod.com.cn/courses/128/videos',
  });
  assert.match(diagnostics, /错误类型: parse/);
  assert.match(diagnostics, /错误编码: COURSE_SYNC_PARSE_004/);
  assert.match(diagnostics, /请求ID: web-/);
  assert.match(diagnostics, /用户端环境:/);
  assert.match(diagnostics, /接口请求日志:/);
  assert.match(diagnostics, /courses\/128/);
});

test('失败后重新调用同步流程可以成功返回课程数据', async () => {
  let attempt = 0;
  const fetchImpl = async () => {
    attempt += 1;
    if (attempt === 1) throw new TypeError('connection reset');
    return new Response('{"success":true,"data":{"id":"128","name":"东方舞技巧大全"}}');
  };
  await assert.rejects(() => syncCourseData('/api/courses/128', { storage: noStorage, fetchImpl }));
  const course = await syncCourseData('/api/courses/128', { storage: noStorage, fetchImpl });
  assert.deepEqual(course, { id: '128', name: '东方舞技巧大全' });
  assert.equal(attempt, 2);
});
