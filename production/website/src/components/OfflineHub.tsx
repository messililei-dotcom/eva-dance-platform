"use client";
import { useEffect, useState } from 'react';
import OfflineCourseCatalog from './OfflineCourseCatalog';
import OfflineSchedulePanel from './OfflineSchedulePanel';
import { parseOfflineEntry, offlineEntryUrl, type OfflineTab } from '@/lib/offline-entry';
export default function OfflineHub() {
  const [entry, setEntry] = useState(() => parseOfflineEntry(''));
  useEffect(() => { const sync = () => setEntry(parseOfflineEntry(window.location.search)); sync(); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  function update(tab: OfflineTab, courseIds = entry.courseIds) { const next = {tab,courseIds}; setEntry(next); window.history.pushState(null, '', offlineEntryUrl(next)); }
  return <div data-mobile-surface="offline" className="mobile-offline-surface pt-20 md:pt-24">
    <nav aria-label="线下课程功能" className="mx-auto grid max-w-5xl grid-cols-3 gap-2 px-4">
      {([{key:'courses',label:'全部课程'},{key:'consumes',label:'核销记录'},{key:'rights',label:'我的课时'}] as const).map(item => <button key={item.key} onClick={() => update(item.key)} className={`rounded-full py-3 text-sm font-semibold ${entry.tab===item.key?'bg-[#9F1D20] text-white':'border border-[#E8DDCB] bg-white text-[#7B6B5B]'}`}>{item.label}</button>)}
    </nav>
    {entry.courseIds.length>0 && entry.tab!=='courses' && <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-4 text-sm"><span>当前显示所选课程期次</span><button onClick={() => update(entry.tab, [])} className="text-[#9F1D20]">查看全部期次</button></div>}
    {entry.tab==='courses'?<OfflineCourseCatalog />:<OfflineSchedulePanel activeTab={entry.tab} courseIds={entry.courseIds} onTabChange={tab=>update(tab)} />}
  </div>;
}
