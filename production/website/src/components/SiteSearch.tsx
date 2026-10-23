'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarDays, GraduationCap, Loader2, MapPin, Newspaper, Search, UserRound, X } from 'lucide-react';

type SearchResult = {
  id: string;
  kind: 'page' | 'online-course' | 'offline-course' | 'lesson' | 'news' | 'event' | 'teacher';
  title: string;
  description: string;
  href: string;
};

const kindMeta = {
  page: { label: '网站栏目', icon: MapPin },
  'online-course': { label: '线上课程', icon: BookOpen },
  'offline-course': { label: '线下课程', icon: CalendarDays },
  lesson: { label: '课程课节', icon: GraduationCap },
  news: { label: '新闻资讯', icon: Newspaper },
  event: { label: '赛事活动', icon: CalendarDays },
  teacher: { label: '传承弟子', icon: UserRound },
};

const suggestions = ['西米', '旋转', '零基础', '师资认证', '线下集训'];

export default function SiteSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setLoading(false);
      setError('');
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/search?v=2&q=${encodeURIComponent(keyword)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('search failed');
        const payload = await response.json();
        setResults(Array.isArray(payload.results) ? payload.results : []);
        setActiveIndex(0);
      } catch (searchError) {
        if ((searchError as Error).name !== 'AbortError') {
          setResults([]);
          setError('搜索暂时不可用，请稍后重试');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  if (!open) return null;

  const submitFirst = () => {
    const result = results[activeIndex] || results[0];
    if (result) window.location.assign(result.href);
  };

  return (
    <div className="fixed inset-0 z-[10100] bg-[#1A120D]/45 p-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] backdrop-blur-sm lg:flex lg:items-start lg:justify-center lg:px-8 lg:pt-24" role="dialog" aria-modal="true" aria-label="全站搜索">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="关闭搜索" />
      <div className="relative mx-auto flex max-h-[min(78svh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#E8DDCB] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(44,24,16,0.28)]">
        <div className="border-b border-[#EFE6D8] p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A98746]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && results.length) {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(results.length - 1, index + 1));
                  } else if (event.key === 'ArrowUp' && results.length) {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(0, index - 1));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    submitFirst();
                  }
                }}
                className="h-11 w-full rounded-xl border border-[#E8DDCB] bg-white pl-10 pr-10 text-base text-[#2C1810] outline-none transition focus:border-[#B99652] focus:ring-2 focus:ring-[#C8A96E]/20"
                placeholder="搜索课程、课节、新闻或网站内容"
                aria-label="输入全站搜索关键词"
                aria-controls="site-search-results"
              />
              {loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#A98746]" /> : null}
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7B6B5B] transition hover:bg-[#F4EBDD] hover:text-[#8B1A1A]" aria-label="关闭全站搜索">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div id="site-search-results" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" aria-live="polite">
          {!query.trim() ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#A98746]">热门搜索</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-[#E8DDCB] bg-white px-3 py-1.5 text-sm text-[#5D4B3B] transition hover:border-[#C8A96E] hover:text-[#8B1A1A]">
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-sm leading-6 text-[#8C8172]">可搜索线上课程、具体课节、线下培训、新闻资讯、赛事活动、传承弟子和网站栏目。</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-[#8B1A1A]">{error}</div>
          ) : !loading && results.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-[#C8A96E]" />
              <p className="font-semibold text-[#2C1810]">没有找到“{query.trim()}”</p>
              <p className="mt-1 text-sm text-[#8C8172]">请尝试课程名称、课节技巧、新闻标题、城市或栏目名称</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="mb-2 flex items-center justify-between px-1 text-xs text-[#8C8172]">
                <span>搜索结果</span>
                <span>{results.length} 条</span>
              </div>
              {results.map((result, index) => {
                const meta = kindMeta[result.kind] || { label: '相关内容', icon: Search };
                const Icon = meta.icon;
                return (
                  <Link
                    key={result.id}
                    href={result.href}
                    onClick={onClose}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition ${index === activeIndex ? 'border-[#D9BF89] bg-[#FFF8EA]' : 'border-transparent hover:border-[#E8DDCB] hover:bg-white'}`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4EBDD] text-[#9F1D20]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[#2C1810]">{result.title}</span>
                        <span className="shrink-0 rounded-full bg-[#F4EBDD] px-2 py-0.5 text-[10px] text-[#8B6A32]">{meta.label}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#8C8172]">{result.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
