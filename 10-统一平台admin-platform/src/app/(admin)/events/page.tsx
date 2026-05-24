'use client';
import { useState } from 'react';
import { Table, Card, Tag, Space, Button, Input, Row, Col, Statistic, Tabs, Modal, Form, DatePicker, message } from 'antd';
import { PlusOutlined, SearchOutlined, CalendarOutlined, TrophyOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import { InputNumber } from 'antd';

const events = Array.from({ length: 6 }, (_, i) => ({
  key: String(400 + i),
  name: ['2026夏季东方舞沙龙', '伊娃老师粉丝见面会', '东方舞文化分享会',
    '学员成果展示晚会', '东方舞公益体验课', '舞者交流会'][i],
  type: ['沙龙', '见面会', '分享会', '晚会', '体验课', '交流会'][i],
  date: `2026-0${6 + Math.floor(i / 3)}-${String(15 + i * 2).padStart(2, '0')}`,
  location: ['石家庄·伊娃舞馆', '石家庄·艺术中心', '线上直播', '石家庄·大剧院', '石家庄·伊娃舞馆', '石家庄·伊娃舞馆'][i],
  expected: [50, 100, 200, 300, 40, 60][i],
  registered: [32, 67, 145, 210, 28, 45][i],
  fee: [0, 0, 0, 0, 0, 0][i],
  status: ['开放报名', '开放报名', '即将开始', '筹备中', '已结束', '开放报名'][i],
}));

const competitions = Array.from({ length: 3 }, (_, i) => ({
  key: String(500 + i),
  name: ['2026东方舞夏季大赛', '伊娃杯·东方舞表演赛', '年度东方舞盛典'][i],
  date: ['2026-07-15', '2026-08-20', '2026-12-31'][i],
  location: ['石家庄·大剧院', '石家庄·艺术中心', '石家庄·大剧院'][i],
  categories: ['个人/团体', '个人/双人', '团体'][i],
  contestants: [0, 0, 0][i],
  maxContestants: [100, 60, 200][i],
  registrationFee: [299, 199, 499][i],
  status: ['报名中', '即将开始', '筹备中'][i],
}));

export default function EventsPage() {
  const [searchText, setSearchText] = useState('');
  const [tab, setTab] = useState('events');
  const [modalVisible, setModalVisible] = useState(false);

  const eventFiltered = events.filter(e => !searchText || e.name.includes(searchText));
  const compFiltered = competitions.filter(c => !searchText || c.name.includes(searchText));

  const totalRegistered = events.reduce((s, e) => s + e.registered, 0);

  const eventColumns = [
    { title: '活动名称', dataIndex: 'name', key: 'name', width: 220, render: (v: string) => <><CalendarOutlined style={{ marginRight: 6, color: '#a855f7' }} /><a>{v}</a></> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
    { title: '地点', dataIndex: 'location', key: 'location', width: 150 },
    { title: '报名', key: 'enroll', width: 100, render: (_: any, r: any) => <>{r.registered} / {r.expected}</> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={{ '开放报名': 'green', '即将开始': 'orange', '筹备中': 'blue', '已结束': 'default' }[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 120, render: () => <Space><Button type="link" size="small">报名管理</Button><Button type="link" size="small">编辑</Button></Space> },
  ];

  const compColumns = [
    { title: '赛事名称', dataIndex: 'name', key: 'name', width: 220, render: (v: string) => <><TrophyOutlined style={{ marginRight: 6, color: '#f59e0b' }} /><a>{v}</a></> },
    { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
    { title: '地点', dataIndex: 'location', key: 'location', width: 150 },
    { title: '组别', dataIndex: 'categories', key: 'categories', width: 100 },
    { title: '参赛人数', key: 'contestants', width: 100, render: (_: any, r: any) => <>{r.contestants} / {r.maxContestants}</> },
    { title: '报名费', dataIndex: 'registrationFee', key: 'registrationFee', width: 80, render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={{ '报名中': 'green', '即将开始': 'orange', '筹备中': 'blue' }[v]}>{v}</Tag> },
    { title: '操作', key: 'action', width: 120, render: () => <Space><Button type="link" size="small">报名管理</Button><Button type="link" size="small">编辑</Button></Space> },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>活动与赛事</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="活动" value={events.length} prefix={<CalendarOutlined />} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="赛事" value={competitions.length} prefix={<TrophyOutlined />} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已报名" value={totalRegistered} suffix="人次" valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={events.filter(e => e.status === '开放报名' || e.status === '即将开始').length + competitions.filter(c => c.status === '报名中' || c.status === '即将开始').length} valueStyle={{ color: '#a855f7' }} /></Card></Col>
      </Row>

      <Card
        size="small"
        title={<Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'events', label: `活动管理 (${events.length})` },
          { key: 'competitions', label: `赛事管理 (${competitions.length})` },
        ]} />}
        extra={<Space>
          <Input placeholder="搜索..." prefix={<SearchOutlined />} style={{ width: 200 }}
            value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            {tab === 'events' ? '新建活动' : '新建赛事'}
          </Button>
        </Space>}
      >
        {tab === 'events' && <Table columns={eventColumns} dataSource={eventFiltered} size="middle" pagination={false} />}
        {tab === 'competitions' && <Table columns={compColumns} dataSource={compFiltered} size="middle" pagination={false} />}
      </Card>

      <Modal title={tab === 'events' ? '新建活动' : '新建赛事'} open={modalVisible}
        onCancel={() => setModalVisible(false)} footer={null} width={550}>
        <Form layout="vertical">
          <Form.Item label={tab === 'events' ? '活动名称' : '赛事名称'} required>
            <Input placeholder={tab === 'events' ? '如：2026夏季东方舞沙龙' : '如：2026东方舞夏季大赛'} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="地点"><Input placeholder="活动/赛事地点" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="人数上限"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={12}><Form.Item label="报名费"><InputNumber prefix="¥" style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit" block>创建</Button>
        </Form>
      </Modal>
    </div>
  );
}
