'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Input, Row, Select, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { InboxOutlined, SearchOutlined, ShopOutlined, WarningOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import type { EcommerceSummary, Product } from '@/types/domain';

const { Text, Title } = Typography;

function priceRange(record: Product) {
  const min = Number(record.minSalePrice || 0);
  const max = Number(record.maxSalePrice || 0);
  if (min === max) return `¥${min.toLocaleString()}`;
  return `¥${min.toLocaleString()} - ¥${max.toLocaleString()}`;
}

export default function EcommercePage() {
  const [data, setData] = useState<EcommerceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    platformAdapter.getEcommerceSummary()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const products = data?.products || [];
  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map(item => item.category).filter(Boolean)))], [products]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products.filter(item => {
      const matchKeyword = !q || [item.name, item.category, item.status, item.sourceId].some(value => value.toLowerCase().includes(q));
      const matchCategory = category === 'all' || item.category === category;
      return matchKeyword && matchCategory;
    });
  }, [products, keyword, category]);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>电商系统</Title>
        <Text type="secondary">统一读取商品、SKU、库存与预警数据，不再依赖独立电商后台页面。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card><Statistic title="商品总数" value={data?.productCount || 0} prefix={<ShopOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="SKU 数" value={data?.skuCount || 0} prefix={<InboxOutlined />} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="库存总量" value={data?.totalStock || 0} valueStyle={{ color: '#22C55E' }} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="低库存 SKU" value={data?.lowStockCount || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#F59E0B' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}><Input prefix={<SearchOutlined />} placeholder="搜索商品、分类、状态" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear /></Col>
          <Col xs={24} md={6}><Select value={category} onChange={setCategory} style={{ width: '100%' }} options={categories.map(item => ({ value: item, label: item === 'all' ? '全部分类' : item }))} /></Col>
          <Col xs={24} md={8}><Text type="secondary">库存成本估值：<Text strong>¥{Number(data?.stockValue || 0).toLocaleString()}</Text></Text></Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          dataSource={filtered}
          size="middle"
          scroll={{ x: 980 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `共 ${total} 个商品` }}
          locale={{ emptyText: <Empty description="暂无商品库存数据" /> }}
          columns={[
            {
              title: '商品',
              dataIndex: 'name',
              fixed: 'left',
              width: 260,
              render: (value, record) => (
                <div>
                  <Text strong>{value}</Text>
                  <div><Text type="secondary">{record.sourceType} / {record.sourceId || '-'}</Text></div>
                </div>
              ),
            },
            { title: '分类', dataIndex: 'category', width: 120, render: value => <Tag color="purple">{value}</Tag> },
            { title: 'SKU', dataIndex: 'skuCount', align: 'right' as const, width: 90 },
            { title: '库存', dataIndex: 'stock', align: 'right' as const, width: 100, render: value => <Text strong style={{ color: '#22C55E' }}>{value}</Text> },
            { title: '售价区间', width: 150, render: (_, record) => priceRange(record) },
            { title: '低库存', dataIndex: 'lowStockSkuCount', align: 'right' as const, width: 100, render: value => value > 0 ? <Tag color="orange">{value}</Tag> : <Tag color="green">正常</Tag> },
            { title: '状态', dataIndex: 'status', width: 120 },
            { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
          ]}
        />
      </Card>
    </div>
  );
}
