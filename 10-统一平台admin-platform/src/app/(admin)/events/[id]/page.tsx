'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import readXlsxFile from 'read-excel-file/browser';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  TeamOutlined,
  TrophyOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { eventApi } from '@/lib/api';
import { sortableColumns } from '@/lib/table-sort';

const statusText: Record<string, string> = {
  approved: '已通过',
  pending: '待审核',
  rejected: '已驳回',
  paid: '已缴费',
  unpaid: '未缴费',
  draft: '草稿',
  submitted: '已提交',
  reviewed: '已复核',
  published: '已公示',
  voided: '已作废',
  scored: '已评分',
  in_progress: '评分中',
  not_started: '未评分',
};

function statusTag(value: string, danger = false) {
  const color = danger ? 'red' : value === 'approved' || value === 'paid' || value === 'published' || value === 'scored' ? 'green' : value === 'rejected' || value === 'voided' ? 'red' : 'orange';
  return <Tag color={color}>{statusText[value] || value || '-'}</Tag>;
}

function lockTag(value: string) {
  return value === 'locked' ? <Tag color="red">已锁定</Tag> : <Tag color="green">可评分</Tag>;
}

function rowsToObjects(rows: unknown[][]) {
  const headers = (rows[0] || []).map((item) => String(item ?? '').trim());
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => headers.reduce<Record<string, unknown>>((obj, header, index) => {
      if (header) obj[header] = row[index] ?? '';
      return obj;
    }, {}));
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const competitionId = Number(params.id);
  const { message, modal } = App.useApp();
  const [competition, setCompetition] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [publishLogs, setPublishLogs] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [scoreModal, setScoreModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [groupForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [playerForm] = Form.useForm();
  const [scoreForm] = Form.useForm();

  const selectedGroup = groups.find((item) => item.id === selectedGroupId);
  const groupPlayers = useMemo(() => players.filter((item) => item.groupId === selectedGroupId), [players, selectedGroupId]);
  const assignedJudgeIds = useMemo(() => new Set(scores.filter((item) => item.groupId === selectedGroupId).map((item) => item.judgeId)), [scores, selectedGroupId]);
  const abnormalScores = useMemo(() => scores.filter((item) => item.isAbnormal || item.scoreStatus === 'voided'), [scores]);

  const loadBoard = async (groupId?: number | null) => {
    if (!groupId) {
      setScores([]);
      setRankings([]);
      setPublishLogs([]);
      return;
    }
    setBoardLoading(true);
    try {
      const [scoreRows, resultData] = await Promise.all([
        eventApi.listScores({ competitionId, groupId }),
        eventApi.getResults({ competitionId, groupId }),
      ]);
      setScores(scoreRows);
      setRankings(resultData.rankings || []);
      setPublishLogs(resultData.logs || []);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载评分结果失败');
    } finally {
      setBoardLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [detail, groupRows, playerRows, judgeRows, ruleRows] = await Promise.all([
        eventApi.getCompetition(competitionId),
        eventApi.listGroups({ competitionId }),
        eventApi.listPlayers({ competitionId }),
        eventApi.listJudges(),
        eventApi.listScoreRules({ competitionId }),
      ]);
      setCompetition(detail);
      setGroups(groupRows);
      setPlayers(playerRows);
      setJudges(judgeRows);
      setRules(ruleRows);
      const nextGroupId = selectedGroupId && groupRows.some((item: any) => item.id === selectedGroupId) ? selectedGroupId : groupRows[0]?.id || null;
      setSelectedGroupId(nextGroupId);
      await loadBoard(nextGroupId);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载赛事详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  const saveGroup = async () => {
    const values = await groupForm.validateFields();
    await eventApi.createGroup({ ...values, competitionId });
    message.success('组别已创建');
    setGroupModal(false);
    groupForm.resetFields();
    load();
  };

  const saveRule = async () => {
    const values = await ruleForm.validateFields();
    await eventApi.createScoreRule({
      ...values,
      competitionId,
      criteria: [
        { name: '技术', score: Number(values.technicalScore || 40) },
        { name: '表现', score: Number(values.performanceScore || 40) },
        { name: '编排', score: Number(values.compositionScore || 20) },
      ],
    });
    message.success('评分规则已创建');
    setRuleModal(false);
    ruleForm.resetFields();
    load();
  };

  const saveAssignment = async () => {
    const values = await assignForm.validateFields();
    await eventApi.assignJudge({ ...values, competitionId });
    message.success('评委已分配');
    setAssignModal(false);
    assignForm.resetFields();
    load();
  };

  const openPlayer = (row?: any) => {
    setEditingPlayer(row || null);
    playerForm.resetFields();
    playerForm.setFieldsValue(row ? {
      ...row,
      groupId: row.groupId || selectedGroupId,
    } : {
      competitionId,
      groupId: selectedGroupId,
      auditStatus: 'pending',
      paidStatus: 'unpaid',
      status: 'pending',
    });
    setPlayerModal(true);
  };

  const savePlayer = async () => {
    const values = await playerForm.validateFields();
    if (editingPlayer) {
      await eventApi.updatePlayer(editingPlayer.id, { ...editingPlayer, ...values, competitionId });
      message.success('报名信息已修正');
    } else {
      await eventApi.createPlayer({ ...values, competitionId });
      message.success('报名记录已创建');
    }
    setPlayerModal(false);
    setEditingPlayer(null);
    playerForm.resetFields();
    load();
  };

  const openScore = (player?: any) => {
    scoreForm.resetFields();
    scoreForm.setFieldsValue({
      groupId: selectedGroupId,
      playerId: player?.id,
      scoreStatus: 'submitted',
      overrideLocked: false,
      overrideAudit: false,
      overrideAuth: false,
    });
    setScoreModal(true);
  };

  const saveScore = async () => {
    const values = await scoreForm.validateFields();
    await eventApi.submitScore(values);
    message.success('评分已保存并重算排名');
    setScoreModal(false);
    scoreForm.resetFields();
    load();
  };

  const parseGroupFile = async (file: File) => {
    try {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.csv')) {
        message.error('仅支持 .xlsx 或 .csv 文件');
        return Upload.LIST_IGNORE;
      }
      const rawRows = (lowerName.endsWith('.csv') ? parseCsv(await file.text()) : await readXlsxFile(file)) as unknown[][];
      const rows = rowsToObjects(rawRows);
      setImportRows(rows);
      message.success(`已读取 ${rows.length} 行组别数据`);
    } catch (err: any) {
      message.error(err?.message || '读取文件失败');
    }
    return false;
  };

  const importGroups = async () => {
    if (!importRows.length) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    const result = await eventApi.importGroups({ competitionId, rows: importRows });
    message.success(`导入完成：新增 ${result.created}，更新 ${result.updated}，错误 ${result.errors.length}`);
    setImportModal(false);
    setImportRows([]);
    load();
  };

  const publishResults = (action: 'publish' | 'unpublish') => {
    if (!selectedGroupId) return;
    modal.confirm({
      title: action === 'publish' ? '确认公示当前组别结果？' : '确认撤回当前组别公示？',
      content: action === 'publish' ? '公示后会锁定该组评分；如需改分，可撤回后修正并重新公示。' : '撤回后该组评分会解锁，公示分将清空。',
      onOk: async () => {
        if (action === 'publish') await eventApi.publishResults(selectedGroupId);
        else await eventApi.unpublishResults(selectedGroupId);
        message.success(action === 'publish' ? '结果已公示' : '公示已撤回');
        load();
      },
    });
  };

  const groupColumns = sortableColumns<any>([
    { title: '组别', dataIndex: 'name', width: 170 },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: string) => v || '-' },
    { title: '舞种', dataIndex: 'danceType', width: 120, render: (v: string) => v || '-' },
    { title: '评分规则', dataIndex: 'scoreRuleName', width: 160, render: (v: string) => v || '-' },
    { title: '评分状态', dataIndex: 'scoringStatus', width: 100, render: lockTag },
    { title: '选手', dataIndex: 'playerCount', width: 80 },
    { title: '评委', dataIndex: 'judgeCount', width: 80 },
    {
      title: '操作',
      width: 190,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedGroupId(row.id); loadBoard(row.id); }}>进入</Button>
          <Button size="small" icon={row.scoringStatus === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={async () => {
            await eventApi.patchGroup(row.id, { action: row.scoringStatus === 'locked' ? 'unlockScoring' : 'lockScoring' });
            message.success(row.scoringStatus === 'locked' ? '已解锁评分' : '已锁定评分');
            load();
          }}>{row.scoringStatus === 'locked' ? '解锁' : '锁定'}</Button>
        </Space>
      ),
    },
  ]);

  const playerColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 130, render: (v: string, row: any) => <Link href={`/events/players/${row.id}`}>{v}</Link> },
    { title: '编号', dataIndex: 'playerNo', width: 90, render: (v: string) => v || '-' },
    { title: '组别', dataIndex: 'groupName', width: 150, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 150, render: (v: string) => v || '-' },
    { title: '审核', dataIndex: 'auditStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '缴费', dataIndex: 'paidStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '评分', dataIndex: 'scoreStatus', width: 100, render: (v: string) => statusTag(v) },
    { title: '进度', width: 90, render: (_: any, row: any) => `${row.scoreCount || 0}/${row.judgeCount || 0}` },
    {
      title: '处理',
      width: 240,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => openPlayer(row)}>修正</Button>
          <Button size="small" icon={<AuditOutlined />} onClick={async () => {
            await eventApi.auditPlayer(row.id, row.auditStatus === 'approved' ? 'rejected' : 'approved');
            message.success(row.auditStatus === 'approved' ? '报名已驳回' : '报名已通过');
            load();
          }}>{row.auditStatus === 'approved' ? '驳回' : '通过'}</Button>
          <Button size="small" type="primary" onClick={() => openScore(row)}>录分</Button>
        </Space>
      ),
    },
  ]);

  const scoreColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'playerName', width: 130 },
    { title: '编号', dataIndex: 'playerNo', width: 90, render: (v: string) => v || '-' },
    { title: '评委', dataIndex: 'judgeName', width: 120 },
    { title: '分数', dataIndex: 'calculatedScore', width: 90 },
    { title: '状态', dataIndex: 'scoreStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '版本', dataIndex: 'version', width: 70 },
    { title: '异常', dataIndex: 'isAbnormal', width: 100, render: (v: boolean, row: any) => v ? statusTag('异常', true) : row.scoreStatus === 'voided' ? statusTag('voided') : <Tag>正常</Tag> },
    { title: '说明', dataIndex: 'abnormalReason', width: 240, render: (v: string) => v || '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 190, render: (v: string) => v || '-' },
  ]);

  const rankingColumns = sortableColumns<any>([
    { title: '名次', dataIndex: 'rankNo', width: 80 },
    { title: '选手', dataIndex: 'playerName', width: 140 },
    { title: '编号', dataIndex: 'playerNo', width: 90, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 160, render: (v: string) => v || '-' },
    { title: '总分', dataIndex: 'calculatedTotal', width: 90 },
    { title: '公示分', dataIndex: 'publishedTotal', width: 90, render: (v: number | null) => v ?? '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => statusTag(v) },
    { title: '评分/评委', width: 100, render: (_: any, row: any) => `${row.scoreCount || 0}/${row.judgeCount || 0}` },
    { title: '异常', dataIndex: 'abnormalCount', width: 80, render: (v: number) => v ? <Tag color="red">{v}</Tag> : <Tag>0</Tag> },
  ]);

  const ruleColumns = sortableColumns<any>([
    { title: '规则', dataIndex: 'name', width: 180 },
    { title: '总分', dataIndex: 'totalScore', width: 80 },
    { title: '去高低分', dataIndex: 'dropHighLow', width: 100, render: (v: boolean) => v ? '是' : '否' },
    { title: '异常阈值', dataIndex: 'abnormalThreshold', width: 100 },
    { title: '发布模式', dataIndex: 'publishMode', width: 160 },
  ]);

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Link href="/events">赛事管理</Link>
        <span>/</span>
        <strong>{competition?.name || '赛事详情'}</strong>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}>
          <Card size="small" title={competition?.name || '赛事详情'} loading={loading}>
            <p style={{ margin: '0 0 8px', color: '#6b7280' }}>{competition?.code} · {competition?.location || '未填写地点'}</p>
            <Space wrap>
              <Tag color={competition?.status === 'published' ? 'green' : 'default'}>{competition?.status || '-'}</Tag>
              <Tag>{competition?.registrationStatus || '-'}</Tag>
              {selectedGroup && lockTag(selectedGroup.scoringStatus)}
            </Space>
          </Card>
        </Col>
        <Col xs={8} lg={4}><Card size="small"><Statistic title="组别" value={groups.length} prefix={<TrophyOutlined />} /></Card></Col>
        <Col xs={8} lg={4}><Card size="small"><Statistic title="选手" value={players.length} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={8} lg={3}><Card size="small"><Statistic title="评委" value={competition?.judgeCount || 0} prefix={<UserSwitchOutlined />} /></Card></Col>
        <Col xs={24} lg={3}><Card size="small"><Statistic title="异常/作废分" value={abnormalScores.length} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: abnormalScores.length ? '#dc2626' : '#16a34a' }} /></Card></Col>
      </Row>

      <Card
        size="small"
        extra={<Space wrap>
          <Select
            placeholder="选择组别"
            value={selectedGroupId || undefined}
            style={{ width: 220 }}
            options={groups.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => { setSelectedGroupId(value); loadBoard(value); }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<FileExcelOutlined />} onClick={() => setImportModal(true)}>导入组别</Button>
          <Button icon={<PlusOutlined />} onClick={() => { groupForm.resetFields(); groupForm.setFieldsValue({ entryType: 'solo', scoringStatus: 'unlocked', status: 'active' }); setGroupModal(true); }}>新建组别</Button>
          <Button icon={<PlusOutlined />} onClick={() => { ruleForm.resetFields(); ruleForm.setFieldsValue({ totalScore: 100, dropHighLow: true, abnormalThreshold: 15, technicalScore: 40, performanceScore: 40, compositionScore: 20 }); setRuleModal(true); }}>评分规则</Button>
          <Button type="primary" icon={<UserSwitchOutlined />} onClick={() => { assignForm.resetFields(); assignForm.setFieldsValue({ groupId: selectedGroupId, weight: 1, authEnabled: true }); setAssignModal(true); }}>分配评委</Button>
        </Space>}
      >
        <Tabs items={[
          { key: 'groups', label: `组别 (${groups.length})`, children: <Table loading={loading} columns={groupColumns} dataSource={groups} scroll={{ x: 1000 }} /> },
          { key: 'players', label: `报名 (${players.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openPlayer()}>新增报名</Button>
              <Table loading={loading} columns={playerColumns} dataSource={players} scroll={{ x: 1200 }} />
            </Space>
          ) },
          { key: 'scoring', label: `评分 (${scores.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert type="info" showIcon message={`当前组别：${selectedGroup?.name || '未选择'}。改分会生成新版本，旧分自动作废并保留审计记录。`} />
              <Space wrap>
                <Button type="primary" icon={<SendOutlined />} disabled={!selectedGroupId} onClick={() => openScore()}>录入/修正评分</Button>
                <Button icon={<CheckCircleOutlined />} disabled={!selectedGroupId} onClick={async () => {
                  await eventApi.recalculateResults(selectedGroupId!);
                  message.success('成绩已重算');
                  loadBoard(selectedGroupId);
                }}>重算当前组成绩</Button>
              </Space>
              <Table loading={boardLoading} columns={scoreColumns} dataSource={scores} scroll={{ x: 1100 }} />
            </Space>
          ) },
          { key: 'results', label: `结果公示 (${rankings.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space wrap>
                <Button icon={<CheckCircleOutlined />} disabled={!selectedGroupId} onClick={async () => {
                  await eventApi.recalculateResults(selectedGroupId!);
                  message.success('成绩已重算');
                  loadBoard(selectedGroupId);
                }}>重算成绩</Button>
                <Button type="primary" icon={<SendOutlined />} disabled={!selectedGroupId || !rankings.length} onClick={() => publishResults('publish')}>公示结果</Button>
                <Button danger icon={<UnlockOutlined />} disabled={!selectedGroupId} onClick={() => publishResults('unpublish')}>撤回公示</Button>
              </Space>
              <Table loading={boardLoading} columns={rankingColumns} dataSource={rankings} scroll={{ x: 1000 }} />
              <Table
                size="small"
                title={() => '公示日志'}
                rowKey="id"
                dataSource={publishLogs}
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: '动作', dataIndex: 'action', width: 110 },
                  { title: '组别', dataIndex: 'group_name', width: 160 },
                  { title: '操作人', dataIndex: 'operator', width: 120 },
                  { title: '时间', dataIndex: 'created_at', width: 190 },
                ]}
              />
            </Space>
          ) },
          { key: 'issues', label: `异常处理 (${abnormalScores.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert type="warning" showIcon message="异常分、作废分会保留在这里，点击对应选手重新录分即可修正；排名只取最新有效分。" />
              <Table loading={boardLoading} columns={scoreColumns} dataSource={abnormalScores} scroll={{ x: 1100 }} />
            </Space>
          ) },
          { key: 'rules', label: `评分规则 (${rules.length})`, children: <Table loading={loading} columns={ruleColumns} dataSource={rules} scroll={{ x: 'max-content' }} /> },
        ]} />
      </Card>

      <Modal title="新建组别" open={groupModal} onCancel={() => setGroupModal(false)} onOk={saveGroup} width={620}>
        <Form form={groupForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="组别名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="category" label="类别"><Input placeholder="个人/团体/公开组" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="danceType" label="舞种"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="ageRange" label="年龄段"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="sortOrder" label="排序"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="maxPlayers" label="人数上限"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="scoreRuleId" label="评分规则"><Select allowClear options={rules.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="导入组别" open={importModal} onCancel={() => setImportModal(false)} onOk={importGroups} width={680}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="支持列名：组别名称、编码、类别、年龄段、舞种、参赛形式、排序、人数上限、评分规则ID。编码相同会更新，避免重复导入。" />
          <Upload.Dragger accept=".xlsx,.csv" beforeUpload={parseGroupFile} maxCount={1}>
            <p className="ant-upload-drag-icon"><FileExcelOutlined /></p>
            <p className="ant-upload-text">点击或拖入 Excel/CSV 文件</p>
          </Upload.Dragger>
          <Table size="small" rowKey={(_, index) => String(index)} dataSource={importRows.slice(0, 8)} pagination={false} scroll={{ x: 'max-content' }} columns={Object.keys(importRows[0] || {}).map((key) => ({ title: key, dataIndex: key }))} />
        </Space>
      </Modal>

      <Modal title="新建评分规则" open={ruleModal} onCancel={() => setRuleModal(false)} onOk={saveRule} width={620}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="technicalScore" label="技术分"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="performanceScore" label="表现分"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="compositionScore" label="编排分"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="totalScore" label="总分"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="abnormalThreshold" label="异常阈值"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="dropHighLow" label="去高低分"><Select options={[{ value: true, label: '开启' }, { value: false, label: '关闭' }]} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="分配评委到组别" open={assignModal} onCancel={() => setAssignModal(false)} onOk={saveAssignment} width={560}>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select options={groups.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Form.Item name="judgeId" label="评委" rules={[{ required: true }]}><Select options={judges.map((item) => ({ value: item.id, label: `${item.name}${assignedJudgeIds.has(item.id) ? '（已有评分）' : ''}` }))} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="weight" label="权重" initialValue={1}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="authEnabled" label="评分授权" initialValue={true}><Select options={[{ value: true, label: '开启' }, { value: false, label: '关闭' }]} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={editingPlayer ? '修正报名' : '新增报名'} open={playerModal} onCancel={() => setPlayerModal(false)} onOk={savePlayer} width={680}>
        <Form form={playerForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select options={groups.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="playerNo" label="选手编号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="选手姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="手机号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="organization" label="机构"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="teacher" label="课程顾问"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="auditStatus" label="审核状态"><Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="paidStatus" label="缴费状态"><Select options={[{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="scoreStatus" label="评分状态"><Select options={[{ value: 'not_started', label: '未评分' }, { value: 'in_progress', label: '评分中' }, { value: 'scored', label: '已评分' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="remark" label="错误/修正备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="录入/修正评分" open={scoreModal} onCancel={() => setScoreModal(false)} onOk={saveScore} width={680}>
        <Form form={scoreForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select options={groups.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="playerId" label="选手" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={groupPlayers.map((item) => ({ value: item.id, label: `${item.playerNo || '-'} ${item.name}` }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="judgeId" label="评委" rules={[{ required: true }]}><Select options={judges.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="rawScore" label="总分" rules={[{ required: true }]}><InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="scoreStatus" label="状态"><Select options={[{ value: 'submitted', label: '提交' }, { value: 'reviewed', label: '复核' }, { value: 'draft', label: '草稿' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="reason" label="修正原因"><Input placeholder="改分时必填更清楚" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="overrideLocked" label="锁定后修正"><Select options={[{ value: false, label: '不允许' }, { value: true, label: '允许' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="overrideAudit" label="未审核评分"><Select options={[{ value: false, label: '不允许' }, { value: true, label: '允许' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="overrideAuth" label="未授权评分"><Select options={[{ value: false, label: '不允许' }, { value: true, label: '允许' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="abnormalReason" label="异常说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
