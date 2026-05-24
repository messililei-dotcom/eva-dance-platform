'use client';
import { useState } from 'react';
import {
  Table, Card, Button, Input, Row, Col, Statistic, Tag, Space, Modal, message, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CrownOutlined, TeamOutlined,
  PlayCircleOutlined, CheckCircleOutlined, EyeOutlined, EditOutlined,
  UserSwitchOutlined, CloseCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// ────────────────────────── 类型定义 ──────────────────────────
interface MasterClass {
  key: string;
  name: string;
  masterName: string;
  country: string;
  type: '线下集训' | '线上直播' | '混合';
  startDate: string;
  endDate: string;
  enrolled: number;
  price: number;
  location: string;
  status: '报名中' | '进行中' | '已结束' | '已取消';
}

interface EnrollmentRecord {
  key: string;
  courseKey: string;
  studentName: string;
  phone: string;
  enrollTime: string;
  payStatus: '已支付' | '待支付' | '已退款';
  payAmount: number;
}

// ────────────────────────── Mock 数据 ──────────────────────────
const mockMasterClasses: MasterClass[] = [
  {
    key: 'MC-001', name: '东方舞国际大师班', masterName: 'Amira Selim', country: '埃及',
    type: '线下集训', startDate: '2026-06-15', endDate: '2026-06-20', enrolled: 32,
    price: 12880, location: '北京·朝阳大悦城', status: '报名中',
  },
  {
    key: 'MC-002', name: '埃及民俗舞特训', masterName: 'Shereen Ahmed', country: '埃及',
    type: '线下集训', startDate: '2026-07-01', endDate: '2026-07-05', enrolled: 26,
    price: 9800, location: '上海·静安区', status: '报名中',
  },
  {
    key: 'MC-003', name: '鼓点与节奏大师课', masterName: 'Khaled Mahmoud', country: '埃及',
    type: '混合', startDate: '2026-05-10', endDate: '2026-06-10', enrolled: 18,
    price: 6800, location: '线上+广州·天河', status: '进行中',
  },
  {
    key: 'MC-004', name: '土耳其东方舞风格训练', masterName: 'Serap Su', country: '土耳其',
    type: '线下集训', startDate: '2026-05-01', endDate: '2026-05-05', enrolled: 22,
    price: 8800, location: '杭州·西湖文化广场', status: '已结束',
  },
  {
    key: 'MC-005', name: 'Mona Said 经典舞码复刻', masterName: 'Mona El Said', country: '黎巴嫩',
    type: '线上直播', startDate: '2026-06-01', endDate: '2026-06-30', enrolled: 15,
    price: 3980, location: '线上', status: '报名中',
  },
  {
    key: 'MC-006', name: '俄罗斯体系芭蕾基训', masterName: 'Yulia Romanova', country: '俄罗斯',
    type: '线下集训', startDate: '2026-04-15', endDate: '2026-04-20', enrolled: 20,
    price: 10800, location: '深圳·南山', status: '已结束',
  },
  {
    key: 'MC-007', name: '东方舞编舞大师班', masterName: 'Randa Kamel', country: '埃及',
    type: '混合', startDate: '2026-07-15', endDate: '2026-08-10', enrolled: 12,
    price: 10800, location: '线上+成都·武侯', status: '进行中',
  },
  {
    key: 'MC-008', name: '阿拉伯节奏与即兴', masterName: 'Tito Seif', country: '埃及',
    type: '线下集训', startDate: '2026-03-01', endDate: '2026-03-03', enrolled: 28,
    price: 7800, location: '南京·鼓楼', status: '已结束',
  },
];

const mockEnrollments: EnrollmentRecord[] = [
  { key: 'EN-001', courseKey: 'MC-001', studentName: '张晓晓', phone: '138****1234', enrollTime: '2026-05-20 14:30', payStatus: '已支付', payAmount: 12880 },
  { key: 'EN-002', courseKey: 'MC-001', studentName: '李明珠', phone: '139****5678', enrollTime: '2026-05-19 10:15', payStatus: '已支付', payAmount: 12880 },
  { key: 'EN-003', courseKey: 'MC-001', studentName: '王思雨', phone: '136****9012', enrollTime: '2026-05-21 09:00', payStatus: '待支付', payAmount: 12880 },
  { key: 'EN-004', courseKey: 'MC-001', studentName: '赵雅琪', phone: '185****3456', enrollTime: '2026-05-18 16:45', payStatus: '已支付', payAmount: 12880 },
  { key: 'EN-005', courseKey: 'MC-001', studentName: '陈思涵', phone: '177****7890', enrollTime: '2026-05-17 11:20', payStatus: '已退款', payAmount: 12880 },
  { key: 'EN-006', courseKey: 'MC-002', studentName: '刘静怡', phone: '188****2345', enrollTime: '2026-05-20 08:30', payStatus: '已支付', payAmount: 9800 },
  { key: 'EN-007', courseKey: 'MC-002', studentName: '周若曦', phone: '133****6789', enrollTime: '2026-05-19 15:00', payStatus: '已支付', payAmount: 9800 },
  { key: 'EN-008', courseKey: 'MC-002', studentName: '吴诗雨', phone: '156****0123', enrollTime: '2026-05-21 12:00', payStatus: '待支付', payAmount: 9800 },
];

// ────────────────────────── 状态配置 ──────────────────────────
const statusColorMap: Record<MasterClass['status'], string> = {
  '报名中': 'purple',
  '进行中': 'success',
  '已结束': 'default',
  '已取消': 'error',
};

const payStatusColorMap: Record<EnrollmentRecord['payStatus'], string> = {
  '已支付': 'success',
  '待支付': 'warning',
  '已退款': 'default',
};

// ────────────────────────── 主组件 ──────────────────────────
export default function MasterClassPage() {
  const [searchText, setSearchText] = useState('');
  const [dataSource, setDataSource] = useState<MasterClass[]>(mockMasterClasses);
  const [enrollModalVisible, setEnrollModalVisible] = useState(false);
  const [enrollCourseName, setEnrollCourseName] = useState('');
  const [enrollData, setEnrollData] = useState<EnrollmentRecord[]>([]);

  // ── 统计数据 ──
  const totalCount = dataSource.length;
  const totalEnrolled = dataSource.reduce((s, c) => s + c.enrolled, 0);
  const inProgress = dataSource.filter(c => c.status === '进行中').length;
  const finished = dataSource.filter(c => c.status === '已结束').length;

  // ── 搜索过滤 ──
  const filteredData = dataSource.filter(
    c =>
      !searchText ||
      c.name.includes(searchText) ||
      c.masterName.toLowerCase().includes(searchText.toLowerCase()) ||
      c.location.includes(searchText),
  );

  // ── 管理报名弹窗 ──
  const handleManageEnrollment = (record: MasterClass) => {
    setEnrollCourseName(record.name);
    const enrollments = mockEnrollments.filter(e => e.courseKey === record.key);
    // 如果 mock 里没有该课程的报名数据，用 enrolled 数量生成占位数据
    if (enrollments.length === 0) {
      const generated: EnrollmentRecord[] = Array.from({ length: Math.min(record.enrolled, 8) }, (_, i) => ({
        key: `GEN-${record.key}-${i + 1}`,
        courseKey: record.key,
        studentName: `学员${String.fromCharCode(65 + i)}`,
        phone: `${['139', '138', '186', '177', '155'][i % 5]}****${String(i * 1111).padStart(4, '0').slice(-4)}`,
        enrollTime: `2026-0${5 + Math.floor(i / 3)}-${String(10 + i * 3).padStart(2, '0')} ${String(8 + i).padStart(2, '0')}:00`,
        payStatus: (['已支付', '已支付', '待支付', '已支付', '已退款'] as EnrollmentRecord['payStatus'][] )[i % 5],
        payAmount: record.price,
      }));
      setEnrollData(generated);
    } else {
      setEnrollData(enrollments);
    }
    setEnrollModalVisible(true);
  };

  // ── 取消课程 ──
  const handleCancelCourse = (record: MasterClass) => {
    setDataSource(prev =>
      prev.map(c => (c.key === record.key ? { ...c, status: '已取消' as const } : c)),
    );
    message.success(`课程 "${record.name}" 已取消`);
  };

  // ── 表格列定义 ──
  const columns: ColumnsType<MasterClass> = [
    { title: '课程名称', dataIndex: 'name', key: 'name', width: 220, render: (v: string) => <a style={{ fontWeight: 500 }}>{v}</a> },
    { title: '大师姓名', dataIndex: 'masterName', key: 'masterName', width: 150, render: (v: string) => <><CrownOutlined style={{ color: '#faad14', marginRight: 4 }} />{v}</> },
    { title: '国籍', dataIndex: 'country', key: 'country', width: 80 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 90, render: (v: string) => {
      const colorMap = { '线下集训': 'blue', '线上直播': 'cyan', '混合': 'geekblue' };
      return <Tag color={colorMap[v as keyof typeof colorMap]}>{v}</Tag>;
    }},
    {
      title: '课程周期', key: 'duration', width: 160,
      render: (_: unknown, r: MasterClass) => <span style={{ fontSize: 13 }}>{r.startDate} ~ {r.endDate}</span>,
    },
    {
      title: '报名人数', dataIndex: 'enrolled', key: 'enrolled', width: 100, align: 'center',
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 600, fontSize: 15 }}>{v} 人</span>,
    },
    {
      title: '价格', dataIndex: 'price', key: 'price', width: 110, align: 'right',
      render: (v: number) => <span style={{ color: '#a855f7', fontWeight: 500 }}>¥{v.toLocaleString()}</span>,
    },
    { title: '地点', dataIndex: 'location', key: 'location', width: 160, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center',
      render: (v: MasterClass['status']) => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 260, fixed: 'right',
      render: (_: unknown, record: MasterClass) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
          <Button type="link" size="small" icon={<UserSwitchOutlined />} onClick={() => handleManageEnrollment(record)}>
            管理报名
          </Button>
          <Popconfirm
            title="确定取消该课程？"
            description="取消后已报名学员将收到通知"
            onConfirm={() => handleCancelCourse(record)}
            okText="确定"
            cancelText="返回"
          >
            <Button type="link" size="small" danger icon={<CloseCircleOutlined />}
              disabled={record.status === '已取消' || record.status === '已结束'}>
              取消
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── 报名学员表格列 ──
  const enrollColumns: ColumnsType<EnrollmentRecord> = [
    { title: '姓名', dataIndex: 'studentName', key: 'studentName', width: 100 },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '报名时间', dataIndex: 'enrollTime', key: 'enrollTime', width: 160 },
    {
      title: '支付状态', dataIndex: 'payStatus', key: 'payStatus', width: 100, align: 'center',
      render: (v: EnrollmentRecord['payStatus']) => <Tag color={payStatusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '支付金额', dataIndex: 'payAmount', key: 'payAmount', width: 120, align: 'right',
      render: (v: number) => <span style={{ fontWeight: 500 }}>¥{v.toLocaleString()}</span>,
    },
  ];

  // ────────────────────────── 渲染 ──────────────────────────
  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>大师课管理</h2>

      {/* Statistic Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderLeft: '3px solid #a855f7' }}>
            <Statistic
              title="大师课总数"
              value={totalCount}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#a855f7' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderLeft: '3px solid #1677ff' }}>
            <Statistic
              title="已报名学员"
              value={totalEnrolled}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title="进行中"
              value={inProgress}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderLeft: '3px solid #8c8c8c' }}>
            <Statistic
              title="已结束"
              value={finished}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table Card */}
      <Card
        size="small"
        title={<span><CrownOutlined style={{ color: '#a855f7', marginRight: 8 }} />大师课列表</span>}
        extra={
          <Space>
            <Input
              placeholder="搜索课程/大师/地点..."
              prefix={<SearchOutlined />}
              style={{ width: 220 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={() => setSearchText('')}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}>
              新建大师课
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredData}
          size="middle"
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 门大师课`,
          }}
        />
      </Card>

      {/* 管理报名弹窗 */}
      <Modal
        title={<span><UserSwitchOutlined style={{ color: '#a855f7', marginRight: 8 }} />管理报名 — {enrollCourseName}</span>}
        open={enrollModalVisible}
        onCancel={() => setEnrollModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setEnrollModalVisible(false)}>关闭</Button>,
        ]}
      >
        <Table
          columns={enrollColumns}
          dataSource={enrollData}
          size="small"
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 名学员` }}
          summary={() => {
            const totalPaid = enrollData.reduce((s, e) => s + e.payAmount, 0);
            const paidCount = enrollData.filter(e => e.payStatus === '已支付').length;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4} align="right">
                  <strong>已支付 {paidCount} 笔，总计：</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <span style={{ color: '#a855f7', fontWeight: 700, fontSize: 15 }}>
                    ¥{totalPaid.toLocaleString()}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Modal>
    </div>
  );
}
