'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClockCircleOutlined, CustomerServiceOutlined, PlusOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Input, List, Modal, Progress, Row, Segmented, Skeleton, Space, Tag, Typography, message } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import { studentApi } from '@/lib/student-api';

const { Text, Title } = Typography;
const { TextArea } = Input;

type PlayInfo = {
  video_url: string;
  type?: string;
  duration?: number;
  material_id?: string | number;
};

type ProgressInfo = {
  progress?: number;
  duration?: number;
  completed?: boolean;
};

type CourseVideo = {
  id: string | number;
  material_id?: string | number;
  name: string;
  duration?: number | string;
};

type CourseChapter = {
  id: string | number;
  name: string;
  sort_order?: number;
  videos?: CourseVideo[];
};

type TimedItem = {
  id: string | number;
  timestamp_seconds: number;
  content?: string;
  label?: string;
  created_at?: string;
};

const cardStyle = {
  borderRadius: 8,
  borderColor: 'var(--learn-border)',
  boxShadow: 'var(--learn-shadow)',
  background: 'var(--learn-card)',
};

function authHeaders(token: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function readJson<T>(url: string, token: string | null): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const payload = await res.json();
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || `请求失败 (${res.status})`);
  }
  return (payload?.data ?? payload) as T;
}

async function postJson(url: string, token: string | null, body: Record<string, unknown>, keepalive = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
    keepalive,
  });
  if (!res.ok) throw new Error(`保存失败 (${res.status})`);
  const payload = await res.json().catch(() => null);
  if (payload?.success === false) throw new Error(payload.message || payload.error || '保存失败');
  return payload;
}

function formatDuration(value?: number | string): string {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export default function CourseVideoPage() {
  const router = useRouter();
  const params = useParams();
  const seriesId = String(params?.id || '');
  const videoId = String(params?.videoId || '');
  const videoRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const memberIdRef = useRef('');
  const tokenRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [notes, setNotes] = useState<TimedItem[]>([]);
  const [resumeSeconds, setResumeSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sidePanel, setSidePanel] = useState<'notes' | 'catalog'>('notes');
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentVideo = useMemo(() => {
    for (const chapter of chapters) {
      const found = chapter.videos?.find(video => String(video.id) === videoId || String(video.material_id) === videoId);
      if (found) return found;
    }
    return null;
  }, [chapters, videoId]);

  const currentChapter = useMemo(() => {
    return chapters.find(chapter => chapter.videos?.some(video => String(video.id) === videoId || String(video.material_id) === videoId)) || null;
  }, [chapters, videoId]);

  const currentCourseTitle = currentChapter?.name || currentVideo?.name?.replace(/\.(mp4|mov|m4v|webm|m4a|mp3|wav|aac)$/i, '') || '课程视频';

  const mediaType = playInfo?.type === 'audio' ? 'audio' : 'video';
  const progressPercent = duration ? Math.min(100, Math.round((currentSeconds / duration) * 100)) : 0;

  const loadPage = useCallback(async () => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    if (!token || !member?.id) {
      router.replace('/learn/login');
      return;
    }

    tokenRef.current = token;
    memberIdRef.current = member.id;
    restoredRef.current = false;
    setLoading(true);
    setError('');
    try {
      const [playData, progressData, outlineRows, noteRows] = await Promise.all([
        readJson<PlayInfo>(`/api/mini/video/${encodeURIComponent(videoId)}/play`, token),
        readJson<ProgressInfo>(`/api/mini/video/${encodeURIComponent(videoId)}/progress`, token).catch((): ProgressInfo => ({ progress: 0 })),
        readJson<CourseChapter[]>(`/api/mini/public/series/${encodeURIComponent(seriesId)}/courses`, token),
        readJson<TimedItem[]>(`/api/mini/notes/all?member_id=${encodeURIComponent(member.id)}&video_id=${encodeURIComponent(videoId)}`, token).catch(() => []),
      ]);
      setPlayInfo(playData);
      setVideoUrl(playData.video_url || '');
      setDuration(Number(progressData.duration || playData.duration || 0));
      setResumeSeconds(Number(progressData.progress || 0));
      setCurrentSeconds(Number(progressData.progress || 0));
      setChapters((outlineRows || []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
      setNotes(noteRows || []);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : '视频加载失败';
      if (messageText.includes('401') || messageText.includes('登录')) {
        studentApi.clearAuth();
        router.replace('/learn/login');
        return;
      }
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [router, seriesId, videoId]);

  const saveProgress = useCallback(async (keepalive = false) => {
    const video = videoRef.current;
    const memberId = memberIdRef.current;
    if (!video || !memberId || !videoId) return;
    const nextProgress = Math.floor(video.currentTime || 0);
    const nextDuration = Math.floor(video.duration || duration || playInfo?.duration || 0);
    if (nextDuration <= 0 && nextProgress <= 0) return;

    await postJson(`/api/mini/video/${encodeURIComponent(videoId)}/progress`, tokenRef.current, {
      member_id: memberId,
      progress: nextProgress,
      duration: nextDuration,
    }, keepalive);
  }, [duration, playInfo?.duration, videoId]);

  useEffect(() => {
    if (seriesId && videoId) loadPage();
  }, [loadPage, seriesId, videoId]);

  useEffect(() => {
    if (!videoUrl) return;
    const timer = window.setInterval(() => {
      saveProgress().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [saveProgress, videoUrl]);

  useEffect(() => {
    const handleLeave = () => {
      saveProgress(true).catch(() => undefined);
    };
    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    return () => {
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      handleLeave();
    };
  }, [saveProgress]);

  const refreshNotes = async () => {
    const memberId = memberIdRef.current;
    if (!memberId) return;
    const rows = await readJson<TimedItem[]>(`/api/mini/notes/all?member_id=${encodeURIComponent(memberId)}&video_id=${encodeURIComponent(videoId)}`, tokenRef.current);
    setNotes(rows || []);
  };

  const addNote = async () => {
    const memberId = memberIdRef.current;
    if (!memberId || !noteContent.trim()) return;
    setSaving(true);
    try {
      await postJson('/api/mini/notes', tokenRef.current, {
        member_id: memberId,
        video_id: videoId,
        timestamp_seconds: Math.floor(videoRef.current?.currentTime || currentSeconds),
        content: noteContent.trim(),
      });
      setNoteContent('');
      setNoteOpen(false);
      await refreshNotes();
      message.success('笔记已添加');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '笔记添加失败');
    } finally {
      setSaving(false);
    }
  };

  const seekTo = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    setCurrentSeconds(seconds);
  };

  return (
    <main className="learn-page learn-video-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', color: 'var(--learn-text)', padding: '24px clamp(14px, 3vw, 34px)' }}>
      <Button href={`/learn/courses/${seriesId}`} style={{ marginBottom: 16, borderRadius: 4 }}>返回课程目录</Button>
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 18, borderRadius: 8 }} /> : null}

      {loading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <Row gutter={[18, 18]} align="top">
          <Col xs={24} lg={18}>
            <Card className="learn-video-player-card" style={cardStyle} styles={{ body: { padding: 0 } }}>
              <div style={{ background: '#140F0C', borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                {videoUrl ? (
                  mediaType === 'audio' ? (
                    <>
                      <div style={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'linear-gradient(135deg, #17110F 0%, #56332C 48%, #B88A44 100%)', color: '#fff', padding: 24, textAlign: 'center' }}>
                        <CustomerServiceOutlined style={{ fontSize: 56, color: '#F8E5B4' }} />
                        <div style={{ fontSize: 20, fontWeight: 600, maxWidth: 560 }}>{currentCourseTitle}</div>
                      </div>
                      <audio
                        ref={videoRef as any}
                        src={videoUrl}
                        controls
                        preload="metadata"
                        style={{ width: '100%', display: 'block', background: '#140F0C' }}
                        onLoadedMetadata={event => {
                          const target = event.currentTarget;
                          setError('');
                          setDuration(Math.floor(target.duration || duration || playInfo?.duration || 0));
                          if (!restoredRef.current && resumeSeconds > 0 && resumeSeconds < target.duration) {
                            target.currentTime = resumeSeconds;
                            restoredRef.current = true;
                          }
                        }}
                        onError={() => setError('音频播放失败，请稍后重试')}
                        onTimeUpdate={event => setCurrentSeconds(Math.floor(event.currentTarget.currentTime || 0))}
                        onPause={() => saveProgress().catch(() => undefined)}
                        onEnded={() => saveProgress().catch(() => undefined)}
                      />
                    </>
                  ) : (
                    <video
                      ref={videoRef as any}
                      src={videoUrl}
                      controls
                      preload="metadata"
                      style={{ width: '100%', aspectRatio: '16 / 9', display: 'block', background: '#140F0C' }}
                      onLoadedMetadata={event => {
                        const target = event.currentTarget;
                        setError('');
                        setDuration(Math.floor(target.duration || duration || playInfo?.duration || 0));
                        if (!restoredRef.current && resumeSeconds > 0 && resumeSeconds < target.duration) {
                          target.currentTime = resumeSeconds;
                          restoredRef.current = true;
                        }
                      }}
                      onError={() => setError('视频播放失败，请稍后重试；如果是刚上传的视频，可能还在转码。')}
                      onTimeUpdate={event => setCurrentSeconds(Math.floor(event.currentTarget.currentTime || 0))}
                      onPause={() => saveProgress().catch(() => undefined)}
                      onEnded={() => saveProgress().catch(() => undefined)}
                    />
                  )
                ) : (
                  <div style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', color: '#fff' }}>暂无可播放地址</div>
                )}
              </div>
              <div style={{ padding: 20 }}>
                <Space wrap size={10}>
                  <Tag color="gold">{mediaType === 'audio' ? <CustomerServiceOutlined /> : <VideoCameraOutlined />} {mediaType === 'audio' ? '当前音频' : '当前视频'}</Tag>
                </Space>
                <Title level={3} style={{ margin: '12px 0 8px', color: 'var(--learn-text)' }}>{currentCourseTitle}</Title>
                <Row justify="space-between" align="middle" style={{ gap: 12 }}>
                  <Text style={{ color: 'var(--learn-muted)' }}><ClockCircleOutlined /> {formatDuration(currentSeconds)} / {formatDuration(duration)}</Text>
                  <Text strong style={{ color: 'var(--learn-gold-dark)' }}>进度 {progressPercent}%</Text>
                </Row>
                <Progress percent={progressPercent} showInfo={false} strokeColor="var(--learn-gold)" trailColor="#EFE6D7" />
                <Space className="learn-video-actions" wrap style={{ marginTop: 14 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setNoteOpen(true)}>添加笔记</Button>
                </Space>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={6}>
            <Card className="learn-video-outline-card" style={{ ...cardStyle, position: 'sticky', top: 16 }} styles={{ body: { maxHeight: 'calc(100vh - 130px)', overflow: 'auto', padding: 0 } }}>
              <div className="learn-course-detail-panel-nav">
                <Segmented
                  block
                  value={sidePanel}
                  onChange={value => setSidePanel(value as 'notes' | 'catalog')}
                  options={[
                    { label: '课程笔记', value: 'notes' },
                    { label: '课程目录', value: 'catalog' },
                  ]}
                />
              </div>
              <div className="learn-course-detail-panel-body">
                {sidePanel === 'notes' ? (
                  notes.length ? (
                    <List
                      dataSource={notes}
                      renderItem={item => (
                        <List.Item actions={[<Button type="link" key="seek" onClick={() => seekTo(item.timestamp_seconds)}>跳转</Button>]}>
                          <List.Item.Meta title={`${formatDuration(item.timestamp_seconds)}  ${item.content || ''}`} description={item.created_at || ''} />
                        </List.Item>
                      )}
                    />
                  ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无笔记" />
                ) : (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    {chapters.map((chapter, chapterIndex) => {
                      const videos = chapter.videos || [];
                      if (videos.length === 1) {
                        const video = videos[0];
                        const active = String(video.id) === videoId || String(video.material_id) === videoId;
                        return (
                          <button
                            key={chapter.id}
                            type="button"
                            onClick={() => router.push(`/learn/courses/${seriesId}/videos/${video.id}`)}
                            style={{
                              width: '100%',
                              border: `1px solid ${active ? 'var(--learn-gold)' : 'var(--learn-border)'}`,
                              background: active ? '#F7EEDB' : '#FFFDF8',
                              color: 'var(--learn-text)',
                              borderRadius: 8,
                              padding: '10px 12px',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <Text strong={active} style={{ color: active ? 'var(--learn-red)' : 'var(--learn-text)' }}>{chapterIndex + 1}. {chapter.name}</Text>
                          </button>
                        );
                      }

                      return (
                        <div key={chapter.id}>
                          <Text strong style={{ color: 'var(--learn-text)' }}>{chapterIndex + 1}. {chapter.name}</Text>
                          <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                            {videos.map(video => {
                              const active = String(video.id) === videoId || String(video.material_id) === videoId;
                              return (
                                <button
                                  key={video.id}
                                  type="button"
                                  onClick={() => router.push(`/learn/courses/${seriesId}/videos/${video.id}`)}
                                  style={{
                                    width: '100%',
                                    border: `1px solid ${active ? 'var(--learn-gold)' : 'var(--learn-border)'}`,
                                    background: active ? '#F7EEDB' : '#FFFDF8',
                                    color: 'var(--learn-text)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Text strong={active} style={{ color: active ? 'var(--learn-red)' : 'var(--learn-text)' }}>{chapter.name}</Text>
                                </button>
                              );
                            })}
                          </Space>
                        </div>
                      );
                    })}
                    {!chapters.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无课程目录" /> : null}
                  </Space>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Modal title={`添加笔记 - ${formatDuration(currentSeconds)}`} open={noteOpen} onOk={addNote} confirmLoading={saving} onCancel={() => setNoteOpen(false)} okText="保存" cancelText="取消">
        <TextArea rows={5} value={noteContent} onChange={event => setNoteContent(event.target.value)} placeholder="记录这一刻的重点、动作细节或练习感受" />
      </Modal>

    </main>
  );
}
