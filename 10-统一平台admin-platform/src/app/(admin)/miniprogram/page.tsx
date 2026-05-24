'use client';
import React, { useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Modal, Tabs,
  Form, Input, InputNumber, Switch, Select, message, Descriptions, Badge, Tooltip
} from 'antd';
import {
  QrcodeOutlined, AppstoreOutlined, PictureOutlined, EditOutlined,
  EyeOutlined, ReloadOutlined, CloudUploadOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, DesktopOutlined, MobileOutlined, BarChartOutlined,
  ShareAltOutlined, SettingOutlined, InfoCircleOutlined
} from '@ant-design/icons';

// ========== 模拟数据 ==========
interface AppConfig {
  key: string;
  name: string;
  description: string;
  status: 'published' | 'draft' | 'reviewing';
  version: string;
  lastUpdate: string;
  qrCode?: string;
  pageCount: number;
  userCount: number;
  dailyActiveUsers: number;
}

const appConfigs: AppConfig[] = [
  {
    key: '1',
    name: '伊娃东方舞学习中心',
    description: '学员小程序，支持在线观看课程、查看学习进度、参与社群讨论',
    status: 'published',
    version: '1.0.2',
    lastUpdate: '2026-05-22',
    pageCount: 12,
    userCount: 1256,
    dailyActiveUsers: 89,
  },
  {
    key: '2',
    name: '伊娃商城',
    description: '电商小程序，支持购买课程、舞蹈用品、美妆产品',
    status: 'draft',
    version: '0.8.0',
    lastUpdate: '2026-05-20',
    pageCount: 8,
    userCount: 0,
    dailyActiveUsers: 0,
  },
];

const pageList = [
  { id: 1, name: '首页', route: '/pages/index/index', module: '核心', isCustomizable: true, icon: '🏠' },
  { id: 2, name: '我的课程', route: '/pages/mycourses/mycourses', module: '学习', isCustomizable: true, icon: '📚' },
  { id: 3, name: '课程详情', route: '/pages/course-detail/course-detail', module: '学习', isCustomizable: false, icon: '📖' },
  { id: 4, name: '视频播放', route: '/pages/player/player', module: '学习', isCustomizable: false, icon: '▶️' },
  { id: 5, name: '直播列表', route: '/pages/live/list', module: '直播', isCustomizable: true, icon: '🔴' },
  { id: 6, name: '直播房间', route: '/pages/live/room', module: '直播', isCustomizable: false, icon: '🎥' },
  { id: 7, name: '个人中心', route: '/pages/mine/mine', module: '用户', isCustomizable: true, icon: '👤' },
  { id: 8, name: '学习日历', route: '/pages/calendar/calendar', module: '学习', isCustomizable: true, icon: '📅' },
  { id: 9, name: '成就中心', route: '/pages/achievements/achievements', module: '用户', isCustomizable: true, icon: '🏆' },
  { id: 10, name: '消息通知', route: '/pages/notifications/notifications', module: '用户', isCustomizable: false, icon: '🔔' },
  { id: 11, name: '搜索', route: '/pages/search/search', module: '核心', isCustomizable: false, icon: '🔍' },
  { id: 12, name: '分销中心', route: '/pages/distribution/distribution', module: '营销', isCustomizable: true, icon: '💰' },
];

const releaseHistory = [
  { version: '1.0.2', date: '2026-05-22', changes: '修复播放器全屏Bug；优化课程列表加载速度；新增学习日历页面', status: 'current' },
  { version: '1.0.1', date: '2026-05-15', changes: '新增成就中心；优化微信支付流程；修复我的课程刷新问题', status: 'published' },
  { version: '1.0.0', date: '2026-05-07', changes: '首次发布：课程浏览、视频播放、个人中心、消息通知', status: 'published' },
];

export default function MiniprogramPage() {
  const [activeTab, setActiveTab] = useState('apps');
  const [editModal, setEditModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      published: { color: 'green', label: '已发布', icon: <CheckCircleOutlined /> },
      draft: { color: 'default', label: '草稿', icon: <EditOutlined /> },
      reviewing: { color: 'processing', label: '审核中', icon: <ReloadOutlined spin /> },
    };
    const s = map[status] || map.draft;
    return <Tag color={s.color} icon={s.icon}>{s.label}</Tag>;
  };

  const tabItems = [
    {
      key: 'apps',
      label: <span><AppstoreOutlined /> 小程序应用</span>,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="小程序应用数" value={appConfigs.length} prefix={<AppstoreOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="累计用户" value={appConfigs.reduce((s, a) => s + a.userCount, 0)} prefix={<MobileOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="日活用户" value={appConfigs.reduce((s, a) => s + a.dailyActiveUsers, 0)} prefix={<BarChartOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card hoverable>
                <Statistic title="页面总数" value={pageList.length} prefix={<DesktopOutlined />} />
              </Card>
            </Col>
          </Row>

          {/* 应用卡片 */}
          <Row gutter={[16, 16]}>
            {appConfigs.map(app => (
              <Col xs={24} md={12} key={app.key}>
                <Card
                  title={
                    <Space>
                      {app.name}
                      {statusTag(app.status)}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button size="small" icon={<EyeOutlined />}
                        onClick={() => { setSelectedApp(app); setPreviewModal(true); }}>
                        预览
                      </Button>
                      <Button size="small" type="primary" icon={<EditOutlined />}
                        onClick={() => { setSelectedApp(app); setEditModal(true); }}>
                        管理
                      </Button>
                    </Space>
                  }
                  style={{ borderLeft: app.status === 'published' ? '3px solid #52c41a' : '3px solid #d9d9d9' }}
                >
                  <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="版本">{app.version}</Descriptions.Item>
                    <Descriptions.Item label="最近更新">{app.lastUpdate}</Descriptions.Item>
                    <Descriptions.Item label="页面数">{app.pageCount}</Descriptions.Item>
                    <Descriptions.Item label="累计用户">{app.userCount.toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="日活">{app.dailyActiveUsers}</Descriptions.Item>
                    <Descriptions.Item label="描述"><Tooltip title={app.description}>{app.description.slice(0, 20)}…</Tooltip></Descriptions.Item>
                  </Descriptions>

                  <Space>
                    <Button size="small" icon={<QrcodeOutlined />}>
                      {app.status === 'published' ? '查看二维码' : '体验版二维码'}
                    </Button>
                    <Button size="small" icon={<CloudUploadOutlined />}>
                      提交代码
                    </Button>
                    <Button size="small" icon={<ShareAltOutlined />}>
                      分享链接
                    </Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      ),
    },
    {
      key: 'pages',
      label: <span><DesktopOutlined /> 页面管理</span>,
      children: (
        <Table
          dataSource={pageList}
          rowKey="id"
          pagination={false}
          columns={[
            { title: '图标', dataIndex: 'icon', width: 50 },
            { title: '页面名称', dataIndex: 'name', width: 150 },
            { title: '路由路径', dataIndex: 'route', ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
            { title: '所属模块', dataIndex: 'module', width: 80, render: (v: string) => <Tag>{v}</Tag> },
            {
              title: '可定制', dataIndex: 'isCustomizable', width: 80,
              render: (v: boolean) => v ? <Tag color="blue">可配置</Tag> : <Tag color="default">固定</Tag>,
            },
            {
              title: '操作', width: 120,
              render: (_: any, record: any) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} disabled={!record.isCustomizable}>
                    编辑
                  </Button>
                  <Button size="small" icon={<SettingOutlined />} disabled={!record.isCustomizable}>
                    配置
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      ),
    },
    {
      key: 'release',
      label: <span><CloudUploadOutlined /> 发布管理</span>,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="版本历史" extra={<Button type="primary" icon={<CloudUploadOutlined />}>提交新版本</Button>}>
            <Table
              dataSource={releaseHistory}
              rowKey="version"
              pagination={false}
              columns={[
                {
                  title: '版本号',
                  dataIndex: 'version',
                  width: 100,
                  render: (v: string) => <Badge status={v === releaseHistory[0].version ? 'processing' : 'default'} text={<strong>{v}</strong>} />,
                },
                { title: '发布日期', dataIndex: 'date', width: 120 },
                { title: '更新内容', dataIndex: 'changes', ellipsis: true },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (v: string) => (
                    <Tag color={v === 'current' ? 'green' : 'default'}>{v === 'current' ? '当前版本' : '历史版本'}</Tag>
                  ),
                },
                {
                  title: '操作',
                  width: 120,
                  render: (_: any, record: any) => (
                    <Space>
                      <Button size="small">回滚</Button>
                      <Button size="small">详情</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <Card title="微信审核状态">
            <Descriptions column={2}>
              <Descriptions.Item label="审核状态"><Tag color="green">审核通过</Tag></Descriptions.Item>
              <Descriptions.Item label="审核时间">2026-05-22 14:30</Descriptions.Item>
              <Descriptions.Item label="当前线上版本">v1.0.2</Descriptions.Item>
              <Descriptions.Item label="上次提交">2026-05-22 10:15</Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#1f2937', fontSize: 22, fontWeight: 600 }}>
          <AppstoreOutlined style={{ marginRight: 12, color: '#7c3aed' }} />
          小程序管理
        </h2>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          管理微信小程序应用、页面配置、版本发布和审核
        </p>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      {/* ===== 编辑弹窗 ===== */}
      <Modal
        title={`管理应用 - ${selectedApp?.name || ''}`}
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => { message.success('保存成功'); setEditModal(false); }}
        width={640}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="应用名称"><Input defaultValue={selectedApp?.name} /></Form.Item>
          <Form.Item label="应用描述"><Input.TextArea defaultValue={selectedApp?.description} rows={3} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="当前版本"><Input defaultValue={selectedApp?.version} disabled /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态">
                <Select defaultValue={selectedApp?.status}>
                  <Select.Option value="published">已发布</Select.Option>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="reviewing">审核中</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="首页配置">
            <Space direction="vertical" style={{ width: '100%' }}>
              {pageList.filter(p => p.isCustomizable).slice(0, 5).map(p => (
                <Card key={p.id} size="small">
                  <Space>
                    <span>{p.icon} {p.name}</span>
                    <Switch defaultChecked size="small" />
                    <InputNumber size="small" defaultValue={p.id} min={1} max={12} style={{ width: 60 }} placeholder="排序" />
                  </Space>
                </Card>
              ))}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 预览弹窗 ===== */}
      <Modal
        title={`小程序预览 - ${selectedApp?.name || ''}`}
        open={previewModal}
        onCancel={() => setPreviewModal(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModal(false)}>关闭</Button>,
          <Button key="refresh" type="primary" icon={<ReloadOutlined />}>刷新预览</Button>,
        ]}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{
            width: 200, height: 200, margin: '0 auto 24px',
            background: '#f5f5f5', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px dashed #d9d9d9'
          }}>
            <QrcodeOutlined style={{ fontSize: 80, color: '#bfbfbf' }} />
          </div>
          <p style={{ color: '#8c8c8c', fontSize: 13 }}>
            使用微信扫描二维码预览小程序<br />
            {selectedApp?.status === 'draft' ? '（体验版，需添加体验成员）' : '（正式版，所有用户可访问）'}
          </p>
          <Descriptions size="small" column={1} style={{ marginTop: 16 }}>
            <Descriptions.Item label="AppID">wxd4cc8f4764e256d9</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedApp?.version}</Descriptions.Item>
            <Descriptions.Item label="页面数">{selectedApp?.pageCount}</Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    </div>
  );
}
