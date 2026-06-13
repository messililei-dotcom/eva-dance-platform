'use client';

import { useEffect } from 'react';
import { CalendarOutlined, CheckCircleFilled, EnvironmentOutlined, PhoneOutlined, ReadOutlined, TeamOutlined, TrophyOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tag, Timeline, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { platformLinks } from '@/lib/platform-links';
import { studentApi } from '@/lib/student-api';

const { Paragraph, Text, Title } = Typography;

const cardStyle = {
  borderRadius: 8,
  borderColor: 'var(--learn-border)',
  boxShadow: 'var(--learn-shadow)',
  background: 'var(--learn-card)',
};

const features = [
  { icon: <TeamOutlined />, title: '专业师资', text: '由东方舞教学团队带练，覆盖动作拆解、音乐处理和舞台表现。' },
  { icon: <ReadOutlined />, title: '系统教学', text: '按基础、进阶、编舞和教练培养分层安排，减少重复试错。' },
  { icon: <EnvironmentOutlined />, title: '沉浸场地', text: '线下训练空间适合镜面纠错、队形排练和集中反馈。' },
  { icon: <CalendarOutlined />, title: '灵活安排', text: '支持常规班、周末班、集训营等节奏，便于兼顾工作与学习。' },
];

const courseTypes = [
  { title: '基础班', tag: '入门', text: '适合零基础或需要重建基本功的学员，重点训练体态、核心、胯部与手臂路线。' },
  { title: '进阶班', tag: '提升', text: '围绕组合、节奏变化和风格表达，提升动作质感与完整舞段掌控力。' },
  { title: '教练班', tag: '认证', text: '面向希望系统授课的学员，加入教学法、课程设计、纠错方法与带班演练。' },
  { title: '集训营', tag: '强化', text: '短周期高密度训练，适合赛事、演出、考级或阶段突破前集中打磨。' },
];

export default function OfflineCoursesPage() {
  const router = useRouter();

  useEffect(() => {
    const token = studentApi.getToken();
    const member = studentApi.getStoredMember();
    if (!token || !member?.id) router.replace('/learn/login');
  }, [router]);

  return (
    <main className="learn-page learn-offline-page" style={{ minHeight: '100vh', background: 'var(--learn-bg)', color: 'var(--learn-text)' }}>
      <section style={{ padding: '30px clamp(16px, 5vw, 58px) 24px' }}>
        <Button href="/learn" type="link" style={{ padding: 0, color: 'var(--learn-gold-dark)', fontWeight: 800 }}>返回个人中心</Button>
        <div className="learn-offline-hero" style={{ marginTop: 12, minHeight: 290, borderRadius: 8, position: 'relative', overflow: 'hidden', border: '1px solid var(--learn-border)', background: 'linear-gradient(120deg,rgba(255,253,248,.96),rgba(242,230,207,.92)), url(/learn/dance-hero.webp) center/cover' }}>
          <div className="learn-offline-hero-content" style={{ maxWidth: 700, padding: '46px clamp(22px, 5vw, 58px)' }}>
            <Tag color="gold" style={{ marginBottom: 16 }}>AIWA RAKS</Tag>
            <Title level={1} style={{ color: 'var(--learn-red)', margin: 0, fontSize: 46 }}>线下课程</Title>
            <Paragraph style={{ color: 'var(--learn-muted)', fontSize: 17, lineHeight: 1.8, margin: '14px 0 26px' }}>
              面向东方舞学员的线下集训与常规课程，强调现场纠错、动作质量、音乐表达和完整作品输出。
            </Paragraph>
            <Space wrap>
              <Button type="primary" size="large" icon={<PhoneOutlined />} href={platformLinks.website.enroll}>报名咨询</Button>
              <Button size="large" href="/learn/search">探索线上课程</Button>
            </Space>
          </div>
        </div>
      </section>

      <section style={{ padding: '0 clamp(16px, 5vw, 58px) 28px' }}>
        <Row gutter={[18, 18]}>
          {features.map(feature => (
            <Col xs={24} sm={12} lg={6} key={feature.title}>
              <Card style={{ ...cardStyle, height: '100%' }}>
                <div style={{ width: 46, height: 46, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(135deg,var(--learn-gold),var(--learn-red))', fontSize: 22 }}>{feature.icon}</div>
                <Title level={4} style={{ margin: '16px 0 8px', color: 'var(--learn-text)' }}>{feature.title}</Title>
                <Text style={{ color: 'var(--learn-muted)', lineHeight: 1.7 }}>{feature.text}</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section style={{ padding: '0 clamp(16px, 5vw, 58px) 28px' }}>
        <Title level={3} style={{ color: 'var(--learn-text)' }}>课程类型</Title>
        <Row gutter={[18, 18]}>
          {courseTypes.map(item => (
            <Col xs={24} md={12} xl={6} key={item.title}>
              <Card style={{ ...cardStyle, height: '100%' }}>
                <Space style={{ marginBottom: 12 }}>
                  <UsergroupAddOutlined style={{ color: 'var(--learn-gold-dark)', fontSize: 22 }} />
                  <Tag color="gold">{item.tag}</Tag>
                </Space>
                <Title level={4} style={{ margin: 0, color: 'var(--learn-text)' }}>{item.title}</Title>
                <Paragraph style={{ color: 'var(--learn-muted)', marginTop: 12, lineHeight: 1.75 }}>{item.text}</Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section style={{ padding: '0 clamp(16px, 5vw, 58px) 34px' }}>
        <Row gutter={[18, 18]}>
          <Col xs={24} lg={14}>
            <Card title="课程安排概览" style={cardStyle}>
              <Timeline
                items={[
                  { dot: <CheckCircleFilled style={{ color: 'var(--learn-gold-dark)' }} />, children: <Text>报名沟通：确认学习基础、目标方向与可参加时段。</Text> },
                  { dot: <CheckCircleFilled style={{ color: 'var(--learn-gold-dark)' }} />, children: <Text>分层入班：根据基础班、进阶班、教练班或集训营安排课程。</Text> },
                  { dot: <CheckCircleFilled style={{ color: 'var(--learn-gold-dark)' }} />, children: <Text>现场训练：基本功、组合、成品舞、体能和表现力同步推进。</Text> },
                  { dot: <CheckCircleFilled style={{ color: 'var(--learn-gold-dark)' }} />, children: <Text>阶段反馈：教师现场纠错，结合线上课程补充课后复习。</Text> },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card style={{ ...cardStyle, height: '100%' }}>
              <TrophyOutlined style={{ color: 'var(--learn-gold-dark)', fontSize: 38 }} />
              <Title level={3} style={{ margin: '16px 0 10px', color: 'var(--learn-text)' }}>报名咨询</Title>
              <Paragraph style={{ color: 'var(--learn-muted)', lineHeight: 1.8 }}>
                线下课程名额、城市、排期和费用以教务沟通为准。你可以通过品牌官网提交报名信息，由课程顾问跟进适合的班型。
              </Paragraph>
              <Space wrap>
                <Button type="primary" icon={<PhoneOutlined />} href={platformLinks.website.enroll}>前往报名</Button>
                <Button href={platformLinks.website.courses}>查看官网课程</Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </section>
    </main>
  );
}
