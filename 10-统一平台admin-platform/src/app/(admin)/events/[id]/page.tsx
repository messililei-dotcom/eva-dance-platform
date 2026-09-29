'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import readXlsxFile from 'read-excel-file/browser';
import { memberOptionLabel, memberSearchText } from '@/lib/member-search';
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
  Switch,
  Tabs,
  Tag,
  Upload,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  TeamOutlined,
  TrophyOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Table } from '@/components/adaptive-table';
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

function formatFinalScore(value: number | null | undefined, peerValues: Array<number | null | undefined> = []) {
  if (value == null || !Number.isFinite(Number(value))) return '-';
  const numeric = Number(value);
  const roundedToTwo = numeric.toFixed(2);
  const hasTwoDecimalTie = peerValues.filter((item) => (
    item != null && Number.isFinite(Number(item)) && Number(item).toFixed(2) === roundedToTwo
  )).length > 1;
  return numeric.toFixed(hasTwoDecimalTie ? 3 : 2);
}

function ResultGroupCard({ groupName, rows }: { groupName: string; rows: any[] }) {
  const ordered = [...rows].sort((a, b) => Number(a.rankNo || 9999) - Number(b.rankNo || 9999));
  const scores = ordered.map((item) => item.publishedTotal ?? item.calculatedTotal);
  const podium = [ordered[1], ordered[0], ordered[2]];
  const podiumMeta = [
    { label: '亚军', icon: '🏆', trophyFilter: 'grayscale(1) brightness(1.35) contrast(.85)', height: 72, background: 'linear-gradient(180deg,#e7ebf0,#cbd3dd)' },
    { label: '冠军', icon: '🏆', trophyFilter: 'none', height: 96, background: 'linear-gradient(180deg,#ffe08a,#e7b83d)' },
    { label: '季军', icon: '🏆', trophyFilter: 'sepia(1) saturate(2.2) hue-rotate(338deg) brightness(.72)', height: 60, background: 'linear-gradient(180deg,#f4b47a,#d4874a)' },
  ];
  return (
    <Card
      size="small"
      title={<Space><TrophyOutlined style={{ color: '#d4a017' }} /><span>{groupName}</span></Space>}
      extra={<Tag color="magenta">{ordered.length} 位选手</Tag>}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, alignItems: 'end', marginBottom: 16 }}>
        {podium.map((item, index) => (
          <div key={item?.playerId || `empty-${index}`} style={{ minWidth: 0, textAlign: 'center' }}>
            {item ? <>
              <div aria-label={`${podiumMeta[index].label}奖杯`} style={{ fontSize: 28, lineHeight: 1, filter: podiumMeta[index].trophyFilter }}>{podiumMeta[index].icon}</div>
              <div title={item.playerName} style={{ marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{item.playerName}</div>
              <div style={{ color: '#e91e63', fontSize: 17, fontWeight: 800 }}>{formatFinalScore(item.publishedTotal ?? item.calculatedTotal, scores)}</div>
              <div style={{ height: podiumMeta[index].height, marginTop: 7, borderRadius: '8px 8px 0 0', background: podiumMeta[index].background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{podiumMeta[index].label}</div>
            </> : <div style={{ height: 120 }} />}
          </div>
        ))}
      </div>
      {ordered.length > 3 && <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
        {ordered.slice(3).map((item, index) => (
          <div key={item.playerId} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) 80px', gap: 8, alignItems: 'center', padding: '9px 12px', background: index % 2 ? '#fafafa' : '#fff', borderBottom: index < ordered.length - 4 ? '1px solid #f0f0f0' : undefined }}>
            <strong style={{ textAlign: 'center', color: '#6b7280' }}>{item.rankNo}</strong>
            <div style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.playerName}</div><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9ca3af', fontSize: 12 }}>{item.organization || item.playerNo || '-'}</div></div>
            <strong style={{ textAlign: 'right', color: '#e91e63' }}>{formatFinalScore(item.publishedTotal ?? item.calculatedTotal, scores)}</strong>
          </div>
        ))}
      </div>}
    </Card>
  );
}

function summarizeJudgeScores(entries: any[]) {
  const valid = entries.filter((item) => ['submitted', 'reviewed', 'published'].includes(item.scoreStatus));
  const modern = valid
    .filter((item) => !item.criteriaScores?.legacy_user_id)
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  if (modern.length) return modern[0];

  const latestByCriterion = new Map<string, { score: number; version: number }>();
  valid.forEach((item) => {
    Object.entries(item.criteriaScores || {}).forEach(([criterion, value]) => {
      if (criterion === 'legacy_user_id') return;
      const score = Number(value);
      const version = Number(item.version || 0);
      if (!Number.isFinite(score)) return;
      const current = latestByCriterion.get(criterion);
      if (!current || version > current.version) latestByCriterion.set(criterion, { score, version });
    });
  });
  if (!latestByCriterion.size) return null;
  const latest = [...valid].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
  return {
    ...latest,
    calculatedScore: [...latestByCriterion.values()].reduce((sum, item) => sum + item.score, 0),
    versionLabel: `${latestByCriterion.size}项`,
    componentCount: latestByCriterion.size,
  };
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
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [competition, setCompetition] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const memberRequestRef = useRef<Promise<any[]> | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('groups');
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const [adaptivePageSize, setAdaptivePageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [groupJudges, setGroupJudges] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Array<number | string>>([]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<Array<number | string>>([]);
  const [judgeIdsToAssign, setJudgeIdsToAssign] = useState<number[]>([]);
  const [batchPlayerAddModal, setBatchPlayerAddModal] = useState(false);
  const [batchPlayerEditModal, setBatchPlayerEditModal] = useState(false);
  const [batchJudgeEditModal, setBatchJudgeEditModal] = useState(false);
  const [batchPlayerText, setBatchPlayerText] = useState('');
  const [ruleModal, setRuleModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [assignGroupIds, setAssignGroupIds] = useState<number[]>([]);
  const [assignJudgeIds, setAssignJudgeIds] = useState<number[]>([]);
  const [assignGroupSearch, setAssignGroupSearch] = useState('');
  const [assignJudgeSearch, setAssignJudgeSearch] = useState('');
  const [assignGroupSearchOpen, setAssignGroupSearchOpen] = useState(false);
  const [assignJudgeSearchOpen, setAssignJudgeSearchOpen] = useState(false);
  const ignoreNextGroupSearchClear = useRef(false);
  const ignoreNextJudgeSearchClear = useRef(false);
  const ignoreNextGroupDropdownClose = useRef(false);
  const ignoreNextJudgeDropdownClose = useRef(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [scoreModal, setScoreModal] = useState(false);
  const [scoreManageOpen, setScoreManageOpen] = useState(false);
  const [scoreManagePlayer, setScoreManagePlayer] = useState<any>(null);
  const [manualScoreModal, setManualScoreModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [groupForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [playerForm] = Form.useForm();
  const [scoreForm] = Form.useForm();
  const [manualScoreForm] = Form.useForm();
  const [batchPlayerForm] = Form.useForm();
  const [batchJudgeForm] = Form.useForm();

  useEffect(() => {
    const updatePageSize = () => {
      if (window.innerWidth < 769) {
        const mobileHeight = window.innerHeight - 360;
        setAdaptivePageSize(Math.max(10, Math.min(50, Math.floor(mobileHeight / 38))));
        return;
      }
      const desktopRows = Math.ceil((window.innerHeight - 165) / 29);
      setAdaptivePageSize(Math.max(10, Math.min(50, desktopRows)));
    };
    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  const selectedGroup = groups.find((item) => item.id === selectedGroupId);
  const groupPlayers = useMemo(() => players.filter((item) => item.groupId === selectedGroupId), [players, selectedGroupId]);
  const groupSearchOptions = useMemo(() => {
    const playersByGroup = new Map<number, any[]>();
    players.forEach((player) => {
      const groupId = Number(player.groupId);
      playersByGroup.set(groupId, [...(playersByGroup.get(groupId) || []), player]);
    });
    return groups.map((group) => {
      const relatedPlayers = playersByGroup.get(Number(group.id)) || [];
      return {
        value: group.id,
        label: group.name,
        searchText: [
          group.name,
          ...relatedPlayers.flatMap((player) => [
            player.name,
            player.performanceTitle,
            player.phone,
            player.groupName,
          ]),
        ].filter(Boolean).join(' ').toLocaleLowerCase(),
      };
    });
  }, [groups, players]);
  const orderedGroupPlayers = useMemo(() => [...groupPlayers].sort((a, b) => {
    const sequenceA = Number(a.sequenceNo || 0);
    const sequenceB = Number(b.sequenceNo || 0);
    if (sequenceA > 0 && sequenceB > 0 && sequenceA !== sequenceB) return sequenceA - sequenceB;
    if (sequenceA > 0 && sequenceB <= 0) return -1;
    if (sequenceA <= 0 && sequenceB > 0) return 1;
    return Number(a.id) - Number(b.id);
  }), [groupPlayers]);
  const latestScoreByJudge = useMemo(() => {
    const grouped = new Map<number, any[]>();
    scores.filter((item) => Number(item.playerId) === Number(scoreManagePlayer?.id)).forEach((item) => {
      const judgeId = Number(item.judgeId);
      grouped.set(judgeId, [...(grouped.get(judgeId) || []), item]);
    });
    const result = new Map<number, any>();
    grouped.forEach((entries, judgeId) => {
      const summary = summarizeJudgeScores(entries);
      if (summary) result.set(judgeId, summary);
    });
    return result;
  }, [scoreManagePlayer?.id, scores]);
  const playerJudgeScores = useMemo(() => groupJudges.map((judge) => ({
    ...judge,
    score: latestScoreByJudge.get(Number(judge.judgeId)) || null,
  })), [groupJudges, latestScoreByJudge]);
  const abnormalScores = useMemo(() => scores.filter((item) => item.isAbnormal || item.scoreStatus === 'voided'), [scores]);
  const judgeSearchOptions = useMemo(() => {
    const memberById = new Map(members.map((member) => [Number(member.id), member]));
    return judges.map((judge) => {
      const member = memberById.get(Number(judge.memberId));
      const searchText = [
        judge.name,
        judge.phone,
        judge.id,
        `judge:${judge.id}`,
        judge.memberId,
        judge.memberId ? `member:${judge.memberId}` : '',
        member ? memberSearchText(member) : '',
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return { value: judge.id, label: judge.name, searchText };
    });
  }, [judges, members]);
  const competitionRule = useMemo(() => {
    if (!rules.length) return null;
    if (rules.length === 1) return rules[0];
    return {
      ...rules[0],
      name: `${competition?.name || '赛事'}评分规则`,
      totalScore: rules.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) || 10,
      dropHighLow: rules.some((item) => item.dropHighLow),
      abnormalThreshold: Number(rules[0]?.abnormalThreshold || 15),
    };
  }, [competition?.name, rules]);
  const calculatedRankings = useMemo(() => {
    const grouped = new Map<string, any[]>();
    scores.forEach((item) => {
      const key = `${item.playerId}-${item.judgeId}`;
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });
    const judgeSummaries = [...grouped.values()].map(summarizeJudgeScores).filter(Boolean) as any[];
    const totals = orderedGroupPlayers.map((player) => {
      const playerScores = judgeSummaries
        .filter((item) => Number(item.playerId) === Number(player.id))
        .map((item) => ({ score: Number(item.calculatedScore || 0) }))
        .sort((a, b) => a.score - b.score);
      const used = competitionRule?.dropHighLow && playerScores.length >= 6 ? playerScores.slice(1, -1) : playerScores;
      const scoreSum = used.reduce((sum, item) => sum + item.score, 0);
      return {
        playerId: player.id,
        calculatedTotal: used.length ? scoreSum / used.length : 0,
        scoreCount: playerScores.length,
      };
    }).sort((a, b) => b.calculatedTotal - a.calculatedTotal || Number(a.playerId) - Number(b.playerId));
    return totals.map((item, index) => ({ ...item, rankNo: index + 1 }));
  }, [competitionRule?.dropHighLow, orderedGroupPlayers, scores]);
  const rankingByPlayerId = useMemo(() => {
    const result = new Map(rankings.map((item) => [Number(item.playerId), item]));
    calculatedRankings.forEach((item) => {
      if (Number(item.scoreCount || 0) > 0 && !result.has(Number(item.playerId))) result.set(Number(item.playerId), item);
    });
    return result;
  }, [calculatedRankings, rankings]);
  const judgeScoreSummaries = useMemo(() => {
    const grouped = new Map<string, any[]>();
    scores.forEach((item) => {
      const key = `${item.groupId}-${item.playerId}-${item.judgeId}`;
      grouped.set(key, [...(grouped.get(key) || []), item]);
    });
    const groupOrder = new Map(groups.map((item, index) => [Number(item.id), index]));
    return [...grouped.entries()].map(([key, entries]) => {
      const summary = summarizeJudgeScores(entries);
      return summary ? { ...summary, key: `judge-total-${key}` } : null;
    }).filter(Boolean).sort((a: any, b: any) =>
      Number(groupOrder.get(Number(a.groupId)) ?? Number.MAX_SAFE_INTEGER)
        - Number(groupOrder.get(Number(b.groupId)) ?? Number.MAX_SAFE_INTEGER)
      || String(a.playerNo || '').localeCompare(String(b.playerNo || ''), 'zh-CN', { numeric: true })
      || Number(a.playerId) - Number(b.playerId)
      || Number(a.judgeId) - Number(b.judgeId)
    );
  }, [groups, scores]);
  const resultGroups = useMemo(() => {
    const rowsByGroup = new Map<number, any[]>();
    rankings.forEach((item) => {
      const groupId = Number(item.groupId);
      rowsByGroup.set(groupId, [...(rowsByGroup.get(groupId) || []), item]);
    });
    return groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      rows: rowsByGroup.get(Number(group.id)) || [],
    })).filter((group) => group.rows.length > 0);
  }, [groups, rankings]);

  const loadBoard = async (groupId?: number | null) => {
    setBoardLoading(true);
    try {
      const params = groupId ? { competitionId, groupId } : { competitionId };
      const [scoreRows, resultData] = await Promise.all([
        eventApi.listScores(params),
        eventApi.getResults(params),
      ]);
      setScores(scoreRows);
      setRankings(resultData.rankings || []);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载评分结果失败');
    } finally {
      setBoardLoading(false);
    }
  };

  const loadGroupJudges = async (groupId?: number | null) => {
    if (!groupId) {
      setGroupJudges([]);
      return;
    }
    const rows = await eventApi.listGroupJudges({ competitionId, groupId });
    setGroupJudges(rows);
  };

  const ensureEventMembers = () => {
    if (members.length) return Promise.resolve(members);
    if (memberRequestRef.current) return memberRequestRef.current;
    memberRequestRef.current = eventApi.listEventMembers()
      .then((rows) => { setMembers(rows); return rows; })
      .finally(() => { memberRequestRef.current = null; });
    return memberRequestRef.current;
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
      const nextGroupId = selectedGroupId && groupRows.some((item: any) => item.id === selectedGroupId) ? selectedGroupId : null;
      setSelectedGroupId(nextGroupId);
      await Promise.all([loadBoard(nextGroupId), loadGroupJudges(nextGroupId)]);
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

  useEffect(() => {
    if (activeTab !== 'results') return;
    const timer = window.setInterval(() => {
      const element = resultsScrollRef.current;
      if (!element || element.scrollHeight <= element.clientHeight + 2) return;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2) element.scrollTop = 0;
      else element.scrollTop += 1;
    }, 45);
    return () => window.clearInterval(timer);
  }, [activeTab, resultGroups.length]);

  const openGroupEditor = (row?: any) => {
    setEditingGroup(row || null);
    groupForm.resetFields();
    groupForm.setFieldsValue(row ? {
      ...row,
      scoreRuleId: row.scoreRuleId || undefined,
    } : {
      entryType: 'solo',
      registrationFee: 0,
      scoringStatus: 'unlocked',
      status: 'active',
    });
    setGroupModal(true);
  };

  const saveGroup = async () => {
    const values = await groupForm.validateFields();
    if (editingGroup) {
      await eventApi.updateGroup(editingGroup.id, { ...editingGroup, ...values, competitionId });
      message.success('组别已更新');
    } else {
      await eventApi.createGroup({ ...values, competitionId });
      message.success('组别已创建');
    }
    setGroupModal(false);
    setEditingGroup(null);
    groupForm.resetFields();
    load();
  };

  const openGroupManager = async (row: any) => {
    setSelectedGroupId(row.id);
    setSelectedPlayerIds([]);
    setSelectedJudgeIds([]);
    setJudgeIdsToAssign([]);
    setGroupManageOpen(true);
    void ensureEventMembers();
    try {
      await Promise.all([loadBoard(row.id), loadGroupJudges(row.id)]);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载组别管理数据失败');
    }
  };

  const saveRule = async () => {
    const values = await ruleForm.validateFields();
    await eventApi.createScoreRule({
      ...values,
      competitionId,
      criteria: [],
      abnormalThreshold: competitionRule?.abnormalThreshold ?? 15,
    });
    message.success('赛事评分规则已保存，所有组别统一使用');
    setRuleModal(false);
    ruleForm.resetFields();
    load();
  };

  const openRuleEditor = () => {
    ruleForm.resetFields();
    ruleForm.setFieldsValue(competitionRule ? {
      name: competitionRule.name,
      totalScore: competitionRule.totalScore,
      dropHighLow: competitionRule.dropHighLow,
      judgeAnonymous: competitionRule.judgeAnonymous,
    } : {
      name: `${competition?.name || '赛事'}评分规则`,
      totalScore: 10,
      dropHighLow: true,
      judgeAnonymous: false,
    });
    setRuleModal(true);
  };

  const saveAssignment = async () => {
    if (!assignGroupIds.length) {
      message.warning('请至少选择一个组别');
      return;
    }
    if (!assignJudgeIds.length) {
      message.warning('请至少选择一名评委');
      return;
    }
    const values = await assignForm.validateFields();
    const result = await eventApi.assignJudge({ ...values, groupIds: assignGroupIds, judgeIds: assignJudgeIds, competitionId });
    message.success(result.skipped
      ? `新增 ${result.assigned} 条评委分配，已有 ${result.skipped} 条保持不变`
      : `已新增 ${result.assigned} 条评委分配`);
    setAssignModal(false);
    assignForm.resetFields();
    setAssignGroupIds([]);
    setAssignJudgeIds([]);
    setAssignGroupSearch('');
    setAssignJudgeSearch('');
    await load();
  };

  const openPlayer = (row?: any) => {
    void ensureEventMembers();
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

  const randomizePlayerSequence = () => {
    if (!selectedGroupId || !groupPlayers.length) return;
    modal.confirm({
      title: `随机安排“${selectedGroup?.name || '当前组别'}”的出场顺序？`,
      content: `系统将为当前组别 ${groupPlayers.length} 名选手重新随机生成 1 至 ${groupPlayers.length} 的出场顺序，并覆盖原有编排。`,
      okText: '确认随机编排',
      cancelText: '取消',
      onOk: async () => {
        const result = await eventApi.randomizePlayerSequence({ competitionId, groupId: selectedGroupId });
        message.success(`已随机安排 ${result.updated} 名选手的出场顺序`);
        await load();
      },
    });
  };

  const openScore = (player?: any, judge?: any, existingScore?: any) => {
    scoreForm.resetFields();
    scoreForm.setFieldsValue({
      groupId: selectedGroupId,
      playerId: player?.id,
      judgeId: judge?.judgeId ?? existingScore?.judgeId,
      rawScore: existingScore?.calculatedScore,
      scoreStatus: 'submitted',
      reason: existingScore ? '后台修正评分' : undefined,
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
    await load();
  };

  const openPlayerScoreManager = async (player: any) => {
    setScoreManagePlayer(player);
    setSelectedGroupId(player.groupId);
    setScoreManageOpen(true);
    try {
      await Promise.all([loadBoard(player.groupId), loadGroupJudges(player.groupId)]);
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载评委评分失败');
    }
  };

  const calculatePlayerFinalScore = async () => {
    if (!scoreManagePlayer?.groupId) return;
    await eventApi.recalculateResults(scoreManagePlayer.groupId);
    const result = await eventApi.getResults({ competitionId, groupId: scoreManagePlayer.groupId });
    const nextRankings = result.rankings || [];
    setRankings(nextRankings);
    const ranking = nextRankings.find((item: any) => Number(item.playerId) === Number(scoreManagePlayer.id));
    const ignoredCount = playerJudgeScores.filter((item) => !item.score).length;
    message.success(ranking
      ? `已忽略 ${ignoredCount} 名未评分评委，最终得分 ${formatFinalScore(ranking.calculatedTotal, rankings.filter((item) => Number(item.groupId) === Number(scoreManagePlayer.groupId)).map((item) => item.calculatedTotal))}，当前第 ${ranking.rankNo} 名`
      : '已按现有有效评分重新计算');
  };

  const openManualFinalScore = () => {
    if (!scoreManagePlayer?.groupId) return;
    const ranking = rankings.find((item) => Number(item.playerId) === Number(scoreManagePlayer.id));
    manualScoreForm.setFieldsValue({
      finalScore: ranking ? Number(ranking.calculatedTotal) : undefined,
      reason: ranking?.manualReason || '后台直接修改最终得分',
    });
    setManualScoreModal(true);
  };

  const saveManualFinalScore = async () => {
    if (!scoreManagePlayer?.groupId) return;
    const values = await manualScoreForm.validateFields();
    await eventApi.setManualFinalScore({
      groupId: scoreManagePlayer.groupId,
      playerId: scoreManagePlayer.id,
      finalScore: Number(values.finalScore),
      reason: values.reason,
    });
    await loadBoard(scoreManagePlayer.groupId);
    setManualScoreModal(false);
    message.success('最终得分已修改并重新排名');
  };

  const clearManualFinalScore = async () => {
    if (!scoreManagePlayer?.groupId) return;
    await eventApi.clearManualFinalScore({ groupId: scoreManagePlayer.groupId, playerId: scoreManagePlayer.id });
    await loadBoard(scoreManagePlayer.groupId);
    setManualScoreModal(false);
    message.success('已恢复为评委评分计算结果并重新排名');
  };

  const deleteCompetition = () => {
    if (!competition) return;
    modal.confirm({
      title: `确认删除赛事“${competition.name}”？`,
      icon: <ExclamationCircleOutlined />,
      content: `删除后，该赛事下的 ${groups.length} 个组别、${players.length} 条报名及相关评分记录将一并删除，且无法恢复。`,
      okText: '确认删除赛事',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await eventApi.deleteCompetition(competitionId);
        message.success('赛事已删除');
        router.push('/events');
      },
    });
  };

  const addPlayersInBatch = async () => {
    if (!selectedGroupId) return;
    const rows = batchPlayerText.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', phone = '', organization = ''] = line.split(/[,，\t]/).map((item) => item.trim());
        return { name, phone, organization };
      });
    if (!rows.length) {
      message.warning('请至少输入一行选手数据');
      return;
    }
    const result = await eventApi.batchCreatePlayers({ competitionId, groupId: selectedGroupId, rows });
    message.success(`批量新增完成：成功 ${result.created} 条${result.errors?.length ? `，跳过 ${result.errors.length} 条` : ''}`);
    setBatchPlayerAddModal(false);
    setBatchPlayerText('');
    setSelectedPlayerIds([]);
    await load();
  };

  const updatePlayersInBatch = async () => {
    if (!selectedGroupId || !selectedPlayerIds.length) return;
    const values = await batchPlayerForm.validateFields();
    const patch = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
    const result = await eventApi.batchUpdatePlayers({ competitionId, groupId: selectedGroupId, ids: selectedPlayerIds, patch });
    message.success(`已批量修改 ${result.updated} 条报名`);
    setBatchPlayerEditModal(false);
    setSelectedPlayerIds([]);
    batchPlayerForm.resetFields();
    await load();
  };

  const deletePlayersInBatch = (ids = selectedPlayerIds, groupId = selectedGroupId) => {
    if (!groupId || !ids.length) return;
    modal.confirm({
      title: `确认删除 ${ids.length} 条报名？`,
      content: '相关表演、评分和排名记录也会一并删除，此操作无法恢复。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await eventApi.batchDeletePlayers({ competitionId, groupId, ids });
        message.success(`已删除 ${result.deleted} 条报名`);
        setSelectedPlayerIds([]);
        await load();
      },
    });
  };

  const assignJudgesInBatch = async () => {
    if (!selectedGroupId || !judgeIdsToAssign.length) {
      message.warning('请选择需要添加的评委');
      return;
    }
    const result = await eventApi.assignJudge({
      competitionId,
      groupId: selectedGroupId,
      memberIds: judgeIdsToAssign,
      role: 'judge',
      weight: 1,
      authEnabled: true,
      status: 'active',
    });
    message.success(`已添加 ${result.assigned} 名评委`);
    setJudgeIdsToAssign([]);
    await Promise.all([loadGroupJudges(selectedGroupId), load()]);
  };

  const updateJudgesInBatch = async () => {
    if (!selectedGroupId || !selectedJudgeIds.length) return;
    const values = await batchJudgeForm.validateFields();
    const patch = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
    const result = await eventApi.batchUpdateGroupJudges({
      competitionId,
      groupId: selectedGroupId,
      judgeIds: selectedJudgeIds,
      patch,
    });
    message.success(`已批量修改 ${result.updated} 名评委的组内设置`);
    setBatchJudgeEditModal(false);
    setSelectedJudgeIds([]);
    batchJudgeForm.resetFields();
    await loadGroupJudges(selectedGroupId);
  };

  const deleteJudgesInBatch = (judgeIds = selectedJudgeIds) => {
    if (!selectedGroupId || !judgeIds.length) return;
    modal.confirm({
      title: `确认从当前组别移除 ${judgeIds.length} 名评委？`,
      content: '仅解除本组分配，不会删除评委资料；已有评分记录会保留。',
      okText: '确认移除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await eventApi.batchDeleteGroupJudges({ competitionId, groupId: selectedGroupId, judgeIds });
        message.success(`已移除 ${result.deleted} 名评委`);
        setSelectedJudgeIds([]);
        await Promise.all([loadGroupJudges(selectedGroupId), load()]);
      },
    });
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
      content: action === 'publish' ? '公示后会锁定该组评分，并打开可分享的赛事大屏；如需改分，可撤回后修正并重新公示。' : '撤回后该组评分会解锁，公示分将清空。',
      onOk: async () => {
        const screenWindow = action === 'publish' ? window.open('about:blank', '_blank') : null;
        try {
          if (action === 'publish') await eventApi.publishResults(selectedGroupId);
          else await eventApi.unpublishResults(selectedGroupId);
          message.success(action === 'publish' ? '结果已公示，大屏已打开' : '公示已撤回');
          if (screenWindow) screenWindow.location.replace(`https://www.swod.com.cn/event-results/${competitionId}`);
          else if (action === 'publish') window.open(`https://www.swod.com.cn/event-results/${competitionId}`, '_blank', 'noopener,noreferrer');
          load();
        } catch (error) {
          screenWindow?.close();
          throw error;
        }
      },
    });
  };

  const deleteGroup = (row: any) => {
    modal.confirm({
      title: `删除组别“${row.name}”？`,
      content: Number(row.judgeCount || 0) > 0
        ? `该空组别的 ${row.judgeCount} 条评委分配将同时移除，此操作不可撤销。`
        : '此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await eventApi.deleteGroup(row.id);
          if (Number(selectedGroupId) === Number(row.id)) {
            setSelectedGroupId(null);
            await Promise.all([loadBoard(null), loadGroupJudges(null)]);
          }
          const removed = Number(result?.data?.removedJudgeAssignments || 0);
          message.success(removed ? `组别已删除，同时移除 ${removed} 条评委分配` : '组别已删除');
          await load();
        } catch (err: any) {
          message.error(err?.response?.data?.error || err?.message || '删除组别失败');
          throw err;
        }
      },
    });
  };

  const groupColumns = sortableColumns<any>([
    { title: '组别', dataIndex: 'name', width: 300 },
    { title: '报名费', dataIndex: 'registrationFee', width: 100, render: (value: number) => `¥${Number(value || 0).toFixed(2)}` },
    { title: '评分状态', dataIndex: 'scoringStatus', width: 100, render: lockTag },
    { title: '选手', dataIndex: 'playerCount', width: 80 },
    { title: '评委', dataIndex: 'judgeCount', width: 80 },
    {
      title: '操作',
      width: 290,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" type="primary" icon={<SettingOutlined />} onClick={() => openGroupManager(row)}>管理</Button>
          <Button size="small" icon={row.scoringStatus === 'locked' ? <UnlockOutlined /> : <LockOutlined />} onClick={async () => {
            await eventApi.patchGroup(row.id, { action: row.scoringStatus === 'locked' ? 'unlockScoring' : 'lockScoring' });
            message.success(row.scoringStatus === 'locked' ? '已解锁评分' : '已锁定评分');
            load();
          }}>{row.scoringStatus === 'locked' ? '解锁' : '锁定'}</Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            aria-label="编辑组别"
            title="编辑组别"
            onClick={() => openGroupEditor(row)}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label="删除组别"
            disabled={Number(row.playerCount || 0) > 0}
            title={Number(row.playerCount || 0) > 0 ? '该组别已有选手，不能删除' : '删除组别'}
            onClick={() => deleteGroup(row)}
          />
        </Space>
      ),
    },
  ]);

  const playerColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 130, render: (v: string, row: any) => <Link href={`/events/players/${row.id}`}>{v}</Link> },
    { title: '组别', dataIndex: 'groupName', width: 150, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 150, render: (v: string) => v || '-' },
    { title: '审核', dataIndex: 'auditStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '缴费', dataIndex: 'paidStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '评分', dataIndex: 'scoreStatus', width: 100, render: (v: string) => statusTag(v) },
    {
      title: '处理',
      width: 280,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => openPlayer(row)}>修正</Button>
          <Button size="small" icon={<AuditOutlined />} onClick={async () => {
            await eventApi.auditPlayer(row.id, row.auditStatus === 'approved' ? 'rejected' : 'approved');
            message.success(row.auditStatus === 'approved' ? '报名已驳回' : '报名已通过');
            load();
          }}>{row.auditStatus === 'approved' ? '驳回' : '通过'}</Button>
          <Button size="small" type="primary" onClick={() => openPlayerScoreManager(row)}>评分</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePlayersInBatch([row.id], row.groupId)}>删除</Button>
        </Space>
      ),
    },
  ]);

  const managedPlayerColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 130, render: (v: string, row: any) => <Link title="查看选手详情" href={`/events/players/${row.id}`}>{v}</Link> },
    { title: '出场顺序', dataIndex: 'sequenceNo', width: 100, render: (v: number) => Number(v) > 0 ? v : <Tag>未安排</Tag> },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 140, render: (v: string) => v || '-' },
    { title: '音乐', dataIndex: 'musicFileId', width: 100, render: (v: number, row: any) => v ? <Tag color="blue">{row.performanceTitle || '已上传'}</Tag> : <Tag>未上传</Tag> },
    { title: '缴费', dataIndex: 'paidStatus', width: 90, render: (v: string) => statusTag(v) },
    {
      title: '评分',
      dataIndex: 'scoreStatus',
      width: 180,
      render: (_v: string, row: any) => {
        const ranking = rankingByPlayerId.get(Number(row.id));
        if (!ranking?.scoreCount && ranking?.manualTotal == null) return <Tag>未评分</Tag>;
        const award = Number(ranking.rankNo) === 1
          ? { label: '冠军', color: '#d4a017' }
          : Number(ranking.rankNo) === 2
            ? { label: '亚军', color: '#8c8c8c' }
            : Number(ranking.rankNo) === 3
              ? { label: '季军', color: '#ad6800' }
              : null;
        return (
          <Space size={6}>
            <strong>{formatFinalScore(ranking.calculatedTotal, [...rankingByPlayerId.values()].map((item) => item.calculatedTotal))}</strong>
            {ranking.manualTotal != null && <Tag color="purple">人工</Tag>}
            {award && <Tag icon={<TrophyOutlined />} color={award.color}>{award.label}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '操作',
      width: 270,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`/events/players/${row.id}`)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPlayer(row)}>修改</Button>
          <Button size="small" type="primary" onClick={() => openPlayerScoreManager(row)}>评分</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePlayersInBatch([row.id])}>删除</Button>
        </Space>
      ),
    },
  ]);

  const groupJudgeColumns = sortableColumns<any>([
    { title: '评委', dataIndex: 'name', width: 120, render: (v: string) => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v: string) => v || '-' },
    { title: '头衔', dataIndex: 'title', width: 120, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 150, render: (v: string) => v || '-' },
    { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => v === 'leader' ? '主评委' : '评委' },
    {
      title: '操作',
      width: 100,
      render: (_: any, row: any) => <Button size="small" danger onClick={() => deleteJudgesInBatch([row.judgeId])}>移除</Button>,
    },
  ]);

  const playerJudgeScoreColumns = sortableColumns<any>([
    { title: '评委', dataIndex: 'name', width: 140 },
    { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => v || '评委' },
    { title: '评分状态', width: 100, render: (_: any, row: any) => row.score ? statusTag(row.score.scoreStatus) : <Tag>未评分</Tag> },
    { title: '分值', width: 100, render: (_: any, row: any) => row.score ? Number(row.score.calculatedScore).toFixed(2) : '-' },
    { title: '明细', width: 80, render: (_: any, row: any) => row.score?.versionLabel || (row.score ? `v${row.score.version}` : '-') },
    { title: '提交时间', width: 190, render: (_: any, row: any) => row.score?.submittedAt || '-' },
    {
      title: '操作',
      width: 110,
      render: (_: any, row: any) => (
        <Button size="small" type={row.score ? 'default' : 'primary'} icon={row.score ? <EditOutlined /> : <PlusOutlined />} onClick={() => openScore(scoreManagePlayer, row, row.score)}>
          {row.score ? '修改' : '录分'}
        </Button>
      ),
    },
  ]);

  const scoreColumns = sortableColumns<any>([
    { title: '组别', dataIndex: 'groupName', width: 210, render: (v: string) => v || '-' },
    { title: '选手', dataIndex: 'playerName', width: 130 },
    { title: '编号', dataIndex: 'playerNo', width: 90, render: (v: string) => v || '-' },
    { title: '评委', dataIndex: 'judgeName', width: 120 },
    { title: '评委总分', dataIndex: 'calculatedScore', width: 100, render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '状态', dataIndex: 'scoreStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '版本/评分项', dataIndex: 'version', width: 110, render: (v: number, row: any) => row.versionLabel || v || '-' },
    { title: '异常', dataIndex: 'isAbnormal', width: 100, render: (v: boolean, row: any) => v ? statusTag('异常', true) : row.scoreStatus === 'voided' ? statusTag('voided') : <Tag>正常</Tag> },
    { title: '说明', dataIndex: 'abnormalReason', width: 240, render: (v: string) => v || '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 190, render: (v: string) => v || '-' },
  ]);

  return (
    <div>
      <Space className="event-detail-heading" style={{ marginBottom: 14 }} wrap>
        <Link href="/events">赛事管理</Link>
        <span>/</span>
        <strong>{competition?.name || '赛事详情'}</strong>
        <Button danger size="small" icon={<DeleteOutlined />} onClick={deleteCompetition}>删除赛事</Button>
      </Space>

      <Card size="small" className="event-detail-stats-card">
        <div className="event-detail-stats-row">
          <div className="event-detail-stat-item"><TrophyOutlined /><span>组别</span><strong>{groups.length}</strong></div>
          <div className="event-detail-stat-item"><TeamOutlined /><span>选手</span><strong>{players.length}</strong></div>
          <div className="event-detail-stat-item"><UserSwitchOutlined /><span>评委</span><strong>{competition?.judgeCount || 0}</strong></div>
          <div className={`event-detail-stat-item ${abnormalScores.length ? 'is-danger' : 'is-success'}`}><ExclamationCircleOutlined /><span>异常/作废分</span><strong>{abnormalScores.length}</strong></div>
        </div>
      </Card>

      <Card
        size="small"
        extra={<Space wrap>
          <Select
            placeholder="搜索姓名、曲目、组别或手机号"
            value={selectedGroupId || undefined}
            style={{ width: 220 }}
            showSearch
            allowClear
            filterOption={(input, option) => String(option?.searchText ?? option?.label ?? '').includes(input.trim().toLocaleLowerCase())}
            options={groupSearchOptions}
            onChange={(value) => {
              const nextGroupId = value ?? null;
              setSelectedGroupId(nextGroupId);
              loadBoard(nextGroupId);
              loadGroupJudges(nextGroupId);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<FileExcelOutlined />} onClick={() => setImportModal(true)}>导入组别</Button>
          <Button icon={<PlusOutlined />} onClick={() => openGroupEditor()}>新建组别</Button>
          <Button icon={<SettingOutlined />} onClick={openRuleEditor}>赛事评分规则</Button>
          <Button type="primary" icon={<UserSwitchOutlined />} onClick={() => {
            assignForm.resetFields();
            assignForm.setFieldsValue({ weight: 1, authEnabled: true });
            setAssignGroupIds(selectedGroupId ? [selectedGroupId] : []);
            setAssignJudgeIds([]);
            setAssignGroupSearch('');
            setAssignJudgeSearch('');
            setAssignGroupSearchOpen(false);
            setAssignJudgeSearchOpen(false);
            setAssignModal(true);
          }}>分配评委</Button>
        </Space>}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'groups', label: `组别 (${groups.length})`, children: <Table loading={loading} columns={groupColumns} dataSource={groups} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 760 }} /> },
          { key: 'players', label: `报名 (${players.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openPlayer()}>新增报名</Button>
              <Table loading={loading} columns={playerColumns} dataSource={players} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 1200 }} />
            </Space>
          ) },
          { key: 'scoring', label: `评分 (${judgeScoreSummaries.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert type="info" showIcon message={selectedGroup
                ? `当前组别：${selectedGroup.name}。改分会生成新版本，旧分自动作废并保留审计记录。`
                : '当前显示全部组别、全部选手、全部评委的评分总分；可使用上方搜索框筛选具体组别。'} />
              <Space wrap>
                <Button type="primary" icon={<SendOutlined />} disabled={!selectedGroupId} onClick={() => openScore()}>录入/修正评分</Button>
                <Button icon={<CheckCircleOutlined />} disabled={!selectedGroupId} onClick={async () => {
                  await eventApi.recalculateResults(selectedGroupId!);
                  message.success('成绩已重算');
                  loadBoard(selectedGroupId);
                }}>重算当前组成绩</Button>
              </Space>
              <Table loading={boardLoading} columns={scoreColumns} dataSource={judgeScoreSummaries} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 1300 }} />
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
                <Button icon={<EyeOutlined />} onClick={() => window.open(`https://www.swod.com.cn/event-results/${competitionId}`, '_blank', 'noopener,noreferrer')}>打开公示大屏</Button>
              </Space>
              <Alert type="info" showIcon message="每个组别独立成卡，前三名显示领奖台；区域会自动滚动。公示后可复制大屏链接分享给其他设备。" />
              <div ref={resultsScrollRef} style={{ maxHeight: 'calc(100vh - 330px)', minHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {resultGroups.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 16 }}>
                    {resultGroups.map((group) => <ResultGroupCard key={group.id} groupName={group.name} rows={group.rows} />)}
                  </div>
                ) : <div style={{ padding: '72px 24px', textAlign: 'center', color: '#9ca3af' }}>暂无可展示的组别成绩</div>}
              </div>
            </Space>
          ) },
          { key: 'issues', label: `异常处理 (${abnormalScores.length})`, children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Alert type="warning" showIcon message="异常分、作废分会保留在这里，点击对应选手重新录分即可修正；排名只取最新有效分。" />
              <Table loading={boardLoading} columns={scoreColumns} dataSource={abnormalScores} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 1100 }} />
            </Space>
          ) },
        ]} />
      </Card>

      <Modal
        title={`组别管理：${selectedGroup?.name || ''}`}
        open={groupManageOpen}
        onCancel={() => setGroupManageOpen(false)}
        footer={null}
        width="95vw"
        styles={{ body: { maxHeight: '78vh', overflowY: 'auto' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message={`${selectedGroup?.name || '当前组别'} · 选手 ${groupPlayers.length} · 评委 ${groupJudges.length} · 评分 ${scores.length}`}
          />
          <Tabs items={[
            {
              key: 'players',
              label: `选手管理 (${groupPlayers.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Space wrap>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openPlayer()}>新增选手</Button>
                    <Button icon={<PlusOutlined />} onClick={() => setBatchPlayerAddModal(true)}>批量添加</Button>
                    <Button icon={<ReloadOutlined />} disabled={!groupPlayers.length} onClick={randomizePlayerSequence}>随机安排出场顺序</Button>
                    <Button icon={<EditOutlined />} disabled={!selectedPlayerIds.length} onClick={() => { batchPlayerForm.resetFields(); setBatchPlayerEditModal(true); }}>批量修改</Button>
                    <Button danger icon={<DeleteOutlined />} disabled={!selectedPlayerIds.length} onClick={() => deletePlayersInBatch()}>批量删除</Button>
                    <span style={{ color: '#6b7280' }}>已选 {selectedPlayerIds.length} 条</span>
                  </Space>
                  <Table
                    size="small"
                    rowKey="id"
                    loading={loading}
                    columns={managedPlayerColumns}
                    dataSource={orderedGroupPlayers}
                    rowSelection={{
                      selectedRowKeys: selectedPlayerIds,
                      onChange: (keys) => setSelectedPlayerIds(keys as Array<number | string>),
                    }}
                    pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
                    scroll={{ x: 1100 }}
                  />
                </Space>
              ),
            },
            {
              key: 'judges',
              label: `评委管理 (${groupJudges.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Space wrap>
                    <Select
                      mode="multiple"
                      showSearch
                      optionFilterProp="label"
                      placeholder="选择需要添加到本组的评委"
                      value={judgeIdsToAssign}
                      onChange={setJudgeIdsToAssign}
                      style={{ minWidth: 360 }}
                      options={members
                        .filter((member) => !groupJudges.some((assigned) => Number(assigned.memberId) === Number(member.id)))
                        .map((member) => ({ value: member.id, label: `${member.name}${member.phone ? ` · ${member.phone}` : ''}` }))}
                    />
                    <Button type="primary" icon={<PlusOutlined />} style={{ color: '#fff' }} disabled={!judgeIdsToAssign.length} onClick={assignJudgesInBatch}>批量添加评委</Button>
                    <Button icon={<EditOutlined />} disabled={!selectedJudgeIds.length} onClick={() => { batchJudgeForm.resetFields(); setBatchJudgeEditModal(true); }}>批量修改</Button>
                    <Button danger icon={<DeleteOutlined />} disabled={!selectedJudgeIds.length} onClick={() => deleteJudgesInBatch()}>批量移除</Button>
                    <span style={{ color: '#6b7280' }}>已选 {selectedJudgeIds.length} 名</span>
                  </Space>
                  <Table
                    size="small"
                    rowKey="judgeId"
                    columns={groupJudgeColumns}
                    dataSource={groupJudges}
                    rowSelection={{
                      selectedRowKeys: selectedJudgeIds,
                      onChange: (keys) => setSelectedJudgeIds(keys as Array<number | string>),
                    }}
                    pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
                    scroll={{ x: 1150 }}
                  />
                </Space>
              ),
            },
            {
              key: 'scoring',
              label: `评分 (${scores.length})`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Alert type="info" showIcon message="选择选手和已分配评委录入评分；修正评分会保留旧版本和审计记录。" />
                  <Space wrap>
                    <Button type="primary" icon={<SendOutlined />} disabled={!groupPlayers.length || !groupJudges.length} onClick={() => openScore()}>录入/修正评分</Button>
                    <Button icon={<CheckCircleOutlined />} disabled={!selectedGroupId} onClick={async () => {
                      await eventApi.recalculateResults(selectedGroupId!);
                      message.success('当前组成绩已重算');
                      loadBoard(selectedGroupId);
                    }}>重算当前组成绩</Button>
                  </Space>
                  <Table size="small" loading={boardLoading} columns={scoreColumns} dataSource={scores} pagination={{ pageSize: 20 }} scroll={{ x: 1100 }} />
                </Space>
              ),
            },
          ]} />
        </Space>
      </Modal>

      <Modal title="批量添加选手" open={batchPlayerAddModal} onCancel={() => setBatchPlayerAddModal(false)} onOk={addPlayersInBatch} width={720}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="每行一名选手，格式：姓名, 手机号, 机构。出场顺序由管理员在组别管理中统一随机安排。支持中文逗号、英文逗号或 Tab 分隔，最多 500 行。" />
          <Input.TextArea
            rows={12}
            value={batchPlayerText}
            onChange={(event) => setBatchPlayerText(event.target.value)}
            placeholder={'张三, 13800000000, 东方舞工作室\n李四, 13900000000, 伊娃东方舞'}
          />
        </Space>
      </Modal>

      <Modal title={`批量修改 ${selectedPlayerIds.length} 条报名`} open={batchPlayerEditModal} onCancel={() => setBatchPlayerEditModal(false)} onOk={updatePlayersInBatch} width={680}>
        <Alert style={{ marginBottom: 16 }} type="warning" showIcon message="只填写需要统一修改的项目；未填写的项目保持原值。" />
        <Form form={batchPlayerForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="auditStatus" label="审核状态"><Select allowClear options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="paidStatus" label="缴费状态"><Select allowClear options={[{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="报名状态"><Select allowClear options={[{ value: 'pending', label: '待处理' }, { value: 'approved', label: '已通过' }, { value: 'cancelled', label: '已取消' }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="organization" label="机构"><Input allowClear /></Form.Item></Col>
            <Col span={12}><Form.Item name="teacher" label="课程顾问"><Input allowClear /></Form.Item></Col>
          </Row>
          <Form.Item name="remark" label="统一备注"><Input.TextArea rows={2} allowClear /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`批量修改 ${selectedJudgeIds.length} 名评委`} open={batchJudgeEditModal} onCancel={() => setBatchJudgeEditModal(false)} onOk={updateJudgesInBatch} width={620}>
        <Alert style={{ marginBottom: 16 }} type="info" showIcon message="评委加入组别即拥有评分权限；此处只调整组内角色。" />
        <Form form={batchJudgeForm} layout="vertical">
          <Form.Item name="role" label="组内角色" rules={[{ required: true }]}>
            <Select options={[{ value: 'judge', label: '评委' }, { value: 'leader', label: '主评委' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingGroup ? '编辑组别' : '新建组别'} open={groupModal} onCancel={() => { setGroupModal(false); setEditingGroup(null); }} onOk={saveGroup} width={620}>
        <Form form={groupForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="组别名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={6}>
              <Form.Item name="registrationFee" label="报名费" initialValue={0}>
                <InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sortOrder" label="本赛事组别排序" tooltip="只决定当前赛事内各组别的显示顺序，不影响其他赛事">
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="导入组别" open={importModal} onCancel={() => setImportModal(false)} onOk={importGroups} width={680}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="支持列名：组别名称、编码、类别、年龄段、舞种、参赛形式、排序、人数上限、报名费。编码相同会更新，避免重复导入；报名费未填时默认为 0。" />
          <Upload.Dragger accept=".xlsx,.csv" beforeUpload={parseGroupFile} maxCount={1}>
            <p className="ant-upload-drag-icon"><FileExcelOutlined /></p>
            <p className="ant-upload-text">点击或拖入 Excel/CSV 文件</p>
          </Upload.Dragger>
          <Table size="small" rowKey={(_, index) => String(index)} dataSource={importRows.slice(0, 8)} pagination={false} scroll={{ x: 'max-content' }} columns={Object.keys(importRows[0] || {}).map((key) => ({ title: key, dataIndex: key }))} />
        </Space>
      </Modal>

      <Modal title="赛事评分规则" open={ruleModal} onCancel={() => setRuleModal(false)} onOk={saveRule} width={620}>
        <Form form={ruleForm} layout="vertical">
          <Alert style={{ marginBottom: 16 }} type="info" showIcon message="每个赛事固定使用一套评分规则，保存后该赛事全部组别统一生效。" />
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="totalScore" label="总分" extra="评委评分范围：0～10分">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="judgeAnonymous" label="评委匿名" valuePropName="checked" tooltip="开启后，官网与个人中心不公开评委头像和姓名">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dropHighLow"
                label="去高低分"
                valuePropName="checked"
                tooltip="开启后，仅在有效评委评分不少于6份时，各去掉一个最高分和最低分，再计算平均分"
                extra="最终得分取评委评分平均值；少于6份评分时不去高低分"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="批量分配评委到组别" open={assignModal} onCancel={() => {
        setAssignModal(false);
        setAssignGroupSearch('');
        setAssignJudgeSearch('');
        setAssignGroupSearchOpen(false);
        setAssignJudgeSearchOpen(false);
      }} onOk={saveAssignment} width={900}>
        <Form form={assignForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="搜索组别" required>
                <Select
                  key={`group-search-${assignGroupIds.join('-')}`}
                  showSearch
                  allowClear
                  value={null}
                  searchValue={assignGroupSearch}
                  open={assignGroupSearchOpen && Boolean(assignGroupSearch.trim())}
                  onOpenChange={(open) => {
                    if (!open && ignoreNextGroupDropdownClose.current) {
                      ignoreNextGroupDropdownClose.current = false;
                      return;
                    }
                    setAssignGroupSearchOpen(open && Boolean(assignGroupSearch.trim()));
                  }}
                  onFocus={() => {
                    setAssignJudgeSearchOpen(false);
                    if (assignGroupSearch.trim()) setAssignGroupSearchOpen(true);
                  }}
                  onSearch={(value) => {
                    if (!value && ignoreNextGroupSearchClear.current) {
                      ignoreNextGroupSearchClear.current = false;
                      return;
                    }
                    setAssignGroupSearch(value);
                    setAssignGroupSearchOpen(Boolean(value.trim()));
                  }}
                  onSelect={(value) => {
                    ignoreNextGroupSearchClear.current = true;
                    ignoreNextGroupDropdownClose.current = true;
                    window.setTimeout(() => { ignoreNextGroupSearchClear.current = false; }, 0);
                    window.setTimeout(() => { ignoreNextGroupDropdownClose.current = false; }, 0);
                    const id = Number(value);
                    if (!Number.isFinite(id) || id <= 0) return;
                    setAssignGroupIds((current) => current.includes(id) ? current : [...current, id]);
                    setAssignGroupSearchOpen(true);
                  }}
                  onClear={() => {
                    ignoreNextGroupSearchClear.current = false;
                    setAssignGroupSearch('');
                    setAssignGroupSearchOpen(false);
                  }}
                  filterOption={false}
                  placeholder="输入组别名称后选择搜索结果"
                  notFoundContent={assignGroupSearch.trim() ? '没有匹配的组别' : '请先输入组别名称'}
                  options={assignGroupSearch.trim() ? groups
                    .filter((item) => !assignGroupIds.includes(Number(item.id)) && String(item.name || '').toLocaleLowerCase().includes(assignGroupSearch.trim().toLocaleLowerCase()))
                    .map((item) => ({ value: item.id, label: item.name })) : []}
                />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>已选组别（{assignGroupIds.length}）</div>
              <div style={{ height: 280, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 8 }}>
                {assignGroupIds.length ? assignGroupIds.map((id) => {
                  const item = groups.find((group) => Number(group.id) === Number(id));
                  return <div key={id} style={{ marginBottom: 6 }}><Tag closable onClose={() => setAssignGroupIds((current) => current.filter((value) => value !== id))} style={{ width: '100%', marginInlineEnd: 0, padding: '4px 8px' }}>{item?.name || `组别 ${id}`}</Tag></div>;
                }) : <span style={{ color: '#999' }}>搜索并选择的组别会显示在这里</span>}
              </div>
            </Col>
            <Col span={12}>
              <Form.Item label="搜索评委" required>
                <Select
                  key={`judge-search-${assignJudgeIds.join('-')}`}
                  showSearch
                  allowClear
                  value={null}
                  searchValue={assignJudgeSearch}
                  open={assignJudgeSearchOpen && Boolean(assignJudgeSearch.trim())}
                  onOpenChange={(open) => {
                    if (!open && ignoreNextJudgeDropdownClose.current) {
                      ignoreNextJudgeDropdownClose.current = false;
                      return;
                    }
                    setAssignJudgeSearchOpen(open && Boolean(assignJudgeSearch.trim()));
                  }}
                  onFocus={() => {
                    setAssignGroupSearchOpen(false);
                    if (assignJudgeSearch.trim()) setAssignJudgeSearchOpen(true);
                  }}
                  onSearch={(value) => {
                    if (!value && ignoreNextJudgeSearchClear.current) {
                      ignoreNextJudgeSearchClear.current = false;
                      return;
                    }
                    setAssignJudgeSearch(value);
                    setAssignJudgeSearchOpen(Boolean(value.trim()));
                  }}
                  onSelect={(value) => {
                    ignoreNextJudgeSearchClear.current = true;
                    ignoreNextJudgeDropdownClose.current = true;
                    window.setTimeout(() => { ignoreNextJudgeSearchClear.current = false; }, 0);
                    window.setTimeout(() => { ignoreNextJudgeDropdownClose.current = false; }, 0);
                    const id = Number(value);
                    if (!Number.isFinite(id) || id <= 0) return;
                    setAssignJudgeIds((current) => current.includes(id) ? current : [...current, id]);
                    setAssignJudgeSearchOpen(true);
                  }}
                  onClear={() => {
                    ignoreNextJudgeSearchClear.current = false;
                    setAssignJudgeSearch('');
                    setAssignJudgeSearchOpen(false);
                  }}
                  filterOption={false}
                  placeholder="搜索姓名、手机号、ID或微信信息"
                  notFoundContent={assignJudgeSearch.trim() ? '没有匹配的评委' : '请先输入搜索要素'}
                  options={assignJudgeSearch.trim() ? judgeSearchOptions.filter((option) => !assignJudgeIds.includes(Number(option.value)) && option.searchText.includes(assignJudgeSearch.trim().toLocaleLowerCase())) : []}
                />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>已选评委（{assignJudgeIds.length}）</div>
              <div style={{ height: 280, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 8 }}>
                {assignJudgeIds.length ? assignJudgeIds.map((id) => {
                  const item = judges.find((judge) => Number(judge.id) === Number(id));
                  return <div key={id} style={{ marginBottom: 6 }}><Tag closable onClose={() => setAssignJudgeIds((current) => current.filter((value) => value !== id))} style={{ width: '100%', marginInlineEnd: 0, padding: '4px 8px' }}>{item?.name || `评委 ${id}`}</Tag></div>;
                }) : <span style={{ color: '#999' }}>搜索并选择的评委会显示在这里</span>}
              </div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="weight" label="权重" initialValue={1}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="authEnabled" label="评分授权" initialValue={true}><Select options={[{ value: true, label: '开启' }, { value: false, label: '关闭' }]} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={editingPlayer ? '修正报名' : '新增报名'} open={playerModal} onCancel={() => setPlayerModal(false)} onOk={savePlayer} width={680}>
        <Form form={playerForm} layout="vertical">
          <Form.Item name="memberId" label="选手" rules={[{ required: true, message: '请选择选手' }]}>
            <Select
              showSearch
              placeholder="搜索姓名、手机号、学员ID或微信ID"
              filterOption={(input, option) => String(option?.searchText || '').includes(input.trim().toLocaleLowerCase())}
              options={members.map((member) => ({
                value: member.id,
                label: memberOptionLabel(member),
                searchText: memberSearchText(member),
              }))}
              onChange={(memberId) => {
                const member = members.find((item) => Number(item.id) === Number(memberId));
                if (member) playerForm.setFieldsValue({ name: member.name, phone: member.phone || '' });
              }}
            />
          </Form.Item>
          <Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select options={groups.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="选手姓名" rules={[{ required: true }]}><Input disabled /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="手机号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="organization" label="领队机构"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="teacher" label="领队老师"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="auditStatus" label="审核状态"><Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '通过' }, { value: 'rejected', label: '驳回' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="paidStatus" label="缴费状态"><Select options={[{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="scoreStatus" label="评分状态"><Select options={[{ value: 'not_started', label: '未评分' }, { value: 'in_progress', label: '评分中' }, { value: 'scored', label: '已评分' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="remark" label="错误/修正备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`评委评分：${scoreManagePlayer?.name || ''}`}
        open={scoreManageOpen}
        onCancel={() => setScoreManageOpen(false)}
        width={920}
        footer={[
          <Button key="close" onClick={() => setScoreManageOpen(false)}>关闭</Button>,
          <Button key="manual" icon={<EditOutlined />} onClick={openManualFinalScore}>编辑最终得分</Button>,
          <Button
            key="calculate"
            type="primary"
            className="event-score-primary"
            icon={<CheckCircleOutlined />}
            disabled={!playerJudgeScores.some((item) => item.score)}
            onClick={calculatePlayerFinalScore}
          >
            {playerJudgeScores.some((item) => !item.score) ? '忽略未评分评委并计算最终得分' : '重新计算最终得分'}
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message={`出场顺序 ${scoreManagePlayer ? (scoreManagePlayer.sequenceNo || orderedGroupPlayers.findIndex((item) => item.id === scoreManagePlayer.id) + 1) : '-'} · 已评分 ${playerJudgeScores.filter((item) => item.score).length}/${playerJudgeScores.length}`}
            description="可逐项录入或修改评委分数。若部分评委未评分，可忽略这些评委并按现有有效评分直接计算最终得分。"
          />
          {(() => {
            const ranking = rankingByPlayerId.get(Number(scoreManagePlayer?.id));
            return ranking && (ranking.scoreCount || ranking.manualTotal != null) ? <Tag color="magenta">当前最终得分：{formatFinalScore(ranking.calculatedTotal, rankings.filter((item) => Number(item.groupId) === Number(ranking.groupId)).map((item) => item.calculatedTotal))} · 第 {ranking.rankNo} 名{ranking.manualTotal != null ? ' · 人工修改' : ''}</Tag> : null;
          })()}
          <Table
            size="small"
            rowKey="judgeId"
            loading={boardLoading}
            columns={playerJudgeScoreColumns}
            dataSource={playerJudgeScores}
            pagination={false}
            scroll={{ x: 820 }}
          />
        </Space>
      </Modal>

      <Modal
        title={`编辑最终得分：${scoreManagePlayer?.name || ''}`}
        open={manualScoreModal}
        onCancel={() => setManualScoreModal(false)}
        onOk={saveManualFinalScore}
        okText="保存最终得分"
        okButtonProps={{ className: 'event-score-primary' }}
        cancelText="取消"
        footer={(_, { OkBtn, CancelBtn }) => {
          const ranking = rankings.find((item) => Number(item.playerId) === Number(scoreManagePlayer?.id));
          return <>
            {ranking?.manualTotal != null && <Button danger onClick={clearManualFinalScore}>恢复评委计算分</Button>}
            <CancelBtn />
            <OkBtn />
          </>;
        }}
      >
        <Alert
          type="warning"
          showIcon
          message="保存后将以此分值作为该选手最终得分，并自动重新排列当前组别名次。原始评委评分不会被修改。"
          style={{ marginBottom: 16 }}
        />
        <Form form={manualScoreForm} layout="vertical">
          <Form.Item name="finalScore" label="最终得分" rules={[{ required: true, message: '请输入最终得分' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="请输入最终得分" />
          </Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, message: '请填写修改原因' }]}>
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="请输入修改原因，便于审计追溯" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="录入/修正评分" open={scoreModal} onCancel={() => setScoreModal(false)} onOk={saveScore} width={680}>
        <Form form={scoreForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select options={groups.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="playerId" label="选手" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={groupPlayers.map((item) => ({ value: item.id, label: `${item.playerNo || '-'} ${item.name}` }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="judgeId" label="评委" rules={[{ required: true }]}><Select options={groupJudges.map((item) => ({ value: item.judgeId, label: item.name }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="rawScore" label="评委评分" extra={`评分范围：0～${Number(competitionRule?.totalScore || 10)}分`} rules={[{ required: true }]}>
                <InputNumber min={0} max={Number(competitionRule?.totalScore || 10)} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
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
