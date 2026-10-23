type LoginPayloadRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LoginPayloadRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractStudentLoginPayload(payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : root;
  const member = isRecord(data.member)
    ? data.member
    : isRecord(data.user)
      ? data.user
      : data;
  const token = String(data.token || data.accessToken || data.access_token || data.jwt || '').trim();

  return { token, member };
}
