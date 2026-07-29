'use client';
import { useState } from 'react';
import { Card, Tag, Space, Button, Input, Row, Col, Statistic, Modal, Form, Select, Tooltip } from 'antd';
import { Table } from '@/components/adaptive-table';
import { PlusOutlined, SearchOutlined, FileTextOutlined, LinkOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { sortableColumns } from '@/lib/table-sort';

const contentItems = Array.from({ length: 12 }, (_, i) => ({
  key: String(300 + i),
  title: ['SWOD教学系统介绍', '2026年春季招生简章', '伊娃老师专访：18年舞蹈之路',
    '埃及东方舞科普：起源与流派', '学员故事：从零基础到舞者',
    '最新课程安排（5-6月）', '舞码鉴赏：《沙漠玫瑰》', '成长体系介绍：七步成长路径',
    '诚信承诺书', '为什么选择伊娃东方舞？', '教学成果展示', '常见问题FAQ'][i],
  type: ['文章', '文章', '专访', '科普', '学员故事', '课程公告', '舞码介绍', '体系介绍', '承诺书', '品牌故事', '成果展示', 'FAQ'][i],
  status: ['published', 'published', 'published', 'published', 'published', 'published', 'draft', 'published', 'published', 'published', 'published', 'published'][i],
  views: [1280, 3560, 2180, 980, 1560, 890, 0, 2340, 1890, 3210, 2780, 4560][i],
  updatedAt: `2026-05-${String(5 + (i % 20)).padStart(2, '0')}`,
  targetPage: ['/swod', '/recruitment', '/interview', '/culture', '/story/1',
    '/schedule', '', '/path', '/commitment', '/why-us', '/achievements', '/faq'][i],
}));

export default function ContentPage() {
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = contentItems.filter(c => !searchText || c.title.includes(searchText));

  const columns = sortableColumns<any>([
    { title: '内容标题', dataIndex: 'title', key: 'title', width: 280, render: (v: string) => <a><FileTextOutlined style={{ marginRight: 6 }} />{v}</a> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (v: string) => <Tag color={['文章', '专访', '科普', '学员故事', '课程公告'].includes(v) ? 'blue' : 'purple'}>{v}</Tag> },
    { title: '浏览量', dataIndex: 'views', key: 'views', width: 80, align: 'right' as const },
    { title: '关联页面', dataIndex: 'targetPage', key: 'targetPage', width: 150, render: (v: string) => v ? <Tag icon={<LinkOutlined />}>{v}</Tag> : '-' },
    { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'published' ? 'green' : 'orange'}>{v === 'published' ? '已发布' : '草稿'}</Tag> },
    { title: '操作', key: 'action', width: 140, render: () => <Space>
      <Button type="link" size="small" icon={<EyeOutlined />}>预览</Button>
      <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
      <Tooltip title="删除">
        <Button type="link" size="small" danger icon={<DeleteOutlined />} aria-label="删除" />
      </Tooltip>
    </Space> },
  ]);

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>内容管理</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="内容总数" value={contentItems.length} prefix={<FileTextOutlined />} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已发布" value={contentItems.filter(c => c.status === 'published').length} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="草稿" value={contentItems.filter(c => c.status === 'draft').length} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="总浏览量" value={contentItems.reduce((s, c) => s + c.views, 0).toLocaleString()} valueStyle={{ color: '#a855f7' }} /></Card></Col>
      </Row>

      <Card size="small" extra={<Space>
        <Input placeholder="搜索内容..." prefix={<SearchOutlined />} style={{ width: 200 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建内容</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      </Card>

      <Modal title="新建内容" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={600}>
        <Form layout="vertical">
          <Form.Item label="内容标题" required>
            <Input placeholder="请输入内容标题" />
          </Form.Item>
          <Form.Item label="内容类型" required>
            <Select
              placeholder="请选择内容类型"
              options={['文章', '课程公告', '学员故事', '品牌故事', 'FAQ'].map(value => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item label="关联页面">
            <Input placeholder="/recruitment 或 /story/1" />
          </Form.Item>
          <Form.Item label="内容摘要">
            <Input.TextArea rows={4} placeholder="这里是统一平台原生内容编辑入口，后续接入官网 CMS 数据适配层。" />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={() => setModalVisible(false)}>保存草稿</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
