'use client';

import type { SyntheticEvent } from 'react';

const WEBSITE_ORIGIN = 'https://www.dongfangwuquan.com';
const ADMIN_ORIGIN = 'https://admin.dongfangwuquan.com';
const FALLBACK_COVER = '/learn/dance-hero.webp';

export function normalizeLearnCover(src?: string): string {
  const value = String(src || '').trim();
  if (!value) return FALLBACK_COVER;
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return encodeURI(value);

  const path = value.startsWith('/') ? value : `/${value}`;
  const origin = path.startsWith('/official-images/') ? WEBSITE_ORIGIN : ADMIN_ORIGIN;
  return encodeURI(`${origin}${path}`);
}

export function hideBrokenCover(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none';
}
