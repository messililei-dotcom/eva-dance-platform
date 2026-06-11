'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, PlayCircleOutlined, ReadOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Progress, Segmented, Skeleton, Spin, Tag, Typography } from 'antd';
import { useParams, useRouter } from 'next/navigation';
import OfficialWebsiteNav from '@/app/learn/components/OfficialWebsiteNav';
import { hideBrokenCover, normalizeLearnCover } from '@/lib/learn-cover';
import { studentApi } from '@/lib/student-api';

const { Paragraph, Text, Title } = Typography;

type SeriesDetail = {
  id: string | number;
  name: string;
  subtitle?: string;
  cover_image?: string;
  teacher?: string;
  total_courses?: number;
  rich_description?: string;
  description?: string;
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
  description?: string;
  duration?: number | string;
  video_count?: number;
  is_free_trial?: number | boolean;
  sort_order?: number;
  videos?: CourseVideo[];
};

const cardStyle = {
  borderRadius: 8,
  borderColor: 'var(--learn-border)',
  boxShadow: 'var(--learn-shadow)',
  background: 'var(--learn-card)',
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson<T>(url: string, token: string | null): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const payload = await res.json();
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || `请求失败 (${res.status})`);
  }
  return (payload?.data ?? payload) as T;
}

function formatVideoTitle(name: string): string {
  return name.replace(/\.(mp4|mov|m4v|webm)$/i, '');
}

function formatDuration(value?: number | string): string {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

const allowedHtmlTags = new Set([
  'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'img', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'u', 's', 'blockquote', 'pre', 'code', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
]);
const voidHtmlTags = new Set(['br', 'hr', 'img']);
const globalHtmlAttrs = new Set(['title', 'class']);
const tagHtmlAttrs: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isSafeHtmlUrl(value: string): boolean {
  const text = value.trim().replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
  if (!text) return false;
  return /^(https?:|mailto:|tel:|\/|#)/.test(text) || /^data:image\/(?:png|jpe?g|gif|webp);base64,/.test(text);
}

function sanitizeHtmlAttributes(tagName: string, attrs: string): string {
  const allowedAttrs = new Set([...Array.from(tagHtmlAttrs[tagName] || []), ...Array.from(globalHtmlAttrs)]);
  const safeAttrs: string[] = [];
  attrs.replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g, (_match, rawName, doubleValue, singleValue, unquotedValue) => {
    const name = String(rawName).toLowerCase();
    const value = String(doubleValue ?? singleValue ?? unquotedValue ?? '');
    if (!allowedAttrs.has(name) || name.startsWith('on')) return '';
    if ((name === 'href' || name === 'src') && !isSafeHtmlUrl(value)) return '';
    if (name === 'target' && value !== '_blank' && value !== '_self') return '';
    safeAttrs.push(`${name}="${escapeHtml(value)}"`);
    return '';
  });
  if (tagName === 'a' && safeAttrs.some(attr => attr === 'target="_blank"') && !safeAttrs.some(attr => attr.startsWith('rel='))) {
    safeAttrs.push('rel="noopener noreferrer"');
  }
  return safeAttrs.length ? ` ${safeAttrs.join(' ')}` : '';
}

function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tagName, attrs) => {
      const lower = String(tagName).toLowerCase();
      if (!allowedHtmlTags.has(lower)) return escapeHtml(match);
      if (match.startsWith('</')) return `</${lower}>`;
      const suffix = voidHtmlTags.has(lower) ? ' />' : '>';
      return `<${lower}${sanitizeHtmlAttributes(lower, String(attrs || ''))}${suffix}`;
    })
    .replace(/javascript\s*:/gi, '');
}

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || '');
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState<'intro' | 'catalog'>('intro');

  const loadDetail = useCallback(async () => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    if (!token || !member?.id) {
      router.replace('/learn/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [seriesDetail, courseRows] = await Promise.all([
        readJson<SeriesDetail>(`/api/mini/public/series/${encodeURIComponent(id)}/detail`, token),
        readJson<CourseChapter[]>(`/api/mini/public/series/${encodeURIComponent(id)}/courses`, token),
      ]);
      setDetail(seriesDetail);
      setChapters((courseRows || []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)));
    } catch (err) {
      const message = err instanceof Error ? err.message : '课程详情加载失败';
      if (message.includes('401') || message.includes('登录')) {
        studentApi.clearAuth();
        router.replace('/learn/login');
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (id) loadDetail();
  }, [id, loadDetail]);

  const videoCount = useMemo(() => chapters.reduce((sum, chapter) => sum + (chapter.videos?.length || chapter.video_count || 0), 0), [chapters]);
  const firstPlayableVideo = useMemo(() => chapters.flatMap(chapter => chapter.videos || [])[0], [chapters]);
  const playVideo = useCallback((videoId: string | number) => {
    router.push(`/learn/courses/${id}/videos/${videoId}`);
  }, [id, router]);

  if (loading) {
    return (
      <main className="learn-page learn-course-detail-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', padding: '28px clamp(16px, 4vw, 42px)' }}>
        <OfficialWebsiteNav />
        <Skeleton active paragraph={{ rows: 8 }} />
      </main>
    );
  }

  return (
    <main className="learn-page learn-course-detail-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', color: 'var(--learn-text)', padding: '28px clamp(16px, 4vw, 42px)' }}>
      <OfficialWebsiteNav />
      <div className="learn-course-detail-topline">
        <Button className="learn-course-detail-back" icon={<ArrowLeftOutlined />} href="/learn/courses" style={{ borderRadius: 4 }}>返回课程列表</Button>
      </div>
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 18, borderRadius: 8 }} /> : null}

      {detail ? (
        <section className="learn-course-detail-hero">
          <div className="learn-course-detail-hero-cover">
            <img
              src={normalizeLearnCover(detail.cover_image)}
              alt={detail.name}
              onError={hideBrokenCover}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.86, display: 'block' }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(44,24,16,.08),rgba(44,24,16,.42))' }} />
          </div>
          <Card className="learn-course-detail-info-card" style={cardStyle}>
            <Tag color="gold" className="learn-course-detail-tag">线上课程</Tag>
            <Title level={1} className="learn-course-detail-title">{detail.name}</Title>
            {detail.subtitle ? <Paragraph className="learn-course-detail-subtitle">{detail.subtitle}</Paragraph> : null}
            <div className="learn-course-detail-meta">
              <Text><UserOutlined /> {detail.teacher || '伊娃东方舞导师'}</Text>
              <Text><ReadOutlined /> {chapters.length} 章</Text>
              <Text><VideoCameraOutlined /> {videoCount || detail.total_courses || 0} 个视频</Text>
            </div>
            <div className="learn-course-detail-progress">
              <div className="learn-course-detail-progress-label">
                <Text style={{ color: 'var(--learn-muted)' }}>学习进度</Text>
                <Text strong style={{ color: 'var(--learn-gold-dark)' }}>0%</Text>
              </div>
              <Progress percent={0} showInfo={false} strokeColor="var(--learn-gold)" trailColor="#EFE6D7" />
            </div>
            <div className="learn-course-detail-actions">
              <Button type="primary" icon={<PlayCircleOutlined />} disabled={!firstPlayableVideo} onClick={() => firstPlayableVideo && playVideo(firstPlayableVideo.id)}>
                开始学习
              </Button>
              <Button onClick={() => setActivePanel('catalog')}>看目录</Button>
            </div>
          </Card>
        </section>
      ) : null}

      <section className="learn-course-detail-panels">
        <Card style={cardStyle} styles={{ body: { padding: 0 } }}>
          <div className="learn-course-detail-panel-nav">
            <Segmented
              block
              value={activePanel}
              onChange={value => setActivePanel(value as 'intro' | 'catalog')}
              options={[
                { label: '课程介绍', value: 'intro' },
                { label: `课程目录 ${chapters.length}章`, value: 'catalog' },
              ]}
            />
          </div>

          {activePanel === 'intro' ? (
            <div className="learn-course-detail-panel-body">
              {detail?.rich_description ? (
                <div className="learn-rich-content" style={{ color: 'var(--learn-text)', lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(detail.rich_description) }} />
              ) : (
                <Paragraph style={{ color: 'var(--learn-muted)', marginBottom: 0 }}>{detail?.description || '暂无课程简介'}</Paragraph>
              )}
            </div>
          ) : (
            <div className="learn-course-detail-panel-body learn-course-catalog">
              {chapters.length ? (
                chapters.map((chapter, chapterIndex) => {
                  const videos = chapter.videos || [];
                  const singleVideo = videos.length === 1 ? videos[0] : null;
                  return (
                    <div className="learn-catalog-chapter" key={chapter.id}>
                      <div
                        className={singleVideo ? 'learn-catalog-chapter-head is-playable' : 'learn-catalog-chapter-head'}
                        role={singleVideo ? 'button' : undefined}
                        tabIndex={singleVideo ? 0 : undefined}
                        onClick={() => singleVideo && playVideo(singleVideo.id)}
                        onKeyDown={(event) => {
                          if (singleVideo && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            playVideo(singleVideo.id);
                          }
                        }}
                      >
                        <div className="learn-catalog-title">
                          <span className="learn-catalog-index">{String(chapterIndex + 1).padStart(2, '0')}</span>
                          <div>
                            <Text strong>{chapter.name}</Text>
                            {chapter.description ? <Text className="learn-catalog-desc">{chapter.description}</Text> : null}
                          </div>
                        </div>
                        <div className="learn-catalog-meta">
                          {chapter.is_free_trial ? <Tag color="gold">试看</Tag> : null}
                          <Text>{videos.length || chapter.video_count || 0} 个视频</Text>
                          {formatDuration(chapter.duration || singleVideo?.duration) ? <Text>{formatDuration(chapter.duration || singleVideo?.duration)}</Text> : null}
                          {singleVideo ? <Text className="learn-catalog-play">播放</Text> : null}
                        </div>
                      </div>
                      {videos.length > 1 ? (
                        <div className="learn-catalog-videos">
                          {videos.map((video, videoIndex) => (
                            <button className="learn-catalog-video-row" key={video.id} type="button" onClick={() => playVideo(video.id)}>
                              <span className="learn-catalog-video-main">
                                <PlayCircleOutlined />
                                <span>{chapterIndex + 1}.{videoIndex + 1} {formatVideoTitle(video.name)}</span>
                              </span>
                              <span className="learn-catalog-video-side">{formatDuration(video.duration) || '播放'}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : error ? null : (
                <Spin tip="正在加载课程目录" />
              )}
              {!chapters.length && !error ? null : chapters.length ? null : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无课程目录" />}
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
