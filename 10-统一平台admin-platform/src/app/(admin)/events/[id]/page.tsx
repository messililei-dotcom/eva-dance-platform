'use client';
import { DEFAULT_SCORE_CRITERIA } from '@/lib/event-score-rules';
import { NumericDateInput } from '@/components/numeric-date-input';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import EventMusicPlayer from '@/components/event-music-player';
import EventImportIdentityModal from '@/components/event-import-identity-modal';
import type { ImportIdentityConflict, ImportIdentityDecision } from '@/lib/event-import-identity';
import EventPlayerProfileModal from '@/components/event-player-profile-modal';
import EventRevenueModal from '@/components/event-revenue-modal';
import EventMusicBoard from '@/components/event-music-board';
import { useParams, useRouter } from 'next/navigation';
import { validateImportWorkbook } from '@/lib/event-import-workbook';
import readXlsxFile from 'read-excel-file/browser';
import type { SheetData } from 'write-excel-file/browser';
import { parseImportRows, parseImportCsv, hasImportHeader, eventImportCsv, groupExportHeaders, type ImportKind } from '@/lib/event-import-format';
import { memberOptionLabel, memberSearchText } from '@/lib/member-search';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
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
  theme,
} from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  HolderOutlined,
  DollarOutlined,
  EditOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
  LockOutlined,
  CustomerServiceOutlined,
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
import { api, eventApi, type RegistrationPaymentDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isPlatformOwner } from '@/lib/admin-feature-access';
import { sortableColumns } from '@/lib/table-sort';
import styles from './event-detail.module.css';
import { useLessonDragSort as useGroupDragSort } from '@/components/online-course/use-lesson-drag-sort';
import { moveGroupToPosition } from '@/lib/event-group-order';
import { eventEntrySummary } from '@/lib/event-entry-summary';

function judgeDisplayName(judge: any): string {
  const name = String(judge.name || '').trim();
  const phone = String(judge.phone || '').trim();
  const digits = phone.replace(/\D/g, '');
  const candidates = [...new Set([phone, digits, digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : ''])].filter(value => value.length >= 6);
  const suffix = candidates.find(value => name.endsWith(value));
  return suffix ? name.slice(0, -suffix.length).replace(/[\s()（）-]+$/u, '').trim() || `评委 ${judge.judgeId}` : name;
}

const statusText: Record<string, string> = {
  approved: '已通过',
  pending: '待处理',
  rejected: '已驳回',
  paid: '已缴费',
  unpaid: '未缴费',
  partial: '部分缴费',
  refunded: '已退款',
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

function groupScoringLabel(value: string) {
  return value === 'locked' ? '已锁定' : '可评分';
}

function lockTag(value: string) {
  return <Tag color={value === 'locked' ? 'red' : 'green'}>{groupScoringLabel(value)}</Tag>;
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

function ResultAvatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <span aria-label={`${name}头像`} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: size, height: size, borderRadius: '50%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', background: '#f4ecd9', color: '#856521', fontSize: size / 3, border: '2px solid #d6bd80' }}>
    {Array.from(name || '选')[0]}
    {src && !failed && <img src={src} alt={`${name}头像`} referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
  </span>;
}

function ResultGroupCard({ groupName, rows }: { groupName: string; rows: any[] }) {
  const ranked = rows.length > 0 && rows.every(item => Number(item.rankNo) > 0);
  const ordered = [...rows].sort((a, b) => ranked ? Number(a.rankNo) - Number(b.rankNo) : Number(a.playerId) - Number(b.playerId));
  const scores = ordered.map((item) => item.publishedTotal ?? item.calculatedTotal);
  const podium = [2, 1, 3].map(rank => ordered.find(item => Number(item.rankNo) === rank));
  const remaining = ranked ? ordered.filter(item => Number(item.rankNo) > 3) : ordered;
  const podiumMeta = [
    { label: '亚军', icon: '🏆', trophyFilter: 'grayscale(1) brightness(1.35) contrast(.85)', height: 72, background: 'linear-gradient(180deg,#e7ebf0,#cbd3dd)' },
    { label: '冠军', icon: '🏆', trophyFilter: 'none', height: 96, background: 'linear-gradient(180deg,#ffe08a,#e7b83d)' },
    { label: '季军', icon: '🏆', trophyFilter: 'sepia(1) saturate(2.2) hue-rotate(338deg) brightness(.72)', height: 60, background: 'linear-gradient(180deg,#f4b47a,#d4874a)' },
  ];
  return (
    <Card
      size="small"
      className={styles.resultGroupCard}
      title={<Space><TrophyOutlined style={{ color: '#d4a017' }} /><span>{groupName}</span></Space>}
      extra={<Tag color="magenta">{ordered.length} 位选手</Tag>}
      styles={{ body: { padding: 16 } }}
    >
      {ranked ? <div className={styles.resultPodium}>
        {podium.map((item, index) => (
          <div key={item?.playerId || `empty-${index}`} style={{ minWidth: 0, textAlign: 'center' }}>
            {item ? <>
              <div style={{ marginBottom: 8 }}><ResultAvatar key={item.avatarUrl} name={item.playerName} src={item.avatarUrl} size={64} /></div>
              <div aria-label={`${podiumMeta[index].label}奖杯`} style={{ fontSize: 28, lineHeight: 1, filter: podiumMeta[index].trophyFilter }}>{podiumMeta[index].icon}</div>
              <div title={item.playerName} style={{ marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{item.playerName}</div>
              <div style={{ color: '#e91e63', fontSize: 17, fontWeight: 800 }}>{formatFinalScore(item.publishedTotal ?? item.calculatedTotal, scores)}</div>
              <div style={{ height: podiumMeta[index].height, marginTop: 7, borderRadius: '8px 8px 0 0', background: podiumMeta[index].background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{podiumMeta[index].label}</div>
            </> : <div style={{ height: 120 }} />}
          </div>
        ))}
      </div> : <Alert type="info" showIcon message="本组节目尚未全部完成，暂不排名" style={{ marginBottom: 16 }} />}
      {remaining.length > 0 && <div className={styles.resultRemaining} tabIndex={0} role="region" aria-label={`${groupName}其余选手名次`}>
        {remaining.map((item, index) => (
          <div key={item.playerId} style={{ display: 'grid', gridTemplateColumns: '32px 40px minmax(0,1fr) 80px', gap: 8, alignItems: 'center', padding: '9px 12px', background: index % 2 ? '#fafafa' : '#fff', borderBottom: index < remaining.length - 1 ? '1px solid #f0f0f0' : undefined }}>
            <strong style={{ textAlign: 'center', color: '#6b7280' }}>{Number(item.rankNo) > 0 ? item.rankNo : '—'}</strong>
            <ResultAvatar key={item.avatarUrl} name={item.playerName} src={item.avatarUrl} />
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

export default function EventDetailPage() {
  const { user } = useAuth();
  const canViewRevenue = isPlatformOwner(user);
  const [profilePlayerId,setProfilePlayerId]=useState<number|null>(null);
  const [revenueOpen,setRevenueOpen]=useState(false);
  const params = useParams<{ id: string }>();
  const competitionId = Number(params.id);
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  // Forms opened from group management are sibling dialogs at the default layer.
  const groupWorkspaceZIndex = token.zIndexPopupBase - 1;
  const [competition, setCompetition] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupSortSaving, setGroupSortSaving] = useState(false);
  const groupSortSavingRef = useRef(false);
  const [groupSortDrafts, setGroupSortDrafts] = useState<Record<number, number | null>>({});
  const [groupColumnSorted, setGroupColumnSorted] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ ids: Array<number | string>; groupId: number | null; entries: any[] } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [judges, setJudges] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [playerMemberSearch, setPlayerMemberSearch] = useState('');
  const [playerMemberMatches, setPlayerMemberMatches] = useState<any[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [paymentPlayer, setPaymentPlayer] = useState<any>(null);
  const paymentRequestVersion = useRef(0);
  const paymentSubmitting = useRef(false);
  const [paymentDetails, setPaymentDetails] = useState<RegistrationPaymentDetails | null>(null);
  const [paymentLoadError, setPaymentLoadError] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentForm] = Form.useForm();
  const paymentKind = Form.useWatch<'charge' | 'refund'>('kind', paymentForm);
  const memberRequestRef = useRef<Promise<any[]> | null>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [activeTab, setActiveTab] = useState('groups');
  const [sectionKeyword, setSectionKeyword] = useState('');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeAudience, setNoticeAudience] = useState<any>(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [noticeForm] = Form.useForm();
  const noticeKey = useRef('');
  const [scoreView, setScoreView] = useState('scores');
  const [competitionJudgeAssignments, setCompetitionJudgeAssignments] = useState<any[]>([]);
  const [judgeView, setJudgeView] = useState<'groups' | 'judges'>('groups');
  const [judgeRemoveGroup, setJudgeRemoveGroup] = useState<any>(null);
  const [judgeRemoveIds, setJudgeRemoveIds] = useState<number[]>([]);
  const [judgeRemoveBusy, setJudgeRemoveBusy] = useState(false);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const [adaptivePageSize, setAdaptivePageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const selectedGroupRef = useRef(selectedGroupId);
  selectedGroupRef.current = selectedGroupId;
  const detailRequestVersion = useRef(0);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Array<number | string>>([]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<Array<number | string>>([]);
  const [batchPlayerAddModal, setBatchPlayerAddModal] = useState(false);
  const [batchPlayerEditModal, setBatchPlayerEditModal] = useState(false);
  const [batchJudgeEditModal, setBatchJudgeEditModal] = useState(false);
  const [batchPlayerText, setBatchPlayerText] = useState('');
  const [ruleModal, setRuleModal] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignGroupIds, setAssignGroupIds] = useState<number[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<Array<{ value: string; label: string }>>([]);
  const [judgeLookup, setJudgeLookup] = useState<{ keyword: string; rows: Array<{ id: number; name: string; nickname?: string; phone_hint?: string }>; failed?: boolean } | null>(null);
  const [assignGroupSearch, setAssignGroupSearch] = useState('');
  const [assignJudgeSearch, setAssignJudgeSearch] = useState('');
  const [assignGroupSearchOpen, setAssignGroupSearchOpen] = useState(false);
  const [assignJudgeSearchOpen, setAssignJudgeSearchOpen] = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [scoreModal, setScoreModal] = useState(false);
  const [scoreManageOpen, setScoreManageOpen] = useState(false);
  const [scoreManagePlayer, setScoreManagePlayer] = useState<any>(null);
  const [manualScoreModal, setManualScoreModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [entryImportKind, setEntryImportKind] = useState<'players' | 'judges' | null>(null);
  const [entryImportRows, setEntryImportRows] = useState<any[]>([]);
  const [entryImportErrors, setEntryImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [entryImportBusy, setEntryImportBusy] = useState(false);
  const [entryExportBusy, setEntryExportBusy] = useState(false);
  const entryExportSubmitting = useRef(false);
  const [entryImportConflicts, setEntryImportConflicts] = useState<ImportIdentityConflict[]>([]);
  const entryImportSubmitting = useRef(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [groupImportErrors, setGroupImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importFileError, setImportFileError] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importSheets, setImportSheets] = useState<Array<{ sheet: string; data: unknown[][] }>>([]);
  const [importSheetName, setImportSheetName] = useState('');
  const [importReading, setImportReading] = useState(false);
  const [groupImportBusy, setGroupImportBusy] = useState(false);
  const importReadVersion = useRef(0);
  const [groupForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const editingCriteria = Form.useWatch<{ name?: string; maxScore?: number | null }[]>('criteria', ruleForm);
  const editingPoints = (editingCriteria || []).reduce((sum, row) => sum + Math.round(Number(row?.maxScore || 0) * 100), 0);
  const [playerForm] = Form.useForm();
  const selectedFeeGroup = Form.useWatch('groupId', playerForm);
  const [scoreForm] = Form.useForm();
  const scoreFormGroupId = Form.useWatch('groupId', scoreForm);
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

  const entrySummary = useMemo(() => eventEntrySummary(players), [players]);
  const numberedPlayers = entrySummary.players;
  const selectedGroup = groups.find((item) => item.id === selectedGroupId);
  const groupPlayers = useMemo(() => numberedPlayers.filter((item) => Number(item.groupId) === Number(selectedGroupId)), [numberedPlayers, selectedGroupId]);
  const groupJudges = useMemo(() => competitionJudgeAssignments.filter(item => Number(item.groupId) === Number(selectedGroupId)), [competitionJudgeAssignments, selectedGroupId]);
  const groupSearchOptions = useMemo(() => groups.map(group => ({ value: Number(group.id), label: group.name, searchText: String(group.name || '').toLocaleLowerCase() })), [groups]);
  const contestantRows = entrySummary.contestants;
  const eventJudgeRows = useMemo(() => {
    const people = new Map<number, any>();
    competitionJudgeAssignments.forEach((assignment) => {
      const key = Number(assignment.judgeId);
      const current = people.get(key);
      if (current) current.assignments.push(assignment);
      else people.set(key, { ...assignment, key: String(key), assignments: [assignment] });
    });
    return [...people.values()];
  }, [competitionJudgeAssignments]);
  const matchesSection = (row: any, section: string) => {
    const fields: Record<string, any[]> = {
      groups: [row.name],
      players: [row.programNumber, row.contestantNumber, row.name, row.phone, row.groupName, row.organization, row.performanceTitle, row.musicName, row.teacher],
      contestants: [row.contestantNumber, row.name, row.phone, row.organization, ...(row.entries || []).map((entry: any) => entry.groupName)],
      judges: [row.groupName, judgeDisplayName(row)],
      scoring: [row.groupName, row.playerName, row.playerNo, row.judgeName, row.performanceTitle],
      results: [row.playerName, row.playerNo, row.organization, row.groupName],
    };
    return !sectionKeyword.trim() || (fields[section] || []).filter(Boolean).join(' ').toLocaleLowerCase().includes(sectionKeyword.trim().toLocaleLowerCase());
  };
  const visiblePlayers = numberedPlayers.filter(row => (!selectedGroupId || Number(row.groupId) === Number(selectedGroupId)) && matchesSection(row, 'players'));
  const visibleContestants = contestantRows.map(row => ({ ...row, entries: row.entries.filter((entry: any) => !selectedGroupId || Number(entry.groupId) === Number(selectedGroupId)) })).filter(row => row.entries.length && matchesSection(row, 'contestants'));
  const judgeGroupRows = useMemo(() => {
    const keyword = sectionKeyword.trim().toLocaleLowerCase();
    return groups.filter(group => !selectedGroupId || Number(group.id) === Number(selectedGroupId)).map(group => {
      const allJudges = competitionJudgeAssignments.filter(row => Number(row.groupId) === Number(group.id)).sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''),'zh-CN'));
      const groupMatch = !keyword || String(group.name || '').toLocaleLowerCase().includes(keyword);
      return { ...group, allJudges, judges: groupMatch ? allJudges : allJudges.filter(row => matchesSection(row,'judges')), groupMatch };
    }).filter(group => group.groupMatch || group.judges.length > 0);
  }, [groups, competitionJudgeAssignments, selectedGroupId, sectionKeyword]);
  const judgeResponsibilityRows = useMemo(() => {
    const keyword = sectionKeyword.trim().toLocaleLowerCase();
    return eventJudgeRows.map(judge => {
      const scoped = judge.assignments.filter((assignment: any) => !selectedGroupId || Number(assignment.groupId) === Number(selectedGroupId));
      const nameMatch = !keyword || judgeDisplayName(judge).toLocaleLowerCase().includes(keyword);
      const assignments = nameMatch ? scoped : scoped.filter((assignment: any) => String(assignment.groupName || '').toLocaleLowerCase().includes(keyword));
      return { ...judge, assignments };
    }).filter(judge => judge.assignments.length > 0).sort((a, b) => judgeDisplayName(a).localeCompare(judgeDisplayName(b), 'zh-CN'));
  }, [eventJudgeRows, selectedGroupId, sectionKeyword]);
  const switchInformation = (key: string) => { setActiveTab(key); setSectionKeyword(''); };
  const informationLabel = (name: string, count: number | string, icon: React.ReactNode) => <div className={styles.informationLabel}><span>{icon}{name}</span><strong>{count}</strong></div>;
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
  const playerJudgeScores = useMemo(() => competitionJudgeAssignments.filter(judge => Number(judge.groupId) === Number(scoreManagePlayer?.groupId)).map((judge) => ({
    ...judge,
    score: latestScoreByJudge.get(Number(judge.judgeId)) || null,
  })), [competitionJudgeAssignments, scoreManagePlayer?.groupId, latestScoreByJudge]);
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
      return { value: `judge:${judge.id}`, label: judgeDisplayName(judge), searchText, memberId: Number(judge.memberId) };
    });
  }, [judges, members]);
  const judgeKeyword = assignJudgeSearch.trim();
  const canLookupJudges = judgeKeyword.length >= 2 || /^\d$/.test(judgeKeyword);
  useEffect(() => {
    if (!assignModal || !canLookupJudges) {
      setJudgeLookup(null);
      return;
    }
    let active = true;
    setJudgeLookup(null);
    const timer = setTimeout(() => {
      eventApi.listEventMembers({ competitionId, keyword: judgeKeyword, matchFor: 'judge' })
        .then(rows => { if (active) setJudgeLookup({ keyword: judgeKeyword, rows }); })
        .catch(() => { if (active) setJudgeLookup({ keyword: judgeKeyword, rows: [], failed: true }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [assignModal, canLookupJudges, competitionId, judgeKeyword]);

  const judgeLookupResult = judgeLookup?.keyword === judgeKeyword ? judgeLookup : null;
  const searchingJudges = canLookupJudges && !judgeLookupResult;
  const judgesByMember = new Map(judgeSearchOptions.filter(option => option.memberId > 0).map(option => [option.memberId, option]));
  const assignmentOptions = new Map<string, { value: string; label: string }>();
  for (const option of judgeSearchOptions) {
    if (option.searchText.includes(judgeKeyword.toLocaleLowerCase())) assignmentOptions.set(option.value, option);
  }
  for (const member of judgeLookupResult?.rows || []) {
    const existing = judgesByMember.get(Number(member.id));
    const value = existing?.value || `member:${member.id}`;
    const label = [member.name || member.nickname || '未命名用户', member.nickname && member.nickname !== member.name ? member.nickname : '', member.phone_hint, `ID ${member.id}`].filter(Boolean).join(' · ');
    assignmentOptions.set(value, { value, label });
  }
  const availableAssignmentOptions = [...assignmentOptions.values()].filter(option => !selectedJudges.some(selected => selected.value === option.value));
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
  const ruleCriteria = useMemo(() => {
    try {
      const items = JSON.parse(competitionRule?.criteriaJson || '[]');
      return Array.isArray(items) ? items as { id?: string; key?: string; name: string; maxScore?: number; score?: number }[] : [];
    } catch {
      return [];
    }
  }, [competitionRule?.criteriaJson]);
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
    return totals.map(item => ({ ...item, rankNo: 0 }));
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
  const scopedScoreSummaries = judgeScoreSummaries.filter(item => !selectedGroupId || Number(item.groupId) === Number(selectedGroupId));
  const scopedAbnormalScores = abnormalScores.filter(item => !selectedGroupId || Number(item.groupId) === Number(selectedGroupId));
  const groupScoreSummaries = judgeScoreSummaries.filter(item => Number(item.groupId) === Number(selectedGroupId));
  const groupRankings = rankings.filter(item => item.status === 'published' && Number(item.groupId) === Number(selectedGroupId));
  const resultGroups = useMemo(() => {
    const rowsByGroup = new Map<number, any[]>();
    rankings.filter(item => item.status === 'published' && (!selectedGroupId || Number(item.groupId) === Number(selectedGroupId)) && matchesSection(item, 'results')).forEach((item) => {
      const groupId = Number(item.groupId);
      rowsByGroup.set(groupId, [...(rowsByGroup.get(groupId) || []), item]);
    });
    return groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      rows: rowsByGroup.get(Number(group.id)) || [],
    })).filter((group) => group.rows.length > 0);
  }, [groups, rankings, sectionKeyword, selectedGroupId]);

  const ensureEventMembers = () => {
    if (members.length) return Promise.resolve(members);
    if (memberRequestRef.current) return memberRequestRef.current;
    memberRequestRef.current = eventApi.listEventMembers()
      .then((rows) => { setMembers(rows); return rows; })
      .finally(() => { memberRequestRef.current = null; });
    return memberRequestRef.current;
  };

  const load = async () => {
    const version = ++detailRequestVersion.current;
    setLoading(true);
    setBoardLoading(true);
    try {
      const [detail, groupRows, playerRows, judgeRows, ruleRows, judgeAssignments, scoreRows, resultData] = await Promise.all([
        eventApi.getCompetition(competitionId),
        eventApi.listGroups({ competitionId }),
        eventApi.listPlayers({ competitionId }),
        eventApi.listJudges(),
        eventApi.listScoreRules({ competitionId }),
        eventApi.listGroupJudges({ competitionId }),
        eventApi.listScores({ competitionId }),
        eventApi.getResults({ competitionId }),
      ]);
      if (version !== detailRequestVersion.current) return false;
      setCompetition(detail);
      setGroups(groupRows);
      setPlayers(playerRows);
      setJudges(judgeRows);
      setRules(ruleRows);
      setCompetitionJudgeAssignments(judgeAssignments);
     
      setScores(scoreRows);
      setRankings(resultData.rankings || []);
      const currentGroupId = selectedGroupRef.current;
      if (currentGroupId && !groupRows.some((item: any) => Number(item.id) === Number(currentGroupId))) {
        setSelectedGroupId(null);
        setSelectedPlayerIds([]);
        setSelectedJudgeIds([]);
        setGroupManageOpen(false);
      }
      return true;
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载赛事详情失败');
      return false;
    } finally {
      if (version === detailRequestVersion.current) { setLoading(false); setBoardLoading(false); }
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
    setGroupManageOpen(true);
    void ensureEventMembers();
    try {
      await load();
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载组别管理数据失败');
    }
  };

  const saveRule = async () => {
    if (ruleSaving) return;
    let values;
    try {
      values = await ruleForm.validateFields();
    } catch {
      return;
    }
    setRuleSaving(true);
    try {
      await eventApi.createScoreRule({
        ...values,
        competitionId,
        totalScore: 10,
        decimalPlaces: competitionRule?.decimalPlaces ?? 2,
        publishMode: competitionRule?.publishMode ?? 'review_then_publish',
        abnormalThreshold: competitionRule?.abnormalThreshold ?? 15,
        judgeAnonymous: competitionRule?.judgeAnonymous ?? false,
      });
      message.success('赛事评分规则已保存');
      setRuleModal(false);
      ruleForm.resetFields();
      void load();
    } catch (error: any) {
      message.error(error?.response?.data?.error || '保存评分规则失败，请重试');
    } finally {
      setRuleSaving(false);
    }
  };

  const openRuleEditor = () => {
    ruleForm.resetFields();
    const criteria = !competitionRule
      ? DEFAULT_SCORE_CRITERIA.map(item => ({ ...item }))
      : ruleCriteria.length
        ? ruleCriteria.map((item, index) => ({
            id: String(item.id ?? item.key ?? `${competitionRule.id}-${index}`),
            name: item.name,
            maxScore: item.maxScore ?? item.score,
          }))
        : [{ id: String(competitionRule.id), name: '评分总分', maxScore: 10 }];
    ruleForm.setFieldsValue({
      name: competitionRule?.name || `${competition?.name || '赛事'}评分规则`,
      dropHighLow: competitionRule?.dropHighLow ?? true,
      criteria,
    });
    setRuleModal(true);
  };

  const saveAssignment = async () => {
    if (!assignGroupIds.length) {
      message.warning('请至少选择一个组别');
      return;
    }
    if (!selectedJudges.length) {
      message.warning('请至少选择一名评委');
      return;
    }
    if (assignBusy) return;
    setAssignBusy(true);
    try {
      const idsFor = (kind: string) => selectedJudges
        .filter(option => option.value.startsWith(kind + ':'))
        .map(option => Number(option.value.split(':')[1]));
      const result = await eventApi.assignJudge({
        groupIds: assignGroupIds,
        judgeIds: idsFor('judge'),
        memberIds: idsFor('member'),
        competitionId,
      });
      if (result.assigned === 0 && result.skipped) {
        message.warning(`所选评委已分配，已跳过 ${result.skipped} 条重复分配`);
      } else {
        message.success(`新增 ${result.assigned} 条评委分配，跳过 ${result.skipped || 0} 条重复分配`);
      }
      setAssignModal(false);
      setAssignGroupIds([]); setSelectedJudges([]);
      setAssignGroupSearch(''); setAssignJudgeSearch('');
      setAssignGroupSearchOpen(false); setAssignJudgeSearchOpen(false);
      await load();
    } catch (error: any) { message.error(error?.response?.data?.error || '分配失败，请重试'); }
    finally { setAssignBusy(false); }
  };

  useEffect(() => {
    let cancelled = false;
    if (!playerModal || playerMemberSearch.trim().length < 2) { setPlayerMemberMatches([]); setMemberSearching(false); return; }
    setMemberSearching(true);
    const timer = setTimeout(() => {
      eventApi.listEventMembers({ competitionId, keyword: playerMemberSearch.trim(), matchFor: 'registration' })
        .then(rows => { if (!cancelled) setPlayerMemberMatches(rows); })
        .catch(() => { if (!cancelled) message.error('数据库匹配失败，请重试'); })
        .finally(() => { if (!cancelled) setMemberSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playerModal, playerMemberSearch, competitionId, message]);

  const paymentMethods: Record<string,string> = {wechat:'微信',alipay:'支付宝',bank:'银行转账',cash:'现金',other:'其他'};
  const showDate = (value: string) => value ? new Date(value).toLocaleString('zh-CN', {hour12:false}) : '未记录';
  const paymentState = paymentDetails?.paymentState;
  const selectedPayment = paymentKind && paymentState?.[paymentKind];
  const paymentUnavailable = paymentState?.charge.unavailableReason && paymentState.refund.unavailableReason
    ? (paymentState.paidAmount > 0 ? paymentState.refund.unavailableReason : paymentState.charge.unavailableReason)
    : '';
  const openPayment = async (row: any) => {
    if (paymentSubmitting.current) return;
    const version = ++paymentRequestVersion.current;
    setPaymentPlayer(row);
    setPaymentDetails(null);
    setPaymentLoadError('');
    paymentForm.resetFields();
    try {
      const details = await eventApi.getRegistrationPayments(row.id);
      if (version !== paymentRequestVersion.current) return;
      const now = new Date();
      paymentForm.setFieldsValue({
        kind: details.paymentState.charge.unavailableReason ? undefined : 'charge',
        method: 'wechat',
        paidAt: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        requestKey: crypto.randomUUID(),
      });
      setPaymentDetails(details);
    } catch (error: any) {
      if (version === paymentRequestVersion.current) setPaymentLoadError(error?.response?.data?.error || '缴费记录加载失败');
    }
  };
  const closePayment = () => {
    if (paymentSubmitting.current) return;
    paymentRequestVersion.current++;
    setPaymentPlayer(null);
  };
  const savePayment = async () => {
    if (!paymentPlayer || !paymentState || !selectedPayment || selectedPayment.unavailableReason || paymentSubmitting.current) return;
    paymentSubmitting.current = true;
    setPaymentBusy(true);
    try {
      const values = await paymentForm.validateFields().catch(() => null);
      if (!values) return;
      const paidAt = new Date(values.paidAt);
      if (!Number.isFinite(paidAt.getTime())) { paymentForm.setFields([{ name: 'paidAt', errors: ['请填写有效的实际缴费或退款时间'] }]); return; }
      await eventApi.recordRegistrationPayment(paymentPlayer.id, { ...values, amount: selectedPayment.amount, paidAt: paidAt.toISOString() });
      message.success(values.kind === 'refund' ? '退款记录已登记' : '缴费记录已登记');
      setPaymentPlayer(null); await load();
    } catch (error: any) { message.error(error?.response?.data?.error || '登记失败'); }
    finally { paymentSubmitting.current = false; setPaymentBusy(false); }
  };

  const openPlayer = (row?: any) => {
    void ensureEventMembers();
    setEditingPlayer(row || null);
    setPlayerMemberSearch(''); setPlayerMemberMatches([]);
    playerForm.resetFields();
    playerForm.setFieldsValue(row ? {
      ...row,
      groupId: row.groupId || selectedGroupId,
    } : {
      competitionId,
      groupId: selectedGroupId,
      auditStatus: 'approved',
      paidStatus: 'unpaid',
      status: 'approved',
    });
    setPlayerModal(true);
  };

  const savePlayer = async () => {
    const values = await playerForm.validateFields();
    delete values.memberId;
    if (editingPlayer) {
      await eventApi.updatePlayer(editingPlayer.id, { ...editingPlayer, ...values, competitionId });
      message.success('报名信息已更新');
    } else {
      await eventApi.createPlayer({ ...values, competitionId });
      message.success('报名记录已创建');
    }
    setPlayerModal(false);
    setEditingPlayer(null);
    playerForm.resetFields();
    load();
  };

  const randomizeEventSequence = () => {
    modal.confirm({
      title: '随机安排全赛事的出场顺序？',
      content: '将分别随机排列各组所有有效报名，覆盖已有出场顺序。报名登记编号保持不变，空组别跳过。',
      okText: '确认随机排序',
      onOk: async () => {
        setRandomizing(true);
        try {
          const result = await eventApi.randomizeEventSequence(competitionId);
          if (!(await load())) throw new Error('出场顺序已保存，页面刷新失败，请点击刷新重试');
          message.success(`已随机编排 ${result.groups} 个组别、${result.updated} 个节目`);
        } catch (error: any) {
          message.error(error?.response?.data?.error || error?.message || '随机排序失败，请重试');
          throw error;
        } finally {
          setRandomizing(false);
        }
      },
    });
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
      groupId: player?.groupId ?? existingScore?.groupId ?? selectedGroupId,
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
    setScoreManageOpen(true);
    try {
      await load();
    } catch (err: any) {
      message.error(err?.response?.data?.error || err?.message || '加载评委评分失败');
    }
  };

  const calculatePlayerFinalScore = async () => {
    if (!scoreManagePlayer?.groupId) return;
    await eventApi.recalculateResults(scoreManagePlayer.groupId);
    const result = await eventApi.getResults({ competitionId, groupId: scoreManagePlayer.groupId });
    const nextRankings = result.rankings || [];
    await load();
    const ranking = nextRankings.find((item: any) => Number(item.playerId) === Number(scoreManagePlayer.id));
    const ignoredCount = playerJudgeScores.filter((item) => !item.score).length;
    message.success(ranking
      ? `已忽略 ${ignoredCount} 名未评分评委，最终得分 ${formatFinalScore(ranking.calculatedTotal, rankings.filter((item) => Number(item.groupId) === Number(scoreManagePlayer.groupId)).map((item) => item.calculatedTotal))}${Number(ranking.rankNo) > 0 ? `，当前第 ${ranking.rankNo} 名` : `，本组尚未全部完成，暂不排名`}`
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
    await load();
    setManualScoreModal(false);
    message.success('最终得分已修改并重新排名');
  };

  const clearManualFinalScore = async () => {
    if (!scoreManagePlayer?.groupId) return;
    await eventApi.clearManualFinalScore({ groupId: scoreManagePlayer.groupId, playerId: scoreManagePlayer.id });
    await load();
    setManualScoreModal(false);
    message.success('已恢复为评委评分计算结果并重新排名');
  };

  const deleteCompetition = () => {
    if (!competition) return;
    modal.confirm({
      title: `确认删除赛事“${competition.name}”？`,
      icon: <ExclamationCircleOutlined />,
      content: `删除后，该赛事下的 ${groups.length} 个组别、${players.length} 条报名及相关评分记录将一并删除，且无法恢复。`,
      okText: <DeleteOutlined aria-label="确认删除赛事" title="确认删除赛事" />,
      okButtonProps: { danger: true , 'aria-label': "确认删除赛事", title: "确认删除赛事"},
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

  const deletePlayersInBatch = (ids = selectedPlayerIds, groupId: number | null | undefined = selectedGroupId) => {
    if (!ids.length) return;
    const entries = numberedPlayers.filter(row => ids.some(id => Number(id) === Number(row.id)) && Number(row.groupId ?? 0) === Number(groupId ?? 0));
    if (entries.length !== ids.length) { message.warning('报名信息已变化，请刷新后再删除'); return; }
    setDeleteError('');
    setDeleteConfirmation({ ids, groupId: groupId || null, entries });
  };

  const confirmPlayerDeletion = async () => {
    if (!deleteConfirmation || deleteBusy) return;
    const { ids, groupId } = deleteConfirmation;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const result = await eventApi.batchDeletePlayers({ competitionId, groupId, ids });
      message.success(`已删除 ${result.deleted} 条报名`);
      setDeleteConfirmation(null);
      setSelectedPlayerIds([]);
      await load();
    } catch (error: any) {
      setDeleteError(error?.response?.data?.error || '删除报名失败，请重试');
    } finally {
      setDeleteBusy(false);
    }
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
    await load();
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
        await load();
      },
    });
  };

  const clearImportFile = () => {
    importReadVersion.current++; setImportRows([]); setGroupImportErrors([]); setEntryImportRows([]); setEntryImportErrors([]);
    setImportFileError(''); setImportWarnings([]); setImportSheets([]); setImportSheetName(''); setImportReading(false);
  };
  const applyImportSheet = (sheet: { sheet: string; data: unknown[][] }, kind: ImportKind) => {
    setImportSheetName(sheet.sheet); setImportFileError(''); setImportWarnings([]);
    setImportRows([]); setGroupImportErrors([]); setEntryImportRows([]); setEntryImportErrors([]);
    try {
      const result = parseImportRows(sheet.data, kind);
      if (kind === 'groups') { setImportRows(result.rows); setGroupImportErrors(result.errors); }
      else { setEntryImportRows(result.rows); setEntryImportErrors(result.errors); }
      setImportWarnings(result.warnings);
    } catch (error: any) { setImportFileError(error?.message || '读取失败'); }
  };
  const readImportFile = async (file: File, kind: ImportKind) => {
    clearImportFile(); const version = ++importReadVersion.current; setImportReading(true);
    try {
      if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('仅支持 .xlsx 或 UTF-8 .csv 文件；Numbers 请先导出为 Excel');
      if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10MB，请拆分后导入');
      if (/\.xlsx$/i.test(file.name)) await validateImportWorkbook(file);
      const sheets = /\.csv$/i.test(file.name)
        ? [{ sheet: 'CSV', data: parseImportCsv(await file.text()) }]
        : await readXlsxFile(file, { parseNumber: value => value });
      if (version !== importReadVersion.current) return false;
      if (!sheets.length) throw new Error('文件没有工作表');
      setImportSheets(sheets);
      const matching = sheets.filter(sheet => hasImportHeader(sheet.data, kind));
      const selected = matching.find(sheet => { try { return parseImportRows(sheet.data, kind).rows.length > 0; } catch { return false; } }) || matching[0] || sheets[0];
      applyImportSheet(selected, kind);
    } catch (error: any) { if (version === importReadVersion.current) setImportFileError(error?.message || '读取失败，请检查文件是否损坏、加密或包含未计算的公式'); }
    finally { if (version === importReadVersion.current) setImportReading(false); }
    return false;
  };
  const parseGroupFile = (file: File) => readImportFile(file, 'groups');
  const openEntryImport = (kind: 'players' | 'judges') => { clearImportFile(); setEntryImportKind(kind); };
  const parseEntryFile = (file: File) => readImportFile(file, entryImportKind || 'players');
  const importEntries = async (decisions: ImportIdentityDecision[] = []) => {
    if (entryImportSubmitting.current) return;
    if (importReading || importFileError || entryImportErrors.length) { message.warning('请先修正文件中的错误再导入'); return; }
    if (!entryImportKind || !entryImportRows.length) { message.warning('请先上传填写好的模板'); return; }
    entryImportSubmitting.current = true;
    setEntryImportBusy(true);
    try {
      const result = await (entryImportKind === 'players' ? eventApi.importPlayers : eventApi.importJudges)({ competitionId, rows: entryImportRows, decisions });
      if (result.conflicts?.length) { setEntryImportConflicts(result.conflicts); return; }
      setEntryImportConflicts([]);
      const summary = `新增 ${result.created}，更新 ${result.updated}${entryImportKind === 'judges' ? `，分配 ${result.assigned || 0}，已有分配 ${result.skipped || 0}` : `，跳过 ${result.skipped || 0} 行`}，错误 ${result.errors.length}`;
      if (result.errors.length) message.warning(summary); else message.success(summary);
      setEntryImportErrors(result.errors);
      if (!result.errors.length) setEntryImportKind(null);
      setMembers([]);
      await load();
    } catch (error: any) { message.error(error?.response?.data?.error || error?.message || '导入失败'); }
    finally { entryImportSubmitting.current = false; setEntryImportBusy(false); }
  };

  const importGroups = async () => {
    if (!importRows.length || groupImportErrors.length || importFileError || importReading) { message.warning('请先上传有效文件并修正错误'); return; }
    setGroupImportBusy(true);
    try {
      const result = await eventApi.importGroups({ competitionId, rows: importRows });
      message.success(`新增 ${result.created}，更新 ${result.updated}，错误 ${result.errors.length}`);
      setGroupImportErrors(result.errors);
      if (!result.errors.length) { setImportModal(false); clearImportFile(); }
      await load();
    } catch (error: any) { setImportFileError(error?.response?.data?.error || '导入失败，请重试'); }
    finally { setGroupImportBusy(false); }
  };

  const deleteGroup = (row: any) => {
    modal.confirm({
      title: `删除组别“${row.name}”？`,
      content: Number(row.judgeCount || 0) > 0
        ? `该空组别的 ${row.judgeCount} 条评委分配将同时移除，此操作不可撤销。`
        : '此操作不可撤销。',
      okText: <DeleteOutlined aria-label="删除" title="删除" />,
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await eventApi.deleteGroup(row.id);
          if (Number(selectedGroupId) === Number(row.id)) {
            setSelectedGroupId(null);
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

  const groupPositions = new Map(groups.map((row, index) => [Number(row.id), index + 1]));
  const saveGroupPosition = async (row: any, position: number | null) => {
    if (groupSortSavingRef.current || loading) return;
    if (!Number.isSafeInteger(position) || Number(position) < 1 || Number(position) > groups.length) {
      setGroupSortDrafts(previous => { const next = { ...previous }; delete next[row.id]; return next; });
      message.warning(`序号须为 1 至 ${groups.length} 的整数`);
      return;
    }
    const previous = groups;
    const next = moveGroupToPosition(previous, Number(row.id), Number(position));
    setGroupSortDrafts({});
    if (next === previous) return;
    groupSortSavingRef.current = true;
    setGroupSortSaving(true);
    setGroups(next);
    try {
      await eventApi.reorderGroups({ competitionId, ids: next.map(item => Number(item.id)), previousIds: previous.map(item => Number(item.id)) });
      message.success('组别排序已保存');
    } catch (error: any) {
      setGroups(previous);
      message.error(error?.response?.data?.error || '排序保存失败，请重试');
      await load();
    } finally {
      groupSortSavingRef.current = false;
      setGroupSortSaving(false);
    }
  };
  const groupDragDisabled = groupSortSaving || loading || Boolean(sectionKeyword.trim()) || Boolean(selectedGroupId) || groupColumnSorted;
  const groupDrag = useGroupDragSort({
    ids: groups.map(row => Number(row.id)), disabled: groupDragDisabled,
    onMove: (id, position) => { const row = groups.find(item => Number(item.id) === id); if (row) void saveGroupPosition(row, position); },
  });
  const groupColumns = sortableColumns<any>([
    { title: '组别名称', dataIndex: 'name', width: 165, fixed: 'left' },
    { title: '顺序序号', dataIndex: 'groupPosition', width: 120, render: (_: unknown, row: any) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button type="button" className={groupDrag.handleClassName} disabled={groupDragDisabled}
        aria-label={`拖动排序：${row.name}`}
        title={sectionKeyword.trim() || selectedGroupId || groupColumnSorted ? '清空筛选并取消列排序后可拖动' : '按住拖动排序，靠近上下边缘可持续滚动；Esc取消；上下方向键移动'}
        onPointerDown={event => groupDrag.start(event, Number(row.id))}
        onKeyDown={event => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const target = Number(groupPositions.get(Number(row.id))) + (event.key === 'ArrowUp' ? -1 : 1);
          if (!groupDragDisabled && !groupDrag.dragging && target >= 1 && target <= groups.length) void saveGroupPosition(row, target);
        }}><HolderOutlined /></button>
      <InputNumber size="small" min={1} max={groups.length} precision={0} controls={false} style={{ width: 64 }}
        aria-label={`组别序号：${row.name}`} title="修改全赛事中的位置，回车或离开输入框保存"
        disabled={groupSortSaving || loading || groupDrag.dragging}
        value={Object.prototype.hasOwnProperty.call(groupSortDrafts, row.id) ? groupSortDrafts[row.id] : groupPositions.get(Number(row.id))}
        onChange={value => setGroupSortDrafts(previous => ({ ...previous, [row.id]: value }))}
        onBlur={() => { if (Object.prototype.hasOwnProperty.call(groupSortDrafts, row.id)) void saveGroupPosition(row, groupSortDrafts[row.id]); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </span> },
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
    { title: '选手', dataIndex: 'name', width: 130, fixed: 'left', render: (v: string, row: any) => <Button type="link" size="small" style={{padding:0,height:"auto",whiteSpace:"normal"}} onClick={()=>setProfilePlayerId(row.id)}>{v}</Button> },
    { title: '编号', dataIndex: 'programNumber', width: 115 },
    { title: '组别', dataIndex: 'groupName', width: 150, render: (v: string) => v || '-' },
    { title: '节目（音乐）名字', dataIndex: 'performanceTitle', width: 180, render: (v: string) => v || '-' },
    { title: '音乐', dataIndex: 'musicName', width: 300, render: (_: any, row: any) => <EventMusicPlayer player={row} onUploaded={load} /> },
    { title: '报名费', dataIndex: 'registrationFee', width: 100, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
    { title: '缴费状态', dataIndex: 'paidStatus', width: 100, render: (v: string) => statusTag(v) },
    { title: '缴费时间', dataIndex: 'paidAt', width: 170, render: showDate },
    { title: '得分', dataIndex: 'scoreStatus', width: 130, render: (_: string, row: any) => {
      const ranking = rankingByPlayerId.get(Number(row.id));
      if (!ranking?.scoreCount && ranking?.manualTotal == null) return <Tag>未评分</Tag>;
      return <strong style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{formatFinalScore(ranking.calculatedTotal, rankings.filter(item => Number(item.groupId) === Number(row.groupId)).map(item => item.calculatedTotal))}</strong>;
    } },
    {
      title: '处理',
      width: 390,
      render: (_: any, row: any) => (
        <Space>
          <Button size="small" onClick={() => openPlayer(row)}>编辑</Button>
          <Button size="small" icon={<DollarOutlined />} onClick={() => void openPayment(row)}>登记缴费</Button>

          <Button size="small" type="primary" onClick={() => openPlayerScoreManager(row)}>评分</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePlayersInBatch([row.id], row.groupId ?? null)} aria-label="删除" title="删除"></Button>
        </Space>
      ),
    },
  ]);

  const managedPlayerColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 124, render: (v: string, row: any) => <Link title="查看选手详情" href={`/events/players/${row.id}`}>{v}</Link> },
    { title: '编号', dataIndex: 'programNumber', width: 115 },
    { title: '出场顺序', dataIndex: 'sequenceNo', width: 100, render: (v: number) => Number(v) > 0 ? v : <Tag>未安排</Tag> },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v: string) => v || '-' },
    { title: '机构', dataIndex: 'organization', width: 140, render: (v: string) => v || '-' },
    { title: '音乐', dataIndex: 'musicName', width: 260, render: (_: any, row: any) => <EventMusicPlayer player={row} onUploaded={load} /> },
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
      width: 210,
      render: (_: any, row: any) => (
        <Space size={[4, 4]} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`/events/players/${row.id}`)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPlayer(row)}>修改</Button>
          <Button size="small" icon={<DollarOutlined />} onClick={() => void openPayment(row)}>登记缴费</Button>
          <Button size="small" type="primary" onClick={() => openPlayerScoreManager(row)}>评分</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePlayersInBatch([row.id], row.groupId ?? null)} aria-label="删除" title="删除"></Button>
        </Space>
      ),
    },
  ]);

  const groupJudgeColumns = sortableColumns<any>([
    { title: '评委', width: 150, fixed: 'left', render: (_: any, row: any) => judgeDisplayName(row) },
    { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => v === 'leader' ? '主评委' : '评委' },
    {
      title: '操作',
      render: (_: any, row: any) => <Button size="small" danger icon={<DeleteOutlined />} aria-label={`移除${judgeDisplayName(row)}`} title="移除本组评委安排" onClick={() => deleteJudgesInBatch([row.judgeId])} />,
    },
  ]);

  const contestantColumns = sortableColumns<any>([
    { title: '选手', dataIndex: 'name', width: 140, fixed: 'left', render: (value: string, row: any) => <Button type="link" size="small" style={{padding:0,height:"auto",whiteSpace:"normal"}} onClick={()=>setProfilePlayerId(row.id)}>{value}</Button> },
    { title: '编号', dataIndex: 'contestantNumber', width: 115 },
    { title: '手机号', dataIndex: 'phone', width: 140, render: (value: string) => value || '-' },
    { title: '机构', dataIndex: 'organization', width: 170, render: (value: string) => value || '-' },
    { title: '报名数', width: 90, render: (_: any, row: any) => row.entries.length },
    { title: '报名费', dataIndex: 'totalRegistrationFee', width: 110, render: (value: number) => `¥${Number(value || 0).toFixed(2)}` },
    { title: '参赛组别', width: 440, render: (_: any, row: any) => <Space direction="vertical" style={{ width: '100%' }}>{row.entries.map((entry: any) => <Space key={entry.id} wrap>
      <Button type="link" size="small" className={styles.entryEditButton} aria-label={`编辑${row.name}的${entry.groupName || '未分组'}报名`} onClick={() => openPlayer(entry)}>{entry.groupName || '未分组'} · ¥{Number(entry.registrationFee || 0).toFixed(2)}</Button>
      {statusTag(entry.paidStatus)}
    </Space>)}</Space> },
  ]);
  const playerJudgeScoreColumns = sortableColumns<any>([
    { title: '评委', dataIndex: 'name', width: 140, fixed: 'left' },
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
    { title: '组别', dataIndex: 'groupName', width: 165, fixed: 'left', render: (v: string) => v || '-' },
    { title: '选手', dataIndex: 'playerName', width: 130 },
    { title: '评委', dataIndex: 'judgeName', width: 120 },
    { title: '评委总分', dataIndex: 'calculatedScore', width: 100, render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '状态', dataIndex: 'scoreStatus', width: 90, render: (v: string) => statusTag(v) },
    { title: '异常', dataIndex: 'isAbnormal', width: 100, render: (v: boolean, row: any) => v ? statusTag('异常', true) : row.scoreStatus === 'voided' ? statusTag('voided') : <Tag>正常</Tag> },
    { title: '说明', dataIndex: 'abnormalReason', width: 240, render: (v: string) => v || '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 190, render: (v: string) => v || '-' },
  ]);
  const scoreIssueColumns = sortableColumns<any>([
    ...scoreColumns.slice(0, 2),
    { title: '评分记录 ID', dataIndex: 'id', width: 120 },
    ...scoreColumns.slice(2),
  ]);

  const addGroupJudges = (groupId: number) => {
    
    setAssignGroupIds([groupId]); setSelectedJudges([]); setAssignGroupSearch(''); setAssignJudgeSearch('');
    setAssignGroupSearchOpen(false); setAssignJudgeSearchOpen(false); setAssignModal(true);
  };
  const removeGroupJudges = async () => {
    if (!judgeRemoveGroup || !judgeRemoveIds.length) return;
    setJudgeRemoveBusy(true);
    try {
      await eventApi.batchDeleteGroupJudges({ competitionId, groupId: judgeRemoveGroup.id, judgeIds: judgeRemoveIds });
      message.success('已解除所选评委的本组安排');
      setJudgeRemoveGroup(null); setJudgeRemoveIds([]); await load();
    } catch (error: any) { message.error(error?.response?.data?.error || '移除失败，请重试'); }
    finally { setJudgeRemoveBusy(false); }
  };
  const openNotice = async () => {
    setNoticeBusy(true);
    try {
      const response = await api.get('/event/notices', { params: { competitionId } });
      setNoticeAudience(response.data.data);
      noticeKey.current = crypto.randomUUID();
      noticeForm.resetFields();
      setNoticeOpen(true);
    } catch (error: any) { message.error(error?.response?.data?.error || '通知接收人加载失败'); }
    finally { setNoticeBusy(false); }
  };
  const sendNotice = async () => {
    const values = await noticeForm.validateFields();
    setNoticeBusy(true);
    try {
      const response = await api.post('/event/notices', { competitionId, ...values, requestKey: noticeKey.current });
      message.success(`通知已发送，已投递 ${response.data.data.recipients} 人`);
      setNoticeOpen(false);
    } catch (error: any) { message.error(error?.response?.data?.error || '通知发送失败，请重试'); }
    finally { setNoticeBusy(false); }
  };
  const exportSection = async (kind: ImportKind) => {
    if (kind === 'players') {
      if (entryExportSubmitting.current) return;
      if (!visiblePlayers.length) { message.info('当前筛选没有可导出的数据'); return; }
      entryExportSubmitting.current = true; setEntryExportBusy(true);
      try {
        const blob = await eventApi.exportPlayers({ competitionId: Number(competitionId), ids: visiblePlayers.map(row => Number(row.id)) });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `${(competition?.name || '赛事').replace(/[\\/:*?"<>|]/g, '_')}-报名表格.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.success(`已导出 ${visiblePlayers.length} 条报名，包含音乐和缴费明细`);
      } catch (error: any) {
        let detail = error?.response?.data;
        if (detail instanceof Blob) { try { detail = JSON.parse(await detail.text()); } catch { detail = null; } }
        message.error(detail?.error || error?.message || '导出失败，请重试');
      } finally { entryExportSubmitting.current = false; setEntryExportBusy(false); }
      return;
    }
    if (kind === 'groups') {
      if (entryExportSubmitting.current) return;
      const rows = groups.filter(row => (!selectedGroupId || Number(row.id) === Number(selectedGroupId)) && matchesSection(row, 'groups'));
      if (!rows.length) { message.info('当前筛选没有可导出的数据'); return; }
      entryExportSubmitting.current = true;
      setEntryExportBusy(true);
      try {
        const { default: writeExcelFile } = await import('write-excel-file/browser');
        const header = groupExportHeaders.map(value => ({ value, fontWeight: 'bold' as const, backgroundColor: '#F3F4F6' }));
        const data: SheetData = [header, ...rows.map(row => [
          groupPositions.get(Number(row.id)) ?? null,
          { value: String(row.name ?? ''), type: String, wrap: true },
          { value: Number(row.registrationFee ?? 0), format: '0.00' },
          Number(row.playerCount ?? 0),
          Number(row.judgeCount ?? 0),
          groupScoringLabel(row.scoringStatus),
        ])];
        const filename = `${(competition?.name || '赛事').replace(/[\\/:*?"<>|\r\n]/g, '_')}-组别.xlsx`;
        await writeExcelFile(data, {
          sheet: '组别',
          stickyRowsCount: 1,
          columns: [10, 48, 14, 12, 12, 14].map(width => ({ width })),
        }).toFile(filename);
      } catch {
        message.error('导出组别失败，请重试');
      } finally {
        entryExportSubmitting.current = false;
        setEntryExportBusy(false);
      }
      return;
    }
    const rows = competitionJudgeAssignments.filter(row => (!selectedGroupId || Number(row.groupId) === Number(selectedGroupId)) && matchesSection(row, 'judges')).map((row, index) => ({ '序号': index + 1, '组别名称': row.groupName, '评委姓名': row.name, '手机号': row.phone, '所属机构': row.organization, '职称': row.title }));
    if (!rows.length) { message.info('当前筛选没有可导出的数据'); return; }
    const url = URL.createObjectURL(new Blob([eventImportCsv(kind, rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${competition?.name || '赛事'}-评委.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sectionToolbar = (section: string) => <div className={styles.sectionToolbar}>
    <Space wrap className={styles.sectionFilters}>
      <Select
            placeholder="筛选组别"
            value={selectedGroupId || undefined}
            style={{ width: 220 }}
            showSearch
            allowClear
            filterOption={(input, option) => String(option?.searchText ?? option?.label ?? '').includes(input.trim().toLocaleLowerCase())}
            options={groupSearchOptions}
            onChange={(value) => {
              const nextGroupId = value ?? null;
              setSelectedGroupId(nextGroupId);
             
              setSelectedPlayerIds([]);
              setSelectedJudgeIds([]);
            }}
          />
      <Input.Search allowClear value={sectionKeyword} onChange={event => { setSectionKeyword(event.target.value); }} placeholder={({ groups: '搜索组别名称', players: '搜索当前报名和音乐信息', contestants: '搜索当前选手信息', judges: '搜索评委姓名或组别名称', scoring: '搜索当前评分记录', results: '搜索当前公示结果' } as Record<string,string>)[section]} style={{ width: 240 }} />
    </Space>
    <Space wrap>
      {section === 'judges' && <Space.Compact>
        <Button type={judgeView === 'groups' ? 'primary' : 'default'} aria-pressed={judgeView === 'groups'} onClick={() => setJudgeView('groups')}>按组别显示</Button>
        <Button type={judgeView === 'judges' ? 'primary' : 'default'} aria-pressed={judgeView === 'judges'} onClick={() => setJudgeView('judges')}>按评委显示</Button>
      </Space.Compact>}
      <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
      {['groups', 'players', 'judges'].includes(section) && <Button className={styles.transferButton} icon={<DownloadOutlined />} loading={section !== 'judges' && entryExportBusy} disabled={loading} onClick={() => void exportSection(section as ImportKind)}>导出表格</Button>}
      {section === 'groups' && <><Button icon={<PlusOutlined />} onClick={() => openGroupEditor()}>新建组别</Button><Button className={styles.transferButton} icon={<FileExcelOutlined />} onClick={() => setImportModal(true)}>导入组别</Button></>}
      {section === 'players' && <><Button icon={<PlusOutlined />} onClick={() => openPlayer()}>新建报名</Button><Button className={styles.transferButton} icon={<FileExcelOutlined />} onClick={() => openEntryImport('players')}>导入报名</Button></>}
      {section === 'judges' && <><Button className={styles.transferButton} icon={<FileExcelOutlined />} onClick={() => openEntryImport('judges')}>导入评委</Button><Button type="primary" icon={<UserSwitchOutlined />} onClick={() => {
            setAssignGroupIds(selectedGroupId ? [selectedGroupId] : []);
            setSelectedJudges([]);
            setAssignGroupSearch('');
            setAssignJudgeSearch('');
            setAssignGroupSearchOpen(false);
            setAssignJudgeSearchOpen(false);
            setAssignModal(true);
          }}>分配评委</Button></>}
    </Space>
  </div>;

  return (
    <div>
      <Space className="event-detail-heading" style={{ marginBottom: 14 }} wrap>
        <Link href="/events">赛事管理</Link>
        <span>/</span>
        <strong>{competition?.name || '赛事详情'}</strong>
        <Button size="small" icon={<SendOutlined />} loading={noticeBusy} onClick={openNotice}>发布通知</Button>
        <Button size="small" icon={<SettingOutlined />} onClick={openRuleEditor}>赛事评分规则</Button>
        <Button size="small" className={styles.randomize} icon={<ReloadOutlined />} loading={randomizing} disabled={loading || randomizing || !players.length} onClick={randomizeEventSequence}>出场随机排序</Button>
        <Button danger size="small" icon={<DeleteOutlined />} onClick={deleteCompetition} aria-label="删除赛事" title="删除赛事"></Button>
      </Space>

      <Card size="small" className={styles.informationCard}>
        <Tabs className={styles.informationTabs} activeKey={activeTab} onChange={switchInformation} tabBarExtraContent={canViewRevenue ? { right: <div className={styles.revenueCards}>
          {([
            ['总收入', competition?.revenue?.totalFen, '实际收取的报名费，已扣除退款，含管理员登记的收费。'],
            ['平台缴费', competition?.revenue?.platformFen, '平台确认支付成功的报名费，已扣除退款。'],
          ] as const).map(([name, fen, description]) => <div key={name} className={styles.revenueCard} title={description}>
            {name === '总收入' ? <button type="button" className={styles.revenueButton} onClick={()=>setRevenueOpen(true)} aria-label="查看总收入明细">{informationLabel(name, typeof fen === 'number' ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(fen / 100) : '—', <DollarOutlined />)}<span className={styles.revenueHint}>查看明细</span></button> : informationLabel(name, typeof fen === 'number' ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(fen / 100) : '—', <DollarOutlined />)}
          </div>)}
        </div> } : undefined} items={[
          { key: 'groups', label: informationLabel('组别', groups.length, <TrophyOutlined />), children: <>{sectionToolbar('groups')}<Table rowKey="id" rowClassName={row => groupDrag.rowClassName(Number(row.id))} onChange={(_pagination, _filters, sorter) => setGroupColumnSorted((Array.isArray(sorter) ? sorter : [sorter]).some(item => Boolean(item.order)))} loading={loading || groupSortSaving} columns={groupColumns} dataSource={groups.map((row, index) => ({ ...row, groupPosition: index + 1 })).filter(row => (!selectedGroupId || Number(row.id) === Number(selectedGroupId)) && matchesSection(row, 'groups'))} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 760 }} /></> },
          { key: 'players', label: informationLabel('报名', players.length, <AuditOutlined />), children: (
            <>{sectionToolbar('players')}<Table loading={loading} columns={playerColumns} rowKey="id" dataSource={visiblePlayers} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 1715 }} /></>
          ) },
          { key: 'music', label: informationLabel('音乐', players.filter(row => row.musicFileId > 0 && !['cancelled', 'withdrawn'].includes(row.status) && row.auditStatus !== 'rejected').length, <CustomerServiceOutlined />),
            children: <EventMusicBoard key={competitionId} competitionId={competitionId} groups={groups} players={players}
              active={activeTab === 'music'} busy={loading || randomizing || groupSortSaving} onRefresh={async () => { await load(); }}
              onMoveGroup={(id, position) => saveGroupPosition({ id }, position)} /> },
          { key: 'contestants', label: informationLabel('选手', contestantRows.length, <TeamOutlined />), children: <>{sectionToolbar('contestants')}<Table loading={loading} columns={contestantColumns} dataSource={visibleContestants} rowKey="key" size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true }} scroll={{ x: 1315 }} /></> },
          { key: 'judges', label: informationLabel('评委', eventJudgeRows.length, <UserSwitchOutlined />), children: <>{sectionToolbar('judges')}
            {judgeView === 'groups' ? <Table key="by-group" adaptiveFillRows adaptiveBottomGap={20} className={styles.judgeArrangementTable} loading={loading} rowKey="id" bordered size="small" dataSource={judgeGroupRows}
              pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100], showTotal: total => `共 ${total} 个组别` }}
              columns={[
                { title: '组别', dataIndex: 'name', width: '28%', render: (name: string) => <strong className={styles.judgeGroupName}>{name}</strong> },
                { title: '评委人数', width: 100, render: (_: any, group: any) => new Set(group.allJudges.map((judge: any) => Number(judge.judgeId))).size },
                { title: '评委', render: (_: any, group: any) => <div data-testid={`judge-group-${group.id}`}>
                  <div className={styles.groupJudgeGrid}>{group.judges.length ? group.judges.map((judge: any) => <span className={styles.groupJudgeName} key={judge.id} title={judgeDisplayName(judge)}>{judgeDisplayName(judge)}</span>) : <span className={styles.groupJudgeEmpty}>{group.allJudges.length ? '没有匹配的评委' : '暂无评委'}</span>}</div>
                  <Space className={styles.judgeRowActions}>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => addGroupJudges(Number(group.id))}>添加</Button>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!group.allJudges.length} aria-label={`删除${group.name}的评委安排`} title="删除本组评委安排" onClick={() => { setJudgeRemoveGroup(group); setJudgeRemoveIds([]); }} />
                  </Space>
                </div> },
              ]} /> : <Table key="by-judge" adaptiveFillRows adaptiveBottomGap={20} className={styles.judgeArrangementTable} loading={loading} rowKey="judgeId" bordered size="small" dataSource={judgeResponsibilityRows}
                pagination={{ showSizeChanger: true, showTotal: total => `共 ${total} 位评委` }}
                columns={[
                  { title: '评委', width: '28%', render: (_: any, judge: any) => <strong className={styles.judgeGroupName}>{judgeDisplayName(judge)}</strong> },
                  { title: '负责组别', render: (_: any, judge: any) => <div className={styles.judgeGroupGrid}>{judge.assignments.map((assignment: any) => <span className={styles.judgeGroupItem} key={assignment.groupId} title={assignment.groupName}>{assignment.groupName}</span>)}</div> },
                ]} />}

          </> },
          { key: 'scoring', label: informationLabel('评分', judgeScoreSummaries.length, <EditOutlined />), children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {sectionToolbar('scoring')}
              <Alert type="info" showIcon message={selectedGroup
                ? `当前组别：${selectedGroup.name}。改分会生成新版本，旧分自动作废并保留审计记录。`
                : '当前显示全部组别、全部选手、全部评委的评分总分；可使用上方搜索框筛选具体组别。'} />
              <Tabs activeKey={scoreView} onChange={setScoreView} items={[{ key: 'scores', label: `评分记录 (${scopedScoreSummaries.length})` }, { key: 'issues', label: `异常处理 (${scopedAbnormalScores.length})` }]} />
              {scoreView === 'issues' && <Alert type="warning" showIcon message="异常分、作废分保留在这里；可在选手的评分管理中处理，旧版本仍保留审计记录。" />}
              <Table loading={boardLoading} rowKey={row => row.key ?? row.id} columns={scoreView === 'issues' ? scoreIssueColumns : scoreColumns} dataSource={(scoreView === 'issues' ? scopedAbnormalScores : scopedScoreSummaries).filter(row => matchesSection(row, 'scoring'))} size="small" pagination={{ pageSize: adaptivePageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 30, 50, 100] }} scroll={{ x: 1300 }} />
            </Space>
          ) },
          { key: 'results', label: informationLabel('结果公示', rankings.filter(item => item.status === 'published').length, <EyeOutlined />), children: (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {sectionToolbar('results')}
              <Space wrap>
                <Button icon={<EyeOutlined />} onClick={() => window.open(`https://www.swod.com.cn/event-results/${competitionId}`, '_blank', 'noopener,noreferrer')}>打开公示大屏</Button>
              </Space>
              <Alert type="info" showIcon message="每个组别使用固定尺寸卡片，前三名显示领奖台，其余名次可在卡片内滚动；组别区域会自动滚动。每个节目完成评分后自动公示得分；本组全部节目完成后才显示排名和领奖台，可分享大屏链接。" />
              <div ref={resultsScrollRef} style={{ maxHeight: 'calc(100vh - 260px)', minHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {resultGroups.length ? (
                  <div className={styles.resultGroupGrid}>
                    {resultGroups.map((group) => <ResultGroupCard key={group.id} groupName={group.name} rows={group.rows} />)}
                  </div>
                ) : <div style={{ padding: '72px 24px', textAlign: 'center', color: '#9ca3af' }}>暂无可展示的组别成绩</div>}
              </div>
            </Space>
          ) },
        ]} />
      </Card>

      <Modal title="删除本组评委安排" open={!!judgeRemoveGroup} onCancel={() => { if (!judgeRemoveBusy) setJudgeRemoveGroup(null); }} onOk={removeGroupJudges} okText="确认删除安排" confirmLoading={judgeRemoveBusy} okButtonProps={{ danger: true, disabled: !judgeRemoveIds.length }}>
        <p>组别：{judgeRemoveGroup?.name}</p>
        <Select aria-label="选择要移除的评委" mode="multiple" showSearch optionFilterProp="label" placeholder="选择要移除的评委" style={{ width: '100%' }} value={judgeRemoveIds} onChange={setJudgeRemoveIds} options={(judgeRemoveGroup?.allJudges || []).map((judge: any) => ({ value: Number(judge.judgeId), label: judgeDisplayName(judge) }))} />
        <Alert type="info" showIcon message="仅解除本组评委安排，保留评委资料与已有评分记录。" style={{ marginTop: 16 }} />
      </Modal>
      <Modal title="发布赛事通知" open={noticeOpen} onCancel={() => { if (!noticeBusy) setNoticeOpen(false); }} onOk={sendNotice} okText="发送站内通知" confirmLoading={noticeBusy} okButtonProps={{ disabled: !noticeAudience?.recipients }} width={600}>
        <Alert type="info" showIcon message={`接收范围：本赛事选手 ${noticeAudience?.players || 0} 人、评委 ${noticeAudience?.judges || 0} 人；去重后 ${noticeAudience?.recipients || 0} 人。`} style={{ marginBottom: 16 }} />
        {!!noticeAudience?.unmatched && <Alert type="warning" showIcon message={`${noticeAudience.unmatched} 位相关人员尚未关联有效用户账号，无法接收站内通知。请先完善账号关联。`} style={{ marginBottom: 16 }} />}
        <Form form={noticeForm} layout="vertical">
          <Form.Item name="title" label="通知标题" rules={[{ required: true, whitespace: true, message: '请填写通知标题' }]}><Input maxLength={60} showCount /></Form.Item>
          <Form.Item name="content" label="通知内容" rules={[{ required: true, whitespace: true, message: '请填写通知内容' }]}><Input.TextArea rows={6} maxLength={2000} showCount /></Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`组别管理：${selectedGroup?.name || ''}`}
        open={groupManageOpen}
        onCancel={() => setGroupManageOpen(false)}
        footer={null}
        zIndex={groupWorkspaceZIndex}
        className={styles.groupManageModal}
        width="min(calc(100% - 32px), 1680px)"
      >
        <div className={styles.groupManageStack}>
          <Alert
            type="info"
            showIcon
            message={`${selectedGroup?.name || '当前组别'} · 选手 ${groupPlayers.length} · 评委 ${groupJudges.length} · 评分 ${groupScoreSummaries.length}`}
          />
          <Tabs className={styles.groupManageTabs} items={[
            {
              key: 'players',
              label: `选手管理 (${groupPlayers.length})`,
              children: (
                <div className={styles.groupManageStack}>
                  <Space wrap>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openPlayer()}>新增选手</Button>
                    <Button icon={<PlusOutlined />} onClick={() => setBatchPlayerAddModal(true)}>批量添加</Button>
                    <Button icon={<ReloadOutlined />} disabled={!groupPlayers.length} onClick={randomizePlayerSequence}>随机安排出场顺序</Button>
                    <Button icon={<EditOutlined />} disabled={!selectedPlayerIds.length} onClick={() => { batchPlayerForm.resetFields(); setBatchPlayerEditModal(true); }}>批量修改</Button>
                    <Button danger icon={<DeleteOutlined />} disabled={!selectedPlayerIds.length} onClick={() => deletePlayersInBatch()} aria-label="批量删除" title="批量删除"></Button>
                    <span style={{ color: '#6b7280' }}>已选 {selectedPlayerIds.length} 条</span>
                  </Space>
                  <Table className={styles.groupManageTable}
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
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: 'judges',
              label: `评委管理 (${groupJudges.length})`,
              children: (
                <div className={styles.groupManageStack}>
                  <Space wrap>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => addGroupJudges(selectedGroupId!)}>添加评委</Button>
                    <Button icon={<EditOutlined />} disabled={!selectedJudgeIds.length} onClick={() => { batchJudgeForm.resetFields(); setBatchJudgeEditModal(true); }}>批量修改</Button>
                    <Button danger icon={<DeleteOutlined />} disabled={!selectedJudgeIds.length} onClick={() => deleteJudgesInBatch()} aria-label="批量移除" title="批量移除"></Button>
                    <span style={{ color: '#6b7280' }}>已选 {selectedJudgeIds.length} 名</span>
                  </Space>
                  <Table className={styles.groupManageTable}
                    size="small"
                    rowKey="judgeId"
                    columns={groupJudgeColumns}
                    dataSource={groupJudges}
                    rowSelection={{
                      selectedRowKeys: selectedJudgeIds,
                      onChange: (keys) => setSelectedJudgeIds(keys as Array<number | string>),
                    }}
                    pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100] }}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
              ),
            },
            {
              key: 'scoring',
              label: `评分 (${groupScoreSummaries.length})`,
              children: (
                <div className={styles.groupManageStack}>
                  <Alert type="info" showIcon message="当前组别的评分记录；可在选手的评分管理中处理评分，旧版本和审计记录保留。" />
                  <Table className={styles.groupManageTable} size="small" loading={boardLoading} columns={scoreColumns} dataSource={groupScoreSummaries} rowKey="key" pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} />
                </div>
              ),
            },
            {
              key: 'results',
              label: `结果公示 (${groupRankings.length})`,
              children: <div className={styles.groupManageStack}>
                {groupRankings.length ? <ResultGroupCard groupName={selectedGroup?.name || ''} rows={groupRankings} /> : <Empty description="当前组别暂无成绩" />}
              </div>,
            },
          ]} />
        </div>
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
            <Col span={8}><Form.Item name="paidStatus" label="缴费状态"><Select allowClear options={[{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="报名状态"><Select allowClear options={[{ value: 'pending', label: '待处理' }, { value: 'approved', label: '已报名' }, { value: 'cancelled', label: '已取消' }]} /></Form.Item></Col>
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

      <Modal className={styles.transferDialog} title="导入组别" open={importModal} onCancel={() => { if (!groupImportBusy) { setImportModal(false); clearImportFile(); } }} confirmLoading={groupImportBusy} okButtonProps={{ className: styles.transferConfirm, disabled: importReading || !importRows.length || Boolean(importFileError) || groupImportErrors.length > 0 }} onOk={importGroups} width={680}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="必填：组别名称。同名组别会更新；序号填整数，报名费最多两位小数，留空为 0。" action={<Button className={styles.templateDownload} icon={<DownloadOutlined style={{ fontSize: 18 }} />} href="/templates/event-group-import-v3.xlsx" download="赛事组别导入模板.xlsx">下载模板</Button>} />
          <Upload.Dragger className={styles.groupImportUpload} accept=".xlsx,.csv" beforeUpload={parseGroupFile} maxCount={1} disabled={groupImportBusy} onRemove={() => { clearImportFile(); }}>
            <p className="ant-upload-drag-icon"><FileExcelOutlined /></p>
            <p className="ant-upload-text">点击或拖入 Excel/CSV 文件</p>
          </Upload.Dragger>
          {importSheets.length > 1 && <Select style={{ width: '100%' }} disabled={importReading || groupImportBusy || entryImportBusy} value={importSheetName} options={importSheets.map(sheet => ({ value: sheet.sheet, label: sheet.sheet }))} onChange={name => { const sheet = importSheets.find(item => item.sheet === name); if (sheet) applyImportSheet(sheet, 'groups'); }} />}
          {importReading && <Alert type="info" showIcon message="正在读取并检查文件，请稍候…" />}
          {importFileError && <Alert type="error" showIcon message={importFileError} />}
          {importWarnings.map(warning => <Alert key={warning} type="warning" showIcon message={warning} />)}
          {importRows.length > 0 && <span>共 {importRows.length} 行组别数据 · {groupImportErrors.length ? '请修正以下错误后再导入' : '格式检查通过'}</span>}
          {groupImportErrors.length > 0 && <Alert type="error" showIcon message={`有 ${groupImportErrors.length} 项错误`} description={<div style={{ maxHeight: 150, overflowY: 'auto' }}>{groupImportErrors.map((error, index) => <div key={index}>Excel 第 {error.row} 行：{error.message}</div>)}</div>} />}
          <div className={styles.groupImportPreview}><Table size="small" rowKey={(_, index) => String(index)} dataSource={importRows} pagination={false} locale={{ emptyText: '请先上传组别文件' }} scroll={Object.keys(importRows[0] || {}).filter(key => key !== '__sourceRow').length > 4 ? { x: 'max-content' } : undefined} columns={(importRows.length ? Object.keys(importRows[0]).filter(key => key !== '__sourceRow') : ['序号', '组别名称', '报名费']).map((key) => ({ title: key, dataIndex: key }))} /></div>
        </Space>
      </Modal>

      {entryImportConflicts.length > 0 && <EventImportIdentityModal key={entryImportConflicts.map(item => item.key).join(',')} conflicts={entryImportConflicts} onCancel={() => setEntryImportConflicts([])} onComplete={decisions => { setEntryImportConflicts([]); void importEntries(decisions); }} />}
      <Modal className={styles.transferDialog} title={entryImportKind === 'players' ? '导入报名' : '导入评委'} open={Boolean(entryImportKind)} confirmLoading={entryImportBusy} okButtonProps={{ className: styles.transferConfirm, disabled: importReading || !entryImportRows.length || Boolean(importFileError) || entryImportErrors.length > 0 }} onCancel={() => { if (!entryImportBusy) { setEntryImportConflicts([]); setEntryImportKind(null); clearImportFile(); } }} onOk={() => void importEntries()} width={800}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon description="区号和手机号分列填写，例如区号填「中国大陆 +86」，手机号填「13800138000」。其他国家或地区请填写对应区号。旧表格没有区号列时仍可按原格式导入。" message={entryImportKind === 'players'
            ? '必填：组别名称、选手姓名、手机号。组别名称须与赛事一致；同组同手机号会更新。档案冲突先确认，合并后用新姓名覆盖；选择否则跳过。新报名默认为未缴费。'
            : '必填：组别名称、评委姓名、手机号。组别名称须与赛事一致；多个组别分行填写。按手机号匹配人员，未匹配则新建；重复分配会跳过。'} action={<Button className={styles.templateDownload} icon={<DownloadOutlined style={{ fontSize: 18 }} />} href={entryImportKind === 'players' ? '/templates/event-player-import-v3.xlsx' : '/templates/event-judge-import-v4.xlsx'} download={entryImportKind === 'players' ? '赛事报名导入模板.xlsx' : '赛事评委导入模板.xlsx'}>下载模板</Button>} />
          <Upload.Dragger key={entryImportKind || 'closed'} className={styles.groupImportUpload} accept=".xlsx,.csv" beforeUpload={parseEntryFile} maxCount={1} disabled={entryImportBusy} onRemove={() => { clearImportFile(); }}>
            <p className="ant-upload-drag-icon"><FileExcelOutlined /></p><p className="ant-upload-text">点击或拖入 Excel/CSV 文件</p>
          </Upload.Dragger>
          {importSheets.length > 1 && <Select style={{ width: '100%' }} disabled={importReading || groupImportBusy || entryImportBusy} value={importSheetName} options={importSheets.map(sheet => ({ value: sheet.sheet, label: sheet.sheet }))} onChange={name => { const sheet = importSheets.find(item => item.sheet === name); if (sheet) applyImportSheet(sheet, entryImportKind || 'players'); }} />}
          {importReading && <Alert type="info" showIcon message="正在读取并检查文件，请稍候…" />}
          {importFileError && <Alert type="error" showIcon message={importFileError} />}
          {importWarnings.map(warning => <Alert key={warning} type="warning" showIcon message={warning} />)}
          {entryImportRows.length > 0 && <span>共 {entryImportRows.length} 行待导入</span>}
          <div className={styles.groupImportPreview}><Table size="small" pagination={false} rowKey={(_, index) => String(index)} dataSource={entryImportRows} locale={{ emptyText: '请先上传文件' }} scroll={{ x: 'max-content' }} columns={(entryImportRows.length ? Object.keys(entryImportRows[0]).filter(key => key !== '__sourceRow') : (entryImportKind === 'players' ? ['组别名称', '选手姓名', '区号', '手机号', '领队机构', '领队老师', '节目名称'] : ['序号', '组别名称', '评委姓名', '区号', '手机号', '所属机构'])).map(key => ({ title: key, dataIndex: key }))} /></div>
          {entryImportErrors.length > 0 && <Alert type="warning" showIcon message={`有 ${entryImportErrors.length} 项错误，请修改文件后重新上传；若已提交导入，成功行已保存，重复导入会更新。`} description={<div style={{ maxHeight: 150, overflow: 'auto' }}>{entryImportErrors.map(error => <div key={error.row}>Excel 第 {error.row} 行：{error.message}</div>)}</div>} />}
        </Space>
      </Modal>

      <Modal title="赛事评分规则" open={ruleModal} onCancel={() => setRuleModal(false)} onOk={saveRule} width={620} confirmLoading={ruleSaving} okButtonProps={{ disabled: editingPoints !== 1000 }} cancelButtonProps={{ disabled: ruleSaving }} maskClosable={!ruleSaving}>
        <Form form={ruleForm} layout="vertical">
          <Alert style={{ marginBottom: 16 }} type="info" showIcon message="可调整评分项目和分值，分项满分合计必须为 10 分。已锁定且有评分的组别保留原规则。" />
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.List name="criteria" rules={[{ validator: async (_, rows) => {
            if (!rows?.length || editingPoints !== 1000) throw new Error('评分项目满分合计必须为 10 分');
          } }]}>
            {(fields, { add, remove }, { errors }) => <>
              <Space wrap style={{ marginBottom: 12 }}>
                <strong>评分项目</strong><Tag color={editingPoints === 1000 ? 'green' : 'orange'}>{editingPoints / 100} / 10 分</Tag>
                <Button size="small" onClick={() => ruleForm.setFieldValue('criteria', DEFAULT_SCORE_CRITERIA.map(item => ({ ...item })))}>使用默认规则</Button>
              </Space>
              {fields.map(field => <Row key={field.key} gutter={8} wrap={false}>
                <Form.Item name={[field.name, 'id']} hidden><Input /></Form.Item>
                <Col flex="1 1 0">
                  <Form.Item name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}>
                    <Input aria-label={`项目 ${field.name + 1} 名称`} placeholder="项目名称" maxLength={60} />
                  </Form.Item>
                </Col>
                <Col flex="96px">
                  <Form.Item name={[field.name, 'maxScore']} rules={[{ required: true, type: 'number', min: 0.01, max: 10, message: '填写 0.01 至 10 分' }]}>
                    <InputNumber aria-label={`项目 ${field.name + 1} 满分`} placeholder="满分" min={0.01} max={10} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col><Button danger disabled={fields.length === 1} aria-label={`删除项目 ${field.name + 1}`} icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Col>
              </Row>)}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" block onClick={() => add({ id: crypto.randomUUID(), name: '', maxScore: null })} style={{ marginBottom: 16 }}>添加评分项目</Button>
            </>}
          </Form.List>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="总分" extra="固定为10分，不可修改">
                <InputNumber value={10} disabled aria-label="总分，固定为10分" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dropHighLow"
                label="去高低分"
                valuePropName="checked"
                tooltip="仅1位评委时，其评分直接作为最终得分；2～5位直接取平均分；6位及以上开启后，各去掉一个最高分和最低分再取平均"
                extra="1位评委直接出结果；2～5位取平均分；6位及以上开启后去掉一个最高分和最低分再取平均"
              >
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={<Space wrap><span>批量分配评委到组别</span><Button className={styles.transferButton} size="small" icon={<FileExcelOutlined />} disabled={assignBusy} onClick={() => openEntryImport('judges')}>导入评委</Button></Space>} open={assignModal} onCancel={() => {
        if (assignBusy) return;
        setAssignModal(false); setAssignGroupIds([]); setSelectedJudges([]);
        setAssignGroupSearch(''); setAssignJudgeSearch('');
        setAssignGroupSearchOpen(false); setAssignJudgeSearchOpen(false);
      }} onOk={saveAssignment} confirmLoading={assignBusy} okButtonProps={{ disabled: !assignGroupIds.length || !selectedJudges.length }} cancelButtonProps={{ disabled: assignBusy }} closable={!assignBusy} maskClosable={!assignBusy} width={900}>
        <Form layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item label="搜索组别" required>
                <Select aria-label="搜索组别" mode="multiple" showSearch allowClear disabled={assignBusy} value={[]} searchValue={assignGroupSearch} autoClearSearchValue={false}
                  open={assignGroupSearchOpen && Boolean(assignGroupSearch.trim())}
                  onOpenChange={open => setAssignGroupSearchOpen(open && Boolean(assignGroupSearch.trim()))}
                  onFocus={() => { setAssignJudgeSearchOpen(false); setAssignGroupSearchOpen(Boolean(assignGroupSearch.trim())); }}
                  onSearch={value => { setAssignGroupSearch(value); setAssignGroupSearchOpen(Boolean(value.trim())); }}
                  onChange={values => setAssignGroupIds(current => [...new Set([...current, ...values.map(Number)])])}
                  onClear={() => { setAssignGroupSearch(''); setAssignGroupSearchOpen(false); }} filterOption={false}
                  placeholder="输入组别名称后选择搜索结果" notFoundContent={assignGroupSearch.trim() ? '没有未选择的匹配组别' : '请先输入组别名称'}
                  options={assignGroupSearch.trim() ? groups.filter(item => !assignGroupIds.includes(Number(item.id)) && String(item.name || '').toLocaleLowerCase().includes(assignGroupSearch.trim().toLocaleLowerCase())).map(item => ({ value: Number(item.id), label: item.name })) : []} />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>已选组别（{assignGroupIds.length}）</div>
              <div style={{ height: 240, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 8 }}>
                {assignGroupIds.length ? assignGroupIds.map(id => <div key={id} style={{ marginBottom: 6 }}><Tag closable={!assignBusy} onClose={() => setAssignGroupIds(current => current.filter(value => value !== id))} style={{ width: '100%', marginInlineEnd: 0, padding: '4px 8px' }}>{groups.find(group => Number(group.id) === id)?.name || `组别 ${id}`}</Tag></div>) : <span style={{ color: '#999' }}>搜索并选择的组别会显示在这里</span>}
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="搜索评委" required>
                <Select aria-label="搜索评委" mode="multiple" showSearch allowClear disabled={assignBusy} value={[]} searchValue={assignJudgeSearch} autoClearSearchValue={false}
                  open={assignJudgeSearchOpen && Boolean(assignJudgeSearch.trim())}
                  onOpenChange={open => setAssignJudgeSearchOpen(open && Boolean(assignJudgeSearch.trim()))}
                  onFocus={() => { setAssignGroupSearchOpen(false); setAssignJudgeSearchOpen(Boolean(assignJudgeSearch.trim())); }}
                  onSearch={value => { setAssignJudgeSearch(value); setAssignJudgeSearchOpen(Boolean(value.trim())); }}
                  onSelect={(_value, option) => setSelectedJudges(current =>
                    current.some(item => item.value === option.value) ? current : [...current, option])}
                  onClear={() => { setAssignJudgeSearch(''); setAssignJudgeSearchOpen(false); }} filterOption={false}
                  placeholder="搜索全站用户姓名、手机号、ID或微信昵称"
                  loading={searchingJudges}
                  notFoundContent={searchingJudges ? '正在搜索全站用户…' : judgeLookupResult?.failed ? '用户搜索失败，请重新输入重试' : canLookupJudges ? '没有未选择的匹配用户' : '请输入至少两个字符或完整用户 ID'}
                  options={judgeKeyword ? availableAssignmentOptions : []} />
              </Form.Item>
              <div style={{ marginBottom: 8 }}>已选评委（{selectedJudges.length}）</div>
              <div style={{ height: 240, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 8 }}>
                {selectedJudges.length ? selectedJudges.map(option => <div key={option.value} style={{ marginBottom: 6 }}><Tag closable={!assignBusy} onClose={() => setSelectedJudges(current => current.filter(item => item.value !== option.value))} style={{ width: '100%', marginInlineEnd: 0, padding: '4px 8px' }}>{option.label}</Tag></div>) : <span style={{ color: '#999' }}>搜索并选择的评委会显示在这里</span>}
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={`报名收费登记：${paymentPlayer?.name || ''} · ${paymentPlayer?.groupName || ''}（报名${paymentPlayer?.id || ''}）`} open={!!paymentPlayer} onCancel={closePayment} onOk={savePayment} confirmLoading={paymentBusy} width={820} okText="保存登记"
        okButtonProps={{ disabled: !selectedPayment || Boolean(selectedPayment.unavailableReason) }}>
        <Alert type="info" showIcon message="每条报名对应一个组别，一次缴清报名费；登记实际已完成的收款或全额退款。" style={{marginBottom:16}} />
        {paymentLoadError && <Alert type="error" showIcon message={paymentLoadError} action={<Button size="small" onClick={() => void openPayment(paymentPlayer)}>重试</Button>} style={{marginBottom:16}} />}
        {paymentState && <div style={{marginBottom:16}}>报名费 ¥{paymentState.registrationFee.toFixed(2)}　实收 ¥{paymentState.paidAmount.toFixed(2)}　未缴 ¥{paymentState.unpaidAmount.toFixed(2)}</div>}
        {paymentUnavailable && <Alert type="info" showIcon message={paymentUnavailable} style={{marginBottom:16}} />}
        <Form form={paymentForm} layout="vertical" disabled={!paymentState || Boolean(paymentUnavailable) || paymentBusy}>
          <Form.Item name="requestKey" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="kind" label="登记类型" rules={[{required:true}]}><Select placeholder="请选择登记类型" options={[
              {value:'charge',label:'登记缴费',disabled:Boolean(paymentState?.charge.unavailableReason)},
              {value:'refund',label:'登记退款',disabled:Boolean(paymentState?.refund.unavailableReason)},
            ]} /></Form.Item></Col>
            <Col span={8}><Form.Item label="金额" htmlFor="registration-payment-amount"><InputNumber id="registration-payment-amount" value={selectedPayment?.amount ?? null} disabled precision={2} style={{width:'100%'}} /></Form.Item></Col>
            <Col span={8}><Form.Item name="method" label="缴费方式" rules={[{required:true}]}><Select options={Object.entries(paymentMethods).map(([value,label]) => ({value,label}))} /></Form.Item></Col>
          </Row>
          <Form.Item name="paidAt" label="实际缴费 / 退款时间" rules={[{required:true}]}><NumericDateInput showTime /></Form.Item>
          <Form.Item name="remark" label="备注 / 收款凭据编号"><Input /></Form.Item>
        </Form>
        <Table size="small" rowKey="id" dataSource={paymentDetails?.data ?? []} loading={!!paymentPlayer && !paymentDetails && !paymentLoadError} pagination={false} scroll={{y:220}} columns={[
          {title:'类型',dataIndex:'kind',render:(v:string) => v === 'refund' ? '退款' : '缴费'},
          {title:'金额',dataIndex:'amount',render:(v:number) => `¥${Number(v).toFixed(2)}`},
          {title:'方式',dataIndex:'method',render:(v:string) => paymentMethods[v] || v},
          {title:'时间',dataIndex:'paid_at',render:showDate},
          {title:'备注',dataIndex:'remark'},
        ]} />
      </Modal>

      <Modal
        title={`确认删除 ${deleteConfirmation?.ids.length ?? 0} 条报名？`}
        open={Boolean(deleteConfirmation)}
        onCancel={() => { if (!deleteBusy) setDeleteConfirmation(null); }}
        onOk={confirmPlayerDeletion}
        confirmLoading={deleteBusy}
        cancelButtonProps={{ disabled: deleteBusy }}
        okButtonProps={{ danger: true }}
        okText="确认删除"
        cancelText="取消"
      >
        <Alert type="warning" showIcon message="删除报名及关联的节目、音乐、评分、排名等赛事数据后无法恢复。" description="缴费和退款流水将完整保留在总收入明细中，并标记为「已删除报名」。删除不会自动退款，也不会删除用户账号。" style={{marginBottom:16}}/>
        <ul style={{ maxHeight: 240, overflowY: 'auto', paddingInlineStart: 24 }}>
          {deleteConfirmation?.entries.map(row => (
            <li key={row.id}>
              <div>{row.programNumber} · {row.name} · {row.groupName || '未分组'}</div>
              <div>报名费 ¥{Number(row.registrationFee || 0).toFixed(2)} · 音乐 {row.musicName || '未上传'}</div>
            </li>
          ))}
        </ul>
        {deleteError && <Alert type="error" showIcon message={deleteError} />}
      </Modal>

      <EventPlayerProfileModal playerId={profilePlayerId} onClose={()=>setProfilePlayerId(null)} onSaved={async()=>{message.success('用户资料已更新');await load();}}/>
      {canViewRevenue&&<EventRevenueModal competitionId={competitionId} totalFen={competition?.revenue?.totalFen||0} open={revenueOpen} onClose={()=>setRevenueOpen(false)}/>}

      <Modal title={editingPlayer ? '编辑报名' : '新建报名'} open={playerModal} onCancel={() => setPlayerModal(false)} onOk={savePlayer} width={680}>
        <Form form={playerForm} layout="vertical">
          <Form.Item name="memberId" label="选择已有选手（选填）">
            <Select
              showSearch
              allowClear
              placeholder="输入姓名或手机号，匹配数据库已有人员"
              loading={memberSearching}
              onSearch={setPlayerMemberSearch}
              filterOption={(input, option) => String(option?.searchText || '').includes(input.trim().toLocaleLowerCase())}
              options={(playerMemberSearch.trim().length >= 2 ? playerMemberMatches : members).map((member) => ({
                value: member.id,
                label: memberOptionLabel(member),
                searchText: memberSearchText(member),
              }))}
              onChange={(memberId) => {
                const member = [...playerMemberMatches,...members].find((item) => Number(item.id) === Number(memberId));
                if (member) playerForm.setFieldsValue({ name: member.name, phone: member.phone || '' });
              }}
            />
          </Form.Item>
          <Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="输入组别名称搜索" options={groupSearchOptions} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="name" label="选手姓名" rules={[{ required: true, whitespace: true, message: '请填写选手姓名' }, { max: 120, message: '姓名最多120个字符' }]}><Input maxLength={120} placeholder="支持中文、英文和空格" /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="手机号" rules={[{required:true,whitespace:true,message:'请填写手机号'},{validator:(_,value) => /^\d{6,20}$/.test(String(value || '').replace(/\D/g,'')) ? Promise.resolve() : Promise.reject(new Error('请填写有效手机号'))}]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="organization" label="领队机构"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="teacher" label="领队老师"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="paidStatus" label="缴费状态（通过登记缴费更新）"><Select disabled options={[{value:'partial',label:'部分缴费'},{value:'refunded',label:'已退款'},{ value: 'unpaid', label: '未缴费' }, { value: 'paid', label: '已缴费' }]} /></Form.Item></Col>
            <Col span={8}><Form.Item name="scoreStatus" label="评分状态"><Select options={[{ value: 'not_started', label: '未评分' }, { value: 'in_progress', label: '评分中' }, { value: 'scored', label: '已评分' }]} /></Form.Item></Col>
          </Row>
          <div style={{marginBottom:16}}>报名费：¥{Number(editingPlayer?.registrationFee ?? groups.find(item => item.id === selectedFeeGroup)?.registrationFee ?? 0).toFixed(2)}（按报名时组别费用）</div>
          <Form.Item name="performanceTitle" label="节目（音乐）名字" rules={[{ required: true, whitespace: true, message: '请填写节目名称' }]}><Input maxLength={120} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
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
            message={`出场顺序 ${scoreManagePlayer ? (scoreManagePlayer.sequenceNo || numberedPlayers.filter((item) => Number(item.groupId) === Number(scoreManagePlayer.groupId)).sort((a, b) => Number(a.id) - Number(b.id)).findIndex((item) => item.id === scoreManagePlayer.id) + 1) : '-'} · 已评分 ${playerJudgeScores.filter((item) => item.score).length}/${playerJudgeScores.length}`}
            description="可逐项录入或修改评委分数。若部分评委未评分，可忽略这些评委并按现有有效评分直接计算最终得分。"
          />
          {(() => {
            const ranking = rankingByPlayerId.get(Number(scoreManagePlayer?.id));
            return ranking && (ranking.scoreCount || ranking.manualTotal != null) ? <Tag color="magenta">当前最终得分：{formatFinalScore(ranking.calculatedTotal, rankings.filter((item) => Number(item.groupId) === Number(ranking.groupId)).map((item) => item.calculatedTotal))} · {Number(ranking.rankNo) > 0 ? `第 ${ranking.rankNo} 名` : '暂不排名'}{ranking.manualTotal != null ? ' · 人工修改' : ''}</Tag> : null;
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
          message="最终得分范围为 1～10 分。保存后将以此分值作为该选手最终得分；本组全部节目完成后统一排名。原始评委评分不会被修改。"
          style={{ marginBottom: 16 }}
        />
        <Form form={manualScoreForm} layout="vertical">
          <Form.Item name="finalScore" label="最终得分" rules={[{ required: true, message: '请输入最终得分' }, { type: 'number', min: 1, max: 10, message: '最终得分必须是 1～10 分之间的数字' }]}>
            <InputNumber min={1} max={10} precision={2} style={{ width: '100%' }} placeholder="请输入 1～10 分" />
          </Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, message: '请填写修改原因' }]}>
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="请输入修改原因，便于审计追溯" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="录入/修正评分" open={scoreModal} onCancel={() => setScoreModal(false)} onOk={saveScore} width={680}>
        <Form form={scoreForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="groupId" label="组别" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="输入组别名称搜索" options={groupSearchOptions} onChange={() => scoreForm.setFieldsValue({ playerId: undefined, judgeId: undefined })} /></Form.Item></Col>
            <Col span={8}><Form.Item name="playerId" label="选手" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={numberedPlayers.filter(item => Number(item.groupId) === Number(scoreFormGroupId)).map((item) => ({ value: item.id, label: `${item.playerNo || '-'} ${item.name}` }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="judgeId" label="评委" rules={[{ required: true }]}><Select options={competitionJudgeAssignments.filter(item => Number(item.groupId) === Number(scoreFormGroupId)).map((item) => ({ value: item.judgeId, label: item.name }))} /></Form.Item></Col>
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
            <Col span={8}><Form.Item name="overrideAuth" label="未授权评分"><Select options={[{ value: false, label: '不允许' }, { value: true, label: '允许' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="abnormalReason" label="异常说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
