'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  Bell,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  CircleUserRound,
  Medal,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { studentApi, type StudentMessage } from '@/lib/student-api';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'course', label: '课程' },
  { key: 'growth', label: '成长' },
  { key: 'system', label: '系统' },
] as const;

const typeLabel: Record<string, string> = {
  welcome: '欢迎',
  growth: '成长',
  level_up: '升级',
  course: '线上课程',
  offline: '线下课程',
  consume: '核销',
  certificate: '证书',
  event: '赛事',
  system: '系统',
};

function MessageIcon({ type }: { type: StudentMessage['type'] }) {
  const className = 'h-5 w-5';
  if (type === 'growth') return <Sparkles className={className} />;
  if (type === 'level_up') return <Medal className={className} />;
  if (type === 'course') return <BookOpen className={className} />;
  if (type === 'offline' || type === 'consume') return <CalendarDays className={className} />;
  if (type === 'certificate') return <Award className={className} />;
  if (type === 'welcome') return <CircleUserRound className={className} />;
  return <Bell className={className} />;
}

function formatMessageTime(value: string) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default function MessageCenter({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [items, setItems] = useState<StudentMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<StudentMessage | null>(null);
  const [notificationHint, setNotificationHint] = useState('');

  const enableInboxReminder = async () => {
    if (!('Notification' in window)) {
      setNotificationHint('当前设备不支持系统通知提醒');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotificationHint('未开启系统通知权限，可在浏览器或系统设置中允许通知');
      return;
    }
    window.localStorage.setItem('swod-inbox-notifications', 'enabled');
    window.dispatchEvent(new Event('student-inbox-reminders-enabled'));
    setNotificationHint('新通知提醒已开启');
  };

  const load = useCallback(async (append = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await studentApi.getMessages({
        type: ['course', 'growth', 'system'].includes(filter) ? filter : undefined,
        status: filter === 'unread' ? 'unread' : undefined,
        cursor: append ? nextCursor : undefined,
        limit: compact ? 5 : 20,
      });
      setItems(current => append ? [...current, ...data.items] : data.items);
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (loadError: any) {
      setError(loadError?.message || '通知加载失败');
    } finally {
      setLoading(false);
    }
  }, [compact, filter, nextCursor]);

  useEffect(() => {
    load(false);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openMessage = async (message: StudentMessage) => {
    let openedMessage = message;
    if (message.status === 'unread') {
      await studentApi.markMessageRead(message.recipientId).catch(() => undefined);
      setItems(current => current.map(item => item.recipientId === message.recipientId ? { ...item, status: 'read' } : item));
      setUnreadCount(current => Math.max(0, current - 1));
      window.dispatchEvent(new CustomEvent('student-inbox-changed'));
      openedMessage = { ...message, status: 'read' };
    }
    setSelectedMessage(openedMessage);
  };

  const markAllRead = async () => {
    await studentApi.markAllMessagesRead();
    setItems(current => current.map(item => ({ ...item, status: 'read' })));
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent('student-inbox-changed'));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E8DDCB] bg-white shadow-sm" aria-label="通知中心">
      <div className="flex items-center justify-between gap-3 border-b border-[#EFE6D8] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative text-[#9F1D20]">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#E02020]" /> : null}
          </span>
          <h2 className="text-lg font-bold text-[#2C1810]">通知中心</h2>
          {unreadCount > 0 ? <span className="rounded-full bg-[#9F1D20] px-2 py-0.5 text-xs font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!compact ? (
            <button type="button" onClick={enableInboxReminder} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A6A32]">
              <BellRing className="h-4 w-4" />新通知提醒
            </button>
          ) : null}
          {unreadCount > 0 ? (
            <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8A6A32]">
              <CheckCheck className="h-4 w-4" />全部已读
            </button>
          ) : null}
          <button type="button" onClick={() => load(false)} className="text-[#8A6A32]" aria-label="刷新通知">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!compact ? (
        <div className="flex gap-1 overflow-x-auto border-b border-[#EFE6D8] px-3 py-2">
          {FILTERS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item.key ? 'bg-[#9F1D20] text-white' : 'bg-[#F8F3EA] text-[#7B6B5B]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notificationHint ? <p className="mx-3 mt-3 rounded-xl bg-[#F8F3EA] px-3 py-2 text-xs text-[#6B5A49]">{notificationHint}</p> : null}
      <div className="divide-y divide-[#F1E7D8]">
        {items.map(message => (
          <button
            key={message.recipientId}
            type="button"
            onClick={() => openMessage(message)}
            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#FCF9F3] ${message.status === 'unread' ? 'bg-[#FFF9EE]' : 'bg-white'}`}
          >
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${message.priority === 'urgent' ? 'bg-[#9F1D20] text-white' : 'bg-[#F1E7D8] text-[#9A793D]'}`}>
              <MessageIcon type={message.type} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={`truncate text-sm text-[#2C1810] ${message.status === 'unread' ? 'font-bold' : 'font-semibold'}`}>{message.title}</span>
                {message.status === 'unread' ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#E02020]" /> : null}
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-5 text-[#7B6B5B]">{message.content}</span>
              <span className="mt-1 flex items-center gap-2 text-[11px] text-[#A09282]">
                <span>{typeLabel[message.type] || '通知'}</span>
                <span>·</span>
                <span>{formatMessageTime(message.createdAt)}</span>
              </span>
            </span>
            {message.actionUrl ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#B9A995]" /> : null}
          </button>
        ))}
      </div>

      {!loading && !items.length ? <p className="px-4 py-8 text-center text-sm text-[#8A7A68]">暂无通知</p> : null}
      {loading && !items.length ? <p className="px-4 py-8 text-center text-sm text-[#8A7A68]">通知加载中...</p> : null}
      {compact ? (
        <button type="button" onClick={() => router.push('/dashboard/messages')} className="flex w-full items-center justify-center gap-1 border-t border-[#EFE6D8] py-3 text-sm font-semibold text-[#9F1D20]">
          查看全部通知 <ChevronRight className="h-4 w-4" />
        </button>
      ) : hasMore ? (
        <button type="button" disabled={loading} onClick={() => load(true)} className="w-full border-t border-[#EFE6D8] py-3 text-sm font-semibold text-[#9F1D20] disabled:opacity-60">
          {loading ? '加载中...' : '加载更多'}
        </button>
      ) : null}

      {selectedMessage ? (
        <div
          className="fixed inset-0 z-[10100] flex items-start justify-center bg-[#211711]/45 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+4rem)] backdrop-blur-sm md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="通知详情"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedMessage(null)}
            aria-label="关闭通知详情"
          />
          <article className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[#E8DDCB] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EFE6D8] px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1E7D8] text-[#9A793D]">
                  <MessageIcon type={selectedMessage.type} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-[#2C1810]">{selectedMessage.title}</h3>
                  <p className="mt-1 text-xs text-[#A09282]">
                    {typeLabel[selectedMessage.type] || '通知'} · {formatMessageTime(selectedMessage.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F3EA] text-[#8A6A32]"
                aria-label="关闭详情"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#5F5145]">{selectedMessage.content}</p>
            </div>
            {selectedMessage.actionUrl?.startsWith('/') ? (
              <div className="border-t border-[#EFE6D8] p-3">
                <button
                  type="button"
                  onClick={() => {
                    const actionUrl = selectedMessage.actionUrl;
                    setSelectedMessage(null);
                    router.push(actionUrl);
                  }}
                  className="w-full rounded-xl bg-[#9F1D20] px-4 py-3 text-sm font-semibold text-white"
                >
                  查看相关内容
                </button>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
