export const SHARE_ORIGIN = 'https://www.swod.com.cn';
export type PublicShare = { title: string; desc: string; link: string; imgUrl: string };
export function publicShareUrl(href: string, canonical?: string) {
  try {
    const current = new URL(href, SHARE_ORIGIN);
    const target = new URL(canonical || current.pathname, SHARE_ORIGIN);
    if (target.origin !== SHARE_ORIGIN) return SHARE_ORIGIN + '/';
    const platform = target.searchParams.get('source') === 'platform' || current.searchParams.get('source') === 'platform';
    target.hash = ''; target.search = '';
    if (/^\/courses\/[^/]+\/videos\/?$/.test(target.pathname)) target.pathname=target.pathname.replace(/\/videos\/?$/,'');
    if (/^\/(dashboard|admin|login|auth|account)(\/|$)/.test(target.pathname)) target.pathname='/';
    if (/^\/courses\/[^/]+\/?$/.test(target.pathname) && platform) target.searchParams.set('source','platform');
    return target.href;
  } catch { return SHARE_ORIGIN + '/'; }
}

export function shareText(value: string, fallback = '') {
  return String(value || fallback).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,120);
}
