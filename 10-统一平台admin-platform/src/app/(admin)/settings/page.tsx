'use client';
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Divider, Form, Input, Space, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { ApiOutlined, CloudServerOutlined, DatabaseOutlined, LinkOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { sortableColumns } from '@/lib/table-sort';

const { Text, Title } = Typography;

export default function SettingsPage() {
  const [tab, setTab] = useState('basic');
  const settings = useMemo(() => platformAdapter.getPlatformSettings(), []);

  return (
    <div>
      <div className="page-header">
        <Title level={2}>系统设置</Title>
        <Text type="secondary">统一平台自身配置，不再硬编码散落在页面里。</Text>
      </div>

      <Card
        title={<Space><SettingOutlined />平台配置</Space>}
        extra={<Tag color="magenta">admin-platform</Tag>}
      >
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'basic', label: '基本设置' },
            { key: 'links', label: '四端链接' },
            { key: 'api', label: 'API 配置' },
            { key: 'data', label: '数据源' },
          ]}
        />

        {tab === 'basic' && (
          <Form layout="vertical" style={{ maxWidth: 680 }}>
            <Form.Item label="平台名称"><Input defaultValue={settings.appName} /></Form.Item>
            <Form.Item label="平台简称"><Input defaultValue={settings.shortName} /></Form.Item>
            <Form.Item label="后台域名"><Input defaultValue={settings.adminDomain} /></Form.Item>
            <Form.Item label="官网域名"><Input defaultValue={settings.websiteDomain} /></Form.Item>
            <Form.Item label="学习中心域名"><Input defaultValue={settings.learnDomain} /></Form.Item>
            <Form.Item label="小程序 API 域名"><Input defaultValue={settings.miniapiDomain} /></Form.Item>
            <Divider />
            <Form.Item label="记录操作日志"><Switch defaultChecked /></Form.Item>
            <Form.Item label="启用统一权限"><Switch defaultChecked /></Form.Item>
            <Form.Item label="旧系统只读适配"><Switch defaultChecked /></Form.Item>
            <Button type="primary" icon={<SaveOutlined />}>保存设置</Button>
          </Form>
        )}

        {tab === 'links' && (
          <div>
            <Alert message="官网、统一后台、学员中心、网课小程序的跨端入口统一从 src/lib/platform-links.ts 读取。" type="success" showIcon style={{ marginBottom: 16 }} />
            <Table
              scroll={{ x: 'max-content' }}
              rowKey="key"
              size="middle"
              dataSource={settings.linkMatrix}
              pagination={false}
              columns={sortableColumns<any>([
                { title: '链路', dataIndex: 'label', render: value => <Space><LinkOutlined />{value}</Space> },
                { title: '目标地址', dataIndex: 'url', render: value => <Text copyable>{value}</Text> },
                { title: '目标端', dataIndex: 'target', render: value => <Tag color={value === 'admin' ? 'purple' : value === 'learn' ? 'magenta' : value === 'miniapp' ? 'blue' : 'green'}>{value}</Tag> },
                { title: '用途', dataIndex: 'description' },
              ])}
            />
          </div>
        )}

        {tab === 'api' && (
          <div>
            <Alert message="API Client 已统一进入 src/lib/api.ts，页面不再直接拼接 API_BASE。" type="success" showIcon style={{ marginBottom: 16 }} />
            <Descriptions column={1} bordered size="small" style={{ maxWidth: 760 }}>
              <Descriptions.Item label={<Space><ApiOutlined />当前 API</Space>}><Text copyable>{settings.apiBase}</Text></Descriptions.Item>
              <Descriptions.Item label="生产 API"><Text copyable>{settings.productionApiBase}</Text></Descriptions.Item>
              <Descriptions.Item label="认证中心"><Text copyable>{settings.authDomain}</Text></Descriptions.Item>
              <Descriptions.Item label="小程序 API"><Text copyable>{settings.miniapiDomain}</Text></Descriptions.Item>
              <Descriptions.Item label="认证方式">{settings.authMode}</Descriptions.Item>
              <Descriptions.Item label="核心端点">
                {settings.endpoints.map(endpoint => <Tag key={endpoint} style={{ marginBottom: 4 }}>{endpoint}</Tag>)}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}

        {tab === 'data' && (
          <div>
            <Alert message="旧系统不再作为页面拼装来源，只作为数据源和适配对象。" type="info" showIcon style={{ marginBottom: 16 }} />
            <Table
              scroll={{ x: 'max-content' }}
              rowKey="name"
              size="middle"
              dataSource={settings.dataSources}
              pagination={false}
              columns={sortableColumns<any>([
                { title: '数据源', dataIndex: 'name', render: value => <Space><DatabaseOutlined />{value}</Space> },
                { title: '路径', dataIndex: 'path', render: value => <Text copyable>{value}</Text> },
                { title: '模式', dataIndex: 'mode', render: value => <Tag color="purple">{value}</Tag> },
                { title: '状态', dataIndex: 'status', render: value => <Tag color="green">{value}</Tag> },
              ])}
            />
            <Card size="small" style={{ marginTop: 16 }} title={<Space><CloudServerOutlined />部署原则</Space>}>
              <Text>统一平台部署读取 `10-统一平台admin-platform`，旧系统数据库必须先备份再迁移，禁止直接覆盖云端数据库。</Text>
            </Card>
          </div>
        )}
      </Card>
    </div>
  );
}
