'use client';
import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Input,
  Space,
  Modal,
  Form,
  Select,
  message,
  Tooltip,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SyncOutlined,
  RiseOutlined,
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  SwapOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// ==================== 类型定义 ====================
type IntentLevel = 'A' | 'B' | 'C' | 'D';
type FollowStatus = '待跟进' | '跟进中' | '已报价' | '已成交' | '已流失';
type Source = '微信' | '抖音' | '小红书' | '转介绍' | '官网' | '地推' | '线下活动' | '电话咨询';
type Follower = '伊小琳' | '增长专家' | '伊小娃';

interface Lead {
  key: string;
  name: string;
  phone: string;
  source: Source;
  intentLevel: IntentLevel;
  followStatus: FollowStatus;
  lastFollowTime: string;
  nextFollowTime: string;
  follower: Follower;
  notes: string;
}

// ==================== 颜色映射 ====================
const intentColorMap: Record<IntentLevel, string> = {
  A: 'red',
  B: 'orange',
  C: 'blue',
  D: 'default',
};

const followStatusColorMap: Record<FollowStatus, 'default' | 'processing' | 'warning' | 'success' | 'error'> = {
  '待跟进': 'default',
  '跟进中': 'processing',
  '已报价': 'warning',
  '已成交': 'success',
  '已流失': 'error',
};

// ==================== Mock 数据 ====================
const mockLeads: Lead[] = [
  { key: '1', name: '张小美', phone: '13800138001', source: '微信', intentLevel: 'A', followStatus: '跟进中', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-25', follower: '伊小琳', notes: '对成品舞课程兴趣浓厚' },
  { key: '2', name: '李芳', phone: '13800138002', source: '抖音', intentLevel: 'B', followStatus: '已报价', lastFollowTime: '2026-05-22', nextFollowTime: '2026-05-26', follower: '增长专家', notes: '咨询线下培训课程' },
  { key: '3', name: '王丽娜', phone: '13800138003', source: '小红书', intentLevel: 'A', followStatus: '已成交', lastFollowTime: '2026-05-21', nextFollowTime: '2026-06-01', follower: '伊小琳', notes: '已报名线上学院年卡' },
  { key: '4', name: '赵思雨', phone: '13800138004', source: '转介绍', intentLevel: 'C', followStatus: '待跟进', lastFollowTime: '2026-05-20', nextFollowTime: '2026-05-24', follower: '伊小娃', notes: '朋友推荐，想了解课程' },
  { key: '5', name: '陈晓燕', phone: '13800138005', source: '官网', intentLevel: 'B', followStatus: '跟进中', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-27', follower: '增长专家', notes: '留了联系方式，对舞蹈感兴趣' },
  { key: '6', name: '刘佳怡', phone: '13800138006', source: '微信', intentLevel: 'A', followStatus: '已报价', lastFollowTime: '2026-05-22', nextFollowTime: '2026-05-25', follower: '伊小琳', notes: '预算充足，想系统学习' },
  { key: '7', name: '周敏', phone: '13800138007', source: '地推', intentLevel: 'D', followStatus: '已流失', lastFollowTime: '2026-05-15', nextFollowTime: '-', follower: '伊小娃', notes: '距离太远，不考虑了' },
  { key: '8', name: '吴静', phone: '13800138008', source: '抖音', intentLevel: 'C', followStatus: '待跟进', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-26', follower: '增长专家', notes: '评论区留言咨询' },
  { key: '9', name: '郑诗涵', phone: '13800138009', source: '小红书', intentLevel: 'B', followStatus: '跟进中', lastFollowTime: '2026-05-21', nextFollowTime: '2026-05-24', follower: '伊小琳', notes: '对肚皮舞感兴趣' },
  { key: '10', name: '孙婉婷', phone: '13800138010', source: '转介绍', intentLevel: 'A', followStatus: '已成交', lastFollowTime: '2026-05-20', nextFollowTime: '2026-06-15', follower: '增长专家', notes: 'VIP会员，转介绍的新学员' },
  { key: '11', name: '黄雨晴', phone: '13800138011', source: '微信', intentLevel: 'B', followStatus: '待跟进', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-24', follower: '伊小娃', notes: '群里添加，想了解价格' },
  { key: '12', name: '林思琪', phone: '13800138012', source: '线下活动', intentLevel: 'C', followStatus: '跟进中', lastFollowTime: '2026-05-22', nextFollowTime: '2026-05-28', follower: '伊小琳', notes: '参加线下活动后咨询' },
  { key: '13', name: '杨雪', phone: '13800138013', source: '抖音', intentLevel: 'D', followStatus: '已流失', lastFollowTime: '2026-05-10', nextFollowTime: '-', follower: '增长专家', notes: '暂无学习计划' },
  { key: '14', name: '马晓萌', phone: '13800138014', source: '官网', intentLevel: 'A', followStatus: '跟进中', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-25', follower: '伊小琳', notes: '高意向，需要尽快跟进' },
  { key: '15', name: '丁悦', phone: '13800138015', source: '转介绍', intentLevel: 'B', followStatus: '已报价', lastFollowTime: '2026-05-21', nextFollowTime: '2026-05-27', follower: '伊小娃', notes: '价格敏感，需要优惠方案' },
  { key: '16', name: '胡佳欣', phone: '13800138016', source: '微信', intentLevel: 'C', followStatus: '待跟进', lastFollowTime: '2026-05-22', nextFollowTime: '2026-05-24', follower: '增长专家', notes: '新添加好友，尚未深入沟通' },
  { key: '17', name: '徐梦然', phone: '13800138017', source: '电话咨询', intentLevel: 'A', followStatus: '已报价', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-25', follower: '伊小琳', notes: '电话咨询，意向强烈' },
  { key: '18', name: '何思彤', phone: '13800138018', source: '小红书', intentLevel: 'B', followStatus: '跟进中', lastFollowTime: '2026-05-20', nextFollowTime: '2026-05-26', follower: '伊小娃', notes: '收藏了多篇笔记' },
  { key: '19', name: '罗晓岚', phone: '13800138019', source: '地推', intentLevel: 'D', followStatus: '待跟进', lastFollowTime: '2026-05-23', nextFollowTime: '2026-05-27', follower: '增长专家', notes: '地推扫码，意向待确认' },
  { key: '20', name: '梁紫萱', phone: '13800138020', source: '微信', intentLevel: 'A', followStatus: '已成交', lastFollowTime: '2026-05-19', nextFollowTime: '2026-06-05', follower: '伊小琳', notes: '已购买全套课程，需跟进学习进度' },
];

const convertSources: Source[] = ['微信', '抖音', '小红书', '转介绍', '官网', '地推', '线下活动', '电话咨询'];
const followers: Follower[] = ['伊小琳', '增长专家', '伊小娃'];

// ==================== 页面组件 ====================
export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [searchText, setSearchText] = useState('');
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [convertForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 统计数据
  const stats = {
    totalLeads: 156,
    converted: 47,
    following: 28,
    conversionRate: '30.1%',
  };

  // 过滤后的数据
  const filteredLeads = leads.filter((lead) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      lead.name.toLowerCase().includes(s) ||
      lead.phone.includes(s) ||
      lead.source.toLowerCase().includes(s) ||
      lead.followStatus.includes(searchText) ||
      lead.follower.includes(searchText)
    );
  });

  // ==================== 转为学员 ====================
  const handleConvert = (record: Lead) => {
    setCurrentLead(record);
    convertForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      level: undefined,
    });
    setConvertModalOpen(true);
  };

  const handleConvertSubmit = async () => {
    try {
      const values = await convertForm.validateFields();
      message.success(`${values.name} 已成功转为学员，会员等级：${values.level}`);
      setLeads((prev) =>
        prev.map((l) =>
          l.key === currentLead?.key
            ? { ...l, followStatus: '已成交' as FollowStatus, lastFollowTime: new Date().toISOString().slice(0, 10) }
            : l
        )
      );
      setConvertModalOpen(false);
      convertForm.resetFields();
    } catch {
      // validation failed
    }
  };

  // ==================== 分配跟进人 ====================
  const handleAssign = (record: Lead) => {
    setCurrentLead(record);
    assignForm.setFieldsValue({ follower: record.follower });
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      message.success(`已将 ${currentLead?.name} 分配给 ${values.follower}`);
      setLeads((prev) =>
        prev.map((l) =>
          l.key === currentLead?.key ? { ...l, follower: values.follower } : l
        )
      );
      setAssignModalOpen(false);
      assignForm.resetFields();
    } catch {
      // validation failed
    }
  };

  // ==================== 编辑线索 ====================
  const handleEdit = (record: Lead) => {
    setCurrentLead(record);
    editForm.setFieldsValue({
      name: record.name,
      phone: record.phone,
      source: record.source,
      intentLevel: record.intentLevel,
      followStatus: record.followStatus,
      follower: record.follower,
      notes: record.notes,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      message.success('线索信息已更新');
      setLeads((prev) =>
        prev.map((l) =>
          l.key === currentLead?.key
            ? { ...l, ...values }
            : l
        )
      );
      setEditModalOpen(false);
      editForm.resetFields();
    } catch {
      // validation failed
    }
  };

  // ==================== 表格列定义 ====================
  const columns: ColumnsType<Lead> = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 100,
      fixed: 'left',
      render: (text: string, record: Lead) => (
        <a onClick={() => { setCurrentLead(record); setDetailModalOpen(true); }}>{text}</a>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 140,
    },
    {
      title: '来源渠道',
      dataIndex: 'source',
      width: 110,
      render: (s: Source) => <Tag>{s}</Tag>,
    },
    {
      title: '意向等级',
      dataIndex: 'intentLevel',
      width: 100,
      render: (level: IntentLevel) => (
        <Tag color={intentColorMap[level]}>{level}类</Tag>
      ),
    },
    {
      title: '跟进状态',
      dataIndex: 'followStatus',
      width: 100,
      render: (status: FollowStatus) => (
        <Tag color={followStatusColorMap[status]}>{status}</Tag>
      ),
    },
    {
      title: '最近跟进',
      dataIndex: 'lastFollowTime',
      width: 120,
    },
    {
      title: '下次跟进',
      dataIndex: 'nextFollowTime',
      width: 120,
      render: (t: string) => <span style={{ color: t === '-' ? '#999' : '#1f2937' }}>{t}</span>,
    },
    {
      title: '跟进人',
      dataIndex: 'follower',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_: unknown, record: Lead) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setCurrentLead(record); setDetailModalOpen(true); }}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Tooltip title={record.followStatus === '已成交' ? '已是学员' : '转为正式学员'}>
            <Button
              type="link"
              size="small"
              icon={<SwapOutlined />}
              onClick={() => handleConvert(record)}
              disabled={record.followStatus === '已成交'}
              style={{ color: record.followStatus === '已成交' ? '#ccc' : '#a855f7' }}
            >
              转为学员
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<UserSwitchOutlined />}
            onClick={() => handleAssign(record)}
          >
            分配
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* ========== 顶部统计卡片 ========== */}
      <h2 style={{ marginBottom: 20, color: '#1f2937' }}>客户关系管理</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="线索总数"
              value={stats.totalLeads}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#a855f7' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="已转化客户"
              value={stats.converted}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="跟进中"
              value={stats.following}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="转化率"
              value={stats.conversionRate}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ========== 搜索 & 操作栏 ========== */}
      <Card style={{ marginTop: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Input
              placeholder="搜索姓名 / 手机号 / 来源 / 状态 / 跟进人"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 360 }}
              allowClear
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}>
              新增线索
            </Button>
          </Col>
        </Row>
      </Card>

      {/* ========== 线索列表 ========== */}
      <Card style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={filteredLeads}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条线索`,
          }}
        />
      </Card>

      {/* ========== 转为学员弹窗 ========== */}
      <Modal
        title="转为正式学员"
        open={convertModalOpen}
        onOk={handleConvertSubmit}
        onCancel={() => { setConvertModalOpen(false); convertForm.resetFields(); }}
        okText="确认转化"
        cancelText="取消"
        okButtonProps={{ style: { backgroundColor: '#a855f7', borderColor: '#a855f7' } }}
      >
        <Form form={convertForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="会员等级"
            name="level"
            rules={[{ required: true, message: '请选择会员等级' }]}
          >
            <Select placeholder="请选择会员等级">
              <Select.Option value="普通会员">普通会员</Select.Option>
              <Select.Option value="VIP会员">VIP会员</Select.Option>
              <Select.Option value="黑金会员">黑金会员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ========== 分配跟进人弹窗 ========== */}
      <Modal
        title="分配跟进人"
        open={assignModalOpen}
        onOk={handleAssignSubmit}
        onCancel={() => { setAssignModalOpen(false); assignForm.resetFields(); }}
        okText="确认分配"
        cancelText="取消"
        okButtonProps={{ style: { backgroundColor: '#a855f7', borderColor: '#a855f7' } }}
      >
        <Form form={assignForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="当前线索" style={{ marginBottom: 16 }}>
            <Tag>{currentLead?.name} - {currentLead?.phone}</Tag>
          </Form.Item>
          <Form.Item label="跟进人" name="follower" rules={[{ required: true, message: '请选择跟进人' }]}>
            <Select>
              {followers.map((f) => (
                <Select.Option key={f} value={f}>{f}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ========== 查看详情弹窗 ========== */}
      <Modal
        title="线索详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
          <Button
            key="convert"
            type="primary"
            style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}
            disabled={currentLead?.followStatus === '已成交'}
            onClick={() => {
              setDetailModalOpen(false);
              if (currentLead) handleConvert(currentLead);
            }}
          >
            转为学员
          </Button>,
        ]}
      >
        {currentLead && (
          <div style={{ padding: '8px 0' }}>
            <p><strong>姓名：</strong>{currentLead.name}</p>
            <p><strong>手机号：</strong>{currentLead.phone}</p>
            <p><strong>来源渠道：</strong><Tag>{currentLead.source}</Tag></p>
            <p>
              <strong>意向等级：</strong>
              <Tag color={intentColorMap[currentLead.intentLevel]}>{currentLead.intentLevel}类</Tag>
            </p>
            <p>
              <strong>跟进状态：</strong>
              <Tag color={followStatusColorMap[currentLead.followStatus]}>{currentLead.followStatus}</Tag>
            </p>
            <p><strong>最近跟进时间：</strong>{currentLead.lastFollowTime}</p>
            <p><strong>下次跟进时间：</strong>{currentLead.nextFollowTime}</p>
            <p><strong>跟进人：</strong>{currentLead.follower}</p>
            <p><strong>备注：</strong>{currentLead.notes}</p>
          </div>
        )}
      </Modal>

      {/* ========== 编辑线索弹窗 ========== */}
      <Modal
        title="编辑线索"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => { setEditModalOpen(false); editForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ style: { backgroundColor: '#a855f7', borderColor: '#a855f7' } }}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="来源渠道" name="source" rules={[{ required: true, message: '请选择来源渠道' }]}>
            <Select>
              {convertSources.map((s) => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="意向等级" name="intentLevel" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="A">A类</Select.Option>
              <Select.Option value="B">B类</Select.Option>
              <Select.Option value="C">C类</Select.Option>
              <Select.Option value="D">D类</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="跟进状态" name="followStatus" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="待跟进">待跟进</Select.Option>
              <Select.Option value="跟进中">跟进中</Select.Option>
              <Select.Option value="已报价">已报价</Select.Option>
              <Select.Option value="已成交">已成交</Select.Option>
              <Select.Option value="已流失">已流失</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="跟进人" name="follower" rules={[{ required: true }]}>
            <Select>
              {followers.map((f) => (
                <Select.Option key={f} value={f}>{f}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
