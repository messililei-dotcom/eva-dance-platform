'use client';
import { useEffect } from 'react';
import type { PublicShare } from '@/lib/public-share';
export let pageShareOverride: { pathname: string; data: PublicShare } | null = null;
export function usePageShare(data: PublicShare | null) {
  const title = data?.title, desc = data?.desc, link = data?.link, imgUrl = data?.imgUrl;
  useEffect(() => {
    if (!title || !link) return;
    const entry = { pathname: window.location.pathname, data: { title, desc: desc || title, link, imgUrl: imgUrl || '/icons/icon-512-20261005.png' } };
    pageShareOverride = entry;
    window.dispatchEvent(new Event('website-share-change'));
    return () => {
      if (pageShareOverride === entry) pageShareOverride = null;
      window.dispatchEvent(new Event('website-share-change'));
    };
  }, [title, desc, link, imgUrl]);
}
