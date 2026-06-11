'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOutlined, PlayCircleFilled, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Progress, Skeleton, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { hideBrokenCover, normalizeLearnCover } from '@/lib/learn-cover';
import { platformLinks } from '@/lib/platform-links';
import { studentApi } from '@/lib/student-api';

const { Text, Title } = Typography;

type AuthorizedSeries = {
  series_id: string | number;
  series_name?: string;
  granted_at?: string;
};

type PublicSeries = {
  id: string | number;
  name: string;
  subtitle?: string;
  category?: string;
  teacher?: string;
  cover_image?: string;
  total_courses?: number;
  total_students?: number;
  description?: string;
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

export default function LearnCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<PublicSeries[]>([]);
  const [authorizedIds, setAuthorizedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    if (!token || !member?.id) {
      router.replace('/learn/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [authorizedRows, publicRows] = await Promise.all([
        readJson<AuthorizedSeries[]>(`/api/mini/member/authorized-series?member_id=${encodeURIComponent(member.id)}`, token),
        readJson<PublicSeries[]>('/api/mini/public/series', token),
      ]);
      const ids = new Set((authorizedRows || []).map(item => String(item.series_id)));
      setAuthorizedIds(ids);
      setCourses((publicRows || []).filter(item => ids.has(String(item.id))));
    } catch (err) {
      const message = err instanceof Error ? err.message : '课程加载失败';
      if (message.includes('401') || message.includes('登录')) {
        studentApi.clearAuth();
        router.replace('/learn/login');
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const filteredCourses = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return courses;
    return courses.filter(course => {
      const text = `${course.name || ''} ${course.subtitle || ''} ${course.teacher || ''} ${course.category || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [courses, query]);

  return (
    <main className="learn-page learn-courses-list-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', color: 'var(--learn-text)', padding: '28px clamp(16px, 4vw, 42px)' }}>
      <header className="learn-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <Button href="/learn" type="link" style={{ padding: 0, color: 'var(--learn-gold-dark)', fontWeight: 800 }}>返回学习中心</Button>
          <Title level={2} style={{ margin: '6px 0 8px', color: 'var(--learn-text)' }}>我的线上课程</Title>
          <Text style={{ color: 'var(--learn-muted)' }}>已授权 {authorizedIds.size} 门课程，继续你的东方舞学习进度</Text>
        </div>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined style={{ color: 'var(--learn-muted)' }} />}
          placeholder="搜索课程名称、教师、类别"
          value={query}
          onChange={event => setQuery(event.target.value)}
          style={{ width: 360, maxWidth: '100%', borderRadius: 4, background: 'var(--learn-card)', borderColor: 'var(--learn-border)' }}
        />
      </header>

      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 18, borderRadius: 8 }} /> : null}

      {loading ? (
        <div className="learn-authorized-course-list">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card className="learn-authorized-course-card" style={cardStyle} styles={{ body: { padding: 0 } }} key={index}>
              <div className="learn-authorized-course-row">
                <Skeleton.Image active className="learn-authorized-course-cover-skeleton" />
                <div className="learn-authorized-course-info">
                  <Skeleton active title={{ width: '70%' }} paragraph={{ rows: 3 }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredCourses.length ? (
        <div className="learn-authorized-course-list">
          {filteredCourses.map(course => (
            <Card
              hoverable
              className="learn-course-card learn-authorized-course-card"
              style={{ ...cardStyle, overflow: 'hidden' }}
              styles={{ body: { padding: 0 } }}
              onClick={() => router.push(`/learn/courses/${course.id}`)}
              key={course.id}
            >
              <div className="learn-authorized-course-row">
                <div className="learn-authorized-course-cover">
                  <img
                    src={normalizeLearnCover(course.cover_image)}
                    alt={course.name}
                    onError={hideBrokenCover}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.86, display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(44,24,16,0.04),rgba(44,24,16,0.45))' }} />
                  <PlayCircleFilled className="learn-authorized-course-play" />
                  {course.category ? <Tag className="learn-authorized-course-tag">{course.category}</Tag> : null}
                </div>
                <div className="learn-authorized-course-info">
                  <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: 0, color: 'var(--learn-text)' }}>{course.name}</Title>
                  <div className="learn-authorized-course-meta">
                    <Text className="learn-authorized-course-meta-line"><UserOutlined /> {course.teacher || '伊娃东方舞导师'}</Text>
                    <Text className="learn-authorized-course-meta-line"><BookOutlined /> {course.total_courses || 0} 节课程</Text>
                    <Text className="learn-authorized-course-meta-line"><TeamOutlined /> {course.total_students || 0} 人学习</Text>
                  </div>
                  <div className="learn-authorized-course-progress">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={{ color: 'var(--learn-muted)' }}>学习进度</Text>
                      <Text strong style={{ color: 'var(--learn-gold-dark)' }}>0%</Text>
                    </div>
                    <Progress percent={0} showInfo={false} strokeColor="var(--learn-gold)" trailColor="#EFE6D7" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={cardStyle}>
          <Empty description={query ? '没有匹配的已授权课程' : '暂无已授权课程'}>
            <Button type="primary" href={platformLinks.website.courses}>查看公开课程</Button>
          </Empty>
        </Card>
      )}
    </main>
  );
}
