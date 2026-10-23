'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { getStudentSession } from '@/lib/student-auth';

type Group = { id: number; name: string; player_count: number; scored_count: number };

export default function JudgeGroupsClient({ slug }: { slug: string }) {
  const [data, setData] = useState<{ judge: { name: string }; groups: Group[] } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { setError('请先登录'); return; }
    fetch(`/api/events-news/${slug}/judge`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || '加载失败');
        setData(payload.data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '加载失败'));
  }, [slug]);

  if (error) return <PermissionState message={error} />;
  if (!data) return <div className="rounded-2xl border border-sand/60 bg-white p-10 text-center text-sm text-text-muted">正在加载评委任务…</div>;
  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-[#1A1A1A] px-4 py-3 text-white">
        <div><div className="text-[11px] text-gold">当前评委</div><div className="mt-0.5 font-semibold">{data.judge.name}</div></div>
        <ClipboardCheck className="h-6 w-6 text-gold" />
      </div>
      <input aria-label="搜索负责组别名称" placeholder="输入组别名称模糊搜索" value={query} onChange={e => setQuery(e.target.value)} className="mb-4 w-full rounded-lg border border-sand bg-white px-4 py-3 text-sm outline-none focus:border-gold-dark" />
      {query.trim() && !data.groups.some(group => group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p role="status" className="mb-4 text-sm text-text-muted">未找到相关组别</p>}
      {data.groups.length ? (
        <div className="space-y-2.5">
          {data.groups.filter(group => group.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((group) => (
            <Link prefetch={false} key={group.id} href={`/events/${slug}/judge/groups/${group.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-sand/60 bg-white p-4 shadow-sm transition hover:border-gold-dark">
              <div className="min-w-0">
                <div className="truncate font-semibold text-text">{group.name}</div>
                <div className="mt-1 text-xs text-text-muted">{group.scored_count}/{group.player_count} 位选手已评分</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-gold-dark" />
            </Link>
          ))}
        </div>
      ) : <PermissionState message="无评委权限" />}
    </>
  );
}

function PermissionState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-sand/60 bg-white px-5 py-12 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-gold-dark" /><div className="mt-3 font-semibold text-text">{message}</div></div>;
}
