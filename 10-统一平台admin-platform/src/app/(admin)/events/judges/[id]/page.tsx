'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { App, Card, Descriptions, Space, Table, Tag } from 'antd';
import { eventApi } from '@/lib/api';

export default function EventJudgeDetailPage() {
  const params = useParams<{ id: string }>();
  const { message } = App.useApp();
  const [judge, setJudge] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    eventApi.getJudge(params.id)
      .then(setJudge)
      .catch((err) => message.error(err?.response?.data?.error || err?.message || '加载评委详情失败'))
      .finally(() => setLoading(false));
  }, [message, params.id]);

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Link href="/events">赛事管理</Link>
        <span>/</span>
        <strong>{judge?.name || '评委详情'}</strong>
      </Space>

      <Card title="评委详情" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
          <Descriptions.Item label="姓名">{judge?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="手机号">{judge?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="头衔">{judge?.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="机构">{judge?.organization || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag>{judge?.status || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="评分授权">{judge?.authEnabled ? <Tag color="green">已授权</Tag> : <Tag>未授权</Tag>}</Descriptions.Item>
          <Descriptions.Item label="分配组别">{judge?.assignedGroupCount || 0}</Descriptions.Item>
          <Descriptions.Item label="评分记录">{judge?.scoreCount || 0}</Descriptions.Item>
          <Descriptions.Item label="简介">{judge?.bio || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="分配记录" size="small">
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          dataSource={judge?.assignments || []}
          columns={[
            { title: '赛事', dataIndex: 'competition_name' },
            { title: '组别', dataIndex: 'group_name' },
            { title: '角色', dataIndex: 'role' },
            { title: '权重', dataIndex: 'weight' },
            { title: '授权', dataIndex: 'auth_enabled', render: (v) => v ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag> },
            { title: '状态', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
