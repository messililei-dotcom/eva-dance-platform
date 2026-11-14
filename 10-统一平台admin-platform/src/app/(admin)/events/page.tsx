'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import styles from './events.module.css';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Upload,
} from 'antd';
import {
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
import { api, eventApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isPlatformSuperAdmin } from '@/lib/admin-feature-access';
import { sortableColumns } from '@/lib/table-sort';

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
  const { user } = useAuth();
  const canAssignAdmin = isPlatformSuperAdmin(user);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState(false);
  useEffect(() => {
    if (!canAssignAdmin) return;
    let active = true;
    setAdminUsersLoading(true);
    api.get('/users').then(({ data }) => {
      if (!data.success || !Array.isArray(data.data)) throw new Error('加载失败');
      if (active) { setAdminUsers(data.data.filter((item: any) => item.status === 'active' && (item.role === 'event_admin' || isPlatformSuperAdmin(item)))); setAdminUsersError(false); }
    }).catch(() => { if (active) setAdminUsersError(true); })
      .finally(() => { if (active) setAdminUsersLoading(false); });
    return () => { active = false; };
  }, [canAssignAdmin]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const loadVersion = useRef(0);
  const [loaded, setLoaded] = useState({ competitions: false, players: false, judges: false });
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [competitionPageSize, setCompetitionPageSize] = useState(10);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [judges, setJudges] = useState<any[]>([]);
  const [competitionModal, setCompetitionModal] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<any>(null);
  const [judgePublicUpdatingId, setJudgePublicUpdatingId] = useState<number | string | null>(null);
  const [publicUpdatingId, setPublicUpdatingId] = useState<number | string | null>(null);
  const [registrationUpdatingId, setRegistrationUpdatingId] = useState<number | string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [competitionForm] = Form.useForm();
  const competitionCoverUrl = Form.useWatch('coverUrl', competitionForm);

  const load = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    const results = await Promise.allSettled([
      eventApi.listCompetitions({ keyword }),
      eventApi.listPlayersPage({ page: 1, pageSize: 1 }),
      eventApi.listJudges(),
    ]);
    if (version !== loadVersion.current) return;
    const [competitionResult, playerResult, judgeResult] = results;
    if (competitionResult.status === 'fulfilled') setCompetitions(competitionResult.value);
    if (playerResult.status === 'fulfilled') setPlayerTotal(playerResult.value.total);
    if (judgeResult.status === 'fulfilled') setJudges(judgeResult.value);
    setLoaded({
      competitions: competitionResult.status === 'fulfilled',
      players: playerResult.status === 'fulfilled',
      judges: judgeResult.status === 'fulfilled',
    });
    const labels = ['赛事', '报名', '评委'];
    setLoadErrors(results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : []));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        adminUserIds: row.adminUserIds || (row.ownerUserId ? [row.ownerUserId] : []),
        dateRange: row.startDate ? [dayjs(row.startDate), row.endDate ? dayjs(row.endDate) : dayjs(row.startDate)] : undefined,

      });
    } else {
      competitionForm.setFieldsValue({
        organizer: '伊娃东方舞',
        coverUrl: '',
      });
    }
    setCompetitionModal(true);
  };

  const saveCompetition = async () => {
    const values = await competitionForm.validateFields();
    const payload = {
      ...(canAssignAdmin && values.adminUserIds !== undefined ? { adminUserIds: values.adminUserIds } : {}),
      name: values.name,
      code: values.code,
      coverUrl: values.coverUrl,
      location: values.location,
      organizer: values.organizer,
      description: values.description,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD') || '',
    };
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
      message.success(next ? '评委姓名和分数已向公众公开' : '公众评委姓名和分数已隐藏；选手仍可匿名查看自己的评分详情');
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '评委评分公开状态更新失败');
    } finally { setJudgePublicUpdatingId(null); }
  };

  const competitionColumns = sortableColumns<any>([
    {
      title: '赛事',
      dataIndex: 'name',
      width: 180,
      fixed: 'left',
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
      title: '评委信息公开', dataIndex: 'judgeScoresPublic', width: 110,
      render: (value: boolean, row: any) => (
        <Switch size="small" checked={value === true} checkedChildren="公开" unCheckedChildren="关闭"
          loading={judgePublicUpdatingId === row.id} disabled={judgePublicUpdatingId !== null}
          aria-label={`${row.name}评委姓名及分数公开开关，当前${value ? '公开' : '关闭'}`}
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

  return (
    <div className={styles.page}>
      <h2 style={{ marginBottom: 16, color: '#1f2937' }}>赛事管理</h2>

      <Card size="small" className={styles.summary} styles={{ body: { padding: '12px 16px' } }}>
        <div className={styles.summaryGrid}>
          {[
            { label: '赛事', value: loaded.competitions ? competitions.length.toLocaleString() : '—', icon: <TrophyOutlined /> },
            { label: '报名选手', value: loaded.players ? playerTotal.toLocaleString() : '—', icon: <TeamOutlined /> },
            { label: '评委', value: loaded.judges ? judges.length.toLocaleString() : '—', icon: <UserSwitchOutlined /> },
          ].map((item) => (
            <div key={item.label} className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{item.icon}{item.label}</span>
              <strong className={styles.summaryValue}>{item.value}</strong>
            </div>
          ))}
        </div>
      </Card>
      {loadErrors.length > 0 && <Alert
        className={styles.error}
        type="error"
        showIcon
        message={`${loadErrors.join('、')}数据加载失败，请重试`}
        description="已成功加载的内容仍可查看。"
        action={<Button size="small" loading={loading} onClick={() => load()}>重试</Button>}
      />}

      <Card
        size="small"
        className={styles.list}
      >
        <div className={styles.toolbar}>
          <Input
            placeholder="搜索赛事"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => load()}
            allowClear
            className={styles.search}
          />
          <Button icon={<DatabaseOutlined />} loading={loading} onClick={() => load()}>刷新</Button>
          <Button icon={<DownloadOutlined />} loading={transferLoading} onClick={exportAll}>导出全部</Button>
          {canAssignAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => openCompetition()}>新建赛事</Button>}
        </div>
        <Table
          loading={loading}
          columns={competitionColumns}
          dataSource={displayCompetitions}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: competitionPageSize, showSizeChanger: false }}
        />
      </Card>

      <Modal title={editingCompetition ? '编辑赛事' : '新建赛事'} open={competitionModal} onCancel={() => setCompetitionModal(false)} onOk={saveCompetition} width={800} centered confirmLoading={coverUploading} styles={{body:{maxHeight:'72vh',overflowY:'auto',overflowX:'hidden',paddingRight:4}}}>
        <Form form={competitionForm} layout="vertical" style={{marginTop:16}}>
          <Form.Item name="coverUrl" hidden><Input /></Form.Item>
          <Row gutter={24}>
            <Col xs={24} sm={8}>
              <Form.Item label="赛事封面主图" extra="4:3 横版 · JPG / PNG / WebP · 8MB以内">
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              customRequest={uploadCompetitionCover}
              disabled={coverUploading}
            >
              <div style={{
                width: 220,
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
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="赛事名称" rules={[{required:true,whitespace:true,message:'请填写赛事名称'}]}><Input placeholder="填写赛事名称" /></Form.Item>
              <Form.Item name="code" label="赛事编码"><Input placeholder="留空自动生成" /></Form.Item>
              <Form.Item name="dateRange" label="比赛日期"><DatePicker.RangePicker style={{width:'100%'}} /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="location" label="地点"><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="organizer" label="主办方"><Input /></Form.Item></Col>
          </Row>
          {canAssignAdmin && <Form.Item name="adminUserIds" label="赛事管理员" extra={adminUsersError ? '管理员用户加载失败，请刷新页面重试' : '支持多选，可搜索姓名或账号。仅超级管理员可以添加或移除赛事管理员。'}>
            <Select mode="multiple" showSearch allowClear optionFilterProp="label" loading={adminUsersLoading} disabled={adminUsersLoading || adminUsersError} placeholder="搜索并选择赛事管理员，可多选" options={adminUsers.map(item => ({ value: item.id, label: `${item.name || item.username}（${item.username}）` }))} />
          </Form.Item>}
          <Form.Item name="description" label="赛事说明"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
