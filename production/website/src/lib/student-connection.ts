export const STUDENT_CONNECTION_TIMEOUT_MS = 15_000;

export type StudentConnectionErrorType = 'network' | 'timeout' | 'http' | 'parse' | 'storage' | 'auth' | 'unknown';

export type StudentConnectionRequestLog = {
  method: string;
  url: string;
  startedAt: string;
  durationMs: number;
  status?: number;
  clientRequestId: string;
  serverRequestId?: string;
  responsePreview?: string;
};

export type StudentConnectionFailure = {
  type: StudentConnectionErrorType;
  code: string;
  title: string;
  message: string;
  requestId: string;
  occurredAt: string;
  logs: StudentConnectionRequestLog[];
  cause?: string;
};

type RequestOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  requestId?: string;
  now?: () => number;
};

const ERROR_COPY: Record<StudentConnectionErrorType, Pick<StudentConnectionFailure, 'code' | 'title' | 'message'>> = {
  network: {
    code: 'PROFILE_NETWORK_001',
    title: '网络连接异常',
    message: '连接个人中心时网络中断，请检查网络后重新连接。',
  },
  timeout: {
    code: 'PROFILE_TIMEOUT_002',
    title: '连接等待超时',
    message: '连接个人中心超过 15 秒仍未完成，请重新连接。',
  },
  http: {
    code: 'PROFILE_HTTP_003',
    title: '个人中心服务暂时异常',
    message: '服务器未能正常返回个人中心数据，请稍后重新连接。',
  },
  parse: {
    code: 'PROFILE_PARSE_004',
    title: '个人中心数据解析失败',
    message: '收到的数据格式异常，请重新连接或联系技术人员。',
  },
  storage: {
    code: 'PROFILE_STORAGE_005',
    title: '浏览器存储不可用',
    message: '浏览器无法读取登录信息，请关闭无痕模式或允许网站存储后重试。',
  },
  auth: {
    code: 'PROFILE_AUTH_006',
    title: '登录状态已失效',
    message: '当前登录状态无效或已过期，请重新登录后进入个人中心。',
  },
  unknown: {
    code: 'PROFILE_UNKNOWN_999',
    title: '个人中心连接失败',
    message: '连接个人中心时遇到未知异常，请重新连接。',
  },
};

export class StudentConnectionError extends Error {
  failure: StudentConnectionFailure;

  constructor(failure: StudentConnectionFailure) {
    super(failure.message);
    this.name = 'StudentConnectionError';
    this.failure = failure;
  }
}

function newRequestId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `profile-${randomId}` : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safePreview(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function responseErrorMessage(responseText: string) {
  try {
    const payload = JSON.parse(responseText) as Record<string, unknown>;
    const value = payload?.message ?? payload?.error;
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 160);
  } catch {
    return '';
  }
}

function serverRequestId(response: Response) {
  return response.headers.get('x-request-id')
    || response.headers.get('x-correlation-id')
    || response.headers.get('trace-id')
    || undefined;
}

function createFailure(
  type: StudentConnectionErrorType,
  requestId: string,
  logs: StudentConnectionRequestLog[],
  cause?: string,
  overrides: Partial<Pick<StudentConnectionFailure, 'code' | 'message'>> = {},
): StudentConnectionFailure {
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

export async function requestStudentJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const requestId = options.requestId || newRequestId();
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? STUDENT_CONNECTION_TIMEOUT_MS;
  const now = options.now || Date.now;
  const started = now();
  const startedAt = new Date().toISOString();
  const method = String(init.method || 'GET').toUpperCase();
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const baseLog: StudentConnectionRequestLog = {
    method,
    url,
    startedAt,
    durationMs: 0,
    clientRequestId: requestId,
  };

  try {
    const headers = new Headers(init.headers);
    headers.set('X-Client-Request-Id', requestId);
    const request = fetchImpl(url, { ...init, headers, signal: controller.signal });
    const timeoutRequest = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        const log = { ...baseLog, durationMs: Math.max(0, now() - started) };
        reject(new StudentConnectionError(createFailure(
          'timeout', requestId, [log], `Hard timeout after ${timeoutMs}ms`,
        )));
      }, timeoutMs);
    });
    // Some older iOS WeChat WebViews do not reliably reject fetch after
    // AbortController.abort(). Promise.race guarantees that the UI can still
    // leave its loading state when that browser bug occurs.
    const response = await Promise.race([request, timeoutRequest]);
    const log: StudentConnectionRequestLog = {
      ...baseLog,
      durationMs: Math.max(0, now() - started),
      status: response.status,
      serverRequestId: serverRequestId(response),
    };
    let responseText = '';
    try {
      // Keep the same hard deadline while the body is being read. A few
      // WebViews resolve fetch after headers arrive but can still hang forever
      // while consuming an interrupted response body.
      responseText = await Promise.race([response.text(), timeoutRequest]);
      log.responsePreview = safePreview(responseText);
    } catch (error) {
      if (error instanceof StudentConnectionError) throw error;
      throw new StudentConnectionError(createFailure(
        'parse', requestId, [log], error instanceof Error ? error.message : String(error),
      ));
    }

    if (!response.ok) {
      const type: StudentConnectionErrorType = response.status === 401 || response.status === 403 ? 'auth' : 'http';
      // 4xx responses describe an action the learner can correct (for example,
      // an expired verification code). Surface that message instead of
      // incorrectly presenting every rejected request as a server outage.
      // Keep 5xx responses generic so internal database errors are not exposed.
      const actionableMessage = type === 'http' && response.status >= 400 && response.status < 500
        ? responseErrorMessage(responseText)
        : '';
      throw new StudentConnectionError(createFailure(
        type,
        requestId,
        [log],
        `HTTP ${response.status}`,
        {
          code: type === 'auth' ? `PROFILE_AUTH_${response.status}` : `PROFILE_HTTP_${response.status}`,
          ...(actionableMessage ? { message: actionableMessage } : {}),
        },
      ));
    }

    if (!responseText) return null as T;
    try {
      const payload = JSON.parse(responseText);
      if (payload?.success === false) {
        const actionableMessage = responseErrorMessage(responseText);
        throw new StudentConnectionError(createFailure(
          'http', requestId, [log], String(payload?.message || payload?.error || '接口返回 success=false'),
          actionableMessage ? { message: actionableMessage } : {},
        ));
      }
      return payload as T;
    } catch (error) {
      if (error instanceof StudentConnectionError) throw error;
      throw new StudentConnectionError(createFailure(
        'parse', requestId, [log], error instanceof Error ? error.message : String(error),
      ));
    }
  } catch (error) {
    if (error instanceof StudentConnectionError) throw error;
    const log = { ...baseLog, durationMs: Math.max(0, now() - started) };
    const cause = error instanceof Error ? error.message : String(error);
    if (timedOut) throw new StudentConnectionError(createFailure('timeout', requestId, [log], cause));
    throw new StudentConnectionError(createFailure('network', requestId, [log], cause));
  } finally {
    if (timeout) clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function createStudentConnectionTimeoutFailure(
  url = '/dashboard/profile',
  timeoutMs = STUDENT_CONNECTION_TIMEOUT_MS,
): StudentConnectionFailure {
  const requestId = newRequestId();
  const startedAt = new Date(Date.now() - timeoutMs).toISOString();
  return createFailure('timeout', requestId, [{
    method: 'PROFILE_BOOTSTRAP',
    url,
    startedAt,
    durationMs: timeoutMs,
    clientRequestId: requestId,
  }], `Profile bootstrap hard timeout after ${timeoutMs}ms`);
}

export function normalizeStudentConnectionFailure(error: unknown): StudentConnectionFailure {
  if (error instanceof StudentConnectionError) return error.failure;
  const requestId = newRequestId();
  const cause = error instanceof Error ? error.message : String(error);
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return createFailure('storage', requestId, [], cause);
  }
  return createFailure('unknown', requestId, [], cause);
}

export function buildStudentConnectionDiagnostics(
  failure: StudentConnectionFailure,
  context: { memberId?: string; pageUrl?: string } = {},
) {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const environment = {
    pageUrl: context.pageUrl || (typeof window === 'undefined' ? '' : window.location.href),
    memberId: context.memberId || 'unknown',
    online: nav?.onLine ?? 'unknown',
    userAgent: nav?.userAgent || 'unknown',
    language: nav?.language || 'unknown',
    platform: nav?.platform || 'unknown',
    viewport: typeof window === 'undefined' ? 'unknown' : `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
  };
  return [
    '个人中心连接排查信息',
    `错误类型: ${failure.type}`,
    `错误编码: ${failure.code}`,
    `请求ID: ${failure.requestId}`,
    `发生时间: ${failure.occurredAt}`,
    `错误原因: ${failure.cause || failure.message}`,
    `用户端环境: ${JSON.stringify(environment)}`,
    `接口请求日志: ${JSON.stringify(failure.logs)}`,
  ].join('\n');
}
