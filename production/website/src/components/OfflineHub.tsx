"use client";
import { useEffect, useState } from 'react';
import OfflineCourseCatalog from './OfflineCourseCatalog';
import OfflineSchedulePanel from './OfflineSchedulePanel';
import { parseOfflineEntry, offlineEntryUrl, type OfflineTab } from '@/lib/offline-entry';
import { studentApi, type OfflineOverview } from '@/lib/student-api';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';

const emptyOverview: OfflineOverview = { entitlements: [], sessions: [], bookings: [], consumes: [] };
const tabs = [
  { key: 'courses', label: '全部课程' },
  { key: 'consumes', label: '核销记录' },
  { key: 'rights', label: '我的课时' },
] as const;

export default function OfflineHub() {
  const [entry, setEntry] = useState(() => parseOfflineEntry(''));
  const [overview, setOverview] = useState(emptyOverview);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const courseKey = entry.courseIds.join(',');
  const showingRecords = entry.tab !== 'courses';

  useEffect(() => {
    const sync = () => setEntry(parseOfflineEntry(window.location.search));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    let requestVersion = 0;
    const mobile = window.matchMedia('(max-width: 767px)');
    const load = async () => {
      const version = ++requestVersion;
      const id = getStudentSession()?.id;
      setSignedIn(Boolean(id));
      setOverview(emptyOverview);
      setError('');
      if (!id || (!mobile.matches && !showingRecords)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const next = await studentApi.getOfflineOverview(courseKey ? courseKey.split(',').map(Number) : []);
        if (version === requestVersion && id === getStudentSession()?.id) setOverview(next);
      } catch (reason) {
        if (version === requestVersion) setError(reason instanceof Error ? reason.message : '课时加载失败');
      } finally {
        if (version === requestVersion) setLoading(false);
      }
    };

    void load();
    window.addEventListener('focus', load);
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, load);
    mobile.addEventListener('change', load);
    return () => {
      requestVersion++;
      window.removeEventListener('focus', load);
      window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, load);
      mobile.removeEventListener('change', load);
    };
  }, [courseKey, showingRecords, attempt]);

  function update(tab: OfflineTab, courseIds = entry.courseIds) {
    const next = { tab, courseIds };
    setEntry(next);
    window.history.pushState(null, '', offlineEntryUrl(next));
  }

  const stats = [
    { label: '剩余课时', value: overview.entitlements.reduce((total, item) => total + Number(item.available_sessions || 0), 0) },
    { label: '已购期次', value: overview.entitlements.length },
    { label: '已核销', value: overview.entitlements.reduce((total, item) => total + Number(item.used_sessions || 0), 0) },
  ];
  const steps = ['选择课程期次', '购买期次课时', '到课后核销'];

  return <div data-mobile-surface="offline" className="mobile-offline-surface pt-20 md:pt-24">
    <header className="mx-4 mb-4 md:hidden">
      <h1 className="text-2xl font-bold">线下课</h1>
      <p className="mt-2 text-sm leading-6 text-[#616773]">购买课程期次的课时，到课后核销扣减，无需预约。</p>
    </header>
    <dl aria-label="线下课课时统计" aria-busy={loading} className="mx-4 grid grid-cols-3 py-2 text-center md:hidden">
      {stats.map(({ label, value }) => (
        <div key={label} className="flex flex-col-reverse gap-1">
          <dt className="text-xs text-[#616773]">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-[#9F1D20]">{loading || error ? '—' : value}</dd>
        </div>
      ))}
    </dl>
    <ol aria-label="线下课流程" className="mx-4 mb-4 grid grid-cols-3 gap-2 text-center text-xs text-[#616773] md:hidden">
      {steps.map((step, index) => (
        <li key={step} className="flex flex-col gap-1">
          <span aria-hidden="true" className="font-semibold text-[#9F1D20]">{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
    <nav aria-label="线下课程功能" className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4">
      {tabs.map(item => <button key={item.key} aria-pressed={entry.tab === item.key} onClick={() => update(item.key)} className={`rounded-full py-3 text-sm font-semibold ${entry.tab === item.key ? 'bg-[#9F1D20] text-white' : 'border border-[#E8DDCB] bg-white text-[#7B6B5B]'}`}>{item.label}</button>)}
    </nav>
    {entry.courseIds.length > 0 && showingRecords && <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4 text-sm"><span>当前显示所选课程期次</span><button onClick={() => update(entry.tab, [])} className="text-[#9F1D20]">查看全部期次</button></div>}
    {entry.tab === 'courses' ? <OfflineCourseCatalog /> : (
      <OfflineSchedulePanel activeTab={entry.tab} overview={overview} signedIn={signedIn}
        loading={loading} error={error} onReload={() => setAttempt(value => value + 1)} />
    )}
  </div>;
}
