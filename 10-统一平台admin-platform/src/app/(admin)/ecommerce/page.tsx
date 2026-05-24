'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Input, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { InboxOutlined, ReloadOutlined, SearchOutlined, ShopOutlined, ShoppingOutlined, WarningOutlined } from '@ant-design/icons';
import { platformAdapter } from '@/lib/adapters/platform';
import { ecommerceApi } from '@/lib/api';
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
  const [sales, setSales] = useState<any[]>([]);
  const [stockLogs, setStockLogs] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      platformAdapter.getEcommerceSummary(),
      ecommerceApi.getSales().catch(() => []),
      ecommerceApi.getStockLogs().catch(() => []),
    ])
      .then(([summary, saleRows, logRows]) => {
        setData(summary);
        setSales(saleRows);
        setStockLogs(logRows);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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
  const totalSales = sales.reduce((sum, item) => sum + Number(item.total_price || item.totalPrice || 0), 0);
  const stockInCount = stockLogs.filter(item => item.type === 'in').reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const stockOutCount = stockLogs.filter(item => item.type === 'out').reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <div className="page-header">
        <Title level={2}>电商系统</Title>
        <Text type="secondary">统一读取商品、SKU、库存、销售与库存变动数据，功能对齐独立电商后台。</Text>
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
          <Col xs={24} md={8} style={{ textAlign: 'right' }}><Space><Text type="secondary">库存成本估值：<Text strong>¥{Number(data?.stockValue || 0).toLocaleString()}</Text></Text><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></Space></Col>
        </Row>
      </Card>

      <Tabs
        items={[
          {
            key: 'products',
            label: `商品库存 ${filtered.length}`,
            children: (
              <Card bodyStyle={{ padding: 0 }}>
                <Table<Product>
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
            ),
          },
          {
            key: 'sales',
            label: `销售记录 ${sales.length}`,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}><Card><Statistic title="销售单数" value={sales.length} prefix={<ShoppingOutlined />} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="销售总额" value={totalSales} prefix="¥" valueStyle={{ color: '#F72A8A' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="库存出库" value={stockOutCount} suffix="件" valueStyle={{ color: '#7C3AED' }} /></Card></Col>
                </Row>
                <Card bodyStyle={{ padding: 0 }}>
                  <Table<any>
                    rowKey={(record) => String(record.id)}
                    size="middle"
                    dataSource={sales}
                    scroll={{ x: 960 }}
                    pagination={{ pageSize: 15 }}
                    locale={{ emptyText: <Empty description="暂无销售记录" /> }}
                    columns={[
                      { title: '销售ID', dataIndex: 'id', width: 90 },
                      { title: '商品ID', dataIndex: 'product_id', width: 100 },
                      { title: '客户', dataIndex: 'customer_name', width: 120, render: value => value || '-' },
                      { title: '手机号', dataIndex: 'customer_phone', width: 130, render: value => value || '-' },
                      { title: '数量', dataIndex: 'quantity', align: 'right' as const, width: 90 },
                      { title: '单价', dataIndex: 'unit_price', align: 'right' as const, width: 110, render: value => `¥${Number(value || 0).toLocaleString()}` },
                      { title: '总价', dataIndex: 'total_price', align: 'right' as const, width: 120, render: value => <Text strong style={{ color: '#F72A8A' }}>¥{Number(value || 0).toLocaleString()}</Text> },
                      { title: '经手人', dataIndex: 'operator', width: 100 },
                      { title: '时间', dataIndex: 'created_at', width: 170 },
                    ]}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'stock',
            label: `库存流水 ${stockLogs.length}`,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}><Card><Statistic title="入库数量" value={stockInCount} suffix="件" valueStyle={{ color: '#22C55E' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="出库数量" value={stockOutCount} suffix="件" valueStyle={{ color: '#F59E0B' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="流水条数" value={stockLogs.length} /></Card></Col>
                </Row>
                <Card bodyStyle={{ padding: 0 }}>
                  <Table<any>
                    rowKey={(record) => String(record.id)}
                    size="middle"
                    dataSource={stockLogs}
                    scroll={{ x: 880 }}
                    pagination={{ pageSize: 15 }}
                    locale={{ emptyText: <Empty description="暂无库存流水" /> }}
                    columns={[
                      { title: '流水ID', dataIndex: 'id', width: 90 },
                      { title: '商品ID', dataIndex: 'product_id', width: 100 },
                      { title: '类型', dataIndex: 'type', width: 100, render: value => value === 'in' ? <Tag color="green">入库</Tag> : <Tag color="orange">出库</Tag> },
                      { title: '数量', dataIndex: 'quantity', align: 'right' as const, width: 90 },
                      { title: '成本', dataIndex: 'cost_price', align: 'right' as const, width: 110, render: value => value ? `¥${Number(value).toLocaleString()}` : '-' },
                      { title: '经手人', dataIndex: 'operator', width: 100 },
                      { title: '备注', dataIndex: 'remark', ellipsis: true },
                      { title: '时间', dataIndex: 'created_at', width: 170 },
                    ]}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
