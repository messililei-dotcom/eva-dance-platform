'use client';
import { FormEvent, useState } from 'react';
import { getStudentSession } from '@/lib/student-auth';

type Details = { name: string; phone: string; countryCode: string; organization: string; teacher: string; performanceTitle: string; remark: string; canEdit: boolean };
export default function RegistrationDetailsEditor({ playerId, onSaved }: { playerId: string; onSaved: (details: Details) => void }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const endpoint = `/api/mini/member/event-registrations/${encodeURIComponent(playerId)}`;
  async function load() {
    const session = getStudentSession();
    if (!session) { setNotice('请先登录'); return; }
    setLoading(true); setNotice('');
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '报名信息加载失败');
      if (getStudentSession()?.id === session.id) setDetails(result.data);
    } catch (error) { setNotice(error instanceof Error ? error.message : '加载失败，请重试'); }
    finally { setLoading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!details || saving) return;
    const session = getStudentSession();
    if (!session) { setNotice('请先登录'); return; }
    setSaving(true); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'PUT', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(details) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '保存失败');
      if (getStudentSession()?.id === session.id) { setDetails(result.data); onSaved(result.data); setNotice('报名信息已保存'); }
    } catch (error) { setNotice(error instanceof Error ? error.message : '保存失败，请重试'); }
    finally { setSaving(false); }
  }
  const fields = [{ key: 'name', label: '参赛姓名', limit: 120, required: true }, { key: 'countryCode', label: '国家/地区区号', limit: 4 }, { key: 'phone', label: '手机号码', limit: 20, required: true }, { key: 'organization', label: '机构 / 舞蹈室', limit: 100 }, { key: 'teacher', label: '指导老师', limit: 60 }, { key: 'performanceTitle', label: '节目（音乐）名字', limit: 120, required: true }] as const;
  return <details className="mt-3 border-t border-sand pt-3" onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary className="cursor-pointer py-2 text-sm font-semibold text-crimson">修改报名信息</summary>
    {loading ? <p role="status" className="py-3 text-sm">正在读取报名信息…</p> : details?.canEdit ? <form onSubmit={save} className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="block text-sm">{field.label}<input required={'required' in field && field.required} type={field.key === 'phone' || field.key === 'countryCode' ? 'tel' : 'text'} maxLength={field.limit} value={details[field.key]} disabled={saving} onChange={event => setDetails({ ...details, [field.key]: event.target.value })} className="mt-2 min-h-12 w-full rounded-lg border border-sand bg-white px-3 text-base text-text" /></label>)}</div>
      <label className="block text-sm">备注<textarea maxLength={500} rows={3} value={details.remark} disabled={saving} onChange={event => setDetails({ ...details, remark: event.target.value })} className="mt-2 w-full rounded-lg border border-sand bg-white p-3 text-base text-text" /></label>
      <button disabled={saving} className="min-h-12 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? '正在保存…' : '保存报名信息'}</button>
    </form> : details && <p className="py-3 text-sm">该报名已取消</p>}
    {notice && <p role="status" className="mt-3 text-sm text-crimson">{notice}</p>}
    {!loading && !details && <button type="button" onClick={load} className="mt-3 py-2 text-sm text-crimson underline">重新加载</button>}
  </details>;
}
