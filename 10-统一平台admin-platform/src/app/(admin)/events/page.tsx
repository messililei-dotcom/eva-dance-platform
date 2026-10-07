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
  Switch,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import {
  AuditOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Table } from '@/components/adaptive-table';
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

function getCompetitionStage(row: any) {
  const eventDate = row.endDate || row.startDate;
  const hasFinished = eventDate && dayjs(eventDate).isValid() && dayjs(eventDate).endOf('day').isBefore(dayjs());
  return hasFinished ? 'finished' : 'ongoing';
}

const competitionStageText: Record<string, string> = {
  ongoing: '火热进行中',
  finished: '圆满结束',
};

export default function EventsPage() {
  const { message } = App.useApp();
  const [tab, setTab] = useState('competitions');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [competitionPageSize, setCompetitionPageSize] = useState(10);
  const [players, setPlayers] = useState<any[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [playerPage, setPlayerPage] = useState(1);
  const [playerPageSize, setPlayerPageSize] = useState(20);
  const [judges, setJudges] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);
  const [verifyPage, setVerifyPage] = useState(1);
  const [verifyPageSize, setVerifyPageSize] = useState(20);
  const [competitionModal, setCompetitionModal] = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [judgeModal, setJudgeModal] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<any>(null);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [editingJudge, setEditingJudge] = useState<any>(null);
  const [judgePublicUpdatingId, setJudgePublicUpdatingId] = useState<number | string | null>(null);
  const [publicUpdatingId, setPublicUpdatingId] = useState<number | string | null>(null);
  const [registrationUpdatingId, setRegistrationUpdatingId] = useState<number | string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [competitionForm] = Form.useForm();
  const [playerForm] = Form.useForm();
  const [judgeForm] = Form.useForm();
  const competitionCoverUrl = Form.useWatch('coverUrl', competitionForm);

  const selectedCompetitionId = competitions[0]?.id;

  const load = async (nextPlayerPage = playerPage, nextPlayerPageSize = playerPageSize) => {
    setLoading(true);
    try {
      const [competitionRows, playerResult, judgeRows] = await Promise.all([
        eventApi.listCompetitions({ keyword }),
        eventApi.listPlayersPage({ keyword, page: nextPlayerPage, pageSize: nextPlayerPageSize }),
        eventApi.listJudges({ keyword }),
      ]);
      setCompetitions(competitionRows);
      setPlayers(playerResult.data);
      setPlayerTotal(playerResult.total);
      setPlayerPage(playerResult.page);
      setPlayerPageSize(playerResult.pageSize);
      setJudges(judgeRows);
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

  const loadVerify = async (page = verifyPage, pageSize = verifyPageSize) => {
    setLoading(true);
    try {
      const data = await eventApi.verifyData({ page, pageSize });
      setVerify(data);
      setVerifyPage(Number(data.page || page));
      setVerifyPageSize(Number(data.pageSize || pageSize));
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '数据核验失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'verify' && !verify) void loadVerify(1, verifyPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const updateCompetitionPageSize = () => {
      if (window.innerWidth < 769) {
        setCompetitionPageSize(10);
        return;
      }
      const availableTableHeight = Math.max(360, window.innerHeight - 390);
      setCompetitionPageSize(Math.max(10, Math.ceil(availableTableHeight / 44)));
    };
    updateCompetitionPageSize();
    window.addEventListener('resize', updateCompetitionPageSize);
    return () => window.removeEventListener('resize', updateCompetitionPageSize);
  }, []);

  const openCompetition = (row?: any) => {
    setEditingCompetition(row || null);
    competitionForm.resetFields();
    if (row) {
      competitionForm.setFieldsValue({
        ...row,
        dateRange: row.startDate ? [dayjs(row.startDate), row.endDate ? dayjs(row.endDate) : dayjs(row.startDate)] : undefined,
        registrationRange: row.registrationStart ? [
          dayjs(row.registrationStart),
          row.registrationEnd ? dayjs(row.registrationEnd) : dayjs(row.registrationStart),
        ] : undefined,
      });
    } else {
      competitionForm.setFieldsValue({
        organizer: '伊娃东方舞',
        coverUrl: '',
        registrationStatus: 'closed',
        registrationPublic: false,
        judgeScoresPublic: false,
        maxPlayers: 0,
        registrationFee: 0,
      });
    }
    setCompetitionModal(true);
  };

  const saveCompetition = async () => {
    const values = await competitionForm.validateFields();
    const payload = {
      ...values,
      status: 'published',
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || '',
      registrationStart: values.registrationRange?.[0]?.format('YYYY-MM-DD') || '',
      registrationEnd: values.registrationRange?.[1]?.format('YYYY-MM-DD') || '',
    };
    delete payload.dateRange;
    delete payload.registrationRange;
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
    const image = file as File;
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', image);
      formData.append('competitionName', String(competitionForm.getFieldValue('name') || '赛事封面'));
      const result = await eventApi.uploadCompetitionCover(formData);
      const coverUrl = String(result?.coverUrl || '');
      competitionForm.setFieldValue('coverUrl', coverUrl);
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
    if (editingPlayer) await eventApi.updatePlayer(editingPlayer.id, values);
    else await eventApi.createPlayer(values);
    message.success(editingPlayer ? '报名记录已更新' : '报名记录已创建');
    setPlayerModal(false);
    playerForm.resetFields();
    load();
  };

  const saveJudge = async () => {
    const values = await judgeForm.validateFields();
    if (editingJudge) await eventApi.updateJudge(editingJudge.id, values);
    else await eventApi.createJudge(values);
    message.success(editingJudge ? '评委已更新' : '评委已创建');
    setJudgeModal(false);
    judgeForm.resetFields();
    load();
  };

  const exportAll = async () => {
    setTransferLoading(true);
    try {
      const payload = await eventApi.exportData();
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `赛事全量数据-${dayjs().format('YYYY-MM-DD')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success('赛事全量数据已导出');
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '导出失败');
    } finally {
      setTransferLoading(false);
    }
  };

  const displayCompetitions = useMemo(
    () => competitions.map((item) => ({ ...item, competitionStage: getCompetitionStage(item) })),
    [competitions],
  );

  const toggleRegistration = async (row: any) => {
    if (registrationUpdatingId !== null) return;
    const shouldOpen = row.registrationStatus !== 'open';
    setRegistrationUpdatingId(row.id);
    try {
      await eventApi.patchCompetition(row.id, { action: shouldOpen ? 'openRegistration' : 'closeRegistration' });
      setCompetitions((current) => current.map((item) => (
        item.id === row.id ? { ...item, registrationStatus: shouldOpen ? 'open' : 'closed' } : item
      )));
      message.success(shouldOpen ? '报名已开启' : '报名已关闭');
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '报名状态更新失败');
    } finally {
      setRegistrationUpdatingId(null);
    }
  };

  const toggleRegistrationPublic = async (row: any) => {
    if (publicUpdatingId !== null) return;
    const next = !row.registrationPublic;
    setPublicUpdatingId(row.id);
    try {
      await eventApi.patchCompetition(row.id, { action: next ? 'showRegistration' : 'hideRegistration' });
      setCompetitions(current => current.map(item => item.id === row.id ? { ...item, registrationPublic: next } : item));
      message.success(next ? '报名信息已公开，所有人可查看各组别报名人数及参赛名单' : '报名信息已关闭公开，公众无法查看报名人数及未公示的参赛名单');
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '报名信息公开状态更新失败');
    } finally { setPublicUpdatingId(null); }
  };

  const toggleJudgeScoresPublic = async (row: any) => {
    if (judgePublicUpdatingId !== null) return;
    const next = !row.judgeScoresPublic;
    setJudgePublicUpdatingId(row.id);
    try {
      await eventApi.patchCompetition(row.id, { action: next ? 'showJudgeScores' : 'hideJudgeScores' });
      setCompetitions(current => current.map(item => item.id === row.id ? { ...item, judgeScoresPublic: next } : item));
      message.success(next ? '评委分数已公开' : '评委分数已隐藏，公众仅可查看姓名及***');
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '评委评分公开状态更新失败');
    } finally { setJudgePublicUpdatingId(null); }
  };

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
    {
      title: '日期',
      dataIndex: 'startDate',
      width: 130,
      render: (_: string, row: any) => {
        const startDate = row.startDate && dayjs(row.startDate).isValid() ? dayjs(row.startDate).format('YYYY-MM-DD') : '';
        const endDate = row.endDate && dayjs(row.endDate).isValid() ? dayjs(row.endDate).format('YYYY-MM-DD') : '';
        return endDate ? `${startDate} 至 ${endDate}` : startDate || '-';
      },
    },
    { title: '地点', dataIndex: 'location', width: 160, render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'competitionStage',
      width: 110,
      render: (value: string) => (
        <Tag color={value === 'ongoing' ? 'magenta' : 'green'}>{competitionStageText[value]}</Tag>
      ),
    },
    {
      title: '开放报名',
      dataIndex: 'registrationStatus',
      width: 80,
      render: (value: string, row: any) => {
        const updating = registrationUpdatingId === row.id;
        return (
          <Switch
            size="small"
            checked={value === 'open'}
            loading={updating}
            disabled={updating}
            aria-label={`${row.name}报名开关，当前${value === 'open' ? '开启' : '关闭'}`}
            onChange={() => toggleRegistration(row)}
            style={value === 'open' ? { backgroundColor: '#52c41a' } : undefined}
          />
        );
      },
    },
    {
      title: '报名信息', dataIndex: 'registrationPublic', width: 130,
      render: (value: boolean, row: any) => (
        <Switch size="small" checked={value === true} checkedChildren="公开" unCheckedChildren="关闭"
          loading={publicUpdatingId === row.id} disabled={publicUpdatingId !== null}
          aria-label={`${row.name}报名信息公开开关，当前${value ? '公开' : '关闭'}`}
          onChange={() => toggleRegistrationPublic(row)} />
      ),
    },
    {
      title: '评委评分', dataIndex: 'judgeScoresPublic', width: 110,
      render: (value: boolean, row: any) => (
        <Switch size="small" checked={value === true} checkedChildren="公开" unCheckedChildren="关闭"
          loading={judgePublicUpdatingId === row.id} disabled={judgePublicUpdatingId !== null}
          aria-label={`${row.name}评委评分公开开关，当前${value ? '公开' : '关闭'}`}
          onChange={() => toggleJudgeScoresPublic(row)} />
      ),
    },
    { title: '组别', dataIndex: 'groupCount', width: 80 },
    { title: '选手', dataIndex: 'playerCount', width: 80 },
    { title: '评委', dataIndex: 'judgeCount', width: 80 },
    {
      title: '操作',
      width: 190,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => openCompetition(row)}>编辑</Button>
          <Link href={`/events/${row.id}`}><Button size="small" icon={<SettingOutlined />}>管理</Button></Link>
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
          <Button size="small" onClick={() => {
            setEditingPlayer(row);
            playerForm.setFieldsValue(row);
            setPlayerModal(true);
          }}>编辑</Button>
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
          <Button size="small" onClick={() => {
            setEditingJudge(row);
            judgeForm.setFieldsValue(row);
            setJudgeModal(true);
          }}>编辑</Button>
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

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[0, 8]}>
          {[
            { label: '赛事', value: competitions.length, icon: <TrophyOutlined /> },
            { label: '报名选手', value: playerTotal, icon: <TeamOutlined /> },
            { label: '评委', value: judges.length, icon: <UserSwitchOutlined /> },
          ].map((item, index) => (
            <Col key={item.label} xs={24} md={8} style={{ borderLeft: index ? '1px solid #f0f0f0' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 28 }}>
                <span style={{ color: '#8c8c8c' }}>{item.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#17233d', fontSize: 22 }}>
                  {item.icon}<strong style={{ fontWeight: 500 }}>{item.value.toLocaleString()}</strong>
                </span>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        size="small"
        title={<Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'competitions', label: `赛事 (${competitions.length})` },
          { key: 'players', label: `报名 (${playerTotal})` },
          { key: 'judges', label: `评委 (${judges.length})` },
          { key: 'verify', label: `数据核验 (${verify?.total || 0})` },
        ]} />}
        extra={<Space wrap>
          <Input
            placeholder="搜索赛事、选手、评委"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => {
              setPlayerPage(1);
              load(1, playerPageSize);
            }}
            allowClear
            style={{ width: 220 }}
          />
          <Button icon={<DatabaseOutlined />} onClick={() => tab === 'verify' ? loadVerify() : load()}>刷新{tab === 'verify' ? '/核验' : ''}</Button>
          <Button icon={<DownloadOutlined />} loading={transferLoading} onClick={exportAll}>导出全部</Button>
          {tab === 'competitions' && <Button type="primary" icon={<PlusOutlined />} onClick={() => openCompetition()}>新建赛事</Button>}
          {tab === 'players' && <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingPlayer(null);
            playerForm.resetFields();
            playerForm.setFieldsValue({ competitionId: selectedCompetitionId, auditStatus: 'pending', paidStatus: 'unpaid' });
            setPlayerModal(true);
          }}>新增报名</Button>}
          {tab === 'judges' && <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingJudge(null);
            judgeForm.resetFields();
            judgeForm.setFieldsValue({ status: 'active', authEnabled: false });
            setJudgeModal(true);
          }}>新增评委</Button>}
        </Space>}
      >
        {tab === 'competitions' && <Table
          loading={loading}
          columns={competitionColumns}
          dataSource={displayCompetitions}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: competitionPageSize, showSizeChanger: false }}
        />}
        {tab === 'players' && <Table
          loading={loading}
          columns={playerColumns}
          dataSource={players}
          scroll={{ x: 1200 }}
          pagination={{
            current: playerPage,
            pageSize: playerPageSize,
            total: playerTotal,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => load(page, pageSize),
          }}
        />}
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
            <Table rowKey={(row: any) => `${row.type}-${row.id}`} loading={loading} columns={issueColumns} dataSource={verify?.issues || []} pagination={{ current: verifyPage, pageSize: verifyPageSize, total: Number(verify?.total || 0), showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: total => `共 ${total} 项`, onChange: (page, pageSize) => loadVerify(page, pageSize) }} scroll={{ x: 'max-content' }} />
          </Space>
        )}
      </Card>

      <Modal title={editingCompetition ? '编辑赛事' : '新建赛事'} open={competitionModal} onCancel={() => setCompetitionModal(false)} onOk={saveCompetition} width={760} confirmLoading={coverUploading}>
        <Form form={competitionForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={16} sm={16}><Form.Item name="name" label="赛事名称" rules={[{ required: true, message: '请填写赛事名称' }]}><Input /></Form.Item></Col>
            <Col xs={8} sm={8}><Form.Item name="code" label="赛事编码"><Input placeholder="自动生成" /></Form.Item></Col>
          </Row>
          <Form.Item name="coverUrl" hidden><Input /></Form.Item>
          <Form.Item label="赛事封面主图" extra="4:3 横版，支持 JPG、PNG、WebP，不超过 8MB。点击图片可上传替换。">
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              customRequest={uploadCompetitionCover}
              disabled={coverUploading}
            >
              <div style={{
                width: 320,
                maxWidth: '100%',
                aspectRatio: '4 / 3',
                border: '1px dashed #d9d9d9',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: coverUploading ? 'wait' : 'pointer',
              }}>
                {competitionCoverUrl ? (
                  <img src={competitionCoverUrl} alt="赛事封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Space direction="vertical" align="center" size={6} style={{ color: '#8c8c8c' }}>
                    <PlusOutlined style={{ fontSize: 26 }} />
                    <span>{coverUploading ? '正在上传…' : '点击上传 4:3 横版封面'}</span>
                  </Space>
                )}
              </div>
            </Upload>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="dateRange" label="比赛日期"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="registrationRange" label="报名日期"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="location" label="地点"><Input /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="organizer" label="主办方"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={6}><Form.Item name="maxPlayers" label="人数上限"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={6}><Form.Item name="registrationFee" label="默认报名费"><InputNumber min={0} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="registrationPublic" label="报名信息公开" valuePropName="checked" extra="公开各组别报名人数和参赛名单；关闭时仅已公示成绩可查看。"><Switch checkedChildren="公开" unCheckedChildren="关闭" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="judgeScoresPublic" label="评委评分" valuePropName="checked" extra="公开每位评委的分数；关闭时保留姓名和头像，分数显示***。"><Switch checkedChildren="公开" unCheckedChildren="关闭" /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="registrationStatus" label="开放报名"><Select options={[{ value: 'open', label: '开放' }, { value: 'closed', label: '关闭' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="赛事说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={editingPlayer ? '编辑报名' : '新增报名'} open={playerModal} onCancel={() => setPlayerModal(false)} onOk={savePlayer} width={660}>
        <Form form={playerForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={12} sm={12}><Form.Item name="competitionId" label="赛事" rules={[{ required: true }]}><Select options={competitions.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col xs={12} sm={12}><Form.Item name="playerNo" label="出场顺序"><Input /></Form.Item></Col>
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

      <Modal title={editingJudge ? '编辑评委' : '新增评委'} open={judgeModal} onCancel={() => setJudgeModal(false)} onOk={saveJudge} width={620}>
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
