'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Input, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { NotificationOutlined, PhoneOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { Table } from '@/components/adaptive-table';

const { Title, Text } = Typography;

type AnnouncementRow = {
  id: number;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  recipient_count: number;
  unread_count: number;
};

type StaffMessageRow = {
  id: number;
  title: string;
  name: string;
  phone: string;
  type: string;
  content: string;
  interest: string;
  course_id: number;
  course_name: string;
  status: 'unread' | 'read';
  created_at: string;
};

export default function MessagesAdminPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [staffMessages, setStaffMessages] = useState<StaffMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [announcementsResponse, staffResponse] = await Promise.all([
        api.get('/inbox/announcements'),
        api.get('/inbox/staff'),
      ]);
      setRows(announcementsResponse.data?.data || []);
      setStaffMessages(staffResponse.data?.data || []);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '公告记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const values = await form.validateFields();
    setSending(true);
    try {
      const response = await api.post('/inbox/announcements', values);
      const recipients = Number(response.data?.data?.recipients || 0);
      message.success(`公告发送成功，已投递 ${recipients} 人`);
      form.resetFields();
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '公告发送失败');
    } finally {
      setSending(false);
    }
  };

  const runReminders = async () => {
    try {
      const response = await api.post('/inbox/jobs/run', {});
      message.success(`提醒任务完成，新增 ${Number(response.data?.data?.created || 0)} 条消息`);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '提醒任务执行失败');
    }
  };

  return (
    <div>
      <Space direction="vertical" size={2} style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>站内消息</Title>
        <Text type="secondary">接收官网咨询报名，发送系统公告，并查看消息投递情况。</Text>
      </Space>

      <Card
        title={<Space><PhoneOutlined />免费咨询报名</Space>}
        extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={staffMessages.filter(row => row.type === 'consultation')}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '暂时没有新的咨询报名' }}
          columns={[
            {
              title: '咨询人',
              dataIndex: 'name',
              render: (value, row) => (
                <Space direction="vertical" size={0}>
                  <Space size={6}>
                    <Text strong>{value}</Text>
                    {row.status === 'unread' && <Tag color="red">未读</Tag>}
                  </Space>
                  <Text type="secondary">{row.course_name || row.interest}</Text>
                </Space>
              ),
            },
            {
              title: '手机号',
              dataIndex: 'phone',
              width: 150,
              render: value => <a href={`tel:${value}`}>{value}</a>,
            },
            { title: '提交时间', dataIndex: 'created_at', width: 170 },
          ]}
        />
      </Card>

      <Card title="管理员通知" extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>} style={{ marginBottom: 16 }}>
        <Table rowKey="id" loading={loading} dataSource={staffMessages.filter(row => row.type !== 'consultation')}
          pagination={{ pageSize: 8 }} locale={{ emptyText: '暂无管理员通知' }} columns={[
            { title: '通知', dataIndex: 'title', render: (value, row) => <Space direction="vertical"><Space><Text strong>{value}</Text>{row.status === 'unread' && <Tag color="red">未读</Tag>}</Space><Text style={{ whiteSpace: 'pre-wrap' }}>{row.content}</Text></Space> },
            { title: '操作时间', dataIndex: 'created_at', width: 170 },
          ]} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title="发送系统公告" extra={<NotificationOutlined />}>
            <Form form={form} layout="vertical" initialValues={{ priority: 'important' }}>
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请填写公告标题' }]}>
                <Input maxLength={60} showCount />
              </Form.Item>
              <Form.Item name="content" label="内容" rules={[{ required: true, message: '请填写公告内容' }]}>
                <Input.TextArea rows={5} maxLength={500} showCount />
              </Form.Item>
              <Form.Item name="actionUrl" label="站内跳转地址">
                <Input placeholder="/courses 或 /dashboard/profile" />
              </Form.Item>
              <Form.Item name="priority" label="优先级">
                <Select options={[
                  { value: 'normal', label: '普通' },
                  { value: 'important', label: '重要' },
                  { value: 'urgent', label: '紧急' },
                ]} />
              </Form.Item>
              <Space wrap>
                <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>发送给全部有效学员</Button>
                <Button icon={<ReloadOutlined />} onClick={runReminders}>执行课程提醒</Button>
              </Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={15}>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={8}><Card size="small"><Statistic title="公告数" value={rows.length} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="累计投递" value={rows.reduce((sum, row) => sum + Number(row.recipient_count || 0), 0)} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="当前未读" value={rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0)} /></Card></Col>
          </Row>
          <Card title="公告记录" extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={rows}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '标题', dataIndex: 'title', render: (value, row) => <Space direction="vertical" size={0}><Text strong>{value}</Text><Text type="secondary" ellipsis style={{ maxWidth: 360 }}>{row.content}</Text></Space> },
                { title: '优先级', dataIndex: 'priority', width: 90, render: value => <Tag color={value === 'urgent' ? 'red' : value === 'important' ? 'gold' : 'default'}>{value === 'urgent' ? '紧急' : value === 'important' ? '重要' : '普通'}</Tag> },
                { title: '投递', dataIndex: 'recipient_count', width: 80 },
                { title: '未读', dataIndex: 'unread_count', width: 80 },
                { title: '发送时间', dataIndex: 'created_at', width: 160 },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
