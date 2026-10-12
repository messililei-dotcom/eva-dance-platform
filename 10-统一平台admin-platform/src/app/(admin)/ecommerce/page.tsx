'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import { Table } from '@/components/adaptive-table';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import ShopOnlineOrders from '@/components/shop-online-orders';
import { ecommerceApi } from '@/lib/api';
import { formatCompactMoney, formatPaymentAmount } from '@/lib/money-format';
import { compareTableValues, sortableColumns } from '@/lib/table-sort';

const { Text, Title } = Typography;

type ProductRow = {
  id: string;
  name: string;
  category: string;
  spec: string;
  color: string;
  size: string;
  image: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  warningStock: number;
  status: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  raw: Record<string, any>;
};

type ProductGroup = {
  key: string;
  name: string;
  category: string;
  spec: string;
  image: string;
  variants: ProductRow[];
  colors: string[];
  sizes: string[];
  stock: number;
  lowStockCount: number;
  minPrice: number;
  maxPrice: number;
};

type ModalMode = 'product' | 'editProduct' | 'stockIn' | 'groupStockIn' | 'sale' | 'groupSale' | 'log' | 'saleRecord';

const money = (value: unknown) => formatPaymentAmount(value);
const today = () => new Date().toISOString().slice(0, 10);
const textValue = (value: unknown, fallback = '-') => (value === undefined || value === null || value === '' ? fallback : String(value));
const errorText = (error: any) => error?.response?.data?.error || error?.response?.data?.message || error?.message || '操作失败';
const numberValue = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const WORKBENCH_CARD_WIDTH = 350;
const WORKBENCH_CARD_HEIGHT = 150;
const WORKBENCH_IMAGE_SIZE = 126;

function normalizeProduct(raw: any): ProductRow {
  const salePrice = numberValue(raw.sale_price ?? raw.salePrice ?? raw.price ?? raw.minSalePrice);
  const costPrice = numberValue(raw.cost_price ?? raw.costPrice);
  return {
    id: textValue(raw.id),
    name: textValue(raw.name ?? raw.title, '未命名商品'),
    category: textValue(raw.category, '未分类'),
    spec: textValue(raw.spec ?? raw.description, '基础款'),
    color: textValue(raw.color, '默认'),
    size: textValue(raw.size, '均码'),
    image: textValue(raw.image, ''),
    costPrice,
    salePrice,
    stock: numberValue(raw.stock ?? raw.quantity),
    warningStock: numberValue(raw.warning_stock ?? raw.warningStock, 3),
    status: textValue(raw.status, '在售'),
    hidden: Number(raw.is_hidden) === 1,
    createdAt: textValue(raw.created_at ?? raw.createdAt, '-').slice(0, 16),
    updatedAt: textValue(raw.updated_at ?? raw.updatedAt, '-'),
    raw,
  };
}

function normalizeLog(raw: any, productMap: Map<string, ProductRow>) {
  const productId = textValue(raw.product_id ?? raw.productId);
  const product = productMap.get(productId);
  const changeType = textValue(raw.change_type ?? raw.type, '');
  const direction = raw.direction || (changeType.includes('出') || changeType.includes('销') || raw.type === 'out' || raw.type === 'sale' ? '出' : '入');
  return {
    id: textValue(raw.id),
    date: textValue(raw.date ?? raw.created_at ?? raw.createdAt, '-').slice(0, 10),
    productId,
    productName: textValue(raw.product_name ?? raw.productName ?? raw.name ?? product?.name, '-'),
    color: textValue(raw.color ?? product?.color, '-'),
    size: textValue(raw.size ?? product?.size, '-'),
    direction,
    type: changeType || '-',
    quantity: numberValue(raw.quantity),
    channel: textValue(raw.channel ?? raw.supplier, '-'),
    operator: textValue(raw.operator, '-'),
    note: textValue(raw.note ?? raw.remark, ''),
    costPrice: numberValue(raw.cost_price ?? raw.unitCost ?? raw.unit_cost),
    raw,
  };
}

function normalizeSale(raw: any, productMap: Map<string, ProductRow>) {
  const productId = textValue(raw.product_id ?? raw.productId);
  const product = productMap.get(productId);
  return {
    id: textValue(raw.id),
    date: textValue(raw.date ?? raw.sale_date ?? raw.created_at ?? raw.createdAt, '-').slice(0, 10),
    productId,
    productName: textValue(raw.product_name ?? raw.productName ?? raw.name ?? product?.name, '-'),
    color: textValue(raw.color ?? product?.color, '-'),
    size: textValue(raw.size ?? product?.size, '-'),
    saleType: textValue(raw.saleType ?? raw.sale_type, '线下'),
    channel: textValue(raw.channel, '线下'),
    quantity: numberValue(raw.quantity),
    amount: numberValue(raw.amount ?? raw.total_amount ?? raw.total_price ?? raw.totalPrice),
    customerName: textValue(raw.customer_name ?? raw.customerName ?? raw.member_name, ''),
    customerPhone: textValue(raw.customer_phone ?? raw.customerPhone, ''),
    operator: textValue(raw.operator, '-'),
    note: textValue(raw.note ?? raw.remark, ''),
    raw,
  };
}

function groupProducts(products: ProductRow[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  products.forEach(product => {
    const key = `${product.category}||${product.name}||${product.spec}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: product.name,
        category: product.category,
        spec: product.spec,
        image: product.image,
        variants: [],
        colors: [],
        sizes: [],
        stock: 0,
        lowStockCount: 0,
        minPrice: product.salePrice,
        maxPrice: product.salePrice,
      });
    }
    const group = map.get(key)!;
    group.variants.push(product);
    group.stock += product.stock;
    group.minPrice = Math.min(group.minPrice, product.salePrice);
    group.maxPrice = Math.max(group.maxPrice, product.salePrice);
    if (product.image && !group.image) group.image = product.image;
    if (!group.colors.includes(product.color)) group.colors.push(product.color);
    if (!group.sizes.includes(product.size)) group.sizes.push(product.size);
    if (product.stock <= product.warningStock) group.lowStockCount += 1;
  });
  return Array.from(map.values()).sort((a, b) => b.stock - a.stock);
}

function payloadFromProductForm(values: any) {
  return {
    name: values.name,
    category: values.category,
    spec: values.spec,
    color: values.color || '默认',
    size: values.size || '均码',
    image: values.image || '',
    price: values.salePrice,
    sale_price: values.salePrice,
    salePrice: values.salePrice,
    stock: values.stock,
    warning_stock: values.warningStock,
    warningStock: values.warningStock,
    description: values.description || values.spec,
    status: values.status || '在售',
  };
}

async function uploadProductImageRequest(data: FormData) {
  const token = typeof window === 'undefined'
    ? ''
    : localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
  const response = await fetch('/local-api/ecommerce/products/image', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: data,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw Object.assign(new Error(result?.error || result?.message || '上传商品主图失败'), {
      response: { data: result },
    });
  }
  return result;
}

export default function EcommercePage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('workbench');
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [activeProduct, setActiveProduct] = useState<ProductRow | null>(null);
  const [activeGroup, setActiveGroup] = useState<ProductGroup | null>(null);
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [productForm] = Form.useForm();
  const [stockForm] = Form.useForm();
  const [saleForm] = Form.useForm();
  const [logForm] = Form.useForm();
  const [saleRecordForm] = Form.useForm();

  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const load = () => {
    setLoading(true);
    ecommerceApi.getOverview()
      .then(({ products: productRows, sales: saleRows, stockLogs: logRows }) => {
        const normalizedProducts = productRows.map(normalizeProduct);
        const productMap = new Map(normalizedProducts.map(item => [item.id, item]));
        setProducts(normalizedProducts);
        setSales(saleRows.map(row => normalizeSale(row, productMap)));
        setStockLogs(logRows.map(row => normalizeLog(row, productMap)));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map(item => item.category).filter(Boolean)))], [products]);
  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products.filter(product => {
      const haystack = [product.name, product.category, product.spec, product.color, product.size, product.status].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (category === 'all' || product.category === category);
    });
  }, [products, keyword, category]);
  const groups = useMemo(() => groupProducts(filteredProducts), [filteredProducts]);
  const salesAmount = sales.reduce((sum, item) => sum + item.amount, 0);
  const stockInCount = stockLogs.filter(item => item.direction === '入').reduce((sum, item) => sum + item.quantity, 0);
  const stockOutCount = stockLogs.filter(item => item.direction !== '入').reduce((sum, item) => sum + item.quantity, 0);

  const closeModal = () => {
    setModalMode(null);
    setActiveProduct(null);
    setActiveGroup(null);
    setActiveRecord(null);
    setImagePreview('');
    productForm.resetFields();
    stockForm.resetFields();
    saleForm.resetFields();
    logForm.resetFields();
    saleRecordForm.resetFields();
  };

  const openProductModal = (product?: ProductRow) => {
    setModalMode(product ? 'editProduct' : 'product');
    setActiveProduct(product || null);
    setImagePreview(product?.image || '');
    productForm.setFieldsValue({
      name: product?.name,
      category: product?.category || '上衣',
      spec: product?.spec || '基础款',
      color: product?.color || '默认',
      size: product?.size || '均码',
      salePrice: product?.salePrice || 0,
      stock: product?.stock || 0,
      warningStock: product?.warningStock ?? 3,
      image: product?.image || '',
      status: product?.status || '在售',
      description: product?.raw?.description || '',
    });
  };

  const openStockModal = (target: ProductRow | ProductGroup) => {
    const groupTarget = 'variants' in target ? target : null;
    const product: ProductRow | undefined = groupTarget ? groupTarget.variants[0] : target as ProductRow;
    setActiveGroup(groupTarget);
    setActiveProduct(product || null);
    setModalMode(groupTarget ? 'groupStockIn' : 'stockIn');
    stockForm.setFieldsValue({
      date: today(),
      productId: product?.id,
      name: product?.name,
      category: product?.category,
      spec: product?.spec,
      color: groupTarget?.colors[0] || product?.color || '',
      size: groupTarget?.sizes[0] || product?.size || '',
      quantity: 1,
      salePrice: product?.salePrice || 0,
      supplier: '进货入库',
      remark: '',
    });
  };

  const openSaleModal = (target: ProductRow | ProductGroup) => {
    const groupTarget = 'variants' in target ? target : null;
    const product: ProductRow | undefined = groupTarget ? groupTarget.variants.find(item => item.stock > 0) || groupTarget.variants[0] : target as ProductRow;
    setActiveGroup(groupTarget);
    setActiveProduct(product || null);
    setModalMode(groupTarget ? 'groupSale' : 'sale');
    saleForm.setFieldsValue({
      date: today(),
      productId: product?.id,
      variantId: product?.id,
      saleType: '线下',
      channel: '线下',
      quantity: 1,
      amount: product?.salePrice || 0,
      unitPrice: product?.salePrice || 0,
      customerName: '',
      customerPhone: '',
      remark: '',
    });
  };

  const openLogModal = (record: any) => {
    setModalMode('log');
    setActiveRecord(record);
    logForm.setFieldsValue({ date: record.date, quantity: record.quantity, channel: record.channel, note: record.note });
  };

  const openSaleRecordModal = (record: any) => {
    setModalMode('saleRecord');
    setActiveRecord(record);
    saleRecordForm.setFieldsValue({
      date: record.date,
      saleType: record.saleType,
      channel: record.channel,
      quantity: record.quantity,
      amount: record.amount,
      note: record.note,
    });
  };

  const submitProduct = async () => {
    const values = await productForm.validateFields();
    if (imageUploading) {
      message.warning('商品主图正在上传，请稍后保存');
      return;
    }
    if (imagePreview.startsWith('data:image/')) {
      message.error('商品主图还没有上传成功，请重新选择图片后再保存');
      return;
    }
    const payload = payloadFromProductForm({ ...values, image: imagePreview });
    if (modalMode === 'editProduct' && activeProduct) {
      await ecommerceApi.updateProduct(activeProduct.id, { ...payload, expectedUpdatedAt: activeProduct.updatedAt });
      message.success('商品已更新');
    } else {
      await ecommerceApi.createProduct(payload);
      message.success('商品已创建');
    }
    closeModal();
    load();
  };

  const submitStock = async () => {
    const values = await stockForm.validateFields();
    const baseProduct = activeProduct;
    await ecommerceApi.stockIn({
      product_id: baseProduct?.id,
      productId: baseProduct?.id,
      name: baseProduct?.name || values.name,
      category: baseProduct?.category || values.category,
      spec: baseProduct?.spec || values.spec,
      color: values.color,
      size: values.size,
      quantity: values.quantity,
      sale_price: values.salePrice,
      salePrice: values.salePrice,
      supplier: values.supplier,
      operator: 'admin',
      remark: values.remark,
      note: values.remark,
      date: values.date,
    });
    message.success('入库完成');
    closeModal();
    load();
  };

  const submitSale = async () => {
    const values = await saleForm.validateFields();
    const productId = values.variantId || values.productId || activeProduct?.id;
    const total = Number(values.amount || values.unitPrice * values.quantity || 0);
    await ecommerceApi.createSale({
      product_id: productId,
      productId,
      quantity: values.quantity,
      unit_price: values.unitPrice || total / Number(values.quantity || 1),
      total_price: total,
      total_amount: total,
      amount: total,
      customer_name: values.customerName,
      customer_phone: values.customerPhone,
      saleType: values.saleType,
      channel: values.channel,
      operator: 'admin',
      remark: values.remark,
      note: values.remark,
      date: values.date,
    });
    message.success('销售出库完成');
    closeModal();
    load();
  };

  const submitLog = async () => {
    if (!activeRecord) return;
    const values = await logForm.validateFields();
    await ecommerceApi.updateStockLog(activeRecord.id, values);
    message.success('库存流水已更新');
    closeModal();
    load();
  };

  const submitSaleRecord = async () => {
    if (!activeRecord) return;
    const values = await saleRecordForm.validateFields();
    await ecommerceApi.updateSale(activeRecord.id, values);
    message.success('销售记录已更新');
    closeModal();
    load();
  };

  const toggleVisibility = async (items: ProductRow[], hidden: boolean) => {
    if (visibilityBusy) return;
    setVisibilityBusy(true);
    try {
      const results = await Promise.allSettled(items.map(item => ecommerceApi.updateProduct(item.id, {hidden, expectedUpdatedAt:item.updatedAt})));
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length) message.error(`${failed.length} 个规格更新失败，请刷新后重试`);
      else message.success(hidden ? '已隐藏，官网和小程序商城不再展示' : '已恢复显示，仍按商品在售状态展示');
      load();
    } finally { setVisibilityBusy(false); }
  };

  const deleteProduct = (product: ProductRow) => {
    if (product.stock > 0) {
      message.warning('该商品仍有库存，不能删除。请先完成销售出库或库存调整。');
      return;
    }
    modal.confirm({
      title: `删除商品 ${product.name}`,
      content: '确认删除这个商品规格？已有销售记录和库存流水会保留，不会被删除。',
      okText: <DeleteOutlined aria-label="删除" title="删除" />,
      okButtonProps: { danger: true , 'aria-label': "删除", title: "删除"},
      onOk: async () => {
        try {
          await ecommerceApi.deleteProduct(product.id);
          message.success('商品已删除，历史销售和库存流水已保留');
          load();
        } catch (error) {
          message.error(errorText(error));
          throw error;
        }
      },
    });
  };

  const deleteProductGroup = (group: ProductGroup) => {
    if (group.stock > 0) {
      message.warning('该商品仍有库存，不能删除。请先完成销售出库或库存调整。');
      return;
    }
    modal.confirm({
      title: `删除商品 ${group.name}`,
      content: `确认删除此商品下的 ${group.variants.length} 个规格？已有销售记录和库存流水会保留，不会被删除。`,
      okText: <DeleteOutlined aria-label="删除" title="删除" />,
      okButtonProps: { danger: true , 'aria-label': "删除", title: "删除"},
      onOk: async () => {
        try {
          await Promise.all(group.variants.map(product => ecommerceApi.deleteProduct(product.id)));
          message.success('商品已删除，历史销售和库存流水已保留');
          load();
        } catch (error) {
          message.error(errorText(error));
          throw error;
        }
      },
    });
  };

  const deleteLog = (record: any) => {
    modal.confirm({
      title: '删除库存流水',
      content: `${record.productName}，${record.direction} ${record.quantity} 件。删除会按后端规则回滚库存。`,
      okText: <DeleteOutlined aria-label="删除" title="删除" />,
      okButtonProps: { danger: true , 'aria-label': "删除", title: "删除"},
      onOk: async () => {
        await ecommerceApi.deleteStockLog(record.id);
        message.success('流水已删除');
        load();
      },
    });
  };

  const deleteSale = (record: any) => {
    modal.confirm({
      title: '删除销售记录',
      content: `${record.productName}，${record.quantity} 件，${money(record.amount)}。删除会按后端规则回滚库存。`,
      okText: <DeleteOutlined aria-label="删除" title="删除" />,
      okButtonProps: { danger: true , 'aria-label': "删除", title: "删除"},
      onOk: async () => {
        await ecommerceApi.deleteSale(record.id);
        message.success('销售记录已删除');
        load();
      },
    });
  };

  const uploadImage = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) {
      message.error('请选择图片文件');
      return false;
    }
    if (file.size > 8 * 1024 * 1024) {
      message.error('商品主图不能超过 8MB');
      return false;
    }
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productName', productForm.getFieldValue('name') || activeProduct?.name || 'product');
      formData.append('oldImage', imagePreview || activeProduct?.image || '');
      const result = await uploadProductImageRequest(formData);
      const image = result?.data?.image || result?.data?.url || result?.image || result?.url;
      if (!image) throw new Error('上传成功但未返回图片地址');
      setImagePreview(image);
      productForm.setFieldValue('image', image);
      message.success('商品主图已上传');
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setImageUploading(false);
    }
    return false;
  };

  const openGroupDetail = (group: ProductGroup) => {
    modal.info({
      title: '商品详情',
      width: 860,
      icon: null,
      content: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space align="start" size={16}>
            <div style={{
              width: 96,
              height: 96,
              borderRadius: 8,
              background: group.image ? '#F8FAFC' : 'linear-gradient(135deg, #F8FAFC 0%, #FCE7F3 100%)',
              border: '1px solid #EEF2F7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flex: '0 0 auto',
            }}>
              {group.image ? (
                <Image src={group.image} width={96} height={96} style={{ objectFit: 'cover' }} preview={false} />
              ) : (
                <ShopOutlined style={{ fontSize: 34, color: '#CBD5E1' }} />
              )}
            </div>
            <Descriptions size="small" column={2} style={{ flex: 1 }}>
              <Descriptions.Item label="商品名称" span={2}>{group.name}</Descriptions.Item>
              <Descriptions.Item label="分类">{group.category}</Descriptions.Item>
              <Descriptions.Item label="款式">{group.spec}</Descriptions.Item>
              <Descriptions.Item label="总库存">{group.stock}</Descriptions.Item>
              <Descriptions.Item label="规格数">{group.variants.length}</Descriptions.Item>
              <Descriptions.Item label="售价">
                {group.minPrice === group.maxPrice ? money(group.minPrice) : `${money(group.minPrice)} - ${money(group.maxPrice)}`}
              </Descriptions.Item>
              <Descriptions.Item label="库存状态">
                {group.variants.some(item => item.hidden) && <Tag>{group.variants.every(item => item.hidden) ? '已隐藏' : '部分隐藏'}</Tag>}
                              {group.lowStockCount > 0 ? <Tag color="orange">低库存 {group.lowStockCount}</Tag> : <Tag color="green">正常</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Space>
          <Table<ProductRow>
            scroll={{ x: 'max-content' }}
            rowKey="id"
            size="small"
            dataSource={group.variants}
            pagination={false}
            columns={[
              { title: '颜色', dataIndex: 'color' },
              { title: '尺码', dataIndex: 'size' },
              { title: '库存', dataIndex: 'stock', align: 'right' as const },
              { title: '低库存预警', dataIndex: 'warningStock', align: 'right' as const },
              { title: '售价', dataIndex: 'salePrice', align: 'right' as const, render: money },
              { title: '状态', dataIndex: 'status', render: value => <Tag color={value === '在售' || value === 'active' ? 'green' : 'default'}>{value}</Tag> },
              { title: '更新时间', dataIndex: 'updatedAt' },
            ]}
          />
        </Space>
      ),
      okText: '关闭',
    });
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  const productColumns = sortableColumns<ProductRow>([
    {
      title: '商品',
      dataIndex: 'name',
      fixed: 'left',
      width: 220,
      sorter: (a, b) => compareTableValues(a.name, b.name),
      render: (_, record) => (
        <Space>
          {record.image ? <Image src={record.image} width={42} height={42} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} /> : <Avatar shape="square">{record.name.slice(0, 1)}</Avatar>}
          <div>
            <Text strong>{record.name}</Text>
            <div><Text type="secondary">{record.category} / {record.spec}</Text></div>
          </div>
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'category', width: 110, sorter: (a, b) => compareTableValues(a.category, b.category), render: value => <Tag color="purple">{value}</Tag> },
    { title: '颜色', dataIndex: 'color', width: 100, sorter: (a, b) => compareTableValues(a.color, b.color) },
    { title: '尺码', dataIndex: 'size', width: 100, sorter: (a, b) => compareTableValues(a.size, b.size) },
    { title: '库存', dataIndex: 'stock', align: 'right' as const, width: 90, sorter: (a, b) => a.stock - b.stock, render: value => <Text strong style={{ color: '#16A34A' }}>{value}</Text> },
    { title: '预警', dataIndex: 'warningStock', align: 'right' as const, width: 90, sorter: (a, b) => a.warningStock - b.warningStock },
    { title: '售价', dataIndex: 'salePrice', align: 'right' as const, width: 100, sorter: (a, b) => a.salePrice - b.salePrice, render: money },
    { title: '展示', dataIndex: 'hidden', width: 90, render: value => <Tag color={value ? 'default' : 'green'}>{value ? '已隐藏' : '显示'}</Tag> },
    { title: '状态', dataIndex: 'status', width: 100, sorter: (a, b) => compareTableValues(a.status, b.status), render: value => <Tag color={value === '在售' || value === 'active' ? 'green' : 'default'}>{value}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 150, render: value => String(value).slice(0, 16), sorter: (a, b) => compareTableValues(a.updatedAt, b.updatedAt) },
    {
      title: '操作',
      fixed: 'right',
      width: 310,
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="编辑"><Button icon={<EditOutlined />} onClick={() => openProductModal(record)} /></Tooltip>
          <Button loading={visibilityBusy} icon={record.hidden ? <EyeOutlined /> : <EyeInvisibleOutlined />} onClick={() => void toggleVisibility([record], !record.hidden)}>{record.hidden ? '显示' : '隐藏'}</Button>
          <Button onClick={() => openStockModal(record)}>入库</Button>
          <Button onClick={() => openSaleModal(record)} disabled={record.stock <= 0}>销售</Button>
          <Tooltip title="删除"><Button danger icon={<DeleteOutlined />} onClick={() => deleteProduct(record)} /></Tooltip>
        </Space>
      ),
    },
  ]);

  return (
    <div className="ecommerce-admin-page">
      <div className="page-header ecommerce-page-header">
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col>
            <Title level={2}>电商系统</Title>
            <Text className="ecommerce-page-subtitle" type="secondary">商品建档、规格库存、进货入库、销售出库、库存流水与销售记录。</Text>
          </Col>
          <Col>
            <Space className="ecommerce-top-actions">
              <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openProductModal()}>新增商品</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="ecommerce-filter-card" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input prefix={<SearchOutlined />} placeholder="搜索商品、分类、颜色、尺码" value={keyword} onChange={event => setKeyword(event.target.value)} allowClear />
          </Col>
          <Col xs={24} md={6}>
            <Select value={category} onChange={setCategory} style={{ width: '100%' }} options={categories.map(item => ({ value: item, label: item === 'all' ? '全部分类' : item }))} />
          </Col>
        </Row>
      </Card>

      <Tabs
        className="ecommerce-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'online-orders', label: '官网商城订单', children: <ShopOnlineOrders /> },
          {
            key: 'workbench',
            label: `工作台 ${groups.length}`,
            children: (
              <Row className="ecommerce-workbench-grid" gutter={[16, 16]}>
                {groups.map(group => (
                  <Col className="ecommerce-workbench-col" flex={`0 0 ${WORKBENCH_CARD_WIDTH}px`} style={{ maxWidth: '100%' }} key={group.key}>
                    <Card
                      className="ecommerce-workbench-card"
                      hoverable
                      styles={{ body: { padding: 12 } }}
                      onClick={() => openGroupDetail(group)}
                      style={{ cursor: 'pointer', width: WORKBENCH_CARD_WIDTH, maxWidth: '100%', minHeight: WORKBENCH_CARD_HEIGHT }}
                    >
                      <Space className="ecommerce-product-card-layout" align="start" size={10} style={{ width: '100%', height: '100%' }}>
                        <div className="ecommerce-product-image" style={{
                          width: WORKBENCH_IMAGE_SIZE,
                          height: WORKBENCH_IMAGE_SIZE,
                          borderRadius: 8,
                          background: group.image ? '#F8FAFC' : 'linear-gradient(135deg, #F8FAFC 0%, #FCE7F3 100%)',
                          border: '1px solid #EEF2F7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flex: `0 0 ${WORKBENCH_IMAGE_SIZE}px`,
                        }}>
                          {group.image ? (
                            <Image src={group.image} width={WORKBENCH_IMAGE_SIZE} height={WORKBENCH_IMAGE_SIZE} style={{ objectFit: 'cover' }} preview={false} />
                          ) : (
                            <ShopOutlined style={{ fontSize: 34, color: '#CBD5E1' }} />
                          )}
                        </div>
                        <Space className="ecommerce-product-content" direction="vertical" style={{ flex: 1, minWidth: 0, minHeight: WORKBENCH_IMAGE_SIZE, justifyContent: 'space-between' }} size={4}>
                          <div>
                            <Space className="ecommerce-product-heading" align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
                              <div style={{ minWidth: 0 }}>
                                <Text type="secondary">{group.category} · {group.spec}</Text>
                                <div><Text className="ecommerce-product-name" strong ellipsis style={{ maxWidth: 128 }}>{group.name}</Text></div>
                              </div>
                              {group.variants.some(item => item.hidden) && <Tag>{group.variants.every(item => item.hidden) ? '已隐藏' : '部分隐藏'}</Tag>}
                              {group.lowStockCount > 0 ? <Tag color="orange">低库存 {group.lowStockCount}</Tag> : <Tag color="green">正常</Tag>}
                            </Space>
                            <Row className="ecommerce-product-stats" gutter={4} style={{ marginTop: 6 }}>
                              <Col span={8}><Statistic title="库存" value={group.stock} valueStyle={{ fontSize: 16 }} /></Col>
                              <Col span={8}><Statistic title="规格" value={group.variants.length} valueStyle={{ fontSize: 16 }} /></Col>
                              <Col span={8}><Statistic title="售价" value={group.minPrice === group.maxPrice ? money(group.minPrice) : `${money(group.minPrice)} - ${money(group.maxPrice)}`} valueStyle={{ fontSize: 14 }} /></Col>
                            </Row>
                          </div>
                          <Space className="ecommerce-card-actions" size={3} wrap onClick={event => event.stopPropagation()}>
                            <Button size="small" onClick={() => openProductModal(group.variants[0])}>编辑</Button>
                            <Button size="small" loading={visibilityBusy} onClick={() => void toggleVisibility(group.variants, !group.variants.every(item => item.hidden))}>{group.variants.every(item => item.hidden) ? '显示' : '隐藏'}</Button>
                            <Button size="small" onClick={() => openStockModal(group)}>入库</Button>
                            <Button size="small" type="primary" onClick={() => openSaleModal(group)} disabled={group.stock <= 0}>销售</Button>
                            <Tooltip title="删除">
                              <Button size="small" danger icon={<DeleteOutlined />} aria-label="删除" onClick={() => deleteProductGroup(group)} />
                            </Tooltip>
                          </Space>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                ))}
                {!groups.length && <Col span={24}><Empty description="暂无商品" /></Col>}
              </Row>
            ),
          },
          {
            key: 'inventory',
            label: `商品库存 ${filteredProducts.length}`,
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<ProductRow>
                  rowKey="id"
                  dataSource={filteredProducts}
                  size="middle"
                  scroll={{ x: 1260, y: 'calc(100dvh - 430px)' }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 个 SKU` }}
                  locale={{ emptyText: <Empty description="暂无商品库存数据" /> }}
                  columns={productColumns}
                />
              </Card>
            ),
          },
          {
            key: 'logs',
            label: `库存流水 ${stockLogs.length}`,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}><Card><Statistic title="入库数量" value={stockInCount} suffix="件" valueStyle={{ color: '#16A34A' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="出库数量" value={stockOutCount} suffix="件" valueStyle={{ color: '#F59E0B' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="流水条数" value={stockLogs.length} /></Card></Col>
                </Row>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table<any>
                    rowKey="id"
                    dataSource={stockLogs}
                    size="middle"
                    scroll={{ x: 1100, y: 'calc(100dvh - 500px)' }}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    columns={sortableColumns([
                      { title: '日期', dataIndex: 'date', width: 120, sorter: (a: any, b: any) => compareTableValues(a.date, b.date) },
                      { title: '商品', dataIndex: 'productName', width: 180, sorter: (a: any, b: any) => compareTableValues(a.productName, b.productName) },
                      { title: '颜色', dataIndex: 'color', width: 100, sorter: (a: any, b: any) => compareTableValues(a.color, b.color) },
                      { title: '尺码', dataIndex: 'size', width: 100, sorter: (a: any, b: any) => compareTableValues(a.size, b.size) },
                      { title: '方向', dataIndex: 'direction', width: 90, sorter: (a: any, b: any) => compareTableValues(a.direction, b.direction), render: (value: string) => <Tag color={value === '入' ? 'green' : 'orange'}>{value}</Tag> },
                      { title: '数量', dataIndex: 'quantity', align: 'right' as const, width: 90, sorter: (a: any, b: any) => a.quantity - b.quantity },
                      { title: '来源', dataIndex: 'channel', width: 140, sorter: (a: any, b: any) => compareTableValues(a.channel, b.channel) },
                      { title: '操作人', dataIndex: 'operator', width: 100, sorter: (a: any, b: any) => compareTableValues(a.operator, b.operator) },
                      { title: '备注', dataIndex: 'note', ellipsis: true, sorter: (a: any, b: any) => compareTableValues(a.note, b.note) },
                      { title: '操作', fixed: 'right' as const, width: 120, render: (_: any, record: any) => <Space><Tooltip title="编辑"><Button icon={<EditOutlined />} onClick={() => openLogModal(record)} /></Tooltip><Tooltip title="删除"><Button danger icon={<DeleteOutlined />} onClick={() => deleteLog(record)} /></Tooltip></Space> },
                    ])}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'sales',
            label: `销售记录 ${sales.length}`,
            children: (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}><Card><Statistic title="销售单数" value={sales.length} prefix={<ShoppingCartOutlined />} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="销售总额" value={formatCompactMoney(salesAmount)} valueStyle={{ color: '#F72A8A' }} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="销售件数" value={sales.reduce((sum, item) => sum + item.quantity, 0)} suffix="件" /></Card></Col>
                </Row>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table<any>
                    rowKey="id"
                    dataSource={sales}
                    size="middle"
                    scroll={{ x: 1120, y: 'calc(100dvh - 500px)' }}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    columns={sortableColumns([
                      { title: '日期', dataIndex: 'date', width: 120, sorter: (a: any, b: any) => compareTableValues(a.date, b.date) },
                      { title: '商品', dataIndex: 'productName', width: 180, sorter: (a: any, b: any) => compareTableValues(a.productName, b.productName) },
                      { title: '颜色', dataIndex: 'color', width: 100, sorter: (a: any, b: any) => compareTableValues(a.color, b.color) },
                      { title: '尺码', dataIndex: 'size', width: 100, sorter: (a: any, b: any) => compareTableValues(a.size, b.size) },
                      { title: '类型', dataIndex: 'saleType', width: 100, sorter: (a: any, b: any) => compareTableValues(a.saleType, b.saleType) },
                      { title: '渠道', dataIndex: 'channel', width: 120, sorter: (a: any, b: any) => compareTableValues(a.channel, b.channel) },
                      { title: '数量', dataIndex: 'quantity', align: 'right' as const, width: 90, sorter: (a: any, b: any) => a.quantity - b.quantity },
                      { title: '实收金额', dataIndex: 'amount', align: 'right' as const, width: 120, sorter: (a: any, b: any) => a.amount - b.amount, render: (value: number) => <Text strong style={{ color: '#F72A8A' }}>{money(value)}</Text> },
                      { title: '备注', dataIndex: 'note', ellipsis: true, sorter: (a: any, b: any) => compareTableValues(a.note, b.note) },
                      { title: '操作', fixed: 'right' as const, width: 120, render: (_: any, record: any) => <Space><Tooltip title="编辑"><Button icon={<EditOutlined />} onClick={() => openSaleRecordModal(record)} /></Tooltip><Tooltip title="删除"><Button danger icon={<DeleteOutlined />} onClick={() => deleteSale(record)} /></Tooltip></Space> },
                    ])}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />

      <Modal title={modalMode === 'editProduct' ? '编辑商品' : '新增商品'} open={modalMode === 'product' || modalMode === 'editProduct'} onCancel={closeModal} onOk={submitProduct} okText="保存" cancelText="取消" width={760} okButtonProps={{ disabled: imageUploading }}>
        <Form form={productForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="商品主图">
                <div style={{ width: 160, height: 160, border: '1px dashed #d9d9d9', borderRadius: 8, overflow: 'hidden', display: 'grid', placeItems: 'center', color: '#8c8c8c', background: '#fafafa' }}>
                  {imagePreview ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '暂无图片'}
                </div>
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={(file) => {
                    void uploadImage(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={imageUploading} style={{ marginTop: 8, width: 160 }}>
                    上传主图
                  </Button>
                </Upload>
                {imagePreview ? (
                  <Button type="link" size="small" danger style={{ paddingInline: 0 }} onClick={() => {
                    setImagePreview('');
                    productForm.setFieldValue('image', '');
                  }}>
                    清除主图
                  </Button>
                ) : null}
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Row gutter={12}>
                <Col xs={12} sm={12}><Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请填写商品名称' }]}><Input placeholder="例如 肩带上衣" /></Form.Item></Col>
                <Col xs={12} sm={12}><Form.Item name="category" label="分类"><Input placeholder="例如 上衣" /></Form.Item></Col>
                <Col xs={12} sm={12}><Form.Item name="spec" label="款式/版型"><Input placeholder="例如 基础款" /></Form.Item></Col>
                <Col xs={12} sm={12}><Form.Item name="status" label="状态"><Select options={['在售', '停售', 'active'].map(item => ({ value: item, label: item }))} /></Form.Item></Col>
                <Col xs={8} sm={8}><Form.Item name="salePrice" label="销售价"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={8} sm={8}><Form.Item name="warningStock" label="低库存预警"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
                {modalMode === 'product' && <Col xs={8} sm={8}><Form.Item name="stock" label="初始库存"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item></Col>}
              </Row>
            </Col>
            <Col span={24}><Form.Item name="description" label="备注"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={modalMode === 'groupStockIn' ? '按颜色尺码入库' : '进货入库'} open={modalMode === 'stockIn' || modalMode === 'groupStockIn'} onCancel={closeModal} onOk={submitStock} okText="保存" cancelText="取消" width={720}>
        <Form form={stockForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} sm={12}><Form.Item name="date" label="日期"><Input type="date" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="supplier" label="来源/供应商"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="color" label="颜色"><Input list="ecommerce-colors" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="size" label="尺码"><Input list="ecommerce-sizes" /></Form.Item></Col>
            <Col xs={8} sm={8}><Form.Item name="quantity" label="入库数量" rules={[{ required: true, message: '请填写入库数量' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={8} sm={8}><Form.Item name="salePrice" label="销售价"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
          </Row>
          <datalist id="ecommerce-colors">{(activeGroup?.colors || products.map(item => item.color)).map(item => <option key={item} value={item} />)}</datalist>
          <datalist id="ecommerce-sizes">{(activeGroup?.sizes || products.map(item => item.size)).map(item => <option key={item} value={item} />)}</datalist>
        </Form>
      </Modal>

      <Modal title="销售出库" open={modalMode === 'sale' || modalMode === 'groupSale'} onCancel={closeModal} onOk={submitSale} okText="保存" cancelText="取消" width={720}>
        <Form form={saleForm} layout="vertical">
          <Row gutter={12}>
            {activeGroup && (
              <Col span={24}>
                <Form.Item name="variantId" label="颜色 / 尺码" rules={[{ required: true, message: '请选择规格' }]}>
                  <Select options={activeGroup.variants.filter(item => item.stock > 0).map(item => ({ value: item.id, label: `${item.color} / ${item.size} / 库存 ${item.stock}` }))} />
                </Form.Item>
              </Col>
            )}
            <Col xs={12} sm={12}><Form.Item name="date" label="日期"><Input type="date" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="saleType" label="销售类型"><Select options={['线下', '线上'].map(item => ({ value: item, label: item }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="channel" label="渠道"><Select options={['线下', '抖店', '微信小店', '淘宝', '呼啦/线下社群', '微信转账'].map(item => ({ value: item, label: item }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="quantity" label="销售数量" rules={[{ required: true, message: '请填写销售数量' }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="unitPrice" label="单价"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="amount" label="实收金额"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="customerName" label="客户姓名"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="customerPhone" label="客户手机号"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="编辑库存流水" open={modalMode === 'log'} onCancel={closeModal} onOk={submitLog} okText="保存" cancelText="取消" width={560}>
        <Form form={logForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} sm={12}><Form.Item name="date" label="日期"><Input type="date" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="quantity" label="数量"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="channel" label="来源/渠道"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="note" label="备注"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="编辑销售记录" open={modalMode === 'saleRecord'} onCancel={closeModal} onOk={submitSaleRecord} okText="保存" cancelText="取消" width={620}>
        <Form form={saleRecordForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={12} sm={12}><Form.Item name="date" label="日期"><Input type="date" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="saleType" label="销售类型"><Select options={['线下', '线上'].map(item => ({ value: item, label: item }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="channel" label="渠道"><Select options={['线下', '抖店', '微信小店', '淘宝', '呼啦/线下社群', '微信转账'].map(item => ({ value: item, label: item }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="quantity" label="销售数量"><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="amount" label="实收金额"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="note" label="备注"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
