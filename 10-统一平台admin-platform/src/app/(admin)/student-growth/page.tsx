'use client';

import { useEffect, useState } from 'react';
import { App, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Statistic, Tabs, Tag, Typography } from 'antd';
import { AuditOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { adminTablePagination } from '@/lib/table-sort';
import { Table } from '@/components/adaptive-table';

const { Text, Title } = Typography;
const levelColors: Record<number, string> = { 1: 'default', 2: 'blue', 3: 'purple', 4: 'magenta', 5: 'gold' };
const experienceRules = [
  { key: 'offline-purchase', source: '线下课程购买', points: '实付 1 元 = 1 点', condition: '仅统计已支付记录，退款或撤销后自动冲正' },
  { key: 'online-purchase', source: '线上课程授权', points: '计价 1 元 = 1 点', condition: '按每条有效授权独立计算，失效或撤销后自动冲正' },
  { key: 'offline-checkin', source: '线下课时核销', points: '10 点 / 课时', condition: '核销数量变更时按差额自动校正' },
  { key: 'online-lesson', source: '线上有效课节', points: '1 点 / 课节', condition: '首次达到有效完成标准时计入' },
  { key: 'online-course', source: '整门线上课程', points: '2 点 / 门', condition: '已发布课节完成率达到 90% 时首次计入' },
  { key: 'streak-7', source: '连续有效学习 7 天', points: '奖励 10 点', condition: '同一连续学习周期只奖励一次' },
  { key: 'streak-30', source: '连续有效学习 30 天', points: '奖励 50 点', condition: '同一连续学习周期只奖励一次' },
];
const levelRules = [
  { key: 1, level: '初舞学员 Lv.1', range: '0–999 点' },
  { key: 2, level: '律动学员 Lv.2', range: '1,000–4,999 点' },
  { key: 3, level: '舞韵学员 Lv.3', range: '5,000–14,999 点' },
  { key: 4, level: '资深舞者 Lv.4', range: '15,000–39,999 点' },
  { key: 5, level: '卓越舞者 Lv.5', range: '40,000 点及以上' },
];

type GrowthRow = Record<string, any> & { id: number; name: string; phone: string; experience_total: number; level_no: number; level_name: string };

export default function StudentGrowthPage() {
  const { message, modal } = App.useApp();
  const [adjustForm] = Form.useForm();
  const [academyForm] = Form.useForm();
  const [rows, setRows] = useState<GrowthRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [summary, setSummary] = useState({ total: 0, experience: 0, learning: 0, top: 0 });
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState(0);
  const [selected, setSelected] = useState<GrowthRow | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get('/student-growth', { params: { page, pageSize, keyword: debouncedKeyword, level } });
      setRows(response.data?.data || []);
      setTotal(Number(response.data?.total || 0));
      setSummary(response.data?.summary || { total: 0, experience: 0, learning: 0, top: 0 });
    } catch (error: any) {
      message.error(error?.response?.data?.error || '成长档案加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);
  useEffect(() => { load(); }, [page, pageSize, debouncedKeyword, level]);

  const openDetail = async (row: GrowthRow) => {
    setSelected(row);
    setDetail(null);
    try {
      const response = await api.get(`/student-growth/${row.id}`);
      setDetail(response.data?.data || null);
    } catch {
      message.error('成长明细加载失败');
    }
  };

  const refreshDetail = async () => {
    if (!selected) return;
    await openDetail(selected);
    await load();
  };

  const submitAdjustment = async () => {
    if (!selected) return;
    const values = await adjustForm.validateFields();
    setSaving(true);
    try {
      await api.post(`/student-growth/${selected.id}/adjust`, values);
      message.success('经验调整已记入流水，等级已自动重算');
      setAdjustOpen(false);
      adjustForm.resetFields();
      await refreshDetail();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '经验调整失败');
    } finally { setSaving(false); }
  };

  const submitAcademyStart = async () => {
    if (!selected) return;
    const values = await academyForm.validateFields();
    setSaving(true);
    try {
      await api.post(`/student-growth/${selected.id}/academy-start`, {
        ...values, started_at: values.started_at.format('YYYY-MM-DD'),
      });
      message.success('学院舞龄补录完成，审计记录已保存');
      setAcademyOpen(false);
      academyForm.resetFields();
      await refreshDetail();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '学院舞龄补录失败');
    } finally { setSaving(false); }
  };

  const runBackfill = async (apply: boolean) => {
    const execute = async () => {
      const response = await api.post('/student-growth/backfill', { apply });
      const report = response.data?.data || {};
      modal.info({
        title: apply ? '历史回算完成' : '历史回算预览',
        width: 560,
        content: `学员 ${report.memberCount || 0} 人；预计事件 ${report.plannedEvents || 0} 条；预计经验 ${report.plannedPoints || 0} 点；本次新增流水 ${report.insertedEvents || 0} 条；异常 ${(report.errors || []).length} 条。`,
      });
      if (apply) await load();
    };
    if (!apply) return execute();
    modal.confirm({ title: '执行正式历史回算？', content: '脚本具备幂等性；执行前仍应确认生产数据库已完成快照备份。', okText: '已备份，开始回算', onOk: execute });
  };

  const growth = detail?.growth || selected || {};

  return <div>
    <div className="page-header">
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col><Title level={2}>学员成长体系</Title><Text type="secondary">等级只读，由有效经验流水自动计算；线上消费按有效授权记录逐条统计。</Text></Col>
        <Col><Space wrap><Button icon={<AuditOutlined />} onClick={() => setRulesOpen(true)}>经验点规则</Button><Button onClick={() => runBackfill(false)}>回算预览</Button><Button onClick={() => runBackfill(true)}>历史回算</Button><Button icon={<ReloadOutlined />} onClick={load}>刷新</Button></Space></Col>
      </Row>
    </div>
    <Card className="student-growth-summary-card">
      <Row>
        {[
          { title: '成长档案', value: summary.total, suffix: '人', prefix: <TrophyOutlined /> },
          { title: '有效经验', value: summary.experience, suffix: '点' },
          { title: '已有学习记录', value: summary.learning, suffix: '人' },
          { title: '卓越舞者', value: summary.top, suffix: '人' },
        ].map(item => <Col xs={12} md={6} key={item.title} className="student-growth-summary-item">
          <Statistic {...item} />
        </Col>)}
      </Row>
    </Card>
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}><Input allowClear prefix={<SearchOutlined />} placeholder="搜索姓名、手机号或学员 ID" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} /></Col>
        <Col xs={24} md={6}><Select style={{ width: '100%' }} value={level} onChange={value => { setLevel(value); setPage(1); }} options={[{ value: 0, label: '全部等级' }, ...[1,2,3,4,5].map(no => ({ value: no, label: `Lv.${no}` }))]} /></Col>
      </Row>
    </Card>
    <Card styles={{ body: { padding: 0 } }}>
      <Table rowKey="id" loading={loading} dataSource={rows} pagination={adminTablePagination({ current: page, pageSize, total, showTotal: value => `共 ${value} 位学员`, onChange: (nextPage, nextSize) => { setPage(nextSize === pageSize ? nextPage : 1); setPageSize(nextSize || 20); } })} locale={{ emptyText: <Empty description="暂无成长档案" /> }} onRow={record => ({ onClick: () => openDetail(record), style: { cursor: 'pointer' } })} columns={[
        { title: '学员', dataIndex: 'name', render: (_: any, row: GrowthRow) => <div><Text strong>{row.name}</Text><br/><Text type="secondary">{row.phone || `ID ${row.id}`}</Text></div> },
        { title: '自动等级', render: (_: any, row: GrowthRow) => <Tag color={levelColors[Number(row.level_no || 1)]}>{row.level_name || '初舞学员'} Lv.{row.level_no || 1}</Tag> },
        { title: '舞蹈经验', dataIndex: 'experience_total', align: 'right' as const, render: (value: number) => <Text strong>{Number(value || 0).toLocaleString()} 点</Text> },
        { title: '学院舞龄', render: (_: any, row: GrowthRow) => row.academy_age?.text || '尚未开始' },
        { title: '线上消费', dataIndex: 'online_authorized_courses', align: 'right' as const, render: (value: number) => `${value || 0} 条授权` },
        { title: '线上课节', dataIndex: 'online_completed_lessons', align: 'right' as const },
        { title: '线下课时', dataIndex: 'offline_completed_hours', align: 'right' as const },
        { title: '累计学习', dataIndex: 'total_learning_days', align: 'right' as const, render: (value: number) => `${value || 0} 天` },
        { title: '最近学习', dataIndex: 'last_learning_at', render: (value: string) => value || '-' },
      ]} />
    </Card>

    <Drawer title={selected ? `${selected.name} · 成长档案` : '成长档案'} width={760} open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} extra={<Space><Button onClick={() => setAcademyOpen(true)}>补录舞龄</Button><Button type="primary" onClick={() => setAdjustOpen(true)}>调整经验</Button></Space>}>
      {!detail ? <Text type="secondary">加载中…</Text> : <>
        <Card style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="自动等级"><Tag color={levelColors[growth.level_no]}>{growth.level_display}</Tag></Descriptions.Item>
            <Descriptions.Item label="有效经验">{Number(growth.experience_total || 0).toLocaleString()} 点</Descriptions.Item>
            <Descriptions.Item label="学院舞龄">{growth.academy_age?.text || '尚未开始'}</Descriptions.Item>
            <Descriptions.Item label="起始日期">{growth.academy_started_at || '-'}</Descriptions.Item>
            <Descriptions.Item label="线上消费">{growth.online_authorized_courses || 0} 条授权</Descriptions.Item>
            <Descriptions.Item label="线上课节">{growth.online_completed_lessons || 0}</Descriptions.Item>
            <Descriptions.Item label="线下课时">{growth.offline_completed_hours || 0}</Descriptions.Item>
            <Descriptions.Item label="累计学习">{growth.total_learning_days || 0} 天</Descriptions.Item>
          </Descriptions>
          <Progress percent={growth.level_progress_percent || 0} status="active" format={() => growth.is_max_level ? '最高等级' : `距 ${growth.next_level_name} ${growth.points_to_next_level} 点`} />
        </Card>
        <Tabs items={[
          { key: 'ledger', label: `经验流水 ${detail.ledger?.length || 0}`, children: <Table size="small" rowKey="id" dataSource={detail.ledger || []} pagination={{ pageSize: 10 }} columns={[
            { title: '时间', dataIndex: 'occurred_at', width: 150 }, { title: '来源', dataIndex: 'description' },
            { title: '经验', dataIndex: 'points_delta', width: 86, align: 'right' as const, render: (value: number) => <Text type={value < 0 ? 'danger' : 'success'}>{value > 0 ? '+' : ''}{value}</Text> },
            { title: '操作人', dataIndex: 'operator_id', width: 100, render: (value: string) => value || '系统' },
          ]} /> },
          { key: 'level', label: `等级历史 ${detail.level_history?.length || 0}`, children: <Table size="small" rowKey="id" dataSource={detail.level_history || []} pagination={false} columns={[
            { title: '时间', dataIndex: 'created_at' }, { title: '变更', render: (_: any, row: any) => `Lv.${row.old_level} → Lv.${row.new_level}` }, { title: '当时经验', dataIndex: 'experience_total' }, { title: '原因', dataIndex: 'change_reason' },
          ]} /> },
          { key: 'academy', label: `舞龄审计 ${detail.academy_audit?.length || 0}`, children: <Table size="small" rowKey="id" dataSource={detail.academy_audit || []} pagination={false} columns={[
            { title: '时间', dataIndex: 'created_at' }, { title: '补录日期', dataIndex: 'new_started_at' }, { title: '依据', dataIndex: 'evidence' }, { title: '原因', dataIndex: 'reason' }, { title: '操作人', dataIndex: 'operator_id' },
          ]} /> },
        ]} />
      </>}
    </Drawer>

    <Modal title="人工调整经验" open={adjustOpen} onCancel={() => setAdjustOpen(false)} onOk={submitAdjustment} confirmLoading={saving} okText="写入经验流水">
      <Form form={adjustForm} layout="vertical"><Form.Item name="points" label="经验增减" rules={[{ required: true, message: '请输入经验值' }]}><InputNumber style={{ width: '100%' }} precision={0} placeholder="正数增加，负数扣减" /></Form.Item><Form.Item name="reason" label="操作原因" rules={[{ required: true, message: '必须填写操作原因' }]}><Input.TextArea rows={3} maxLength={300} /></Form.Item></Form>
    </Modal>
    <Modal title="补录学院舞龄" open={academyOpen} onCancel={() => setAcademyOpen(false)} onOk={submitAcademyStart} confirmLoading={saving} okText="保存并审计">
      <Form form={academyForm} layout="vertical" initialValues={{ source: 'admin' }}><Form.Item name="started_at" label="起始日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} maxDate={dayjs()} /></Form.Item><Form.Item name="source" label="来源" rules={[{ required: true }]}><Select options={[{ value: 'admin', label: '管理员补录' }, { value: 'imported', label: '历史导入/推定' }]} /></Form.Item><Form.Item name="evidence" label="补录依据" rules={[{ required: true }]}><Input.TextArea rows={2} maxLength={300} /></Form.Item><Form.Item name="reason" label="操作原因" rules={[{ required: true }]}><Input.TextArea rows={2} maxLength={300} /></Form.Item></Form>
    </Modal>
    <Modal title="经验点规则" open={rulesOpen} onCancel={() => setRulesOpen(false)} footer={<Button type="primary" onClick={() => setRulesOpen(false)}>我知道了</Button>} width={760}>
      <Text type="secondary">经验由有效业务记录自动累计，同一来源不会重复计分；退款、撤销或失效时会自动冲正。</Text>
      <Title level={5} style={{ marginTop: 20 }}>经验获取</Title>
      <Table size="small" rowKey="key" dataSource={experienceRules} pagination={false} columns={[
        { title: '来源', dataIndex: 'source', width: 180 },
        { title: '经验点', dataIndex: 'points', width: 150 },
        { title: '有效条件', dataIndex: 'condition' },
      ]} />
      <Title level={5} style={{ marginTop: 20 }}>等级门槛</Title>
      <Table size="small" rowKey="key" dataSource={levelRules} pagination={false} columns={[
        { title: '自动等级', dataIndex: 'level' },
        { title: '有效经验', dataIndex: 'range' },
      ]} />
      <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>人工调整必须填写原因，并会完整保留在经验流水中。等级始终根据当前有效经验自动计算。</Text>
    </Modal>
  </div>;
}
