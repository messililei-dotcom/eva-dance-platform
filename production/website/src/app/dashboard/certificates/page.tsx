'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStudentSession } from '@/lib/student-auth';

type Certificate = { id: number; courseName: string; memberName: string; issueDate: string; certificateNo: string; status: string };
export default function CertificatesPage() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const previewRef = useRef<string | null>(null);
  const cert = certificates.find(item => item.id === selected);
  const headers = () => ({ Authorization: `Bearer ${getStudentSession()?.token || ''}` });

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      router.replace(`/?login=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/learn/certificates?member_id=${encodeURIComponent(session.id)}`, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => { const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error || '证书加载失败，请稍后重试'); return payload.data as Certificate[]; })
      .then(rows => {
        setCertificates(rows);
        const no = new URLSearchParams(window.location.search).get('no');
        const initial = (no ? rows.find(item => item.certificateNo === no) : undefined) || rows.find(item => item.status === 'active');
        if (no && !rows.some(item => item.certificateNo === no)) setNotice('当前账号没有这张证书，请选择自己的证书或切换学员账号。');
        if (initial) { setSelected(initial.id); setName(initial.memberName); }
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
    if (!cert || cert.status !== 'active') { setPreviewLoading(false); return; }
    setPreviewLoading(true);
    fetch(`/api/learn/certificates/${cert.id}/preview?v=${revision}`, { headers: headers(), cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) {
          const payload = await response.json().catch(() => null); throw new Error(payload?.error || '证书图片生成失败，请稍后重试');
        }
        return response.blob();
      }).then(blob => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob); previewRef.current = url; setPreview({ url, blob });
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    return () => { controller.abort(); if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; } };
  }, [selected, revision, cert?.status]);

  const select = (item: Certificate) => { setSelected(item.id); setName(item.memberName); setEditing(false); setError(''); setNotice(''); setPreview(null); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!cert || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/learn/certificates/${cert.id}/name`, { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, previousName: cert.memberName }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || '重新生成失败，请稍后重试');
      setCertificates(rows => rows.map(item => item.id === cert.id ? { ...item, memberName: payload.data.memberName } : item));
      setName(payload.data.memberName); setEditing(false); setPreview(null); setRevision(value => value + 1);
      setNotice('证书姓名已更新，重新生成后即可下载。');
    } catch (err) { setError(err instanceof Error ? err.message : '操作失败，请稍后重试'); }
    finally { setSaving(false); }
  };
  const download = () => {
    if (!cert || !preview || saving || previewLoading) return;
    const link = document.createElement('a'); link.href = preview.url; link.download = `${cert.certificateNo}.png`; document.body.appendChild(link); link.click(); link.remove();
  };
  if (loading) return <main className="min-h-screen bg-warm-white pt-36 text-center">加载证书中…</main>;
  return <main className="min-h-screen bg-warm-white px-4 pb-16 pt-32 md:pt-36">
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/profile#certificates" className="text-sm text-gold-dark">返回个人中心</Link>
      <h1 className="mb-2 mt-4 font-serif text-3xl font-bold text-text">我的证书</h1>
      <p className="mb-6 text-text-secondary">查看证书后，可修改本张证书的姓名，重新生成并下载。</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-gold/10 p-4 text-text">{notice}</p>}
      {!certificates.length && !error ? <div className="rounded-2xl bg-white p-8 text-center text-text-secondary">暂无证书，完成课程学习后可获得结业证书。</div> : null}
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">{certificates.map(item => <button key={item.id} onClick={() => select(item)} disabled={saving} aria-pressed={item.id === selected} className={`w-full rounded-xl border p-4 text-left ${item.id === selected ? 'border-gold bg-gold/10' : 'border-sand/50 bg-white'} disabled:opacity-50`}>
          <span className="block font-semibold">{item.courseName}</span><span className="mt-2 block text-sm">{item.memberName}</span><span className="mt-1 block break-all text-xs text-text-secondary">{item.certificateNo}</span><span className="mt-1 block text-xs text-text-secondary">{item.status === 'active' ? item.issueDate : '已撤销'}</span>
        </button>)}</div>
        {cert && <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-xl font-semibold">证书预览</h2>
          {cert.status !== 'active' ? <p>此证书已撤销，不能修改或下载。</p> : <>
            {previewLoading ? <div role="status" className="rounded-xl bg-warm-white p-12 text-center">正在生成证书图片…</div> : preview ? <img src={preview.url} alt={`${cert.memberName}的${cert.courseName}证书`} className="h-auto w-full rounded-lg border border-sand/30" /> : <div className="rounded-xl bg-warm-white p-8 text-center">暂时无法显示证书图片</div>}
            <div className="mt-4 flex flex-wrap gap-3"><button onClick={() => { setEditing(true); setName(cert.memberName); setNotice(''); }} disabled={saving || previewLoading || !preview} className="rounded-lg border border-gold px-4 py-2 text-gold-dark disabled:opacity-50">编辑证书姓名</button><button onClick={download} disabled={saving || previewLoading || !preview} className="rounded-lg bg-gold px-4 py-2 font-medium text-white disabled:opacity-50">下载证书图片</button></div>
            {editing && <form onSubmit={save} className="mt-5 rounded-xl bg-warm-white p-4">
              <label htmlFor="recipientName" className="mb-2 block font-medium">证书姓名</label><input id="recipientName" value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={saving} className="w-full rounded-lg border border-sand/50 bg-white px-3 py-2" />
              <p className="mt-2 text-sm text-text-secondary">仅修改这张证书的姓名，证书编号、课程与颁发日期保持不变。</p><div className="mt-3 flex gap-3"><button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-gold px-4 py-2 text-white disabled:opacity-50">{saving ? '重新生成中…' : '保存并重新生成'}</button><button type="button" onClick={() => setEditing(false)} disabled={saving} className="px-3 py-2 text-text-secondary">取消</button></div>
            </form>}
          </>}
        </section>}
      </div>
    </div>
  </main>;
}
