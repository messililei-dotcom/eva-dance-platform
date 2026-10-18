'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  MapPin,
  Medal,
  RefreshCw,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { studentApi, type StudentCompetitionEntry } from '@/lib/student-api';
import { getStudentSession } from '@/lib/student-auth';

const auditLabels: Record<string, string> = {
  approved: '报名已生效',
  passed: '报名已生效',
  pending: '报名已记录',
  rejected: '历史无效报名',
};

const paymentLabels: Record<string, string> = {
  paid: '已缴费',
  completed: '已缴费',
  unpaid: '待缴费',
  pending: '待缴费',
  refunded: '已退款',
};

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return '比赛日期待定';
  if (!endDate || startDate === endDate) return startDate || endDate;
  return `${startDate} 至 ${endDate}`;
}

function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 3 }).format(value);
}

function eventPhase(entry: StudentCompetitionEntry) {
  const today = new Date().toISOString().slice(0, 10);
  if (entry.startDate && entry.startDate > today) return '即将开始';
  if (entry.endDate && entry.endDate < today) return '已结束';
  if (entry.startDate && entry.startDate <= today && (!entry.endDate || entry.endDate >= today)) return '进行中';
  return entry.competitionStatus === 'finished' ? '已结束' : '赛事信息';
}

export default function MyEventsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<StudentCompetitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const session = getStudentSession();
    if (!session) {
      router.replace('/?login=1');
      return;
    }

    setLoading(true);
    studentApi.getCompetitions(session.id)
      .then((rows) => {
        if (!mounted) return;
        setEntries(rows);
        setError('');
      })
      .catch((loadError: any) => {
        if (!mounted) return;
        setError(loadError?.message || '比赛数据加载失败，请稍后重试');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [router]);

  const eventGroups = useMemo(() => {
    const grouped = new Map<string, StudentCompetitionEntry[]>();
    entries.forEach((entry) => {
      const list = grouped.get(entry.competitionId) || [];
      list.push(entry);
      grouped.set(entry.competitionId, list);
    });
    return Array.from(grouped.values());
  }, [entries]);

  const publishedCount = entries.filter((entry) => entry.resultPublished).length;
  const podiumCount = entries.filter((entry) => entry.rankNo > 0 && entry.rankNo <= 3).length;

  return (
    <main className="min-h-screen bg-[#F8F3EA] px-3 pb-12 pt-2 text-[#2C1810] md:px-5 md:pt-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href="/dashboard/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8A6A32] shadow-sm"
            aria-label="返回个人中心"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="text-xs text-[#9B8A76]">个人中心</span>
        </div>

        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#8B1A1A] to-[#B99652] px-5 py-5 text-white shadow-sm md:px-7 md:py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">我的比赛</h1>
              <p className="mt-1 text-sm text-white/75">报名组别、作品、评分与比赛成绩</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 divide-x divide-white/20 rounded-xl bg-white/10 py-3 text-center">
            <div><strong className="block text-xl">{eventGroups.length}</strong><span className="text-[11px] text-white/70">赛事</span></div>
            <div><strong className="block text-xl">{entries.length}</strong><span className="text-[11px] text-white/70">组别</span></div>
            <div><strong className="block text-xl">{publishedCount}</strong><span className="text-[11px] text-white/70">已出成绩</span></div>
            <div><strong className="block text-xl">{podiumCount}</strong><span className="text-[11px] text-white/70">前三名</span></div>
          </div>
        </section>

        {loading ? (
          <section className="mt-3 flex min-h-56 items-center justify-center rounded-2xl bg-white text-[#8A7A68]">
            <div className="text-center"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#B99652]" /><p>正在同步比赛数据…</p></div>
          </section>
        ) : error ? (
          <section className="mt-3 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-[#9F1D20]">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[#9F1D20] px-5 py-2.5 text-sm font-semibold text-white">重新加载</button>
          </section>
        ) : !entries.length ? (
          <section className="mt-3 rounded-2xl bg-white px-6 py-14 text-center shadow-sm">
            <Trophy className="mx-auto h-10 w-10 text-[#D4BE92]" />
            <h2 className="mt-4 text-lg font-bold">暂无比赛记录</h2>
            <p className="mt-2 text-sm leading-6 text-[#8A7A68]">完成赛事报名并关联当前手机号后，比赛组别和成绩会自动显示在这里。</p>
          </section>
        ) : (
          <div className="mt-3 space-y-3">
            {eventGroups.map((groupEntries) => {
              const event = groupEntries[0];
              return (
                <section key={event.competitionId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <header className="border-b border-[#F1E7D8] px-4 py-4 md:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold leading-6 md:text-lg">{event.competitionName}</h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8A7A68]">
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDateRange(event.startDate, event.endDate)}</span>
                          {event.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span> : null}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#F8F3EA] px-2.5 py-1 text-xs font-semibold text-[#8A6A32]">{eventPhase(event)}</span>
                    </div>
                  </header>

                  <div className="space-y-2 p-3 md:p-4">
                    {groupEntries.map((entry) => (
                      <article key={entry.playerId} className="rounded-xl border border-[#EEE3D3] bg-[#FCFAF6] p-3 md:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <UsersRound className="h-4 w-4 shrink-0 text-[#B99652]" />
                              <h3 className="font-bold leading-5">{entry.groupName}</h3>
                            </div>
                            <p className="mt-1.5 text-sm text-[#6F6257]">选手：{entry.entrantName || '本人'} · 报名费 ¥{entry.registrationFee.toFixed(2)} · 已缴 ¥{entry.paidAmount.toFixed(2)}</p>{entry.paidAt && <p className="mt-1 text-xs text-[#8A7A68]">缴费时间：{new Date(entry.paidAt).toLocaleString('zh-CN')}</p>}{entry.canPay && <Link className="mt-2 inline-block rounded-lg bg-crimson px-3 py-2 text-xs text-white" href={'/checkout/event/'+entry.playerId}>继续缴费</Link>}
                            {entry.performanceTitle ? <p className="mt-1.5 text-sm text-[#6F6257]">作品：{entry.performanceTitle}</p> : null}
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="rounded-full bg-white px-2 py-1 text-[#7C6E5F]">{auditLabels[entry.auditStatus] || '报名已记录'}</span>
                              <span className="rounded-full bg-white px-2 py-1 text-[#7C6E5F]">{paymentLabels[entry.paidStatus] || '缴费状态已记录'}</span>
                              {entry.playerNo ? <span className="rounded-full bg-white px-2 py-1 text-[#7C6E5F]">编号 {entry.playerNo}</span> : null}
                            </div>
                          </div>

                          {entry.resultPublished ? (
                            <div className="shrink-0 text-right">
                              <div className="inline-flex items-center gap-1 rounded-full bg-[#FFF1D8] px-2.5 py-1 text-xs font-bold text-[#8A5B11]">
                                <Medal className="h-3.5 w-3.5" />{entry.awardName || `第 ${entry.rankNo} 名`}
                              </div>
                              <p className="mt-2 text-2xl font-bold text-[#9F1D20]">{formatScore(entry.totalScore)}</p>
                              <p className="text-[11px] text-[#8A7A68]">公示总分</p>
                            </div>
                          ) : (
                            <span className="shrink-0 rounded-full bg-[#F1ECE4] px-2.5 py-1 text-xs text-[#8A7A68]">成绩待公示</span>
                          )}
                        </div>

                        {entry.resultPublished && entry.judgeScores.length ? (
                          <details className="mt-3 border-t border-[#EEE3D3] pt-3">
                            <summary className="cursor-pointer list-none text-sm font-semibold text-[#8A6A32]">
                              查看评委评分（{entry.judgeScores.length}）
                            </summary>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {entry.judgeScores.map((score) => (
                                <div key={`${entry.playerId}-${score.judgeId}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                  <span className="truncate text-[#6F6257]">{score.judgeName}</span>
                                  <strong className="ml-2 text-[#9F1D20]">{score.score === null ? '***' : formatScore(score.score)}</strong>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        {entry.organization || entry.teacher ? (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[#EEE3D3] pt-2 text-xs text-[#8A7A68]">
                            {entry.organization ? <span>领队机构：{entry.organization}</span> : null}
                            {entry.teacher ? <span>领队老师：{entry.teacher}</span> : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
