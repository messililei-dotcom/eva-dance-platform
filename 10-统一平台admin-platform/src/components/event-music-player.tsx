'use client';
import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Tag } from 'antd';
import { api } from '@/lib/api';
export default function EventMusicPlayer({ player, onUploaded }: { player: any; onUploaded?: () => void }) {
  const { message } = App.useApp();
  const [music, setMusic] = useState(player);
  const [duration, setDuration] = useState(Number(player.musicDuration || 0));
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(player.performanceTitle || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setMusic(player); setDuration(Number(player.musicDuration || 0)); setFailed(false); }, [player]);
  async function upload() {
    if (!file || !title.trim()) { message.error('请选择音乐并填写节目（音乐）名字'); return; }
    if (!/\.(mp3|wav|m4a|aac|flac)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) { message.error('请选择10MB以内的 MP3、WAV、M4A、AAC 或 FLAC'); return; }
    setSaving(true);
    try {
      const body = new FormData(); body.append('musicFile', file); body.append('performanceTitle', title.trim());
      const { data } = await api.post(`/event/players/${player.id}/music`, body, { timeout: 120000 });
      if (!data.success) throw new Error(data.error || '上传失败');
      setMusic({ ...player, musicFileId: data.data.musicFileId, musicUrl: `/api/event/music/${data.data.musicFileId}`, musicName: data.data.fileName });
      setDuration(0); setFailed(false); setOpen(false); message.success('参赛音乐已更新'); onUploaded?.();
    } catch (error: any) { message.error(error?.response?.data?.error || error.message || '上传失败，请重试'); }
    finally { setSaving(false); }
  }
  const seconds = Math.round(duration);
  const label = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '读取时长中';
  return <div style={{ minWidth: 260, maxWidth: 360 }}>
    {music.musicFileId && music.musicUrl ? <>
      <div style={{ overflowWrap: 'anywhere', marginBottom: 4 }}>{music.musicName || `${player.groupName}-${player.name}-${player.performanceTitle || '节目（音乐）名字'}`}</div>
      <div style={{ color: '#64748b', fontSize: 12 }}>{failed ? '音乐暂时无法播放，请刷新重试' : label}</div>
      <audio key={music.musicUrl} aria-label={`${player.name}的参赛音乐`} controls preload="metadata" style={{ width: '100%', height: 32 }} src={music.musicUrl}
        onLoadedMetadata={event => { const value = event.currentTarget.duration; if (Number.isFinite(value)) setDuration(value); setFailed(false); }}
        onError={() => setFailed(true)} onPlay={event => { document.querySelectorAll('audio').forEach(audio => { if (audio !== event.currentTarget) audio.pause(); }); }} />
    </> : <Tag>未上传</Tag>}
    <Button size="small" onClick={() => { setTitle(player.performanceTitle || ''); setFile(null); setOpen(true); }}>{music.musicFileId ? '更换音乐' : '代上传音乐'}</Button>
    <Modal title={`为${player.name}上传音乐`} open={open} onCancel={() => { if (!saving) setOpen(false); }} onOk={upload} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} okText="保存音乐">
      <label style={{ display: 'block', marginBottom: 16 }}>节目（音乐）名字<Input value={title} maxLength={120} disabled={saving} onChange={event => setTitle(event.target.value)} /></label>
      <label style={{ display: 'block' }}>音乐文件<input key={String(open)} type="file" disabled={saving} onChange={event => setFile(event.target.files?.[0] || null)} style={{ display: 'block', marginTop: 8, maxWidth: '100%' }} /></label>
      <p>支持 MP3、WAV、M4A、AAC、FLAC，最大10MB。保存成功后使用新音乐。</p>
    </Modal>
  </div>;
}
