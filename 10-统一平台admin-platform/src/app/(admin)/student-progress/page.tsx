'use client';
import { useState, useEffect } from 'react';
import { Table, Card, Tag, Space, Button, Input, Row, Col, Statistic, Progress, Tabs, InputNumber, message } from 'antd';
import { SearchOutlined, UserOutlined, PlayCircleOutlined, DollarOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { eduApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  const [data, setData] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const fetchData = () => {
    setLoading(true);
    eduApi.getStudentProgress()
      .then(setData)
      .catch(() => {
        // Mock fallback
        setData(Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          name: ['李小雅', '张秀玲', '谢孟辉', '大凤凤', '碧水丛林', '王雨涵', '陈思思', '刘美琪', '赵婷婷', '孙莉', '周敏', '吴芳', '郑洁', '冯娟', '褚云', '卫红', '蒋萍', '沈岚', '韩梅', '杨雪'][i],
          phone: `1380000${String(i + 1).padStart(4, '0')}`,
          level: ['门徒班', '师资班', '常规班', '私教课', '门徒班', '体验学员', '师资班', '常规班', '门徒班', '师资班', '常规班', '体验学员', '门徒班', '私教课', '常规班', '师资班', '门徒班', '体验学员', '常规班', '师资班'][i],
          status: 'active',
          remaining_hours: Math.floor(Math.random() * 30),
          register_date: '2026-01-15',
          growth: Math.floor(Math.random() * 200),
          totalPayments: Math.floor(Math.random() * 5) + 1,
          totalAmount: Math.floor(Math.random() * 10000) + 1000,
          completedVideos: Math.floor(Math.random() * 15),
        })));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = data.filter(d => !searchText || d.name.includes(searchText) || d.phone?.includes(searchText));

  const columns = [
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
      render: (v: number) => <span style={{ fontWeight: 600, color: '#10b981' }}>¥{v?.toLocaleString()}</span> },
    { title: '剩余课次', dataIndex: 'remaining_hours', key: 'remaining_hours', width: 80, align: 'right' as const },
    { title: '完成视频', dataIndex: 'completedVideos', key: 'completedVideos', width: 80, align: 'right' as const,
      render: (v: number) => <span style={{ color: '#a855f7' }}>{v}节</span> },
    { title: '成长值', dataIndex: 'growth', key: 'growth', width: 80, align: 'right' as const },
    { title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '正常' : '停用'}</Tag> },
    { title: '操作', key: 'action', width: 100,
      render: (_: any, r: StudentProgress) => <Button type="link" size="small" onClick={() => router.push(`/members/${r.id}`)}>查看详情</Button> },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>学习进度</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="学员总数" value={data.length} prefix={<UserOutlined />} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="有效学员" value={data.filter(d => d.status === 'active').length} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总缴费" prefix="¥" value={data.reduce((s, d) => s + d.totalAmount, 0).toLocaleString()} valueStyle={{ color: '#a855f7' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总课次" value={data.reduce((s, d) => s + d.remaining_hours, 0)} suffix="次" valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      <Card size="small" extra={<Space>
        <Input placeholder="搜索学员姓名/手机号..." prefix={<SearchOutlined />} style={{ width: 220 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" loading={loading}
          pagination={{ pageSize: 20 }}
          rowKey="id" />
      </Card>
    </div>
  );
}
