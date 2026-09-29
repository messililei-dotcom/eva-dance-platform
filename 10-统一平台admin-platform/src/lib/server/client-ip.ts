import net from 'node:net';

const DEFAULT_SERVER_IPS = ['8.138.227.61'];

function configuredServerIps() {
  return new Set([
    ...DEFAULT_SERVER_IPS,
    ...(process.env.SERVER_PUBLIC_IPS || '').split(','),
  ].map(normalizeIp).filter(Boolean));
}

export function normalizeIp(value: unknown) {
  let ip = String(value ?? '').trim().replace(/^"|"$/g, '');
  if (!ip) return '';
  if (ip.toLowerCase().startsWith('for=')) ip = ip.slice(4).trim().replace(/^"|"$/g, '');
  if (ip.startsWith('[')) ip = ip.match(/^\[([^\]]+)\]/)?.[1] || ip;
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, '');
  if (ip.toLowerCase().startsWith('::ffff:')) ip = ip.slice(7);
  const zoneIndex = ip.indexOf('%');
  if (zoneIndex >= 0) ip = ip.slice(0, zoneIndex);
  return net.isIP(ip) ? ip : '';
}

export function isPublicIp(value: unknown) {
  const ip = normalizeIp(value);
  const version = net.isIP(ip);
  if (!version) return false;
  if (version === 6) {
    const lower = ip.toLowerCase();
    return !(
      lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') ||
      lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')
    );
  }
  const [a, b] = ip.split('.').map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isServerIp(value: unknown) {
  const ip = normalizeIp(value);
  return Boolean(ip && configuredServerIps().has(ip));
}

function usableClientIp(value: unknown) {
  const ip = normalizeIp(value);
  return isPublicIp(ip) && !isServerIp(ip) ? ip : '';
}

export function clientIpFromRequest(request?: Request) {
  if (!request) return '';

  const forwarded = String(request.headers.get('x-forwarded-for') || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    const ip = usableClientIp(forwarded[index]);
    if (ip) return ip;
  }

  for (const header of ['x-real-ip', 'x-client-ip']) {
    const ip = usableClientIp(request.headers.get(header));
    if (ip) return ip;
  }
  return '';
}

export function displayClientIp(value: unknown) {
  const ip = normalizeIp(value);
  return isPublicIp(ip) && !isServerIp(ip) ? ip : '';
}
