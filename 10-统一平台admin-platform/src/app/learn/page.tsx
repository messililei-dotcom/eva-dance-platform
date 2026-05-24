'use client';

import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  FileDoneOutlined,
  GiftOutlined,
  HeartOutlined,
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
  UsergroupAddOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, Card, Col, Input, Progress, Row, Space, Tag, Typography } from 'antd';
import Image from 'next/image';
import { platformLinks } from '@/lib/platform-links';

const { Text, Title } = Typography;

const navItems = [
  { icon: <HomeFilled />, label: '首页', href: platformLinks.learn.home, active: true },
  { icon: <BookOutlined />, label: '我的课程', href: platformLinks.learn.courses },
  { icon: <CalendarOutlined />, label: '直播课表', href: platformLinks.learn.calendar },
  { icon: <ReadOutlined />, label: '线下课程', href: platformLinks.website.courses },
  { icon: <ProfileOutlined />, label: '学习计划', href: '#plans' },
  { icon: <FileDoneOutlined />, label: '我的作业', href: platformLinks.learn.assignments },
  { icon: <TrophyOutlined />, label: '我的证书', href: '#certificates' },
  { icon: <StarOutlined />, label: '收藏夹', href: '#favorites' },
  { icon: <ClockCircleOutlined />, label: '学习记录', href: '#records' },
  { icon: <GiftOutlined />, label: '积分商城', href: platformLinks.website.shop },
  { icon: <BellOutlined />, label: '消息中心', href: '#messages' },
  { icon: <CustomerServiceOutlined />, label: '帮助中心', href: platformLinks.learn.support },
];

const courses = [
  { title: '零基础东方舞入门', tag: 'NEW', progress: 60, lessons: 18, color: '#F72A8A' },
  { title: '中级技巧提升班', tag: '热门', progress: 45, lessons: 24, color: '#3B82F6' },
  { title: '魅力腰部提升课', tag: '推荐', progress: 30, lessons: 16, color: '#F72A8A' },
  { title: '高级表演编舞班', tag: '直播', progress: 20, lessons: 28, color: '#EF4444' },
];

const schedule = [
  { date: '今天', day: '05.20', title: '周六集训课（5.18）', time: '19:30 - 21:30', action: '进入教室' },
  { date: '05.22', day: '周三', title: '工作坊-上海站', time: '14:00 - 17:00', action: '查看详情' },
  { date: '05.25', day: '周六', title: '技巧进阶直播课', time: '20:00 - 21:30', action: '进入教室' },
];

const plans = [
  { text: '完成《零基础第8节》', done: true },
  { text: '观看直播：技巧进阶课', done: false },
  { text: '练习打卡 20 分钟', done: false },
  { text: '提交作业：舞蹈组合练习', done: true },
  { text: '参加线下课程到', done: false },
];

const recommend = [
  { title: '东方舞基础身姿训练', duration: '18:45', learners: 1324 },
  { title: '优雅手臂技巧提升', duration: '22:30', learners: 1986 },
  { title: '阿拉伯风情组合', duration: '26:10', learners: 1560 },
  { title: '舞台表现魅力提升', duration: '30:15', learners: 2876 },
];

const quickLinks = [
  { icon: <VideoCameraOutlined />, label: '直播课表', bg: '#FFE1ED', href: platformLinks.learn.calendar },
  { icon: <UsergroupAddOutlined />, label: '线下课程', bg: '#FFECD8', href: platformLinks.website.courses },
  { icon: <ProfileOutlined />, label: '作业中心', bg: '#EDE3FF', href: platformLinks.learn.assignments },
  { icon: <CheckCircleFilled />, label: '学习打卡', bg: '#DFF0FF', href: '#plans' },
  { icon: <GiftOutlined />, label: '积分商城', bg: '#FFEBD6', href: platformLinks.website.shop },
  { icon: <TrophyOutlined />, label: '我的证书', bg: '#DCFCE7', href: '#certificates' },
  { icon: <StarFilled />, label: '收藏夹', bg: '#FFE1F0', href: '#favorites' },
  { icon: <CustomerServiceOutlined />, label: '客服中心', bg: '#E1F0FF', href: platformLinks.learn.support },
];

function CourseThumb({ accent }: { accent: string }) {
  return (
    <div style={{
      height: 118,
      borderRadius: '12px 12px 0 0',
      overflow: 'hidden',
      position: 'relative',
      background: `linear-gradient(135deg, ${accent}, #7C3AED)`,
    }}>
      <Image src="/learn/dance-hero.png" alt="课程封面" fill style={{ objectFit: 'cover', opacity: 0.78 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(18,26,58,.28))' }} />
      <PlayCircleFilled style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#fff', fontSize: 34, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.28))' }} />
    </div>
  );
}

export default function LearnCenterPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FC', color: '#121A3A' }}>
      <aside style={{
        position: 'fixed',
        inset: '0 auto 0 0',
        width: 218,
        background: 'linear-gradient(180deg,#FFF7FB 0%,#FFFFFF 100%)',
        borderRight: '1px solid #EEF0F7',
        padding: '26px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <a href={platformLinks.website.home} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg,#F72A8A,#7C3AED)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 20 }}>E</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#121A3A' }}>伊娃东方舞</div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: '#7A8199' }}>AIWA RAKS</div>
          </div>
        </a>

        <nav style={{ display: 'grid', gap: 9 }}>
          {navItems.map(item => (
            <a key={item.label} href={item.href} style={{
              height: 48,
              borderRadius: 10,
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 15,
              fontWeight: 700,
              color: item.active ? '#fff' : '#15204A',
              background: item.active ? 'linear-gradient(135deg,#F72A8A,#FF4FA0)' : 'transparent',
              boxShadow: item.active ? '0 12px 24px rgba(247,42,138,.22)' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              textDecoration: 'none',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', borderRadius: 16, padding: 18, background: 'linear-gradient(135deg,#FFE4F0,#FFF6D8)', textAlign: 'center' }}>
          <TrophyOutlined style={{ fontSize: 34, color: '#F59E0B' }} />
          <div style={{ fontWeight: 800, marginTop: 8 }}>加入会员</div>
          <Text style={{ fontSize: 13 }}>解锁更多特权</Text>
          <Button type="primary" shape="round" href={platformLinks.website.enroll} style={{ marginTop: 12 }}>立即查看</Button>
        </div>
      </aside>

      <main style={{ marginLeft: 218, padding: '20px 28px 32px' }}>
        <header style={{ height: 58, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
          <Input
            prefix={<BookOutlined />}
            suffix={<SearchOutlined />}
            placeholder="搜索课程、老师、直播、活动..."
            style={{ width: 460, height: 46, borderRadius: 24, background: '#F0F2FA', borderColor: '#E6E9F4' }}
          />
          <div style={{ flex: 1 }} />
          <Space size={22}>
            <Button type="text" href={platformLinks.learn.calendar} icon={<CalendarOutlined />} style={{ fontWeight: 800 }}>学习日历</Button>
            <Badge count={12}><BellOutlined style={{ fontSize: 22, color: '#121A3A' }} /></Badge>
            <Badge count={5}><MailOutlined style={{ fontSize: 22, color: '#121A3A' }} /></Badge>
            <Space>
              <Avatar size={46} src="/learn/dance-hero.png" />
              <div>
                <div style={{ fontWeight: 900 }}>小舞姐姐</div>
                <Tag color="magenta">高级会员</Tag>
              </div>
            </Space>
          </Space>
        </header>

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={17}>
            <section style={{
              height: 306,
              borderRadius: 18,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(135deg,#FFE1F0,#F3D9FF)',
              boxShadow: '0 18px 44px rgba(247,42,138,.12)',
              padding: '54px 58px',
            }}>
              <Image src="/learn/dance-hero.png" alt="舞动自信" fill style={{ objectFit: 'cover', objectPosition: 'right center', opacity: 0.58 }} priority />
              <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#5A1652', marginBottom: 32, fontFamily: 'serif' }}>舞动自信 · 绽放魅力 ♡</div>
                <Title level={3} style={{ margin: 0, color: '#121A3A' }}>欢迎回来，小舞姐姐 🌸</Title>
                <Text style={{ fontSize: 17, color: '#4A5270' }}>坚持学习，每一天都在变得更美好</Text>
                <div style={{ marginTop: 28 }}>
                  <Button type="primary" size="large" shape="round" href={platformLinks.learn.courses} icon={<PlayCircleOutlined />}>继续学习</Button>
                  <Button size="large" shape="round" href={platformLinks.website.courses} style={{ marginLeft: 14, border: 0, color: '#F72A8A', fontWeight: 800 }}>全部课程</Button>
                </div>
              </div>
            </section>
          </Col>

          <Col xs={24} xl={7}>
            <Card style={{ height: 306, borderRadius: 18, overflow: 'hidden' }} bodyStyle={{ height: '100%' }}>
              <Row justify="space-between" align="middle">
                <Title level={4} style={{ margin: 0 }}>学习进度</Title>
                <Text type="secondary">查看全部 〉</Text>
              </Row>
              <Row align="middle" style={{ marginTop: 28 }}>
                <Col span={12}>
                  <Progress type="circle" percent={75} strokeWidth={10} strokeColor={{ '0%': '#F72A8A', '100%': '#7C3AED' }} format={() => <div><b style={{ fontSize: 28 }}>75%</b><div style={{ fontSize: 12 }}>总体进度</div></div>} />
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size={18}>
                    <Text><Tag color="magenta">已学课程</Tag><b style={{ fontSize: 24 }}>36</b> 节</Text>
                    <Text><Tag color="blue">学习时长</Tag><b style={{ fontSize: 24 }}>86.5</b> 小时</Text>
                    <Text><Tag color="purple">连续学习</Tag><b style={{ fontSize: 24 }}>7</b> 天</Text>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={17} id="courses">
            <Card style={{ borderRadius: 18 }} bodyStyle={{ padding: 22 }}>
              <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Space size={34}>
                  <Title level={4} style={{ margin: 0 }}>我的课程</Title>
                  <Text>全部</Text>
                  <Text strong style={{ color: '#F72A8A', borderBottom: '2px solid #F72A8A', paddingBottom: 9 }}>正在学习</Text>
                  <Text>已完成</Text>
                  <Text>未开始</Text>
                </Space>
                <Text type="secondary">查看全部 〉</Text>
              </Row>
              <Row gutter={[14, 14]}>
                {courses.map(course => (
                  <Col xs={24} md={12} xl={6} key={course.title}>
                    <div style={{ border: '1px solid #EEF0F7', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                      <div style={{ position: 'relative' }}>
                        <CourseThumb accent={course.color} />
                        <Tag color="magenta" style={{ position: 'absolute', left: 10, top: 10 }}>{course.tag}</Tag>
                      </div>
                      <div style={{ padding: 12 }}>
                        <Text strong>{course.title}</Text>
                        <Row justify="space-between" style={{ marginTop: 10 }}>
                          <Text type="secondary">学习进度 {course.progress}%</Text>
                          <Text type="secondary">共 {course.lessons} 节</Text>
                        </Row>
                        <Progress percent={course.progress} showInfo={false} strokeColor={course.color} />
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={7} id="calendar">
            <Card title="近期课程" style={{ borderRadius: 18 }} extra="更多 〉">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                {schedule.map(item => (
                  <Row key={item.title} align="middle" gutter={12}>
                    <Col><div style={{ width: 54, borderRadius: 12, background: '#FFF0F7', textAlign: 'center', padding: 8 }}><b>{item.date}</b><div>{item.day}</div></div></Col>
                    <Col flex="auto"><Text strong>{item.title}</Text><div><Text type="secondary">{item.time}</Text></div></Col>
                    <Col><Button size="small" shape="round" type={item.action.includes('进入') ? 'primary' : 'default'}>{item.action}</Button></Col>
                  </Row>
                ))}
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={5} id="plans">
            <Card title={<Row justify="space-between"><span>今日学习计划</span><Text>3/5 项任务</Text></Row>} style={{ borderRadius: 18 }}>
              <Progress percent={60} showInfo={false} strokeColor="#F72A8A" />
              <Space direction="vertical" style={{ marginTop: 18, width: '100%' }}>
                {plans.map(item => <Row key={item.text} justify="space-between"><Text>{item.done ? <CheckCircleFilled style={{ color: '#F72A8A' }} /> : '○'} {item.text}</Text><Text type="secondary">{item.done ? '✓' : '—'}</Text></Row>)}
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={12}>
            <Card title="为你推荐" style={{ borderRadius: 18 }} extra="换一换 ⟳">
              <Row gutter={[14, 14]}>
                {recommend.map(item => (
                  <Col xs={12} md={6} key={item.title}>
                    <CourseThumb accent="#F72A8A" />
                    <Text strong style={{ display: 'block', marginTop: 8 }}>{item.title}</Text>
                    <Text type="secondary"><StarFilled style={{ color: '#F59E0B' }} /> 4.9　{item.learners} 人学习</Text>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          <Col xs={24} xl={7}>
            <Card title="快捷入口" style={{ borderRadius: 18 }}>
              <Row gutter={[18, 18]}>
                {quickLinks.map(item => (
                  <Col span={6} key={item.label} style={{ textAlign: 'center' }}>
                    <a href={item.href} style={{ textDecoration: 'none', color: '#121A3A', display: 'block' }}>
                      <div style={{ width: 58, height: 58, borderRadius: 16, margin: '0 auto 8px', background: item.bg, display: 'grid', placeItems: 'center', color: '#F72A8A', fontSize: 24 }}>{item.icon}</div>
                      <Text strong style={{ fontSize: 13 }}>{item.label}</Text>
                    </a>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      </main>
    </div>
  );
}
