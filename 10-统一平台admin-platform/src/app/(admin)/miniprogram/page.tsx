'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Modal, Tabs,
  Form, Input, InputNumber, Switch, Select, message, Descriptions, Badge, Tooltip, Empty
} from 'antd';
import {
  QrcodeOutlined, AppstoreOutlined, EditOutlined,
  EyeOutlined, ReloadOutlined, CloudUploadOutlined, CheckCircleOutlined,
  DesktopOutlined, MobileOutlined, BarChartOutlined,
  ShareAltOutlined, SettingOutlined
} from '@ant-design/icons';
import { onlineCourseApi } from '@/lib/api';

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
  apiBase?: string;
  appId?: string;
}

interface MiniPageConfig {
  key: string;
  name: string;
  route: string;
  module: string;
  customizable?: boolean;
  isCustomizable?: boolean;
  icon?: string;
  status?: string;
  record_count?: number;
  response_ms?: number;
}

const releaseHistory = [
  { version: '数据库联动版', date: '当前', changes: '小程序管理页接入 mini 与网课真实数据源', status: 'current' },
];

const pageIcons: Record<string, string> = {
  home: '⌂',
  courses: '▦',
  detail: '◇',
  player: '▷',
  practice: '✓',
  questions: '?',
  notes: '✎',
  profile: '○',
};

function pickData(payload: any) {
  return payload?.data || payload || {};
}

function formatDate(value?: string) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

export default function MiniprogramPage() {
  const [activeTab, setActiveTab] = useState('apps');
  const [editModal, setEditModal] = useState(false);
  const [previewModal, setPreviewModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [courseMiniConfig, setCourseMiniConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    onlineCourseApi.getMiniProgramConfig()
      .then(payload => setCourseMiniConfig(pickData(payload)))
      .catch(() => setCourseMiniConfig(null))
      .finally(() => setLoading(false));
  }, []);

  const appConfigs = useMemo<AppConfig[]>(() => (courseMiniConfig?.apps || []).map((app: any) => ({
    key: String(app.key || app.id || app.name),
    name: app.name || '未命名小程序',
    description: app.description || '',
    status: (app.status || 'draft') as AppConfig['status'],
    version: app.version || '-',
    lastUpdate: formatDate(app.lastUpdate || app.updated_at || app.created_at),
    qrCode: app.qrCode,
    pageCount: Number(app.pageCount || 0),
    userCount: Number(app.userCount || 0),
    dailyActiveUsers: Number(app.dailyActiveUsers || 0),
    apiBase: app.apiBase,
    appId: app.appId,
  })), [courseMiniConfig]);

  const pageList = useMemo<MiniPageConfig[]>(() => (courseMiniConfig?.pages || []).map((page: any, index: number) => ({
    key: String(page.key || page.route || index),
    name: page.name || page.page || '-',
    route: page.route || '-',
    module: page.module || '-',
    icon: page.icon || pageIcons[page.key] || String(index + 1),
    customizable: Boolean(page.customizable ?? page.isCustomizable),
    status: page.status || '待配置',
    record_count: Number(page.record_count || page.recordCount || 0),
    response_ms: Number(page.response_ms || page.response || 0),
  })), [courseMiniConfig]);

  const courseMiniPages = courseMiniConfig?.courseLink?.pages || pageList;
  const linkedContent = courseMiniConfig?.courseLink?.linkedContent || [];
  const currentReleaseHistory = useMemo(() => {
    const app = appConfigs[0];
    return app ? [{ version: app.version, date: app.lastUpdate, changes: app.description || '小程序配置已连接真实数据源', status: 'current' }] : releaseHistory;
  }, [appConfigs]);

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
            {!loading && !appConfigs.length && (
              <Col span={24}>
                <Card>
                  <Empty description="暂无可用的小程序应用数据" />
                </Card>
              </Col>
            )}
          </Row>
        </Space>
      ),
    },
    {
      key: 'pages',
      label: <span><DesktopOutlined /> 页面管理</span>,
      children: (
        <Table
          scroll={{ x: 'max-content' }}
          dataSource={pageList}
          rowKey="key"
          pagination={false}
          loading={loading}
          locale={{ emptyText: <Empty description="暂无小程序页面数据" /> }}
          columns={[
            { title: '图标', dataIndex: 'icon', width: 50 },
            { title: '页面名称', dataIndex: 'name', width: 150 },
            { title: '路由路径', dataIndex: 'route', ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
            { title: '所属模块', dataIndex: 'module', width: 80, render: (v: string) => <Tag>{v}</Tag> },
            { title: '关联数据', dataIndex: 'record_count', width: 90, align: 'right' as const },
            {
              title: '可定制', dataIndex: 'customizable', width: 80,
              render: (v: boolean) => v ? <Tag color="blue">可配置</Tag> : <Tag color="default">固定</Tag>,
            },
            { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <Tag color={value === '已连接' ? 'green' : 'default'}>{value}</Tag> },
            {
              title: '操作', width: 120,
              render: (_: any, record: any) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} disabled={!record.customizable}>
                    编辑
                  </Button>
                  <Button size="small" icon={<SettingOutlined />} disabled={!record.customizable}>
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
      key: 'course-link',
      label: <span><MobileOutlined /> 网课联动</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <Card
              title={<Space><MobileOutlined />学习小程序</Space>}
              extra={<Button type="primary" icon={<SettingOutlined />} onClick={() => setActiveTab('apps')}>应用管理</Button>}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="应用">{courseMiniConfig?.courseLink?.appName || appConfigs[0]?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前版本"><Badge status="processing" text={courseMiniConfig?.courseLink?.version || appConfigs[0]?.version || '-'} /></Descriptions.Item>
                <Descriptions.Item label="联动内容">{linkedContent.length ? linkedContent.join('、') : '-'}</Descriptions.Item>
                <Descriptions.Item label="接口域名">{courseMiniConfig?.courseLink?.apiBase || appConfigs[0]?.apiBase || '-'}</Descriptions.Item>
                <Descriptions.Item label="VOD合法域名">{courseMiniConfig?.courseLink?.vodPlaybackDomain || '未配置'}</Descriptions.Item>
              </Descriptions>
              <Space wrap style={{ marginTop: 16 }}>
                <Button icon={<QrcodeOutlined />}>体验版二维码</Button>
                <Button icon={<CloudUploadOutlined />}>提交体验版</Button>
                <Button icon={<DesktopOutlined />} onClick={() => setActiveTab('pages')}>页面配置</Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card title="网课页面映射" styles={{ body: { padding: 0 } }}>
              <Table
                scroll={{ x: 'max-content' }}
                rowKey="key"
                dataSource={courseMiniPages}
                pagination={false}
                size="middle"
                loading={loading}
                locale={{ emptyText: <Empty description="暂无网课页面映射" /> }}
                columns={[
                  { title: '页面', dataIndex: 'name', width: 120 },
                  { title: '路由', dataIndex: 'route', render: value => <code>{value}</code> },
                  { title: '模块', dataIndex: 'module', width: 100, render: value => <Tag>{value}</Tag> },
                  { title: '关联数据', dataIndex: 'record_count', width: 90, align: 'right' as const },
                  { title: '状态', dataIndex: 'status', width: 100, render: value => <Tag color={value === '已连接' || value === '已发布' ? 'green' : 'default'}>{value}</Tag> },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'release',
      label: <span><CloudUploadOutlined /> 发布管理</span>,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="版本历史" extra={<Button type="primary" icon={<CloudUploadOutlined />}>提交新版本</Button>}>
            <Table
              scroll={{ x: 'max-content' }}
              dataSource={currentReleaseHistory}
              rowKey="version"
              pagination={false}
              columns={[
                {
                  title: '版本号',
                  dataIndex: 'version',
                  width: 100,
                  render: (v: string) => <Badge status={v === currentReleaseHistory[0]?.version ? 'processing' : 'default'} text={<strong>{v}</strong>} />,
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
              <Descriptions.Item label="审核状态"><Tag color={appConfigs[0]?.status === 'published' ? 'green' : 'default'}>{appConfigs[0]?.status === 'published' ? '已发布' : '待发布'}</Tag></Descriptions.Item>
              <Descriptions.Item label="审核时间">{appConfigs[0]?.lastUpdate || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前线上版本">{appConfigs[0]?.version || '-'}</Descriptions.Item>
              <Descriptions.Item label="上次提交">{appConfigs[0]?.lastUpdate || '-'}</Descriptions.Item>
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
              {pageList.filter(p => p.customizable).slice(0, 5).map((p, index) => (
                <Card key={p.key} size="small">
                  <Space>
                    <span>{p.icon} {p.name}</span>
                    <Switch defaultChecked size="small" />
                    <InputNumber size="small" defaultValue={index + 1} min={1} max={Math.max(pageList.length, 1)} style={{ width: 60 }} placeholder="排序" />
                  </Space>
                </Card>
              ))}
              {!pageList.some(p => p.customizable) && <Empty description="暂无可配置页面" />}
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
            <Descriptions.Item label="AppID">{selectedApp?.appId || '未配置'}</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedApp?.version}</Descriptions.Item>
            <Descriptions.Item label="页面数">{selectedApp?.pageCount}</Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    </div>
  );
}
