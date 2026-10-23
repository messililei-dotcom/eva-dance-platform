'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, MapPin, Send, Trophy } from 'lucide-react';
import { getStudentSession, clearStudentSession, STUDENT_AUTH_CHANGED_EVENT, type StudentSession } from '@/lib/student-auth';

type EventGroup = {
  id: number;
  name: string;
  ageRange: string;
  danceType: string;
  entryType: string;
  registrationFee:number;
};

type RegistrationEvent = {
  slug: string;
  title: string;
  dateRange: string;
  location: string;
  canRegister: boolean;
  groups: EventGroup[];
  member?: { name: string; phone: string };
};

const initialForm = {
  name: '',
  phone: '',
  organization: '',
  teacher: '',
  groupId: '',
  performanceTitle: '',
  remark: '',
  website: '',
};

const MAX_MUSIC_FILE_SIZE = 10 * 1024 * 1024;
type MusicReceipt = { uploadId: string; fileName: string; fileSize: number; expiresAt: number };
const DRAFT_TTL = 24 * 60 * 60 * 1000;

export default function EventRegistrationPage() {
  const params = useParams<{ slug: string }>();
  const slug = String(params.slug || '');
  const [event, setEvent] = useState<RegistrationEvent | null>(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [search, setSearch]=useState('');
  const [matches,setMatches]=useState<{name:string;phoneMasked:string}[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [session, setSession] = useState<StudentSession | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicReceipt, setMusicReceipt] = useState<MusicReceipt | null>(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [musicPreview, setMusicPreview] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const uploadRequestRef = useRef<AbortController | null>(null);
  const draftKey = session ? `event-registration:${session.id}:${slug}` : '';
  const [musicSource, setMusicSource] = useState<'local' | 'wechat'>('local');
  const musicFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncSession = () => {
      const currentSession = getStudentSession();
      if (!currentSession) {
        window.location.replace(`/events?login=1&next=${encodeURIComponent(`/events/${slug}/register`)}`);
        return;
      }
      setSession(currentSession);
    };
    syncSession();
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, syncSession);
    return () => window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, syncSession);
  }, [slug]);

  useEffect(() => {
    if (!draftKey) return;
    setDraftReady(false);
    setForm(initialForm);
    setMusicReceipt(null);
    setDraftMessage('');
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && draft.savedAt > Date.now() - DRAFT_TTL) {
        const restored = { ...initialForm };
        for (const key of Object.keys(initialForm) as (keyof typeof initialForm)[]) {
          if (key !== 'website' && typeof draft.form?.[key] === 'string') restored[key] = draft.form[key];
        }
        setForm(restored);
        setMusicSource(draft.musicSource === 'wechat' ? 'wechat' : 'local');
        if (draft.music?.expiresAt > Date.now()) setMusicReceipt(draft.music);
        setDraftMessage('已恢复未提交的报名信息，请确认后继续。');
      }
    } catch { /* Storage restrictions must not prevent opening the form. */ }
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || !draftKey || success) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ form, music: musicReceipt, musicSource, savedAt: Date.now() })); }
    catch { setDraftMessage('浏览器无法保存草稿，请在本次页面内完成报名。'); }
  }, [draftReady, draftKey, form, musicReceipt, musicSource, success]);

  useEffect(() => () => uploadRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!session || !musicReceipt) { setMusicPreview(''); return; }
    const controller = new AbortController();
    let url = '';
    fetch(`/api/events-news/${encodeURIComponent(slug)}/register?music=${encodeURIComponent(musicReceipt.uploadId)}`, {
      headers: { Authorization: `Bearer ${session.token}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('音乐上传记录已失效，请重新上传');
      url = URL.createObjectURL(await response.blob());
      if (!controller.signal.aborted) setMusicPreview(url); else URL.revokeObjectURL(url);
    }).catch(error => {
      if (!controller.signal.aborted) { setMusicError(error.message); setMusicReceipt(null); }
    });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [session, slug, musicReceipt]);

  useEffect(() => {
    if (!session) return;
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    setError('');
    fetch(`/api/events-news/${encodeURIComponent(slug)}/register`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { clearStudentSession(); throw new Error('登录状态已过期，请重新登录'); }
        if (!response.ok || !result.success) throw new Error(result.error || '报名信息加载失败');
        return result.data as RegistrationEvent;
      })
      .then((data) => {
        if (mounted) {
          setEvent(data);
          setForm((current) => ({
            ...current,
            name: current.name || data.member?.name || session.name || '',
            phone: current.phone || data.member?.phone || '',
            groupId: data.groups.some(group => String(group.id) === current.groupId) ? current.groupId : String(data.groups[0]?.id || ''),
          }));
        }
      })
      .catch((loadError) => {
        if (mounted) setError(controller.signal.aborted ? '报名信息加载超时，请重试' : loadError instanceof Error ? loadError.message : '报名信息加载失败');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; controller.abort(); clearTimeout(timeout); };
  }, [session, slug, loadAttempt]);

  useEffect(()=>{
    if(!session||search.trim().length<2){setMatches([]);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>{fetch(`/api/events-news/${encodeURIComponent(slug)}/register?search=${encodeURIComponent(search)}`,{headers:{Authorization:`Bearer ${session.token}`},signal:controller.signal}).then(r=>r.json()).then(d=>setMatches(d.matches||[])).catch(()=>{});},300);
    return()=>{clearTimeout(timer);controller.abort();};
  },[search,session,slug]);
  const selectedGroup=event?.groups.find(g=>String(g.id)===form.groupId);

  async function submitRegistration(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentSession = getStudentSession();
    if (!currentSession) {
      window.location.replace(`/events?login=1&next=${encodeURIComponent(`/events/${slug}/register`)}`);
      return;
    }
    if(!selectedGroup){setError('请选择报名组别');return;}
    if (musicUploading) { setError('音乐正在上传，请稍候'); return; }
    if (!musicReceipt || musicReceipt.expiresAt <= Date.now()) {
      setError('请选择需要上传的音乐文件');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append('musicSource', musicSource);
      payload.append('musicUploadId', musicReceipt.uploadId);

      const response = await fetch(`/api/events-news/${encodeURIComponent(slug)}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentSession.token}`,
        },
        body: payload,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '报名提交失败');
      try { localStorage.removeItem(draftKey); } catch {}
      setDraftReady(false);
      setMusicReceipt(null);
      if(result.data?.registrationFee>0){window.location.assign('/checkout/event/'+result.data.registrationId);return;}
      setSuccess(result.message || '报名信息及音乐已提交成功');
      setForm(initialForm);
      setMusicFile(null);
      setMusicSource('local');
      if (musicFileInputRef.current) musicFileInputRef.current.value = '';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '报名提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  function chooseMusic(source: 'local' | 'wechat') {
    if (source === 'wechat' && !/MicroMessenger/i.test(navigator.userAgent)) {
      setError('请在微信内打开本页面后，从聊天记录选择音乐文件');
      return;
    }
    setError('');
    setMusicSource(source);
    if (musicFileInputRef.current) {
      musicFileInputRef.current.value = '';
      musicFileInputRef.current.click();
    }
  }

  async function updateMusicFile(file: File | null) {
    if (!file) return;
    if (!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name) || !file.size) {
      setMusicError('请上传 MP3、WAV、M4A、AAC 或 FLAC 音乐文件'); return;
    }
    if (file.size > MAX_MUSIC_FILE_SIZE) { setMusicError('音乐文件不能超过 10MB'); return; }
    const currentSession = getStudentSession();
    if (!currentSession) { setMusicError('请重新登录后上传音乐'); return; }
    uploadRequestRef.current?.abort();
    const controller = new AbortController();
    uploadRequestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);
    setMusicFile(file);
    setMusicReceipt(null);
    setMusicError('');
    setMusicUploading(true);
    try {
      const payload = new FormData(); payload.append('musicFile', file);
      const response = await fetch(`/api/events-news/${encodeURIComponent(slug)}/register?music=upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${currentSession.token}` }, body: payload, signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '音乐上传失败，请重试');
      if (!controller.signal.aborted) setMusicReceipt(result.data);
    } catch (error) {
      setMusicError(controller.signal.aborted ? '音乐上传已中断，请重新上传' : error instanceof Error ? error.message : '音乐上传失败，请重试');
    } finally { clearTimeout(timeout); if (uploadRequestRef.current === controller) setMusicUploading(false); }
  }

  return (
    <div className="min-h-screen bg-warm-white px-4 pb-14 pt-24 md:pb-20 md:pt-32">
      <div className="mx-auto max-w-3xl">
        <a href="/events" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-crimson">
          <ArrowLeft className="h-4 w-4" />
          返回赛事报道
        </a>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-white shadow-sm">
            <Loader2 className="h-7 w-7 animate-spin text-gold-dark" />
          </div>
        ) : !event ? (
          <div className="rounded-2xl border border-crimson/15 bg-white p-8 text-center shadow-sm">
            <Trophy className="mx-auto mb-4 h-10 w-10 text-gold-dark" />
            <h1 className="font-serif text-2xl font-bold text-text">暂时无法报名</h1>
            <p className="mt-3 text-sm text-text-secondary">{error || '该赛事报名信息未配置'}</p>
            <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="mt-5 rounded-lg bg-crimson px-5 py-3 text-sm font-semibold text-white">重新加载报名信息</button>
          </div>
        ) : success ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm md:p-12">
            <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-600" />
            <h1 className="font-serif text-2xl font-bold text-text md:text-3xl">报名提交成功</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-secondary">{success}</p>
            <Link href="/dashboard/events" className="mt-7 inline-flex rounded-lg bg-crimson px-5 py-3 text-sm font-semibold text-white">
              查看我的赛事
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-t-2xl bg-[#1A1A1A] p-5 text-white md:p-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
                <Trophy className="h-4 w-4" /> 赛事报名
              </span>
              <h1 className="mt-4 font-serif text-2xl font-bold leading-snug md:text-4xl">{event.title}</h1>
              <div className="mt-4 flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-5">
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gold" />{event.dateRange}</span>
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" />{event.location}</span>
              </div>
            </section>

            {!event.canRegister ? (
              <div className="rounded-b-2xl border border-t-0 border-sand/50 bg-white p-8 text-center shadow-sm">
                <h2 className="font-serif text-2xl font-bold text-text">该赛事当前未开放报名</h2>
                <p className="mt-3 text-sm text-text-secondary">如需了解后续赛程，请关注官网通知或联系客服。</p>
              </div>
            ) : (
              <form onSubmit={submitRegistration} className="rounded-b-2xl border border-t-0 border-sand/50 bg-white p-5 shadow-sm md:p-8">
                <div className="mb-6 flex items-end justify-between gap-4 border-b border-sand/40 pb-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-text md:text-2xl">填写报名信息</h2>
                    <p className="mt-1 text-xs text-text-muted">带 * 为必填项</p>
                  </div>
                  {selectedGroup && (
                    <div className="text-right text-sm text-text-muted">报名费 <strong className="block text-lg text-crimson">{selectedGroup.registrationFee>0?`¥${selectedGroup.registrationFee.toFixed(2)}`:'免费'}</strong></div>
                  )}
                </div>

                <button type="button" disabled={musicUploading || submitting} onClick={() => {
                  try { localStorage.removeItem(draftKey); } catch {}
                  setForm({ ...initialForm, name: event.member?.name || session?.name || '', phone: event.member?.phone || '', groupId: String(event.groups[0]?.id || '') });
                  setMusicReceipt(null); setMusicFile(null); setMusicError(''); setError(''); setSearch(''); setMatches([]);
                  if (musicFileInputRef.current) musicFileInputRef.current.value = '';
                  setDraftMessage('已清空未提交的信息，可重新填写。');
                }} className="mb-3 text-xs text-text-muted underline disabled:opacity-50">清空未提交信息</button>
                <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{draftMessage || '未提交的信息和已上传音乐保留24小时，可退出后继续填写。'}</p>
                <p className="mb-4 text-xs text-text-muted">默认填写本人信息，可修改姓名和手机号为他人报名。按手机号匹配已有用户，未匹配时自动新建。</p>
                {matches.length>0&&<div className="mb-4 rounded-lg border border-sand p-3"><p className="mb-2 text-xs text-text-muted">匹配结果（手机号仍需填写完整）</p>{matches.map((m,i)=><button key={i} type="button" onClick={()=>{setForm({...form,name:m.name});setSearch('');setMatches([]);}} className="block w-full p-2 text-left text-sm hover:bg-warm-white">{m.name} · {m.phoneMasked}</button>)}</div>}
                <div className="grid grid-cols-2 gap-3 md:gap-5">
                  <label className="text-sm font-medium text-text">
                    姓名 <span className="text-crimson">*</span>
                    <input required maxLength={30} value={form.name} onChange={(e)=>{setForm({...form,name:e.target.value});setSearch(e.target.value);}} className="mt-2 w-full min-w-0 rounded-lg border border-sand bg-white px-3 py-3 text-text outline-none md:px-4" />
                  </label>
                  <label className="text-sm font-medium text-text">
                    手机号 <span className="text-crimson">*</span>
                    <input required inputMode="tel" pattern="^1[3-9]\d{9}$" maxLength={11} value={form.phone} onChange={(e) => {setForm({ ...form, phone: e.target.value });setSearch(e.target.value);}} className="mt-2 w-full min-w-0 rounded-lg border border-sand px-3 py-3 outline-none focus:border-gold-dark md:px-4" placeholder="11位手机号" />
                  </label>
                  <label className="text-sm font-medium text-text">
                    机构 / 舞蹈室
                    <input maxLength={100} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="mt-2 w-full min-w-0 rounded-lg border border-sand px-3 py-3 outline-none focus:border-gold-dark md:px-4" placeholder="选填" />
                  </label>
                  <label className="text-sm font-medium text-text">
                    指导老师
                    <input maxLength={60} value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} className="mt-2 w-full min-w-0 rounded-lg border border-sand px-3 py-3 outline-none focus:border-gold-dark md:px-4" placeholder="选填" />
                  </label>
                  <label className="text-sm font-medium text-text">
                    报名组别 <span className="text-crimson">*</span>
                    <input aria-label="搜索报名组别名称" value={groupQuery} onChange={e => setGroupQuery(e.target.value)} placeholder="输入组别名称模糊搜索" className="mt-2 w-full rounded-lg border border-sand px-3 py-3 outline-none focus:border-gold-dark" />
                    <select required value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} className="mt-2 w-full min-w-0 rounded-lg border border-sand bg-white px-3 py-3 outline-none focus:border-gold-dark md:px-4">
                      {event.groups.filter(group => String(group.id) === form.groupId || group.name.toLocaleLowerCase().includes(groupQuery.trim().toLocaleLowerCase())).map((group) => <option key={group.id} value={group.id}>{group.name} · ¥{group.registrationFee.toFixed(2)}</option>)}
                      <option value="">请选择报名组别</option>
                    </select>
                    {groupQuery.trim() && <span role="status" className="mt-1 block text-xs text-text-muted">找到 {event.groups.filter(group => group.name.toLocaleLowerCase().includes(groupQuery.trim().toLocaleLowerCase())).length} 个组别，已选组别保持不变</span>}
                  </label>
                  <label className="text-sm font-medium text-text">
                    节目名称 <span className="text-crimson">*</span>
                    <input required maxLength={120} value={form.performanceTitle} onChange={(e) => setForm({ ...form, performanceTitle: e.target.value })} className="mt-2 w-full min-w-0 rounded-lg border border-sand px-3 py-3 outline-none focus:border-gold-dark md:px-4" placeholder="请填写节目名称" />
                  </label>
                  <div className="col-span-2 text-sm font-medium text-text">
                    上传音乐 <span className="text-crimson">*</span>
                    <input
                      ref={musicFileInputRef}
                      type="file"
                      accept=".mp3,.wav,.m4a,.aac,.flac"
                      onChange={(e) => updateMusicFile(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <button type="button" disabled={musicUploading || submitting} onClick={() => chooseMusic('local')} className="rounded-lg border border-crimson bg-crimson px-3 py-3 font-semibold text-white transition hover:bg-crimson-dark">
                        选取文件
                      </button>
                      <button type="button" disabled={musicUploading || submitting} onClick={() => chooseMusic('wechat')} className="rounded-lg border border-sand bg-warm-white px-3 py-3 font-semibold text-text transition hover:border-gold-dark">
                        从微信聊天记录
                      </button>
                    </div>
                    <div aria-live="polite" className="mt-3 break-words text-xs font-normal">
                      {musicUploading ? <p className="flex items-center gap-2 text-gold-dark"><Loader2 className="h-4 w-4 animate-spin" />正在上传音乐：{musicFile?.name}，请等待上传完成。</p> : musicReceipt ? <p className="flex items-start gap-2 text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />音乐上传成功：{musicReceipt.fileName}（{(musicReceipt.fileSize / 1024 / 1024).toFixed(2)} MB）。提交报名后关联本组别。</p> : <p className="text-text-muted">尚未上传音乐 · MP3、WAV、M4A、AAC、FLAC · 最大10MB</p>}
                      {musicError && <p role="alert" className="mt-2 text-red-700">{musicError}</p>}
                      {musicError && musicFile && <button type="button" disabled={musicUploading} onClick={() => updateMusicFile(musicFile)} className="mt-2 text-crimson underline">重试上传</button>}
                      {musicPreview && <audio aria-label="试听已上传音乐" controls preload="metadata" src={musicPreview} className="mt-3 w-full" />}
                    </div>
                  </div>
                </div>

                <label className="mt-5 block text-sm font-medium text-text">
                  备注
                  <textarea maxLength={500} rows={4} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} className="mt-2 w-full resize-y rounded-lg border border-sand px-4 py-3 outline-none focus:border-gold-dark" placeholder="可填写参赛项目、作品或其他需要说明的信息" />
                </label>
                <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" />

                {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

                <button disabled={submitting || musicUploading || !musicReceipt || !selectedGroup} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-crimson px-5 py-3.5 text-sm font-bold text-white transition hover:bg-crimson-dark disabled:disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? '正在提交报名...' : musicUploading ? '音乐上传中...' : '提交报名缴费'}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-text-muted">提交即表示您同意工作人员使用上述信息联系您确认赛事报名。</p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
