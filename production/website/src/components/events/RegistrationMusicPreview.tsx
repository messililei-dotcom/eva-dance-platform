'use client';
import { useEffect, useRef, useState } from 'react';
import { getStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';

// Fetch with the current login header; never put login tokens or private file paths in a media URL.
export default function RegistrationMusicPreview({ endpoint, fileName }: { endpoint: string; fileName: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const objectURL = useRef('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStudentSession()?.token;
    function clear() {
      request.current?.abort();
      audio.current?.pause();
      audio.current?.removeAttribute('src');
      audio.current?.load();
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
      objectURL.current = '';
    }
    function checkAccount() {
      if (getStudentSession()?.token !== token) { clear(); setSource(''); setLoading(false); setError('登录状态已变化，请重新打开音乐'); }
    }
    const panel = audio.current?.closest('details');
    function panelToggled() {
      if (panel && !panel.open) { request.current?.abort(); audio.current?.pause(); setLoading(false); }
    }
    panel?.addEventListener('toggle', panelToggled);
    window.addEventListener(STUDENT_AUTH_CHANGED_EVENT, checkAccount);
    window.addEventListener('focus', checkAccount);
    window.addEventListener('storage', checkAccount);
    return () => {
      clear();
      panel?.removeEventListener('toggle', panelToggled);
      window.removeEventListener(STUDENT_AUTH_CHANGED_EVENT, checkAccount);
      window.removeEventListener('focus', checkAccount);
      window.removeEventListener('storage', checkAccount);
    };
  }, [endpoint, fileName]);

  async function listen() {
    const session = getStudentSession();
    if (!session) { setError('请先登录后试听'); return; }
    if (loading) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setLoading(true); setError('');
    audio.current?.pause();
    try {
      const response = await fetch(`${endpoint}?preview=1`, { headers: { Authorization: `Bearer ${session.token}` }, cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || '音乐读取失败，请重试');
      }
      const blob = await response.blob();
      if (controller.signal.aborted || getStudentSession()?.token !== session.token) return;
      if (!blob.size) throw new Error('音乐文件为空，请重新上传');
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
      const url = URL.createObjectURL(blob); objectURL.current = url;
      setSource(url);
      if (audio.current) {
        audio.current.src = url;
        await audio.current.play().catch(() => { setError('音乐已加载，请点击下方播放按钮试听'); });
      }
    } catch (cause) {
      if (request.current === controller && audio.current?.closest('details')?.open && getStudentSession()?.token === session.token) setError(controller.signal.aborted ? '音乐加载超时，请重试' : cause instanceof Error ? cause.message : '试听失败，请重试');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }
  return <div className="my-3 min-w-0 rounded-lg border border-sand bg-white p-3">
    <button type="button" disabled={loading} onClick={listen} className="min-h-11 w-full break-words text-left text-sm font-semibold text-crimson underline disabled:opacity-50" aria-label={`试听音乐：${fileName}`}>{loading ? '正在加载音乐…' : `▶ ${fileName} · ${source ? '重新试听' : '点击试听'}`}</button>
    <audio ref={audio} controls preload="none" aria-label={`参赛音乐：${fileName}`} className={source ? 'mt-2 w-full max-w-full' : 'hidden'} onPlay={() => {
      document.querySelectorAll('audio').forEach(other => { if (other !== audio.current) other.pause(); });
    }} onError={() => setError('当前浏览器无法播放此音乐，请重试或使用 MP3 格式重新上传')} />
    {loading && <p role="status" className="mt-2 text-sm">正在读取已上传的音乐…</p>}
    {error && <p role="status" className="mt-2 text-sm text-crimson">{error}</p>}
  </div>;
}
