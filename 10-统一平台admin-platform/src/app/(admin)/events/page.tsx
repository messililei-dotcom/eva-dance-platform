'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import { Table } from '@/components/adaptive-table';
import {
  AuditOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { eventApi } from '@/lib/api';
import { sortableColumns } from '@/lib/table-sort';

const statusColor: Record<string, string> = {
  draft: 'default',
  published: 'green',
  offline: 'red',
  finished: 'blue',
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  active: 'green',
};

const statusText: Record<string, string> = {
  draft: '草稿',
  published: '已上架',
  offline: '已下架',
  finished: '已结束',
  open: '开放报名',
  closed: '关闭报名',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  active: '启用',
};

function tag(value: string) {
  return <Tag color={statusColor[value] || 'default'}>{statusText[value] || value}</Tag>;
}

export default function EventsPage() {
  const { message } = App.useApp();
  const [tab, setTab] = useState('competitions');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);
  const [competitionModal, setCompetitionModal] = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [judgeModal, setJudgeModal] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<any>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [competitionForm] = Form.useForm();
  const [playerForm] = Form.useForm();
  const [judgeForm] = Form.useForm();
  const competitionCoverUrl = Form.useWatch('coverUrl', competitionForm);

  const selectedCompetitionId = competitions[0]?.id;

  const load = async () => {
    setLoading(true);
    try {
      const [competitionRows, playerRows, judgeRows, verifyData] = await Promise.all([
        eventApi.listCompetitions({ keyword }),
        eventApi.listPlayers({ keyword }),
        eventApi.listJudges({ keyword }),
        eventApi.verifyData(),
      ]);
      setCompetitions(competitionRows);
      setPlayers(playerRows);
      setJudges(judgeRows);
      setVerify(verifyData);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载赛事数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCompetition = (row?: any) => {
    setEditingCompetition(row || null);
    competitionForm.resetFields();
    if (row) {
      competitionForm.setFieldsValue({
        ...row,
        dateRange: row.startDate ? [dayjs(row.startDate), row.endDate ? dayjs(row.endDate) : dayjs(row.startDate)] : undefined,
      });
    } else {
      competitionForm.setFieldsValue({ status: 'draft', organizer: '伊娃东方舞', coverUrl: '' });
    }
    setCompetitionModal(true);
  };

  const saveCompetition = async () => {
    const values = await competitionForm.validateFields();
    const payload = {
      ...values,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || '',
      registrationStart: editingCompetition?.registrationStart || '',
      registrationEnd: editingCompetition?.registrationEnd || '',
      registrationStatus: editingCompetition?.registrationStatus || 'closed',
      maxPlayers: editingCompetition?.maxPlayers || 0,
    };
    delete payload.dateRange;
    if (editingCompetition) {
      await eventApi.updateCompetition(editingCompetition.id, payload);
    } else {
      await eventApi.createCompetition(payload);
    }
    message.success('赛事已保存');
    setCompetitionModal(false);
    load();
  };

  const uploadCompetitionCover = async ({ file, onSuccess, onError }: any) => {
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('competitionName', String(competitionForm.getFieldValue('name') || '赛事封面'));
      const result = await eventApi.uploadCompetitionCover(formData);
      competitionForm.setFieldValue('coverUrl', String(result?.coverUrl || ''));
      message.success('赛事封面已上传，点击确定后保存');
      onSuccess?.(result);
    } catch (err: any) {
      const error = new Error(err?.response?.data?.error || err?.message || '赛事封面上传失败');
      message.error(error.message);
      onError?.(error);
    } finally {
      setCoverUploading(false);
    }
  };

  const savePlayer = async () => {
    const values = await playerForm.validateFields();
    await eventApi.createPlayer(values);
    message.success('报名记录已创建');
    setPlayerModal(false);
    playerForm.resetFields();
    load();
  };

  const saveJudge = async () => {
    const values = await judgeForm.validateFields();
    await eventApi.createJudge(values);
    message.success('评委已创建');
    setJudgeModal(false);
    judgeForm.resetFields();
    load();
  };

  const stats = useMemo(() => {
    const active = competitions.filter((item) => item.status === 'published').length;
    const approved = players.filter((item) => item.auditStatus === 'approved').length;
    return { active, approved };
  }, [competitions, players]);

  const competitionColumns = sortableColumns<any>([
    {
      title: '赛事',
      dataIndex: 'name',
      width: 260,
      render: (value: string, row: any) => (
        <Space direction="vertical" size={0}>
          <Link href={`/events/${row.id}`}><TrophyOutlined style={{ color: '#d97706', marginRight: 6 }} />{value}</Link>
          <span style={{ color: '#6b7280', fontSize: 12 }}>{row.code}</span>
        </Space>
      ),
    },
    { title: '日期', dataIndex: 'startDate', width: 130, render: (_: string, row: any) => row.endDate ? `${row.startDate} 至 ${row.endDate}` : row.startDate || '-' },
    { title: '地点', dataIndex: 'location', width: 160, render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: tag },
    { title: '报名', dataIndex: 'registrationStatus', width: 100, render: tag },
    { title: '组别', dataIndex: 'groupCount', width: 80 },
    { title: '选手', dataIndex: 'playerCount', width: 80 },
    { title: '评委', dataIndex: 'judgeCount', width: 80 },
    {
      title: '操作',
      width: 220,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => openCompetition(row)}>编辑</Button>
          <Button size="small" onClick={async () => {
            await eventApi.patchCompetition(row.id, { action: row.status === 'published' ? 'unpublish' : 'publish' });
            message.success(row.status === 'published' ? '赛事已下架' : '赛事已上架');
            load();
          }}>{row.status === 'published' ? '下架' : '上架'}</Button>
          <Link href={`/events/${row.id}`}>管理</Link>
        </Space>
      ),
    },
  ]);

  const playerColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 150, render: (v: string, row: any) => <Link href={`/events/players/${row.id}`}>{v}</Link> },
    { title: '编号', dataIndex: 'playerNo', width: 100, render: (v: string) => v || '-' },
    { title: '赛事', dataIndex: 'competitionName', width: 190 },
    { title: '组别', dataIndex: 'groupName', width: 160, render: (v: string) => v || '-' },
    { title: '机构/课程顾问', width: 170, render: (_: any, row: any) => row.organization || row.teacher || '-' },
    { title: '审核', dataIndex: 'auditStatus', width: 90, render: tag },
    { title: '缴费', dataIndex: 'paidStatus', width: 90, render: tag },
    { title: '评分', dataIndex: 'scoreStatus', width: 110, render: tag },
    {
      title: '操作',
      width: 150,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={async () => {
            await eventApi.auditPlayer(row.id, 'approved');
            message.success('报名已通过');
            load();
          }}>通过</Button>
          <Link href={`/events/players/${row.id}`}>详情</Link>
        </Space>
      ),
    },
  ]);

  const judgeColumns = sortableColumns<any>([
    { title: '评委', dataIndex: 'name', width: 150, render: (v: string, row: any) => <Link href={`/events/judges/${row.id}`}>{v}</Link> },
    { title: '头衔', dataIndex: 'title', width: 140, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 180, render: (v: string) => v || '-' },
    { title: '授权', dataIndex: 'authEnabled', width: 90, render: (v: boolean) => v ? <Tag color="green">已授权</Tag> : <Tag>未授权</Tag> },
    { title: '分配组别', dataIndex: 'assignedGroupCount', width: 100 },
    { title: '评分记录', dataIndex: 'scoreCount', width: 100 },
    {
      title: '操作',
      width: 150,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={async () => {
            await eventApi.patchJudge(row.id, { action: row.authEnabled ? 'disableAuth' : 'enableAuth' });
            message.success(row.authEnabled ? '已关闭授权' : '已开启授权');
            load();
          }}>{row.authEnabled ? '停权' : '授权'}</Button>
          <Link href={`/events/judges/${row.id}`}>详情</Link>
        </Space>
      ),
    },
  ]);

  const issueColumns = [
    { title: '类型', dataIndex: 'type', width: 220 },
    { title: '记录ID', dataIndex: 'id', width: 100 },
    { title: '对象', dataIndex: 'label' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>赛事管理</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="赛事" value={competitions.length} prefix={<TrophyOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="上架赛事" value={stats.active} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="报名选手" value={players.length} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="评委" value={judges.length} prefix={<UserSwitchOutlined />} /></Card></Col>
      </Row>

      <Card
        size="small"
        title={<Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'competitions', label: `赛事 (${competitions.length})` },
          { key: 'players', label: `报名 (${players.length})` },
          { key: 'judges', label: `评委 (${judges.length})` },
          { key: 'verify', label: `数据核验 (${verify?.issues?.length || 0})` },
        ]} />}
        extra={<Space wrap>
          <Input
            placeholder="搜索赛事、选手、评委"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={load}
            allowClear
            style={{ width: 220 }}
          />
          <Button icon={<DatabaseOutlined />} onClick={load}>刷新/核验</Button>
          {tab === 'competitions' && <Button type="primary" icon={<PlusOutlined />} onClick={() => openCompetition()}>新建赛事</Button>}
          {tab === 'players' && <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            playerForm.resetFields();
            playerForm.setFieldsValue({ competitionId: selectedCompetitionId, auditStatus: 'pending', paidStatus: 'unpaid' });
            setPlayerModal(true);
          }}>新增报名</Button>}
          {tab === 'judges' && <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            judgeForm.resetFields();
            judgeForm.setFieldsValue({ status: 'active', authEnabled: false });
            setJudgeModal(true);
          }}>新增评委</Button>}
        </Space>}
      >
        {tab === 'competitions' && <Table loading={loading} columns={competitionColumns} dataSource={competitions} scroll={{ x: 1200 }} />}
        {tab === 'players' && <Table loading={loading} columns={playerColumns} dataSource={players} scroll={{ x: 1200 }} />}
        {tab === 'judges' && <Table loading={loading} columns={judgeColumns} dataSource={judges} scroll={{ x: 1000 }} />}
        {tab === 'verify' && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Row gutter={[12, 12]}>
              {Object.entries(verify?.counts || {}).map(([key, value]) => (
                <Col xs={12} md={6} xl={4} key={key}>
                  <Card size="small"><Statistic title={key.replace('event_', '')} value={Number(value)} /></Card>
                </Col>
              ))}
            </Row>
            <Table rowKey={(row: any) => `${row.type}-${row.id}`} columns={issueColumns} dataSource={verify?.issues || []} pagination={{ pageSize: 10 }} scroll={{ x: 'max-content' }} />
          </Space>
        )}
      </Card>

      <Modal title={editingCompetition ? '编辑赛事' : '新建赛事'} open={competitionModal} onCancel={() => setCompetitionModal(false)} onOk={saveCompetition} width={760} confirmLoading={coverUploading}>
        <Form form={competitionForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={16} sm={16}><Form.Item name="name" label="赛事名称" rules={[{ required: true, message: '请填写赛事名称' }]}><Input /></Form.Item></Col>
            <Col xs={8} sm={8}><Form.Item name="code" label="赛事编码"><Input placeholder="自动生成" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}><Form.Item name="dateRange" label="比赛日期"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="coverUrl" hidden><Input /></Form.Item>
          <Form.Item label="赛事封面主图" extra="4:3 横版，支持 JPG、PNG、WebP，不超过 8MB。点击图片可上传替换。">
            <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} customRequest={uploadCompetitionCover} disabled={coverUploading}>
              <div style={{ width: 320, maxWidth: '100%', aspectRatio: '4 / 3', border: '1px dashed #d9d9d9', borderRadius: 10, overflow: 'hidden', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: coverUploading ? 'wait' : 'pointer' }}>
                {competitionCoverUrl ? <img src={competitionCoverUrl} alt="赛事封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                  <Space direction="vertical" align="center" size={6} style={{ color: '#8c8c8c' }}><PlusOutlined style={{ fontSize: 26 }} /><span>{coverUploading ? '正在上传…' : '点击上传 4:3 横版封面'}</span></Space>
                )}
              </div>
            </Upload>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="location" label="地点"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="organizer" label="主办方"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12}><Form.Item name="registrationFee" label="报名费"><InputNumber min={0} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12}><Form.Item name="status" label="赛事状态"><Select options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '上架' }, { value: 'offline', label: '下架' }, { value: 'finished', label: '结束' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="赛事说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增报名" open={playerModal} onCancel={() => setPlayerModal(false)} onOk={savePlayer} width={660}>
        <Form form={playerForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="competitionId" label="赛事" rules={[{ required: true }]}><Select options={competitions.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="playerNo" label="选手编号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="name" label="选手姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="phone" label="手机号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="organization" label="机构"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="teacher" label="课程顾问"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="auditStatus" label="审核状态"><Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }]} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="paidStatus" label="缴费状态"><Select options={[{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增评委" open={judgeModal} onCancel={() => setJudgeModal(false)} onOk={saveJudge} width={620}>
        <Form form={judgeForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="name" label="评委姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="phone" label="手机号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="title" label="头衔"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="organization" label="机构"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="status" label="状态"><Select options={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '停用' }]} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="authEnabled" label="评分授权"><Select options={[{ value: true, label: '开启' }, { value: false, label: '关闭' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="bio" label="简介"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
