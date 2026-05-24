'use client';
import { useState } from 'react';
import { Table, Card, Tag, Space, Button, Input, Row, Col, Statistic, Modal, Form, DatePicker, Select, message } from 'antd';
import { PlusOutlined, SearchOutlined, TrophyOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';

interface CertRecord {
  id: number;
  certificateNo: string;
  memberName: string;
  courseName: string;
  issueDate: string;
  status: string;
}

// Mock data
const mockCerts: CertRecord[] = Array.from({ length: 3 }, (_, i) => ({
  id: i + 1,
  certificateNo: `EW-2026-${String(i + 1).padStart(4, '0')}`,
  memberName: '李小雅',
  courseName: ['师资班·初级', '东方舞系统课·中级', '舞码编排训练营'][i],
  issueDate: `2026-0${3 + i}-15`,
  status: 'active',
}));

export default function CertificatesPage() {
  const [data] = useState<CertRecord[]>(mockCerts);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = data.filter(c => !searchText || c.memberName.includes(searchText) || c.certificateNo.includes(searchText) || c.courseName.includes(searchText));

  const total = 3;
  const active = data.filter(c => c.status === 'active').length;

  const columns = [
    { title: '证书编号', dataIndex: 'certificateNo', key: 'certificateNo', width: 150,
      render: (v: string) => <><TrophyOutlined style={{ color: '#f59e0b', marginRight: 6 }} /><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span></> },
    { title: '学员', dataIndex: 'memberName', key: 'memberName', width: 120 },
    { title: '课程', dataIndex: 'courseName', key: 'courseName', width: 200 },
    { title: '颁发日期', dataIndex: 'issueDate', key: 'issueDate', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (v: string) => <Tag color={v === 'active' ? 'gold' : 'default'}>{v === 'active' ? '有效' : '已撤销'}</Tag> },
    { title: '操作', key: 'action', width: 120,
      render: () => <Space>
        <Button type="link" size="small">查看</Button>
        <Button type="link" size="small" danger>撤销</Button>
      </Space> },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>证书管理</h2>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="证书总数" value={total} prefix={<TrophyOutlined />} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="有效" value={active} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#10b981' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已撤销" value={total - active} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#ef4444' }} /></Card></Col>
      </Row>

      <Card size="small" extra={<Space>
        <Input placeholder="搜索证书编号/学员/课程..." prefix={<SearchOutlined />} style={{ width: 250 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} allowClear />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>颁发证书</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" pagination={false} rowKey="id" />
      </Card>

      <Modal title="颁发证书" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={500}>
        <Form layout="vertical">
          <Form.Item label="学员" required><Select placeholder="搜索并选择学员" showSearch options={
            Array.from({ length: 10 }, (_, i) => ({ label: `学员${i + 1}`, value: i + 1 }))
          } /></Form.Item>
          <Form.Item label="课程" required>
            <Select placeholder="选择课程" options={[
              { label: '师资班·初级', value: 1 },
              { label: '师资班·中级', value: 2 },
              { label: '东方舞系统课·中级', value: 3 },
              { label: '舞码编排训练营', value: 4 },
            ]} />
          </Form.Item>
          <Form.Item label="颁发日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Button type="primary" htmlType="submit" block>颁发证书</Button>
        </Form>
      </Modal>
    </div>
  );
}
