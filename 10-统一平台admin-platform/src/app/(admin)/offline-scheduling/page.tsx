'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  QRCode,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Table } from '@/components/adaptive-table';
import { trainingApi } from '@/lib/api';
import { platformAdapter } from '@/lib/adapters/platform';

const { Text, Title } = Typography;

type Course = {
  id: number;
  name: string;
  subType?: string;
  teacher?: string;
  series_id?: number;
};

type Member = { id: number | string; name: string; phone?: string };

type Session = {
  id: number;
  course_id: number;
  course_name: string;
  course_period?: string;
  session_no: number;
  session_date: string;
  start_time: string;
  end_time: string;
  teacher_name?: string;
  classroom?: string;
  address?: string;
  capacity: number;
  booked_count: number;
  actual_booked_count: number;
  checked_in_count: number;
  status: string;
};

type Booking = {
  id: number;
  booking_no: string;
  member_name: string;
  member_phone?: string;
  course_name: string;
  course_period?: string;
  session_no: number;
  session_date: string;
  start_time: string;
  status: string;
  available_sessions: number;
  frozen_sessions: number;
};

function token() {
  return typeof window === 'undefined' ? '' : localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.error || body.message || '操作失败');
  return body.data ?? body;
}

function statusTag(status: string) {
  const config: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    published: { color: 'blue', text: '可预约' },
    checkin_open: { color: 'green', text: '签到中' },
    finished: { color: 'default', text: '已结束' },
    cancelled: { color: 'red', text: '已取消' },
    booked: { color: 'blue', text: '已预约' },
    consumed: { color: 'green', text: '已到课核销' },
  };
  const item = config[status] || { color: 'default', text: status || '-' };
  return <Tag color={item.color}>{item.text}</Tag>;
}

export default function OfflineSchedulingPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [bookingForm] = Form.useForm();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [bookingModal, setBookingModal] = useState(false);
  const [checkinData, setCheckinData] = useState<{ checkinCode: string; validUntil: string } | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRows, bookingRows, courseRows, directory] = await Promise.all([
        request<Session[]>('/offline/sessions'),
        request<Booking[]>('/offline/bookings'),
        trainingApi.getCourses(),
        platformAdapter.getMemberDirectory(),
      ]);
      setSessions(sessionRows);
      setBookings(bookingRows);
      setCourses(courseRows.filter((course: Course) => Number(course.series_id || 0) <= 0));
      setMembers(directory.members);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const todaySessions = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    return sessions.filter(item => item.session_date === today);
  }, [sessions]);
  const bookedTotal = useMemo(
    () => sessions.reduce((sum, item) => sum + Number(item.actual_booked_count || 0), 0),
    [sessions],
  );
  const checkedInTotal = useMemo(
    () => sessions.reduce((sum, item) => sum + Number(item.checked_in_count || 0), 0),
    [sessions],
  );

  const createSession = async () => {
    const values = await form.validateFields();
    const sessionDate = values.sessionDate.format('YYYY-MM-DD');
    const startTime = values.startTime.format('HH:mm');
    const endTime = values.endTime.format('HH:mm');
    const sessionStart = dayjs(`${sessionDate} ${startTime}`);
    await request('/offline/sessions', {
      method: 'POST',
      body: JSON.stringify({
        ...values,
        sessionDate,
        startTime,
        endTime,
        bookingCloseAt: `${sessionDate} ${startTime}`,
        cancelDeadlineAt: sessionStart.subtract(12, 'hour').format('YYYY-MM-DD HH:mm'),
        checkinOpenAt: sessionStart.subtract(30, 'minute').format('YYYY-MM-DD HH:mm'),
        checkinCloseAt: sessionStart.add(30, 'minute').format('YYYY-MM-DD HH:mm'),
      }),
    });
    message.success('课次已创建');
    setSessionModal(false);
    form.resetFields();
    await load();
  };

  const publishSession = async (session: Session) => {
    await request(`/offline/sessions/${session.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'published' }),
    });
    message.success('课次已开放预约');
    await load();
  };

  const openCheckin = async (session: Session) => {
    const data = await request<{ checkinCode: string; validUntil: string }>(
      `/offline/sessions/${session.id}/checkin-code`,
      { method: 'POST' },
    );
    setSelectedSession(session);
    setCheckinData(data);
    await load();
  };

  const createBooking = async () => {
    const values = await bookingForm.validateFields();
    await request('/offline/bookings', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    message.success('预约成功，已冻结1课次');
    setBookingModal(false);
    bookingForm.resetFields();
    await load();
  };

  const checkinBooking = async (booking: Booking) => {
    const result = await request<{ repeated?: boolean; remainingSessions?: number }>(`/offline/bookings/${booking.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'checkin' }),
    });
    message.success(result.repeated ? '该预约已核销，无需重复操作' : `到课核销成功，剩余${result.remainingSessions}课次`);
    await load();
  };

  const openBookingForSession = (session: Session) => {
    setSelectedSession(session);
    bookingForm.setFieldsValue({ sessionId: session.id });
    setBookingModal(true);
  };

  return (
    <div>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>排课与约课</Title>
          <Text type="secondary">统一按课次计量：预约冻结1课次，到课签到后核销1课次。</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button
            onClick={async () => {
              const result = await request<any>('/offline/migrate', { method: 'POST' });
              message.success(`权益同步完成：${result.totals?.availableSessions || 0}个可用课次`);
              await load();
            }}
          >
            同步历史权益
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.setFieldsValue({
              sessionDate: dayjs(),
              startTime: dayjs('09:30', 'HH:mm'),
              endTime: dayjs('12:00', 'HH:mm'),
              capacity: 30,
              status: 'draft',
            });
            setSessionModal(true);
          }}>新增课次</Button>
        </Space>
      </Space>

      <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
        <Col xs={12} lg={6}><Card><Statistic title="已排课次" value={sessions.length} prefix={<CalendarOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="今日课次" value={todaySessions.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="累计预约" value={bookedTotal} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="已到课核销" value={checkedInTotal} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      <Tabs items={[
        {
          key: 'sessions',
          label: `排课（${sessions.length}）`,
          children: (
            <Card styles={{ body: { padding: 0 } }}>
              <Table<Session>
                rowKey="id"
                loading={loading}
                dataSource={sessions}
                scroll={{ x: 1250 }}
                pagination={{ pageSize: 20 }}
                columns={[
                  { title: '日期', dataIndex: 'session_date', fixed: 'left', width: 110 },
                  { title: '时间', width: 120, render: (_, row) => `${row.start_time}–${row.end_time}` },
                  { title: '课程期次', width: 240, render: (_, row) => <><Text strong>{row.course_name}</Text><br /><Text type="secondary">{row.course_period || '-'}</Text></> },
                  { title: '课次', dataIndex: 'session_no', width: 75, render: value => `第${value}次` },
                  { title: '老师', dataIndex: 'teacher_name', width: 110, render: value => value || '-' },
                  { title: '教室', dataIndex: 'classroom', width: 110, render: value => value || '-' },
                  { title: '预约', width: 110, render: (_, row) => `${row.actual_booked_count || 0}/${row.capacity}` },
                  { title: '已到课', dataIndex: 'checked_in_count', width: 80 },
                  { title: '状态', dataIndex: 'status', width: 90, render: statusTag },
                  {
                    title: '操作',
                    fixed: 'right',
                    width: 310,
                    render: (_, row) => (
                      <Space size={4}>
                        {row.status === 'draft' && <Button size="small" onClick={() => publishSession(row)}>开放预约</Button>}
                        <Button size="small" icon={<UserAddOutlined />} onClick={() => openBookingForSession(row)}>代约课</Button>
                        <Button size="small" icon={<QrcodeOutlined />} disabled={!['published', 'checkin_open'].includes(row.status)} onClick={() => openCheckin(row)}>签到码</Button>
                        <Button size="small" onClick={() => {
                          setSelectedSession(row);
                          document.getElementById('offline-bookings-tab')?.click();
                        }}>名单</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          ),
        },
        {
          key: 'bookings',
          label: <span id="offline-bookings-tab">预约与签到（{bookings.length}）</span>,
          children: (
            <Card styles={{ body: { padding: 0 } }}>
              <Table<Booking>
                rowKey="id"
                loading={loading}
                dataSource={selectedSession ? bookings.filter(row => Number((row as any).session_id) === selectedSession.id) : bookings}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 1100 }}
                columns={[
                  { title: '上课日期', dataIndex: 'session_date', width: 110 },
                  { title: '时间', dataIndex: 'start_time', width: 80 },
                  { title: '课程', dataIndex: 'course_name', width: 220 },
                  { title: '学员', dataIndex: 'member_name', width: 100 },
                  { title: '手机号', dataIndex: 'member_phone', width: 130 },
                  { title: '状态', dataIndex: 'status', width: 110, render: statusTag },
                  { title: '可用课次', dataIndex: 'available_sessions', width: 90 },
                  { title: '已冻结', dataIndex: 'frozen_sessions', width: 80 },
                  {
                    title: '操作',
                    fixed: 'right',
                    width: 140,
                    render: (_, row) => row.status === 'booked'
                      ? <Button type="primary" size="small" onClick={() => checkinBooking(row)}>到课并核销</Button>
                      : <Text type="secondary">已处理</Text>,
                  },
                ]}
              />
            </Card>
          ),
        },
      ]} />

      <Modal title="新增具体课次" open={sessionModal} onCancel={() => setSessionModal(false)} onOk={createSession} width={720}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="courseId" label="课程期次" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={courses.map(item => ({ value: item.id, label: `${item.name}${item.subType ? ` / ${item.subType}` : ''}` }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="sessionNo" label="第几课次"><InputNumber min={1} style={{ width: '100%' }} placeholder="自动顺延" /></Form.Item></Col>
            <Col span={8}><Form.Item name="sessionDate" label="上课日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="teacherName" label="老师"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="classroom" label="教室"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="capacity" label="可约人数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="address" label="上课地址"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="后台代约课" open={bookingModal} onCancel={() => setBookingModal(false)} onOk={createBooking}>
        <Form form={bookingForm} layout="vertical">
          <Form.Item name="sessionId" label="具体课次" rules={[{ required: true }]}>
            <Select options={sessions.filter(item => ['published', 'checkin_open'].includes(item.status)).map(item => ({
              value: item.id,
              label: `${item.session_date} ${item.start_time}｜${item.course_name} 第${item.session_no}次`,
            }))} />
          </Form.Item>
          <Form.Item name="memberId" label="学员" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={members.map(item => ({ value: item.id, label: `${item.name}${item.phone ? ` / ${item.phone}` : ''}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`${selectedSession?.course_name || ''} 第${selectedSession?.session_no || ''}课次签到码`} open={!!checkinData} footer={null} onCancel={() => setCheckinData(null)}>
        {checkinData && (
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <QRCode value={checkinData.checkinCode} size={260} />
            <Text>学员进入“我的线下课”扫码签到</Text>
            <Text type="secondary">有效至：{checkinData.validUntil}</Text>
            <Text copyable={{ text: checkinData.checkinCode }}>签到码：{checkinData.checkinCode}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
