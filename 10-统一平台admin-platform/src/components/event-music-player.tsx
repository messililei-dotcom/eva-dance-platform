'use client';
import { useEffect, useState } from 'react';
import { App, Button, Input, Modal, Tag } from 'antd';
import { api } from '@/lib/api';
export default function EventMusicPlayer({ player, onUploaded, onEnded, preload = 'metadata', cardLayout = false }: {
  player: any;
  cardLayout?: boolean;
  onUploaded?: () => void;
  onEnded?: (musicFileId: number) => void;
  preload?: 'none' | 'metadata';
}) {
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
  const label = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '—';
  return <div style={{ display: cardLayout ? 'grid' : 'flex', gridTemplateColumns: cardLayout ? '1fr auto' : undefined, gridTemplateRows: cardLayout ? '32px' : undefined, alignItems: 'center', gap: cardLayout ? 4 : 8, minWidth: 0, textAlign: 'left' }}>
    {music.musicFileId && music.musicUrl ? <>
      <span style={{ flexShrink: 0, color: failed ? '#b91c1c' : '#475569', fontSize: cardLayout ? 13 : 12, fontWeight: cardLayout ? 600 : undefined, fontVariantNumeric: 'tabular-nums', position: cardLayout ? 'absolute' : undefined, right: cardLayout ? 8 : undefined, top: cardLayout ? 32 : undefined, lineHeight: cardLayout ? '20px' : undefined }}>{failed ? '播放失败' : label}</span>
      <audio key={music.musicUrl} aria-label={`${player.name}的参赛音乐`} controls preload={preload} onEnded={() => onEnded?.(Number(music.musicFileId))} style={{ width: cardLayout ? '100%' : 180, minWidth: cardLayout ? 0 : 110, height: 32, gridColumn: cardLayout ? 1 : undefined, gridRow: cardLayout ? 1 : undefined }} src={music.musicUrl}
        onLoadedMetadata={event => { const value = event.currentTarget.duration; if (Number.isFinite(value)) setDuration(value); setFailed(false); }}
        onError={() => setFailed(true)} onPlay={event => { document.querySelectorAll('audio').forEach(audio => { if (audio !== event.currentTarget) audio.pause(); }); }} />
    </> : <Tag color="red">未上传</Tag>}
    <Button size="small" style={{ flexShrink: 0, gridColumn: cardLayout ? 2 : undefined, gridRow: cardLayout ? 1 : undefined, justifySelf: cardLayout ? 'end' : undefined }} onClick={() => { setTitle(player.performanceTitle || ''); setFile(null); setOpen(true); }}>{music.musicFileId ? '替换' : '上传'}</Button>
    <Modal title={`为${player.name}上传音乐`} open={open} onCancel={() => { if (!saving) setOpen(false); }} onOk={upload} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} okText="保存音乐">
      <label style={{ display: 'block', marginBottom: 16 }}>节目（音乐）名字<Input value={title} maxLength={120} disabled={saving} onChange={event => setTitle(event.target.value)} /></label>
      <label style={{ display: 'block' }}>音乐文件<input key={String(open)} type="file" disabled={saving} onChange={event => setFile(event.target.files?.[0] || null)} style={{ display: 'block', marginTop: 8, maxWidth: '100%' }} /></label>
      <p>支持 MP3、WAV、M4A、AAC、FLAC，最大10MB。保存成功后使用新音乐。</p>
    </Modal>
  </div>;
}
