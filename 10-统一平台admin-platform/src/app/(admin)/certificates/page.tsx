'use client';
import { useEffect, useRef, useState } from 'react';
import { Card, Tag, Space, Button, Input, Row, Col, Statistic, Modal, Form, Select, message, InputNumber, Alert, Typography, Tooltip } from 'antd';
import { Table } from '@/components/adaptive-table';
import { PlusOutlined, SearchOutlined, TrophyOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ThunderboltOutlined, FileImageOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { api, certApi } from '@/lib/api';
import { sortableColumns } from '@/lib/table-sort';

interface CertRecord {
  id: number;
  certificateNo: string;
  seriesId: number;
  memberName: string;
  courseName: string;
  issueDate: string;
  status: string;
  pdfUrl?: string;
  verifyUrl?: string;
  issueMethod?: string;
  sourcePlatform?: string;
  completionRate?: number;
}

interface MemberOption {
  id: number;
  name: string;
  phone?: string;
}

interface SeriesOption {
  id: number;
  name: string;
  status?: string;
}

interface TemplateField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  align: 'start' | 'middle' | 'end';
}

const fieldLabels: Record<string, string> = {
  memberName: '学员姓名',
  courseName: '课程名称',
  issueDate: '发证日期',
  certificateNo: '证书编号',
};

function issueMethodLabel(value?: string) {
  if (value === 'auto') return '自动发放';
  if (value === 'training_batch') return '线下发放';
  return '手动发放';
}

export default function CertificatesPage() {
  const [form] = Form.useForm();
  const [templateForm] = Form.useForm();
  const templateImageUrl = Form.useWatch('template_image_url', templateForm);
  const templateWidth = Form.useWatch('width', templateForm);
  const templateHeight = Form.useWatch('height', templateForm);
  const [data, setData] = useState<CertRecord[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number>();
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [autoIssuing, setAutoIssuing] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const rows = await certApi.list();
      setData(rows.map((row: any) => ({
        id: row.id,
        certificateNo: row.certificateNo || row.certNo || '',
        seriesId: Number(row.seriesId || row.series_id || 0),
        memberName: row.memberName || '',
        courseName: row.courseName || row.name || '',
        issueDate: row.issueDate || '',
        status: row.status || 'active',
        pdfUrl: row.pdfUrl || row.pdf_url || '',
        verifyUrl: row.verifyUrl || row.verify_url || '',
        issueMethod: row.issueMethod || row.issue_method || 'manual',
        sourcePlatform: row.sourcePlatform || row.source_platform || 'admin',
        completionRate: Number(row.completionRate || row.completion_rate || 0),
      })));
    } catch (err: any) {
      message.error(err?.response?.data?.error || '证书列表加载失败');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const res = await api.get('/members/directory');
      const rows = Array.isArray(res.data?.members) ? res.data.members : [];
      setMembers(rows);
      return rows;
    } catch (err: any) {
      message.error(err?.response?.data?.error || '学员列表加载失败');
      setMembers([]);
      return [];
    }
  };

  const loadSeries = async () => {
    try {
      const res = await api.get('/course/series', { params: { pageSize: 100 } });
      const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setSeriesList(rows);
      return rows;
    } catch (err: any) {
      message.error(err?.response?.data?.error || '课程系列加载失败');
      setSeriesList([]);
      return [];
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const openIssueModal = async () => {
    await Promise.all([
      members.length ? Promise.resolve(members) : loadMembers(),
      seriesList.length ? Promise.resolve(seriesList) : loadSeries(),
    ]);
    setModalVisible(true);
  };

  const handleIssue = async (values: { memberId: number; seriesId: number }) => {
    setIssuing(true);
    try {
      const res = await certApi.issue(values.memberId, values.seriesId);
      message.success(`证书已颁发：${res?.data?.certificateNo || res?.certificateNo || ''}`);
      setModalVisible(false);
      form.resetFields();
      await loadCertificates();
    } catch (err: any) {
      message.error(err?.response?.data?.error || '证书颁发失败');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = (record: CertRecord) => {
    Modal.confirm({
      title: '撤销证书',
      content: `确认撤销证书 ${record.certificateNo}？`,
      okText: '撤销',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await certApi.revoke(record.id);
          message.success('证书已撤销');
          await loadCertificates();
        } catch (err: any) {
          message.error(err?.response?.data?.error || '撤销失败');
        }
      },
    });
  };

  const handleAutoIssue = async () => {
    setAutoIssuing(true);
    try {
      const res = await certApi.autoIssue();
      message.success(`自动颁发完成，本次颁发 ${res?.data?.issued ?? 0} 张证书`);
      await loadCertificates();
    } catch (err: any) {
      message.error(err?.response?.data?.error || '自动颁发失败');
    } finally {
      setAutoIssuing(false);
    }
  };

  const openTemplateModal = async (seriesId?: number) => {
    const availableSeries = seriesList.length ? seriesList : await loadSeries();
    const targetSeriesId = seriesId || selectedSeriesId || availableSeries[0]?.id;
    if (!targetSeriesId) {
      message.warning('请先创建课程系列');
      return;
    }
    setSelectedSeriesId(targetSeriesId);
    setTemplateModalVisible(true);
    setTemplateLoading(true);
    try {
      const res = await certApi.getTemplate(targetSeriesId);
      const template = res?.data || res;
      templateForm.setFieldsValue({
        template_name: template.template_name || template.templateName || '课程证书模板',
        template_image_url: template.template_image_url || template.templateImageUrl || '',
        width: template.width || 1200,
        height: template.height || 850,
      });
      setTemplateFields(template.fields || []);
    } catch (err: any) {
      message.error(err?.response?.data?.error || '证书模板加载失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!selectedSeriesId) return;
    setTemplateLoading(true);
    try {
      const values = await templateForm.validateFields();
      await certApi.saveTemplate(selectedSeriesId, { ...values, fields: templateFields });
      message.success('课程证书模板已保存');
      setTemplateModalVisible(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error || '证书模板保存失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  const generateTemplate = async () => {
    if (!selectedSeriesId) return;
    setTemplateLoading(true);
    try {
      const res = await certApi.generateTemplate(selectedSeriesId);
      const template = res?.data || res;
      templateForm.setFieldsValue({
        template_name: template.template_name || template.templateName || 'AI电子证书模板',
        template_image_url: template.template_image_url || template.templateImageUrl || '',
        width: template.width || 1200,
        height: template.height || 850,
      });
      setTemplateFields(template.fields || templateFields);
      message.success(template.template_image_url ? 'AI证书模板已生成' : '已启用系统电子证书模板');
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'AI证书模板生成失败');
    } finally {
      setTemplateLoading(false);
    }
  };

  const updateTemplateField = (index: number, patch: Partial<TemplateField>) => {
    setTemplateFields(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const previewRef = useRef<HTMLDivElement | null>(null);
  const moveTemplateField = (event: React.PointerEvent<HTMLElement>, index: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    updateTemplateField(index, { x: Math.round(x), y: Math.round(y) });
  };

  const filtered = data.filter(c => {
    if (!searchText) return true;
    const keyword = searchText.trim();
    return c.memberName.includes(keyword)
      || c.certificateNo.includes(keyword)
      || c.courseName.includes(keyword)
      || c.issueMethod?.includes(keyword)
      || c.sourcePlatform?.includes(keyword);
  });

  const total = data.length;
  const active = data.filter(c => c.status === 'active').length;
  const memberOptions = members.map((member) => ({
    label: `${member.name}${member.phone ? ` · ${member.phone}` : ''}`,
    value: member.id,
  }));
  const seriesOptions = (() => {
    const options = new Map<number, { label: string; value: number }>();
    seriesList.forEach((series) => {
      options.set(series.id, {
        label: `${series.name}${series.status && series.status !== 'published' ? ` · ${series.status}` : ''}`,
        value: series.id,
      });
    });
    data.forEach((cert) => {
      if (!cert.seriesId || options.has(cert.seriesId)) return;
      options.set(cert.seriesId, {
        label: cert.seriesId < 0 ? `${cert.courseName || '线下课程'} · 线下课` : (cert.courseName || `课程 ${cert.seriesId}`),
        value: cert.seriesId,
      });
    });
    return Array.from(options.values());
  })();

  const templateFieldColumns = [
    { title: '填充项', dataIndex: 'key', width: 110, render: (v: string) => fieldLabels[v] || v },
    { title: 'X%', dataIndex: 'x', width: 100, render: (_: number, record: TemplateField, index: number) => <InputNumber min={0} max={100} value={record.x} onChange={value => updateTemplateField(index, { x: Number(value || 0) })} /> },
    { title: 'Y%', dataIndex: 'y', width: 100, render: (_: number, record: TemplateField, index: number) => <InputNumber min={0} max={100} value={record.y} onChange={value => updateTemplateField(index, { y: Number(value || 0) })} /> },
    { title: '字号', dataIndex: 'fontSize', width: 100, render: (_: number, record: TemplateField, index: number) => <InputNumber min={10} max={96} value={record.fontSize} onChange={value => updateTemplateField(index, { fontSize: Number(value || 12) })} /> },
    { title: '颜色', dataIndex: 'color', width: 120, render: (_: string, record: TemplateField, index: number) => <Input value={record.color} onChange={event => updateTemplateField(index, { color: event.target.value })} /> },
    { title: '对齐', dataIndex: 'align', width: 120, render: (_: string, record: TemplateField, index: number) => <Select value={record.align} style={{ width: 96 }} onChange={value => updateTemplateField(index, { align: value })} options={[{ value: 'start', label: '左' }, { value: 'middle', label: '中' }, { value: 'end', label: '右' }]} /> },
  ];

  const previewWidth = Number(templateWidth || 1200);
  const previewHeight = Number(templateHeight || 850);
  const previewAspectRatio = previewWidth && previewHeight ? `${previewWidth} / ${previewHeight}` : '1200 / 850';
  const previewValues: Record<string, string> = {
    memberName: '王小舞',
    courseName: seriesList.find(item => item.id === selectedSeriesId)?.name || '课程名称',
    issueDate: '2026-06-01',
    certificateNo: 'SWOD-20260601-001',
  };
  const textAnchorToTranslate: Record<TemplateField['align'], string> = {
    start: '0',
    middle: '-50%',
    end: '-100%',
  };

  const columns = sortableColumns<CertRecord>([
    { title: '证书编号', dataIndex: 'certificateNo', key: 'certificateNo', width: 150,
      render: (v: string) => <><TrophyOutlined style={{ color: '#f59e0b', marginRight: 6 }} /><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span></> },
    { title: '学员', dataIndex: 'memberName', key: 'memberName', width: 120 },
    { title: '课程', dataIndex: 'courseName', key: 'courseName', width: 200, className: 'course-name-column' },
    { title: '来源', dataIndex: 'issueMethod', key: 'issueMethod', width: 110,
      render: (v: string, record: CertRecord) => <Tag color={v === 'auto' ? 'blue' : v === 'training_batch' ? 'green' : 'default'}>{issueMethodLabel(v)} · {record.sourcePlatform || 'admin'}</Tag> },
    { title: '颁发日期', dataIndex: 'issueDate', key: 'issueDate', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 60,
      render: (v: string) => <Tag color={v === 'active' ? 'gold' : 'default'}>{v === 'active' ? '有效' : '已撤销'}</Tag> },
    { title: '操作', key: 'action', width: 160,
      render: (_: any, record: CertRecord) => <Space>
        <Tooltip title="查看电子证书"><Button type="link" size="small" icon={<LinkOutlined />} disabled={!record.pdfUrl} onClick={() => record.pdfUrl && window.open(record.pdfUrl, '_blank')}>查看</Button></Tooltip>
        <Tooltip title="课程证书模板"><Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openTemplateModal(record.seriesId)}>模板</Button></Tooltip>
        <Button type="link" size="small" danger disabled={record.status !== 'active'} onClick={() => handleRevoke(record)}>撤销</Button>
      </Space> },
  ]);

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
        <Button icon={<ReloadOutlined />} onClick={loadCertificates} loading={loading}>刷新</Button>
        <Button icon={<ThunderboltOutlined />} onClick={handleAutoIssue} loading={autoIssuing}>自动颁发</Button>
        <Button icon={<FileImageOutlined />} onClick={() => openTemplateModal()}>证书模板</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { void openIssueModal(); }}>颁发证书</Button>
      </Space>}>
        <Table columns={columns} dataSource={filtered} size="middle" loading={loading} pagination={{ pageSize: 20 }} rowKey="id" scroll={{ x: 'max-content' }} />
      </Card>

      <Modal title="颁发证书" open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={500} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleIssue}>
          <Form.Item name="memberId" label="学员" rules={[{ required: true, message: '请选择学员' }]}>
            <Select
              placeholder="搜索并选择学员"
              showSearch
              options={memberOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="seriesId" label="课程" rules={[{ required: true, message: '请选择课程系列' }]}>
            <Select
              placeholder="搜索并选择课程系列"
              showSearch
              options={seriesOptions}
              optionFilterProp="label"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={issuing} block>颁发证书</Button>
        </Form>
      </Modal>

      <Modal
        title="课程证书模板"
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        onOk={saveTemplate}
        okText="保存模板"
        cancelText="取消"
        width={860}
        confirmLoading={templateLoading}
        destroyOnClose
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="每个课程可绑定独立证书模板；没有模板时，系统会自动生成电子证书底图，再把姓名、日期、课程和编号填入留白处。"
          />
          <Row gutter={12}>
            <Col span={10}>
              <Typography.Text type="secondary">选择课程</Typography.Text>
              <Select
                value={selectedSeriesId}
                style={{ width: '100%', marginTop: 6 }}
                showSearch
                optionFilterProp="label"
                options={seriesOptions}
                onChange={value => openTemplateModal(value)}
              />
            </Col>
            <Col span={14} style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
              <Button icon={<ThunderboltOutlined />} onClick={generateTemplate} loading={templateLoading}>AI生成电子证书模板</Button>
            </Col>
          </Row>
          <Form form={templateForm} layout="vertical">
            <Row gutter={12}>
              <Col span={8}><Form.Item name="template_name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}><Input /></Form.Item></Col>
              <Col span={8}><Form.Item name="width" label="画布宽度"><InputNumber min={600} max={2400} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="height" label="画布高度"><InputNumber min={400} max={1800} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={24}><Form.Item name="template_image_url" label="模板图片地址"><Input placeholder="可填写 /uploads/... 或 https://...；留空则使用系统电子证书底图" /></Form.Item></Col>
            </Row>
          </Form>
          <Card size="small" title="模板预览" styles={{ body: { padding: 12 } }}>
            <div
              ref={previewRef}
              onPointerMove={event => {
                if (draggingFieldIndex !== null) moveTemplateField(event, draggingFieldIndex);
              }}
              onPointerUp={() => setDraggingFieldIndex(null)}
              onPointerLeave={() => setDraggingFieldIndex(null)}
              style={{
                width: '100%',
                maxWidth: 720,
                aspectRatio: previewAspectRatio,
                margin: '0 auto',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: '#FFF9F0',
                userSelect: 'none',
              }}
            >
              {templateImageUrl ? (
                <img
                  src={templateImageUrl}
                  alt="证书模板预览"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, background: '#FFF9F0' }}>
                  <div style={{ position: 'absolute', inset: '5.5%', border: '2px solid #C8A96E', borderRadius: 14 }} />
                  <div style={{ position: 'absolute', top: '22%', left: 0, right: 0, textAlign: 'center', fontSize: 34, fontWeight: 700, color: '#8B1A1A' }}>结业证书</div>
                </div>
              )}
              {templateFields.map((field, index) => (
                <div
                  key={field.key}
                  title="拖动调整位置"
                  onPointerDown={event => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingFieldIndex(index);
                    moveTemplateField(event, index);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    transform: `translate(${textAnchorToTranslate[field.align] || '-50%'}, -50%)`,
                    color: field.color,
                    fontSize: Math.max(10, Math.round(Number(field.fontSize || 14) * 0.42)),
                    fontWeight: field.key === 'memberName' ? 700 : 500,
                    whiteSpace: 'nowrap',
                    maxWidth: '80%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: draggingFieldIndex === index ? 'grabbing' : 'grab',
                    pointerEvents: 'auto',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: draggingFieldIndex === index ? 'rgba(59,130,246,0.12)' : 'transparent',
                  }}
                >
                  {previewValues[field.key] || fieldLabels[field.key] || field.key}
                </div>
              ))}
            </div>
          </Card>
          <Table
            scroll={{ x: 'max-content' }}
            columns={templateFieldColumns}
            dataSource={templateFields}
            rowKey="key"
            size="small"
            pagination={false}
            loading={templateLoading}
          />
        </Space>
      </Modal>
    </div>
  );
}
