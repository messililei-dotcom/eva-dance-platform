export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function pickData<T>(payload: unknown, fallback: T): T {
  if (!isRecord(payload) || !('data' in payload)) return fallback;
  return payload.data as T;
}

export function pickArray<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!isRecord(payload)) return [];

  for (const key of ['data', 'rows', 'list', 'items', 'products'] as const) {
    const value = payload[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

export type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
};

export function apiErrorMessage(error: unknown, fallback = '操作失败') {
  if (!isRecord(error)) return fallback;
  const response = isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  const message = data?.message || data?.error || error.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
