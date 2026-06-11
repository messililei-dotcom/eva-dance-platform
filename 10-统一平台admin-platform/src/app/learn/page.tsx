'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  FileDoneOutlined,
  GiftOutlined,
  HomeFilled,
  MailOutlined,
  PlayCircleFilled,
  PlayCircleOutlined,
  ProfileOutlined,
  ReadOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  TrophyOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Alert, Avatar, Badge, Button, Card, Col, Empty, Form, Input, Modal, Progress, Row, Skeleton, Space, Tag, Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import { hideBrokenCover, normalizeLearnCover } from '@/lib/learn-cover';
import { platformLinks } from '@/lib/platform-links';
import { studentApi, type StudentCertificate, type StudentCourse, type StudentHomeData } from '@/lib/student-api';
import OfficialWebsiteNav from './components/OfficialWebsiteNav';

const { Text, Title } = Typography;

const BRAND = {
  gold: '#C8A96E',
  goldDark: '#A98746',
  red: '#8B1A1A',
  bg: '#F7F3EB',
  text: '#2C1810',
  muted: '#8C8172',
  border: '#E8DDCB',
  card: '#FFFDF8',
  shadow: '0 2px 8px rgba(44,24,16,0.06)',
};

const cardStyle = {
  borderRadius: 8,
  borderColor: BRAND.border,
  boxShadow: '0 10px 28px rgba(44,24,16,0.07)',
  background: BRAND.card,
};

const navItems = [
  { icon: <HomeFilled />, label: '首页', href: platformLinks.learn.home, hash: '' },
  { icon: <BookOutlined />, label: '我的课程', href: '/learn/courses' },
  { icon: <ReadOutlined />, label: '线下课程', href: '/learn/offline' },
  { icon: <CheckCircleFilled />, label: '签到核销', href: '#checkins' },
  { icon: <ProfileOutlined />, label: '学习计划', href: '#plans' },
  { icon: <SearchOutlined />, label: '课程探索', href: '/learn/search' },
  { icon: <FileDoneOutlined />, label: '我的作业', href: platformLinks.learn.assignments },
  { icon: <TrophyOutlined />, label: '我的证书', href: '#certificates' },
  { icon: <StarOutlined />, label: '收藏夹', href: '#favorites' },
  { icon: <ClockCircleOutlined />, label: '学习记录', href: '#records' },
  { icon: <GiftOutlined />, label: '积分商城', href: platformLinks.website.shop },
  { icon: <BellOutlined />, label: '消息中心', href: '#messages' },
  { icon: <ProfileOutlined />, label: '个人资料', href: '#profile' },
  { icon: <CustomerServiceOutlined />, label: '帮助中心', href: platformLinks.learn.support },
];

const quickLinks = [
  { icon: <VideoCameraOutlined />, label: '直播课表', bg: '#F2E6CF', color: BRAND.goldDark, href: platformLinks.learn.calendar },
  { icon: <UsergroupAddOutlined />, label: '线下课程', bg: '#F7E8E2', color: BRAND.red, href: platformLinks.website.courses },
  { icon: <ProfileOutlined />, label: '作业中心', bg: '#EFE6D7', color: BRAND.goldDark, href: platformLinks.learn.assignments },
  { icon: <CheckCircleFilled />, label: '签到核销', bg: '#F3EDE2', color: BRAND.gold, href: '#checkins' },
  { icon: <GiftOutlined />, label: '积分商城', bg: '#F7E8E2', color: BRAND.red, href: platformLinks.website.shop },
  { icon: <TrophyOutlined />, label: '我的证书', bg: '#F2E6CF', color: BRAND.goldDark, href: '#certificates' },
  { icon: <StarFilled />, label: '收藏夹', bg: '#EFE6D7', color: BRAND.gold, href: '#favorites' },
  { icon: <CustomerServiceOutlined />, label: '客服中心', bg: '#F3EDE2', color: BRAND.red, href: platformLinks.learn.support },
];

function CourseThumb({ accent, cover }: { accent: string; cover?: string }) {
  return (
    <div className="learn-course-thumb" style={{
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      position: 'relative',
      background: `linear-gradient(135deg, ${accent || BRAND.gold}, ${BRAND.red})`,
    }}>
      <img
        src={normalizeLearnCover(cover)}
        alt="课程封面"
        onError={hideBrokenCover}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.86, display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(44,24,16,.34))' }} />
      <PlayCircleFilled style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#fff', fontSize: 34, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.28))' }} />
    </div>
  );
}

function EmptyBlock({ description }: { description: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} style={{ margin: '18px 0' }} />;
}

function CourseCard({ course, onOpen }: { course: StudentCourse; onOpen: () => void }) {
  return (
    <div
      className="learn-course-card learn-authorized-course-card learn-home-course-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      style={{
        height: '100%',
        border: `1px solid ${BRAND.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: BRAND.card,
        boxShadow: BRAND.shadow,
        cursor: 'pointer',
      }}
    >
      <div className="learn-authorized-course-row">
        <div className="learn-authorized-course-cover">
          <img
            src={normalizeLearnCover(course.cover)}
            alt={course.title}
            onError={hideBrokenCover}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.86, display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(44,24,16,0.04),rgba(44,24,16,0.45))' }} />
          <PlayCircleFilled className="learn-authorized-course-play" />
          <Tag className="learn-authorized-course-tag" style={{ borderColor: BRAND.red, color: BRAND.red, background: '#FFF7F2' }}>{course.tag}</Tag>
        </div>
        <div className="learn-authorized-course-info">
          <Text className="learn-course-title" strong style={{ color: BRAND.text }}>{course.title}</Text>
          <div className="learn-authorized-course-meta">
            <Text className="learn-authorized-course-meta-line"><UserOutlined /> 伊娃</Text>
            <Text className="learn-authorized-course-meta-line"><BookOutlined /> 共 {course.lessons} 节</Text>
          </div>
          <div className="learn-authorized-course-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: BRAND.muted }}>学习进度</Text>
              <Text style={{ color: BRAND.goldDark }}>{course.progress}%</Text>
            </div>
            <Progress percent={course.progress} showInfo={false} strokeColor={BRAND.gold} trailColor="#EFE6D7" />
          </div>
        </div>
      </div>
    </div>
  );
}

function paymentStatusText(status: string) {
  if (status === 'completed') return '已完成';
  if (status === 'expired') return '已到期';
  return '学习中';
}

function paymentStatusColor(status: string) {
  if (status === 'completed') return 'purple';
  if (status === 'expired') return 'red';
  return 'green';
}

export default function LearnCenterPage() {
  const router = useRouter();
  const [profileForm] = Form.useForm();
  const [data, setData] = useState<StudentHomeData | null>(null);
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [checkingPaymentId, setCheckingPaymentId] = useState('');
  const [error, setError] = useState('');
  const [currentHash, setCurrentHash] = useState('');

  const loadData = useCallback(async () => {
    const token = studentApi.getToken();
    const storedMember = studentApi.getStoredMember();
    if (!token || !storedMember?.id) {
      router.replace('/learn/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const memberId = storedMember.id;
      const [homeData, certificateRows, recentRecords, bookmarkData] = await Promise.all([
        studentApi.getHomeData(memberId),
        studentApi.getCertificates(memberId),
        fetch(`/api/mini/member/recent-courses?member_id=${memberId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(d => d.data || []).catch(() => []),
        fetch(`/api/mini/bookmarks/all?member_id=${memberId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(d => d.data || []).catch(() => []),
      ]);
      setData(homeData);
      setCertificates(certificateRows);
      setRecentRecords(recentRecords);
      setBookmarks(bookmarkData);
    } catch (err) {
      const message = err instanceof Error ? err.message : '数据加载失败';
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
    loadData();
  }, [loadData]);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const memberName = data?.member.name || '同学';
  const memberAvatar = data?.member.avatar || '/learn/dance-hero.webp';
  const memberLevel = data?.member.level || '学员';
  const completedPlans = useMemo(() => data?.plans.filter(item => item.done).length || 0, [data?.plans]);
  const planPercent = data?.plans.length ? Math.round((completedPlans / data.plans.length) * 100) : 0;
  const activePayments = useMemo(() => data?.payments.filter(item => item.status === 'active') || [], [data?.payments]);
  const completedPayments = useMemo(() => data?.payments.filter(item => item.status !== 'active') || [], [data?.payments]);
  const isNavActive = (item: (typeof navItems)[number]) => {
    if ('hash' in item) return item.hash === currentHash;
    const hashIndex = item.href.indexOf('#');
    return hashIndex >= 0 && item.href.slice(hashIndex) === currentHash;
  };
  const openProfileEditor = () => {
    if (!data?.member) return;
    profileForm.setFieldsValue(data.member);
    setProfileOpen(true);
  };
  const handleProfileSave = async () => {
    if (!data?.member.id) return;
    setSavingProfile(true);
    try {
      const values = await profileForm.validateFields();
      const member = await studentApi.updateMember(data.member.id, values);
      setData(current => current ? { ...current, member } : current);
      message.success('个人信息已更新');
      setProfileOpen(false);
    } catch (err) {
      if (err instanceof Error) message.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };
  const handleCheckIn = async (paymentId: string, courseName: string) => {
    if (!data?.member.id) return;
    if (!window.confirm(`确认签到并核销《${courseName}》1课时吗？`)) return;
    setCheckingPaymentId(paymentId);
    try {
      await studentApi.checkInPayment(data.member.id, paymentId);
      message.success('签到成功，已核销 1 课时');
      await loadData();
      window.location.hash = 'checkins';
    } catch (err) {
      message.error(err instanceof Error ? err.message : '签到核销失败');
    } finally {
      setCheckingPaymentId('');
    }
  };

  return (
    <div className="learn-center-page" style={{ minHeight: '100vh', background: BRAND.bg, color: BRAND.text }}>
      <aside className="learn-sidebar" style={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: 218,
        background: 'linear-gradient(180deg,#FFFDF8 0%,#F7F3EB 100%)',
        borderRight: `1px solid ${BRAND.border}`,
        padding: '26px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <a className="learn-sidebar-brand" href={platformLinks.website.home} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: `linear-gradient(135deg,${BRAND.gold},${BRAND.red})`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 20 }}>E</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: BRAND.text }}>伊娃东方舞</div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: BRAND.muted }}>AIWA RAKS</div>
          </div>
        </a>

        <nav className="learn-sidebar-nav" style={{ display: 'grid', gap: 9 }}>
          {navItems.map(item => {
            const active = isNavActive(item);
            return (
            <a key={item.label} className={`learn-nav-link${active ? ' is-active' : ''}`} href={item.href} style={{
              height: 48,
              borderRadius: 4,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 15,
              fontWeight: 700,
              color: active ? '#fff' : BRAND.text,
              background: active ? `linear-gradient(135deg,${BRAND.gold},${BRAND.goldDark})` : 'transparent',
              boxShadow: active ? '0 2px 8px rgba(44,24,16,0.12)' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              textDecoration: 'none',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </a>
            );
          })}
        </nav>

        <div className="learn-sidebar-benefit" style={{ marginTop: 'auto', borderRadius: 8, padding: 18, background: 'linear-gradient(135deg,#F2E6CF,#FFFDF8)', textAlign: 'center', boxShadow: BRAND.shadow }}>
          <TrophyOutlined style={{ fontSize: 34, color: BRAND.goldDark }} />
          <div style={{ fontWeight: 800, marginTop: 8, color: BRAND.text }}>学员权益</div>
          <Text style={{ fontSize: 13, color: BRAND.muted }}>解锁更多特权</Text>
          <Button type="primary" href={platformLinks.website.enroll} style={{ marginTop: 12, borderRadius: 4 }}>立即查看</Button>
        </div>
      </aside>

      <main className="learn-main" style={{ marginLeft: 218, padding: '20px 28px 32px' }}>
        <OfficialWebsiteNav />
        <header className="learn-topbar" style={{ minHeight: 58, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
          <Input
            className="learn-search"
            prefix={<BookOutlined />}
            suffix={<SearchOutlined />}
            placeholder="搜索课程、课程顾问、直播、活动..."
            style={{ width: 460, height: 46, borderRadius: 4, background: '#FFFDF8', borderColor: BRAND.border }}
          />
          <div className="learn-topbar-spacer" style={{ flex: 1 }} />
          <Space className="learn-topbar-actions" size={22}>
            <Button className="learn-calendar-button" type="text" href={platformLinks.learn.calendar} icon={<CalendarOutlined />} style={{ fontWeight: 800, color: BRAND.text, borderRadius: 4 }}>学习日历</Button>
            <Badge className="learn-topbar-icon" count={0}><BellOutlined style={{ fontSize: 22, color: BRAND.text }} /></Badge>
            <Badge className="learn-topbar-icon learn-topbar-mail" count={0}><MailOutlined style={{ fontSize: 22, color: BRAND.text }} /></Badge>
            <Space className="learn-member-summary">
              <Avatar size={46} src={memberAvatar} style={{ border: `2px solid ${BRAND.gold}`, boxShadow: BRAND.shadow }} />
              <div>
                <div style={{ fontWeight: 900, color: BRAND.text }}>{loading ? <Skeleton.Input active size="small" style={{ width: 80 }} /> : memberName}</div>
                <Tag style={{ borderColor: BRAND.gold, color: BRAND.goldDark, background: '#FFF8EA' }}>{memberLevel}</Tag>
              </div>
            </Space>
          </Space>
        </header>

        {error ? (
          <Alert
            type="error"
            showIcon
            message="学员数据加载失败"
            description={error}
            action={<Button size="small" danger onClick={loadData}>重试</Button>}
            style={{ marginBottom: 18 }}
          />
        ) : null}

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={17}>
            <section className="learn-hero" style={{
              height: 306,
              borderRadius: 8,
              overflow: 'hidden',
              position: 'relative',
              background: BRAND.card,
              boxShadow: BRAND.shadow,
              padding: 36,
              display: 'flex',
              alignItems: 'stretch',
            }}>
              <div className="learn-hero-content" style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 26 }}>
                {loading ? <Skeleton active paragraph={{ rows: 2 }} title={{ width: 240 }} /> : (
                  <Row gutter={[28, 18]} align="middle" style={{ flex: 1 }}>
                    <Col xs={24} lg={14}>
                      <Text style={{ display: 'block', color: BRAND.goldDark, fontWeight: 800, marginBottom: 12 }}>舞动自信 · 绽放魅力</Text>
                      <Title className="learn-hero-title" level={1} style={{ fontSize: 40, fontWeight: 900, color: BRAND.red, margin: '0 0 16px', fontFamily: 'serif', lineHeight: 1.18 }}>
                        欢迎回来，{memberName}
                      </Title>
                      <Text style={{ fontSize: 17, color: BRAND.muted }}>坚持学习，每一天都在变得更美好</Text>
                    </Col>
                    <Col xs={24} lg={10}>
                      <Row gutter={[12, 12]}>
                        {[
                          { label: '已学习', value: data?.progress.learningHours || 0, unit: '小时' },
                          { label: '连续', value: data?.progress.streakDays || 0, unit: '天' },
                          { label: '已学课程', value: data?.progress.learnedCourses || 0, unit: '节' },
                          { label: '我的课程', value: data?.progress.offlineCourses || 0, unit: '门' },
                          { label: '总核销', value: data?.progress.consumedSessions || 0, unit: '课时' },
                          { label: '剩余课时', value: data?.progress.remainingSessions || 0, unit: '课时' },
                        ].map(item => (
                          <Col xs={8} key={item.label}>
                            <div style={{ height: 82, borderRadius: 8, padding: '12px 8px', background: '#F7F3EB', border: `1px solid ${BRAND.border}`, textAlign: 'center' }}>
                              <div style={{ fontSize: 24, fontWeight: 900, color: BRAND.red, lineHeight: 1 }}>{item.value}</div>
                              <div style={{ marginTop: 6, color: BRAND.muted, fontSize: 13 }}>{item.label}</div>
                              <div style={{ color: BRAND.goldDark, fontSize: 12 }}>{item.unit}</div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Col>
                  </Row>
                )}
                <div className="learn-hero-actions" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <Button type="primary" size="large" href={platformLinks.learn.courses} icon={<PlayCircleOutlined />} style={{ borderRadius: 4 }}>继续学习</Button>
                  <Button size="large" href={platformLinks.website.courses} style={{ borderColor: BRAND.gold, color: BRAND.goldDark, fontWeight: 800, borderRadius: 4 }}>全部课程</Button>
                </div>
              </div>
            </section>
          </Col>

          <Col xs={24} xl={7}>
            <Card className="learn-progress-card learn-section-card" style={{ height: 306, overflow: 'hidden', ...cardStyle }} styles={{ body: { height: '100%' } }}>
              <Row justify="space-between" align="middle">
                <Title level={4} style={{ margin: 0, color: BRAND.text }}>学习进度</Title>
                <Text style={{ color: BRAND.muted }}>查看全部 〉</Text>
              </Row>
              {loading ? <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 28 }} /> : (
                <Row className="learn-progress-body" align="middle" style={{ marginTop: 28 }}>
                  <Col span={12}>
                    <Progress type="circle" percent={data?.progress.percent || 0} strokeWidth={10} strokeColor={BRAND.gold} trailColor="#EFE6D7" format={() => <div><b style={{ fontSize: 28, color: BRAND.red }}>{data?.progress.percent || 0}%</b><div style={{ fontSize: 12, color: BRAND.muted }}>总体进度</div></div>} />
                  </Col>
                  <Col span={12}>
                    <Space direction="vertical" size={18}>
                      <Text style={{ color: BRAND.text }}><Tag style={{ borderColor: BRAND.gold, color: BRAND.goldDark, background: '#FFF8EA' }}>已学课程</Tag><b style={{ fontSize: 24, color: BRAND.red }}>{data?.progress.learnedCourses || 0}</b> 节</Text>
                      <Text style={{ color: BRAND.text }}><Tag style={{ borderColor: BRAND.border, color: BRAND.text, background: '#F7F3EB' }}>学习时长</Tag><b style={{ fontSize: 24, color: BRAND.red }}>{data?.progress.learningHours || 0}</b> 小时</Text>
                      <Text style={{ color: BRAND.text }}><Tag style={{ borderColor: BRAND.red, color: BRAND.red, background: '#FFF7F2' }}>连续学习</Tag><b style={{ fontSize: 24, color: BRAND.red }}>{data?.progress.streakDays || 0}</b> 天</Text>
                    </Space>
                  </Col>
                </Row>
              )}
            </Card>
          </Col>

          <Col xs={24} xl={17} id="courses">
            <Card className="learn-courses-card learn-section-card" style={cardStyle} styles={{ body: { padding: 22 } }}>
              <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Space className="learn-course-tabs" size={34}>
                  <Title level={4} style={{ margin: 0, color: BRAND.text }}>我的课程</Title>
                  <Text style={{ color: BRAND.muted }}>全部</Text>
                  <Text strong style={{ color: BRAND.red, borderBottom: `2px solid ${BRAND.gold}`, paddingBottom: 9 }}>正在学习</Text>
                  <Text style={{ color: BRAND.muted }}>已完成</Text>
                  <Text style={{ color: BRAND.muted }}>未开始</Text>
                </Space>
                <Text style={{ color: BRAND.muted }}>查看全部 〉</Text>
              </Row>
              {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : data?.courses.length ? (
                <div className="learn-home-course-list">
                  {data.courses.slice(0, 4).map(course => (
                    <CourseCard
                      course={course}
                      onOpen={() => router.push(`/learn/courses/${encodeURIComponent(course.id)}`)}
                      key={course.id}
                    />
                  ))}
                </div>
              ) : <EmptyBlock description="暂无已授权课程" />}
            </Card>
          </Col>

          <Col xs={24} xl={17} id="offline-courses">
            <Card
              className="learn-offline-card learn-section-card"
              title="线下课程课时"
              style={cardStyle}
              extra={<Text style={{ color: BRAND.muted }}>学习中 {activePayments.length} 门 · 已完成/到期 {completedPayments.length} 门</Text>}
            >
              {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : data?.payments.length ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {data.payments.slice(0, 8).map(payment => (
                    <Row key={payment.id} align="middle" gutter={[14, 12]} style={{ padding: '14px 0', borderBottom: `1px solid ${BRAND.border}` }}>
                      <Col flex="auto">
                        <Space wrap style={{ marginBottom: 6 }}>
                          <Text strong style={{ color: BRAND.text, fontSize: 16 }}>{payment.courseName}</Text>
                          <Tag color={paymentStatusColor(payment.status)}>{paymentStatusText(payment.status)}</Tag>
                          {payment.courseType ? <Tag style={{ borderColor: BRAND.border, color: BRAND.muted }}>{payment.courseType}</Tag> : null}
                        </Space>
                        <div>
                          <Text style={{ color: BRAND.muted }}>
                            开始学习 {payment.date || '-'}
                            {payment.courseSessions ? ` · 共 ${payment.courseSessions} 课时` : ''}
                            {payment.expireDate ? ` · 有效期至 ${payment.expireDate}` : ''}
                          </Text>
                        </div>
                      </Col>
                      <Col>
                        <Space direction="vertical" align="end" size={4}>
                          <Text strong style={{ color: payment.status === 'active' ? '#389e0d' : BRAND.muted }}>
                            {payment.status === 'completed' ? '已完成' : `剩余 ${payment.remainingSessions} 课时`}
                          </Text>
                          <Text style={{ color: BRAND.muted, fontSize: 12 }}>今日已核销 {payment.todayCheckinCount} 次</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Button
                          type={payment.status === 'active' ? 'primary' : 'default'}
                          disabled={payment.status !== 'active'}
                          loading={checkingPaymentId === payment.id}
                          onClick={() => handleCheckIn(payment.id, payment.courseName)}
                          style={{ borderRadius: 4 }}
                        >
                          签到核销
                        </Button>
                      </Col>
                    </Row>
                  ))}
                </Space>
              ) : <EmptyBlock description="暂无线下课程记录" />}
            </Card>
          </Col>

          <Col xs={24} xl={7} id="calendar">
            <Card className="learn-sessions-card learn-section-card" title="近期课程" style={cardStyle} extra="更多 〉">
              {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : data?.sessions.length ? (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  {data.sessions.map(item => (
                    <Row key={item.id} align="middle" gutter={12}>
                      <Col><div style={{ width: 54, borderRadius: 8, background: '#F2E6CF', color: BRAND.text, textAlign: 'center', padding: 8 }}><b>{item.date}</b><div>{item.day}</div></div></Col>
                      <Col flex="auto"><Text strong>{item.title}</Text><div><Text type="secondary">{item.time}</Text></div></Col>
                      <Col><Button size="small" type={item.action.includes('进入') ? 'primary' : 'default'} style={{ borderRadius: 4 }}>{item.action}</Button></Col>
                    </Row>
                  ))}
                </Space>
              ) : (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Text style={{ color: BRAND.muted }}>当前暂无直播排期，请关注官网公告或咨询教务。</Text>
                  <Button type="link" href={platformLinks.learn.courses} style={{ padding: 0 }}>
                    查看线上课程 →
                  </Button>
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24} xl={5} id="plans">
            <Card className="learn-plan-card learn-section-card" title={<Row justify="space-between"><span>今日学习计划</span><Text style={{ color: BRAND.muted }}>{completedPlans}/{data?.plans.length || 0} 项任务</Text></Row>} style={cardStyle}>
              {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : data?.plans.length ? (
                <>
                  <Progress percent={planPercent} showInfo={false} strokeColor={BRAND.gold} trailColor="#EFE6D7" />
                  <Space direction="vertical" style={{ marginTop: 18, width: '100%' }}>
                    {data.plans.map(item => <Row key={item.id} justify="space-between"><Text style={{ color: BRAND.text }}>{item.done ? <CheckCircleFilled style={{ color: BRAND.gold }} /> : '○'} {item.text}</Text><Text style={{ color: BRAND.muted }}>{item.done ? '✓' : '—'}</Text></Row>)}
                  </Space>
                </>
              ) : (
                <>
                  <EmptyBlock description="暂无学习计划" />
                  <Text style={{ color: BRAND.muted }}>今日暂无学习任务，可先查看线上课程或等待教务更新打卡安排。</Text>
                </>
              )}
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card className="learn-recommend-card learn-section-card" title="为你推荐" style={cardStyle} extra="换一换 ⟳">
              {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : data?.recommend.length ? (
                <Row gutter={[14, 14]}>
                  {data.recommend.map(item => (
                    <Col className="learn-recommend-item" xs={12} md={6} key={item.id}>
                      <CourseThumb accent={item.color} cover={item.cover} />
                      <Text strong style={{ display: 'block', marginTop: 8 }}>{item.title}</Text>
                      <Text style={{ color: BRAND.muted }}><StarFilled style={{ color: BRAND.gold }} /> 4.9　{item.learners || 0} 人学习</Text>
                    </Col>
                  ))}
                </Row>
              ) : <EmptyBlock description="暂无推荐课程" />}
            </Card>
          </Col>

          <Col xs={24} xl={12} id="certificates">
            <Card className="learn-certificates-card learn-section-card" title="我的证书" style={cardStyle} extra={`${certificates.length} 张`}>
              {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : certificates.length ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {certificates.slice(0, 4).map(cert => (
                    <Row key={cert.id || cert.certificateNo} align="middle" gutter={14} style={{ padding: '12px 0', borderBottom: `1px solid ${BRAND.border}` }}>
                      <Col><TrophyOutlined style={{ fontSize: 24, color: BRAND.goldDark }} /></Col>
                      <Col flex="auto">
                        <Text strong>{cert.courseName}</Text>
                        <div><Text type="secondary">{cert.issueDate} · {cert.certificateNo}</Text></div>
                      </Col>
                      <Col>
                        <Button size="small" href={cert.pdfUrl || undefined} target="_blank" disabled={!cert.pdfUrl} style={{ borderRadius: 4 }}>查看</Button>
                      </Col>
                    </Row>
                  ))}
                </Space>
              ) : <EmptyBlock description="暂无证书" />}
            </Card>
          </Col>

          <Col xs={24} xl={7}>
            <Card className="learn-shortcuts-card learn-section-card" title="快捷入口" style={cardStyle}>
              <Row gutter={[18, 18]}>
                {quickLinks.map(item => (
                  <Col span={6} key={item.label} style={{ textAlign: 'center' }}>
                    <a className="learn-quick-link" href={item.href} style={{ textDecoration: 'none', color: BRAND.text, display: 'block' }}>
                      <div style={{ width: 58, height: 58, borderRadius: 8, margin: '0 auto 8px', background: item.bg, display: 'grid', placeItems: 'center', color: item.color, fontSize: 24, border: `1px solid ${BRAND.border}` }}>{item.icon}</div>
                      <Text strong style={{ fontSize: 13 }}>{item.label}</Text>
                    </a>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} md={12} xl={5} id="assignments">
            <Card className="learn-section-card" title="我的作业" style={cardStyle}>
              <EmptyBlock description="暂无待提交作业" />
            </Card>
          </Col>

          <Col xs={24} md={12} xl={5} id="favorites">
            <Card className="learn-section-card" title="收藏夹" style={cardStyle}>
              {bookmarks.length ? (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {bookmarks.slice(0, 5).map((bm: any) => (
                    <Row key={bm.id} align="middle" gutter={8}>
                      <Col><StarFilled style={{ color: BRAND.gold }} /></Col>
                      <Col flex="auto">
                        <Text style={{ color: BRAND.text }} ellipsis>{bm.label || '收藏'}</Text>
                      </Col>
                    </Row>
                  ))}
                </Space>
              ) : <EmptyBlock description="暂无收藏内容" />}
            </Card>
          </Col>

          <Col xs={24} md={12} xl={7} id="checkins">
            <Card className="learn-section-card" title="签到核销记录" style={cardStyle} extra={`${data?.consumeRecords.length || 0} 条`}>
              {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : data?.consumeRecords.length ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {data.consumeRecords.slice(0, 6).map(record => (
                    <Row key={record.id} justify="space-between" align="middle" gutter={10} style={{ paddingBottom: 10, borderBottom: `1px solid ${BRAND.border}` }}>
                      <Col flex="auto" style={{ minWidth: 0 }}>
                        <Text style={{ color: BRAND.text }} ellipsis>{record.courseName}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {record.consumeDate || '-'} · 操作人: {record.operator || '-'}{record.remark ? ` · ${record.remark}` : ''}
                          </Text>
                        </div>
                      </Col>
                      <Col style={{ textAlign: 'right' }}>
                        <Text strong style={{ color: BRAND.red }}>-{record.count}课时</Text>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>剩余 {record.remainingAfter} 次</Text></div>
                      </Col>
                    </Row>
                  ))}
                </Space>
              ) : <EmptyBlock description="暂无核销记录" />}
            </Card>
          </Col>

          <Col xs={24} md={12} xl={7} id="records">
            <Card className="learn-section-card" title="学习记录" style={cardStyle}>
              {loading ? <Skeleton active paragraph={{ rows: 3 }} /> : recentRecords.length ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {recentRecords.slice(0, 5).map((record: any, i: number) => (
                    <Row key={record.course_id || i} justify="space-between" align="middle">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: BRAND.text }} ellipsis>{record.course_name || record.series_name}</Text>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{record.series_name}</Text></div>
                      </div>
                      <Tag style={{ borderColor: BRAND.gold, color: BRAND.goldDark, background: '#FFF8EA' }}>
                        {record.completed ? '已完成' : `${record.progress || 0}%`}
                      </Tag>
                    </Row>
                  ))}
                </Space>
              ) : <EmptyBlock description="暂无学习记录" />}
            </Card>
          </Col>

          <Col xs={24} md={12} xl={7} id="messages">
            <Card className="learn-section-card" title="消息中心" style={cardStyle}>
              <EmptyBlock description="暂无新消息" />
            </Card>
          </Col>

          <Col xs={24} md={12} xl={7} id="profile">
            <Card
              className="learn-section-card"
              title="个人信息"
              style={cardStyle}
              extra={<Button type="link" onClick={openProfileEditor} style={{ padding: 0, color: BRAND.goldDark, fontWeight: 800 }}>编辑</Button>}
            >
              {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : data?.member ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Row justify="space-between"><Text type="secondary">姓名</Text><Text strong>{data.member.name}</Text></Row>
                  <Row justify="space-between"><Text type="secondary">手机号</Text><Text>{data.member.phone || '-'}</Text></Row>
                  <Row justify="space-between"><Text type="secondary">等级</Text><Tag style={{ borderColor: BRAND.gold, color: BRAND.goldDark, background: '#FFF8EA' }}>{data.member.level || '学员'}</Tag></Row>
                  <Row justify="space-between"><Text type="secondary">地区</Text><Text>{[data.member.province, data.member.city].filter(Boolean).join(' ') || '-'}</Text></Row>
                  <Row justify="space-between"><Text type="secondary">注册日期</Text><Text>{data.member.registerDate || '-'}</Text></Row>
                  {data.member.remark ? <Text type="secondary">{data.member.remark}</Text> : null}
                </Space>
              ) : <EmptyBlock description="暂无个人信息" />}
            </Card>
          </Col>

          <Col xs={24} xl={24} id="support">
            <Card className="learn-section-card" title="帮助中心" style={cardStyle}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}><Text style={{ color: BRAND.text }}>课程咨询</Text><div><Text type="secondary">联系教务获取课程安排</Text></div></Col>
                <Col xs={24} md={8}><Text style={{ color: BRAND.text }}>学习问题</Text><div><Text type="secondary">反馈播放、进度、证书问题</Text></div></Col>
                <Col xs={24} md={8}><Text style={{ color: BRAND.text }}>账号支持</Text><div><Text type="secondary">手机号登录与授权查询</Text></div></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </main>

      <Modal
        title="编辑个人信息"
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={handleProfileSave}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingProfile}
        styles={{ body: { paddingTop: 12 } }}
      >
        <Form form={profileForm} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="gender" label="性别">
                <Input placeholder="女" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="birthday" label="生日">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="province" label="省份">
                <Input placeholder="省份" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="城市">
                <Input placeholder="城市" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="country" label="国家">
            <Input placeholder="中国" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="详细地址" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="学习目标、身体情况或教务备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
