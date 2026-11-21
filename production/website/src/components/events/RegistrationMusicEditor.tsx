'use client';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import RegistrationMusicPreview from './RegistrationMusicPreview';
import { getStudentSession } from '@/lib/student-auth';

const MAX_MUSIC_FILE_SIZE = 10 * 1024 * 1024;
const MUSIC_SIZE_ERROR = '音乐文件不能超过 10MB';

export default function RegistrationMusicEditor({ playerId, initialTitle, onSaved }: { playerId: string; initialTitle: string; onSaved: (title: string) => void }) {
  const [title, setTitle] = useState(initialTitle);
  const [fileName, setFileName] = useState('');
  const [musicVersion, setMusicVersion] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [notice, setNotice] = useState('');
  const [uploadError, setUploadError] = useState('');
  const errorDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploadError) return;
    if (typeof errorDialog.current?.showModal === 'function') {
      errorDialog.current.showModal();
    } else {
      window.alert(uploadError);
      setUploadError('');
    }
  }, [uploadError]);

  function selectMusic(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = input.files?.[0];
    setNotice('');
    setFile(null);
    if (!selected) return;

    let error = '';
    if (!selected.size) error = '音乐文件为空，请重新选择';
    else if (selected.size > MAX_MUSIC_FILE_SIZE) error = MUSIC_SIZE_ERROR;
    else if (!/\.(mp3|wav|m4a|aac|flac)$/i.test(selected.name)) error = '请上传 MP3、WAV、M4A、AAC 或 FLAC 音乐文件';
    if (error) {
      input.value = '';
      setUploadError(error);
      return;
    }
    setFile(selected);
  }

  const endpoint = `/api/mini/member/event-registrations/${encodeURIComponent(playerId)}/music`;
  async function load() {
    const session = getStudentSession();
    if (!session) { setNotice('请先登录'); return; }
    setLoading(true); setNotice(''); setFileName(''); setCanEdit(false);
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '音乐信息加载失败');
      if (getStudentSession()?.token !== session.token) return;
      setTitle(result.data.performanceTitle); setFileName(result.data.fileName); setCanEdit(result.data.canEdit);
    } catch (error) { setNotice(error instanceof Error ? error.message : '加载失败，请重试'); }
    finally { setLoading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !file) return;
    const session = getStudentSession();
    if (!session) { setNotice('请先登录'); return; }
    setSaving(true); setNotice('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const body = new FormData(); body.append('musicFile', file); body.append('performanceTitle', title.trim());
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body, signal: controller.signal });
      if (response.status === 413) throw new Error(MUSIC_SIZE_ERROR);
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || '上传失败，请重试');
      if (fileInput.current) fileInput.current.value = '';
      if (getStudentSession()?.token !== session.token) return;
      setMusicVersion(value => value + 1); setFileName(result.data.fileName); setTitle(result.data.performanceTitle); setFile(null); onSaved(result.data.performanceTitle); setNotice('音乐已更新成功');
    } catch (error) { setUploadError(controller.signal.aborted ? '上传超时，请重新查看当前音乐后重试' : error instanceof Error ? error.message : '上传失败，请重试'); }
    finally { clearTimeout(timeout); setSaving(false); }
  }
  return <details className="mt-3 border-t border-sand pt-3" onToggle={event => { if (event.currentTarget.open) void load(); else event.currentTarget.querySelectorAll('audio').forEach(audio => audio.pause()); }}>
    <summary className="cursor-pointer py-2 text-sm font-semibold text-crimson">试听 / 上传参赛音乐</summary>
    {loading ? <p role="status" className="py-3 text-sm">正在读取音乐信息…</p> : <>
      {fileName ? <RegistrationMusicPreview key={`${playerId}-${musicVersion}-${fileName}`} endpoint={endpoint} fileName={fileName} /> : <p className="my-2 text-sm">当前音乐　未上传</p>}
      {canEdit && <form onSubmit={save} className="space-y-3">
        <label className="block text-sm">节目（音乐）名字<input required maxLength={120} value={title} disabled={saving} onChange={event => setTitle(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-sand bg-white px-3 text-base text-text" /></label>
        <label className="block text-sm">选择新音乐<input required type="file" disabled={saving} ref={fileInput} onChange={selectMusic} className="mt-2 block max-w-full text-sm" /></label>
        <p className="text-xs leading-6">支持 MP3、WAV、M4A、AAC、FLAC，最大10MB。苹果微信中的音乐请先存储到“文件”的“我的iPhone”，再点“选择文件”上传。</p>
        <button disabled={saving || !file} className="min-h-11 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? '正在上传…' : '保存新音乐'}</button>
      </form>}
      <button type="button" disabled={saving} onClick={load} className="mt-3 py-2 text-sm text-crimson underline">刷新音乐信息</button>
    </>}
    <dialog
      ref={errorDialog}
      role="alertdialog"
      aria-label="音乐上传失败"
      onClose={() => setUploadError('')}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl bg-white p-5 text-text shadow-xl backdrop:bg-black/50"
    >
      <h2 className="font-bold">音乐上传失败</h2>
      <p className="mt-2 text-sm" role="alert">{uploadError}</p>
      <form method="dialog" className="mt-4 text-right">
        <button autoFocus className="min-h-11 rounded-lg bg-crimson px-5 text-sm font-semibold text-white">确定</button>
      </form>
    </dialog>
    {notice && <p role="status" className="mt-3 text-sm text-crimson">{notice}</p>}
  </details>;
}
