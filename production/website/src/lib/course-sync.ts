export const COURSE_SYNC_TIMEOUT_MS = 15_000;

export type CourseSyncErrorType = 'network' | 'timeout' | 'http' | 'parse' | 'storage' | 'unknown';

export type CourseSyncRequestLog = {
  method: 'GET';
  url: string;
  startedAt: string;
  durationMs: number;
  status?: number;
  clientRequestId: string;
  serverRequestId?: string;
  responsePreview?: string;
};

export type CourseSyncFailure = {
  type: CourseSyncErrorType;
  code: string;
  title: string;
  message: string;
  requestId: string;
  occurredAt: string;
  logs: CourseSyncRequestLog[];
  cause?: string;
};

type StorageLike = Pick<Storage, 'setItem' | 'removeItem'>;

type SyncOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  signal?: AbortSignal;
  now?: () => number;
};

const ERROR_COPY: Record<CourseSyncErrorType, Pick<CourseSyncFailure, 'code' | 'title' | 'message'>> = {
  network: {
    code: 'COURSE_SYNC_NETWORK_001',
    title: '网络连接异常',
    message: '课程数据同步时网络连接中断，请检查网络后重新同步。',
  },
  timeout: {
    code: 'COURSE_SYNC_TIMEOUT_002',
    title: '同步等待超时',
    message: '课程数据同步超过 15 秒仍未完成，请重新同步。',
  },
  http: {
    code: 'COURSE_SYNC_HTTP_003',
    title: '课程服务暂时异常',
    message: '服务器未能正常返回课程数据，请稍后重新同步。',
  },
  parse: {
    code: 'COURSE_SYNC_PARSE_004',
    title: '课程数据解析失败',
    message: '收到的课程数据格式异常，请重新同步或联系技术人员。',
  },
  storage: {
    code: 'COURSE_SYNC_STORAGE_005',
    title: '本地存储不可用',
    message: '浏览器无法保存课程同步信息，请关闭无痕模式或允许网站存储后重试。',
  },
  unknown: {
    code: 'COURSE_SYNC_UNKNOWN_999',
    title: '课程同步失败',
    message: '课程数据同步遇到未知异常，请重新同步。',
  },
};

export class CourseSyncError extends Error {
  failure: CourseSyncFailure;

  constructor(failure: CourseSyncFailure) {
    super(failure.message);
    this.name = 'CourseSyncError';
    this.failure = failure;
  }
}

function newRequestId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `web-${randomId}` : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function serverRequestId(response: Response) {
  return response.headers.get('x-request-id')
    || response.headers.get('x-correlation-id')
    || response.headers.get('trace-id')
    || undefined;
}

function safePreview(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function createFailure(
  type: CourseSyncErrorType,
  requestId: string,
  logs: CourseSyncRequestLog[],
  cause?: string,
  overrides: Partial<Pick<CourseSyncFailure, 'code' | 'message'>> = {},
): CourseSyncFailure {
  return {
    type,
    ...ERROR_COPY[type],
    ...overrides,
    requestId,
    occurredAt: new Date().toISOString(),
    logs,
    cause,
  };
}

function resolveBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function verifyStorage(storage: StorageLike | null, requestId: string) {
  if (!storage) return;
  const key = `__course_sync_probe_${requestId}`;
  try {
    storage.setItem(key, '1');
    storage.removeItem(key);
  } catch (error) {
    throw new CourseSyncError(createFailure(
      'storage',
      requestId,
      [],
      error instanceof Error ? error.message : String(error),
    ));
  }
}

export async function syncCourseData<T>(url: string, options: SyncOptions = {}): Promise<T> {
  const requestId = newRequestId();
  let storage: StorageLike | null;
  try {
    storage = options.storage === undefined ? resolveBrowserStorage() : options.storage;
  } catch (error) {
    throw new CourseSyncError(createFailure(
      'storage',
      requestId,
      [],
      error instanceof Error ? error.message : String(error),
    ));
  }
  verifyStorage(storage, requestId);

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? COURSE_SYNC_TIMEOUT_MS;
  const now = options.now || Date.now;
  const started = now();
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const baseLog: CourseSyncRequestLog = {
    method: 'GET',
    url,
    startedAt,
    durationMs: 0,
    clientRequestId: requestId,
  };

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: { 'X-Client-Request-Id': requestId },
      signal: controller.signal,
    });
    const log: CourseSyncRequestLog = {
      ...baseLog,
      durationMs: Math.max(0, now() - started),
      status: response.status,
      serverRequestId: serverRequestId(response),
    };
    let responseText = '';
    try {
      responseText = await response.text();
      log.responsePreview = safePreview(responseText);
    } catch (error) {
      throw new CourseSyncError(createFailure(
        'parse', requestId, [log], error instanceof Error ? error.message : String(error),
      ));
    }

    if (!response.ok) {
      throw new CourseSyncError(createFailure(
        'http',
        requestId,
        [log],
        `HTTP ${response.status}`,
        { code: `COURSE_SYNC_HTTP_${response.status}` },
      ));
    }

    let payload: any;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new CourseSyncError(createFailure(
        'parse', requestId, [log], error instanceof Error ? error.message : String(error),
      ));
    }
    if (payload?.success === false) {
      throw new CourseSyncError(createFailure(
        'http',
        requestId,
        [log],
        String(payload?.message || payload?.error || '接口返回 success=false'),
      ));
    }
    return (payload?.data ?? payload) as T;
  } catch (error) {
    if (error instanceof CourseSyncError) throw error;
    const log = { ...baseLog, durationMs: Math.max(0, now() - started) };
    const cause = error instanceof Error ? error.message : String(error);
    if (timedOut) {
      throw new CourseSyncError(createFailure('timeout', requestId, [log], cause));
    }
    throw new CourseSyncError(createFailure('network', requestId, [log], cause));
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function normalizeCourseSyncFailure(error: unknown): CourseSyncFailure {
  if (error instanceof CourseSyncError) return error.failure;
  const requestId = newRequestId();
  return createFailure('unknown', requestId, [], error instanceof Error ? error.message : String(error));
}

export function buildCourseSyncDiagnostics(
  failure: CourseSyncFailure,
  context: { courseId: string; pageUrl?: string },
) {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const environment = {
    pageUrl: context.pageUrl || (typeof window === 'undefined' ? '' : window.location.href),
    courseId: context.courseId,
    online: nav?.onLine ?? 'unknown',
    userAgent: nav?.userAgent || 'unknown',
    language: nav?.language || 'unknown',
    platform: nav?.platform || 'unknown',
    viewport: typeof window === 'undefined' ? 'unknown' : `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  };
  return [
    '课程数据同步排查信息',
    `错误类型: ${failure.type}`,
    `错误编码: ${failure.code}`,
    `请求ID: ${failure.requestId}`,
    `发生时间: ${failure.occurredAt}`,
    `错误原因: ${failure.cause || failure.message}`,
    `用户端环境: ${JSON.stringify(environment)}`,
    `接口请求日志: ${JSON.stringify(failure.logs)}`,
  ].join('\n');
}
