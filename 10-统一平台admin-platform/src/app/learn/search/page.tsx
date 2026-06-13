'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FireOutlined, SearchOutlined, TeamOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Input, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { hideBrokenCover, normalizeLearnCover } from '@/lib/learn-cover';
import { platformLinks } from '@/lib/platform-links';
import { studentApi } from '@/lib/student-api';

const { Paragraph, Text, Title } = Typography;

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

export default function CourseSearchPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<PublicSeries[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('全部');
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
      const rows = await readJson<PublicSeries[]>('/api/mini/public/series', token);
      setCourses(rows || []);
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const categories = useMemo(() => {
    const values = Array.from(new Set(courses.map(course => course.category).filter(Boolean))) as string[];
    return ['全部', ...values];
  }, [courses]);

  const results = useMemo(() => {
    return courses.filter(course => {
      const matchesCategory = category === '全部' || course.category === category;
      const text = `${course.name || ''} ${course.subtitle || ''} ${course.teacher || ''}`.toLowerCase();
      const matchesQuery = !debouncedQuery || text.includes(debouncedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, courses, debouncedQuery]);

  const recommended = useMemo(() => courses.slice(0, 8), [courses]);
  const displayCourses = query || category !== '全部' ? results : recommended;

  return (
    <main className="learn-page learn-search-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', color: 'var(--learn-text)', padding: '30px clamp(16px, 4vw, 42px)' }}>
      <Button href="/learn" type="link" style={{ padding: 0, color: 'var(--learn-gold-dark)', fontWeight: 800 }}>返回个人中心</Button>

      <section className="learn-search-hero" style={{ margin: '10px 0 26px', padding: '30px clamp(18px, 4vw, 40px)', borderRadius: 8, background: 'linear-gradient(135deg,#FFFDF8,#F2E6CF)', border: '1px solid var(--learn-border)', boxShadow: 'var(--learn-shadow)' }}>
        <Title level={1} style={{ margin: 0, color: 'var(--learn-red)' }}>课程探索</Title>
        <Paragraph style={{ color: 'var(--learn-muted)', margin: '10px 0 22px', maxWidth: 620 }}>按课程名称、教师和类别筛选公开线上课程，找到适合当前阶段的训练内容。</Paragraph>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined style={{ color: 'var(--learn-muted)', fontSize: 20 }} />}
          placeholder="搜索课程名称或教师"
          value={query}
          onChange={event => setQuery(event.target.value)}
          style={{ maxWidth: 720, height: 52, borderRadius: 4, background: 'var(--learn-card)', borderColor: 'var(--learn-border)' }}
        />
      </section>

      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 18, borderRadius: 8 }} /> : null}

      <Space size={[8, 8]} wrap style={{ marginBottom: 18 }}>
        {categories.map(item => (
          <Button
            key={item}
            type={item === category ? 'primary' : 'default'}
            onClick={() => setCategory(item)}
            style={{ borderRadius: 4 }}
          >
            {item}
          </Button>
        ))}
      </Space>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: 'var(--learn-text)' }}>
          {query || category !== '全部' ? '搜索结果' : <Space><FireOutlined /> 热门课程推荐</Space>}
        </Title>
        <Text style={{ color: 'var(--learn-muted)' }}>{displayCourses.length} 门课程</Text>
      </Row>

      {loading ? (
        <div className="learn-search-course-list">
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
      ) : displayCourses.length ? (
        <div className="learn-search-course-list">
          {displayCourses.map(course => (
            <Card
              hoverable
              className="learn-course-card learn-authorized-course-card"
              style={{ ...cardStyle, overflow: 'hidden' }}
              styles={{ body: { padding: 0 } }}
              onClick={() => router.push(`/learn/courses/${course.id}?section=lessons`)}
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
                  {course.category ? <Tag className="learn-authorized-course-tag" style={{ color: 'var(--learn-red)', borderColor: 'var(--learn-gold)', background: '#FFFDF8' }}>{course.category}</Tag> : null}
                </div>
                <div className="learn-authorized-course-info">
                  <Title level={5} ellipsis={{ rows: 2 }} style={{ margin: 0, color: 'var(--learn-text)' }}>{course.name}</Title>
                  <Text ellipsis style={{ color: 'var(--learn-muted)', display: 'block', marginTop: 8 }}>{course.subtitle || course.description || '系统课程内容'}</Text>
                  <div className="learn-authorized-course-meta">
                    <Text className="learn-authorized-course-meta-line"><UserOutlined /> {course.teacher || '伊娃东方舞导师'}</Text>
                    <Text className="learn-authorized-course-meta-line"><VideoCameraOutlined /> {course.total_courses || 0} 节内容</Text>
                    <Text className="learn-authorized-course-meta-line"><TeamOutlined /> {course.total_students || 0} 人学习</Text>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={cardStyle}>
          <Empty description="没有匹配的课程">
            <Button onClick={() => { setQuery(''); setCategory('全部'); }}>清空筛选</Button>
            <Button type="primary" href={platformLinks.website.courses} style={{ marginLeft: 8 }}>查看官网课程</Button>
          </Empty>
        </Card>
      )}
    </main>
  );
}
