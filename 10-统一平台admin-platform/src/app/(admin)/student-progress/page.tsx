'use client';
import { useState, useEffect } from 'react';
import { Card, Tag, Space, Button, Input, Row, Col, Statistic, Empty, App } from 'antd';
import { Table } from '@/components/adaptive-table';
import { SearchOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons';
import { eduApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { sortableColumns } from '@/lib/table-sort';

interface StudentProgress {
  id: number;
  name: string;
  phone: string;
  level: string;
  status: string;
  remaining_hours: number;
  register_date: string;
  growth: number;
  totalPayments: number;
  totalAmount: number;
  completedVideos: number;
}

export default function StudentProgressPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [data, setData] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const fetchData = () => {
    setLoading(true);
    eduApi.getStudentProgress()
      .then(setData)
      .catch((error) => {
        setData([]);
        message.error(error?.response?.data?.error || error?.message || '学习进度加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = data.filter(d => !searchText || d.name.includes(searchText) || d.phone?.includes(searchText));

  const columns = sortableColumns<StudentProgress>([
    { title: '学员', key: 'name', width: 120,
      render: (_: any, r: StudentProgress) => (
        <a onClick={() => router.push(`/members/${r.id}`)}>
          <UserOutlined style={{ marginRight: 6 }} />{r.name}
        </a>
      )
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '等级', dataIndex: 'level', key: 'level', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '缴费次数', dataIndex: 'totalPayments', key: 'totalPayments', width: 80, align: 'right' as const },
    { title: '缴费总额', dataIndex: 'totalAmount', key: 'totalAmount', width: 100, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600, color: '#10b981' }}>{formatPaymentAmount(v)}</span> },
    { title: '剩余课次', dataIndex: 'remaining_hours', key: 'remaining_hours', width: 80, align: 'right' as const },
    { title: '完成视频', dataIndex: 'completedVideos', key: 'completedVideos', width: 80, align: 'right' as const,
      render: (v: number) => <span style={{ color: '#a855f7' }}>{v}节</span> },
    { title: '成长值', dataIndex: 'growth', key: 'growth', width: 80, align: 'right' as const },
    { title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '正常' : '停用'}</Tag> },
    { title: '操作', key: 'action', width: 100,
      render: (_: any, r: StudentProgress) => <Button type="link" size="small" onClick={() => router.push(`/members/${r.id}`)}>查看详情</Button> },
  ]);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>学习进度</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="学员总数" value={data.length} prefix={<UserOutlined />} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="有效学员" value={data.filter(d => d.status === 'active').length} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总缴费" value={formatCompactMoney(data.reduce((s, d) => s + d.totalAmount, 0))} valueStyle={{ color: '#a855f7' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总课次" value={data.reduce((s, d) => s + d.remaining_hours, 0)} suffix="次" valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      <Card size="small" extra={<Space>
        <Input placeholder="搜索学员姓名/手机号..." prefix={<SearchOutlined />} style={{ width: 220 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" loading={loading}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="暂无真实学习进度数据" /> }}
          pagination={{ pageSize: 20 }}
          rowKey="id" />
      </Card>
    </div>
  );
}
