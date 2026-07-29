'use client';
import { useState } from 'react';
import { Card, Tag, Space, Button, Input, Select, DatePicker, Row, Col, Statistic, Tabs, Modal, Form, Switch, message } from 'antd';
import { Table } from '@/components/adaptive-table';
import { PlusOutlined, SearchOutlined, VideoCameraOutlined, PlayCircleOutlined, ClockCircleOutlined, UserOutlined, SettingOutlined, CopyOutlined } from '@ant-design/icons';
import { InputNumber } from 'antd';
import { sortableColumns } from '@/lib/table-sort';

interface LiveCourse { key: string; name: string; instructor: string; schedule: string; enrolled: number; maxStudents: number; status: string; nextLive: string; platform: string; price: number; }
const liveCourses: LiveCourse[] = Array.from({ length: 8 }, (_, i) => ({
  key: String(100 + i),
  name: ['入门基础直播课', '舞码精讲直播', '埃及节奏直播解析', '即兴舞码训练营',
    '大师直播答疑', '纱巾舞专场直播', '藤杖舞基础教学', '学员作品点评'][i],
  instructor: ['伊娃老师', '伊娃老师', '琪琪老师', '伊娃老师', '伊娃老师', '琪琪老师', '海燕老师', '伊娃老师'][i],
  schedule: [
    '每周一、三 19:00-20:30',
    '每周二、四 20:00-21:30',
    '每周五 19:30-21:00',
    '周六 14:00-16:00',
    '每月第一周日 10:00-11:30',
    '每周三 20:00-21:00',
    '每周日 15:00-16:30',
    '每月最后一个周六 19:00-20:30',
  ][i],
  enrolled: [45, 38, 52, 28, 120, 33, 41, 67][i] as number,
  maxStudents: [100, 80, 120, 60, 200, 60, 80, 120][i] as number,
  status: i < 5 ? 'active' : i === 7 ? 'draft' : 'active',
  nextLive: `2026-05-${String(24 + i).padStart(2, '0')} 19:00`,
  platform: ['腾讯会议', '腾讯会议', '抖音', '腾讯会议', '腾讯会议', '抖音', '腾讯会议', '抖音'][i],
  price: [0, 0, 0, 299, 0, 0, 0, 0][i],
}));

export default function LivePage() {
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = liveCourses.filter(c => !searchText || c.name.includes(searchText) || c.instructor.includes(searchText));
  const totalEnrolled = liveCourses.reduce((s, c) => s + c.enrolled, 0);

  const columns = sortableColumns<LiveCourse>([
    { title: '直播课程', dataIndex: 'name', key: 'name', width: 200, render: (v: string) => <><VideoCameraOutlined style={{ color: '#a855f7', marginRight: 6 }} /><a>{v}</a></> },
    { title: '讲师', dataIndex: 'instructor', key: 'instructor', width: 100 },
    { title: '时间安排', dataIndex: 'schedule', key: 'schedule', width: 200, render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span> },
    { title: '已报名', key: 'enroll', width: 120, render: (_: any, r: any) => <>{r.enrolled} / {r.maxStudents}</> },
    { title: '平台', dataIndex: 'platform', key: 'platform', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: '下次直播', dataIndex: 'nextLive', key: 'nextLive', width: 150 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'active' ? 'green' : 'orange'}>{v === 'active' ? '进行中' : '预告'}</Tag> },
    { title: '操作', key: 'action', width: 180,
      render: () => <Space>
        <Button type="link" size="small" icon={<PlayCircleOutlined />}>开播</Button>
        <Button type="link" size="small" icon={<CopyOutlined />}>直播间链接</Button>
        <Button type="link" size="small" icon={<SettingOutlined />}>设置</Button>
      </Space> },
  ]);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>直播管理</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="直播课程" value={liveCourses.length} prefix={<VideoCameraOutlined />} valueStyle={{ color: '#a855f7' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="进行中" value={liveCourses.filter(c => c.status === 'active').length} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="累计报名" value={totalEnrolled} suffix="人次" valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="预告" value={liveCourses.filter(c => c.status === 'draft').length} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      <Card size="small" extra={<Space>
        <Input placeholder="搜索直播课程..." prefix={<SearchOutlined />} style={{ width: 200 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建直播</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Modal title="新建直播" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={550}>
        <Form layout="vertical">
          <Form.Item label="直播标题" required><Input placeholder="如：入门基础直播课（第3期）" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="主讲老师"><Select options={[{ label: '伊娃老师', value: '伊娃老师' }, { label: '琪琪老师', value: '琪琪老师' }, { label: '海燕老师', value: '海燕老师' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item label="直播平台"><Select options={[{ label: '腾讯会议', value: 'tencent' }, { label: '抖音', value: 'douyin' }, { label: '视频号', value: 'weixin' }]} /></Form.Item></Col>
          </Row>
          <Form.Item label="时间安排"><Input placeholder="如：每周一、三 19:00-20:30" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="人数上限"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={12}><Form.Item label="价格"><InputNumber prefix="¥" style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Form.Item label="课程详情"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" htmlType="submit" block>创建直播</Button>
        </Form>
      </Modal>
    </div>
  );
}
