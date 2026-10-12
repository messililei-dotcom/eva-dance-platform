'use client';
import { useState } from 'react';
import { Tag } from 'antd';
export default function EventMusicPlayer({ player }: { player: any }) {
  const [duration, setDuration] = useState(Number(player.musicDuration || 0));
  const [failed, setFailed] = useState(false);
  if (!player.musicFileId || !player.musicUrl) return <Tag>未上传</Tag>;
  const seconds = Math.round(duration);
  const label = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '读取时长中';
  return <div style={{ minWidth: 260, maxWidth: 360 }}>
    <div style={{ overflowWrap: 'anywhere', marginBottom: 4 }}>{player.musicName || `${player.groupName}-${player.name}-${player.performanceTitle || '节目名称'}`}</div>
    <div style={{ color: '#64748b', fontSize: 12 }}>{failed ? '音乐暂时无法播放，请刷新重试' : label}</div>
    <audio key={player.musicUrl} aria-label={`${player.name}的参赛音乐`} controls preload="metadata" style={{ width: '100%', height: 32 }} src={player.musicUrl}
      onLoadedMetadata={event => { const value = event.currentTarget.duration; if (Number.isFinite(value)) setDuration(value); setFailed(false); }}
      onError={() => setFailed(true)} onPlay={event => { document.querySelectorAll('audio').forEach(audio => { if (audio !== event.currentTarget) audio.pause(); }); }} />
  </div>;
}
