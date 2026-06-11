'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { App, Card, Descriptions, Space, Table, Tag } from 'antd';
import { eventApi } from '@/lib/api';

export default function EventPlayerDetailPage() {
  const params = useParams<{ id: string }>();
  const { message } = App.useApp();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    eventApi.getPlayer(params.id)
      .then(setPlayer)
      .catch((err) => message.error(err?.response?.data?.error || err?.message || '加载选手详情失败'))
      .finally(() => setLoading(false));
  }, [message, params.id]);

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Link href="/events">赛事管理</Link>
        <span>/</span>
        {player?.competitionId && <Link href={`/events/${player.competitionId}`}>{player.competitionName}</Link>}
        <span>/</span>
        <strong>{player?.name || '选手详情'}</strong>
      </Space>

      <Card title="选手详情" loading={loading} style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} bordered size="small">
          <Descriptions.Item label="姓名">{player?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="编号">{player?.playerNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="手机号">{player?.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="赛事">{player?.competitionName || '-'}</Descriptions.Item>
          <Descriptions.Item label="组别">{player?.groupName || '-'}</Descriptions.Item>
          <Descriptions.Item label="机构">{player?.organization || '-'}</Descriptions.Item>
          <Descriptions.Item label="课程顾问">{player?.teacher || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核"><Tag>{player?.auditStatus || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="缴费"><Tag>{player?.paidStatus || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="评分状态"><Tag>{player?.scoreStatus || '-'}</Tag></Descriptions.Item>
          <Descriptions.Item label="备注">{player?.remark || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="评分记录" size="small">
        <Table
          scroll={{ x: 'max-content' }}
          rowKey="id"
          dataSource={player?.scores || []}
          columns={[
            { title: '评委', dataIndex: 'judge_name' },
            { title: '组别', dataIndex: 'group_name' },
            { title: '原始分', dataIndex: 'raw_score' },
            { title: '计算分', dataIndex: 'calculated_score' },
            { title: '发布分', dataIndex: 'published_score', render: (v) => v ?? '-' },
            { title: '状态', dataIndex: 'score_status', render: (v) => <Tag>{v}</Tag> },
            { title: '异常', dataIndex: 'is_abnormal', render: (v) => v ? <Tag color="red">异常</Tag> : <Tag>正常</Tag> },
          ]}
        />
      </Card>
    </div>
  );
}
