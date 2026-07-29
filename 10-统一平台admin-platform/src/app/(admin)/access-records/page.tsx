'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Card, DatePicker, Empty, Input, Select, Space, Spin, Tabs, Tag, Typography } from 'antd';
import { Table } from '@/components/adaptive-table';
import { BarChartOutlined, ClockCircleOutlined, HistoryOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import { adminTablePagination, sortableColumns } from '@/lib/table-sort';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

type AccessRecord = {
  id: string;
  category: 'student' | 'admin';
  visitedAt: string;
  platform: string;
  module: string;
  action: string;
  targetTitle: string;
  visitorName: string;
  visitorPhone: string;
  visitorKey: string;
  visitorType: string;
  source: string;
  remark: string;
};

type AccessRecordsResponse = {
  records: AccessRecord[];
  summary: {
    total: number;
    today: number;
    month: number;
    visitors: number;
    student: number;
    admin: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  byPlatform: { platform: string; count: number }[];
  byAction: { action: string; count: number }[];
};

const EMPTY_RESPONSE: AccessRecordsResponse = {
  records: [],
  summary: { total: 0, today: 0, month: 0, visitors: 0, student: 0, admin: 0 },
  pagination: { page: 1, pageSize: 20, total: 0 },
  byPlatform: [],
  byAction: [],
};

function platformColor(platform: string) {
  if (platform.includes('后台')) return 'blue';
  if (platform.includes('小程序')) return 'green';
  if (platform.includes('官网')) return 'purple';
  return 'default';
}

function actionColor(action: string) {
  if (action.includes('视频') || action.includes('学习')) return 'magenta';
  if (action.includes('授权')) return 'orange';
  if (action.includes('操作')) return 'geekblue';
  return 'cyan';
}

export default function AccessRecordsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState('all');
  const [action, setAction] = useState('all');
  const [category, setCategory] = useState<'student' | 'admin'>('student');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [data, setData] = useState<AccessRecordsResponse>(EMPTY_RESPONSE);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        q: keyword.trim(),
        platform,
        action,
        category,
        page: String(page),
        pageSize: String(pageSize),
      };
      if (range?.[0]) params.start = range[0].format('YYYY-MM-DD');
      if (range?.[1]) params.end = range[1].format('YYYY-MM-DD');
      const res = await api.get('/access-records', { params });
      setData(res.data?.data || EMPTY_RESPONSE);
    } catch (error: any) {
      message.error(error?.response?.data?.error || '访问记录加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadData, keyword.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [keyword, platform, action, category, page, pageSize, range]);

  const platformOptions = useMemo(() => [
    { label: '全部平台', value: 'all' },
    ...data.byPlatform.map(item => ({ label: `${item.platform} ${item.count}`, value: item.platform })),
  ], [data.byPlatform]);

  const actionOptions = useMemo(() => [
    { label: '全部动作', value: 'all' },
    ...data.byAction.map(item => ({ label: `${item.action} ${item.count}`, value: item.action })),
  ], [data.byAction]);

  const resetPage = () => setPage(1);

  const categoryTabs = [
    { key: 'student', label: `学员/游客访问 ${data.summary.student || 0}` },
    { key: 'admin', label: `管理员访问 ${data.summary.admin || 0}` },
  ];

  return (
    <div className="access-records-page">
      <div className="page-header">
        <div>
          <Title level={2}>访问记录</Title>
          <Text type="secondary">分开统计学员/游客访问和管理员后台操作，覆盖官网、小程序、后台系统等平台。</Text>
        </div>
      </div>

      <Spin spinning={loading}>
        <Card className="access-records-summary-card" styles={{ body: { padding: 10 } }}>
          <div className="access-records-summary-line" aria-label="访问记录统计">
            <span className="access-records-summary-item access-records-summary-item-green">
              <ClockCircleOutlined />
              <span>今日访问</span>
              <strong>{data.summary.today}</strong>
            </span>
            <span className="access-records-summary-item access-records-summary-item-blue">
              <BarChartOutlined />
              <span>本月访问</span>
              <strong>{data.summary.month}</strong>
            </span>
            <span className="access-records-summary-item access-records-summary-item-purple">
              <HistoryOutlined />
              <span>累计记录</span>
              <strong>{data.summary.total}</strong>
            </span>
            <span className="access-records-summary-item">
              <TeamOutlined />
              <span>访客数</span>
              <strong>{data.summary.visitors}</strong>
            </span>
          </div>
        </Card>

        <Card
          className="access-records-table-card"
          title={
            <Tabs
              activeKey={category}
              items={categoryTabs}
              onChange={(key) => {
                setCategory(key as 'student' | 'admin');
                setPlatform('all');
                setAction('all');
                setPage(1);
              }}
            />
          }
          extra={
            <Space wrap>
              <RangePicker value={range} onChange={(value) => { setRange(value); resetPage(); }} allowClear />
              <Select value={platform} options={platformOptions} onChange={(value) => { setPlatform(value); resetPage(); }} style={{ width: 150 }} />
              <Select value={action} options={actionOptions} onChange={(value) => { setAction(value); resetPage(); }} style={{ width: 180 }} />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={category === 'admin' ? '搜索管理员、模块、操作内容' : '搜索课程、访客、手机号、动作'}
                value={keyword}
                onChange={event => { setKeyword(event.target.value); resetPage(); }}
                style={{ width: 280 }}
              />
            </Space>
          }
          styles={{ body: { padding: 0 } }}
        >
          <Table<AccessRecord>
            className="access-records-table"
            rowKey="id"
            size="middle"
            scroll={{ x: 'max-content', y: 'calc(100dvh - 382px)' }}
            dataSource={data.records}
            pagination={adminTablePagination({
              current: page,
              pageSize,
              total: data.pagination.total,
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize || 20);
              },
            })}
            locale={{ emptyText: <Empty description="暂无访问记录" /> }}
            columns={sortableColumns<AccessRecord>([
              { title: '访问时间', dataIndex: 'visitedAt', width: 170, fixed: 'left' },
              { title: '平台', dataIndex: 'platform', width: 130, render: value => <Tag color={platformColor(String(value))}>{value}</Tag> },
              { title: '模块', dataIndex: 'module', width: 120 },
              { title: '动作', dataIndex: 'action', width: 150, render: value => <Tag color={actionColor(String(value))}>{value}</Tag> },
              { title: '访问对象', dataIndex: 'targetTitle', width: 360, render: value => <Text style={{ whiteSpace: 'normal' }}>{value}</Text> },
              { title: category === 'admin' ? '管理员' : '访客/学员', dataIndex: 'visitorName', width: 150, render: value => <Text strong>{value}</Text> },
              { title: '身份', dataIndex: 'visitorType', width: 100 },
              { title: '手机号', dataIndex: 'visitorPhone', width: 130, render: value => value || '-' },
              { title: '来源标识', dataIndex: 'visitorKey', width: 180, render: value => value || '-' },
              { title: '备注', dataIndex: 'remark', width: 160, render: value => value || '-' },
            ])}
          />
        </Card>
      </Spin>
    </div>
  );
}
