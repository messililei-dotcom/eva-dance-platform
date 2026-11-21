import path from 'node:path';
import { eventMusicExtension, eventMusicFilename } from '@/lib/server/event-music-filename';
import { eventEntrySummary } from '@/lib/event-entry-summary';

export class EventExportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const text = (v: unknown) => String(v ?? '');
const money = (v: unknown) => Math.round(Number(v || 0) * 100) / 100;
const statusNames: Record<string, string> = {
  pending: '待处理', approved: '已通过', confirmed: '已确认', rejected: '已拒绝', cancelled: '已取消', withdrawn: '已退赛',
  unpaid: '未缴费', paid: '已缴费', partial: '部分缴费', refunded: '已退款',
  not_started: '未开始', submitted: '已提交', reviewed: '已复核', published: '已公示', scored: '已评分', voided: '已作废',
};
const status = (v: unknown) => statusNames[text(v)] || text(v);
const methods: Record<string, string> = { wechat: '微信', alipay: '支付宝', bank: '银行转账', cash: '现金', other: '其他' };
const method = (v: unknown) => methods[text(v)] || text(v);
export const formatEventMusicDuration = (value: unknown) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const roundedSeconds = Math.round(seconds);
  return `${Math.floor(roundedSeconds / 60)}分${String(roundedSeconds % 60).padStart(2, '0')}秒`;
};

/** Reads scoped event views only. The caller supplies visible row IDs, never
 * amounts, names, music paths or profile data. All values come from the server. */
export function eventPlayerExport(db: any, competitionId: number, ids: number[], origin: string) {
  if (!Number.isSafeInteger(competitionId) || competitionId <= 0) throw new EventExportError('缺少有效赛事ID');
  if (!Array.isArray(ids) || !ids.length || ids.length > 20000 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw new EventExportError('请选择1至20000条有效报名');
  const competition = db.prepare('SELECT id,name FROM event_competitions WHERE id=?').get(competitionId);
  if (!competition) throw new EventExportError('赛事不存在或无权查看', 404);
  const players = db.prepare(`SELECT p.*,g.name AS group_name FROM event_players p
    LEFT JOIN event_groups g ON g.id=p.group_id AND g.competition_id=p.competition_id WHERE p.competition_id=? ORDER BY p.id`).all(competitionId);
  const byId = new Map<number, any>(players.map((p: any) => [Number(p.id), p]));
  if (ids.some(id => !byId.has(id))) throw new EventExportError('报名不存在、已删除或不属于当前赛事，请刷新后重试', 404);
  const selected = new Set(ids);
  const numbered = new Map<number, any>(eventEntrySummary(players.map((p: any) => ({ id: p.id, name: p.name, phone: p.phone, memberId: p.member_id, registeredAt: p.registered_at, createdAt: p.created_at, registrationFee: p.registration_fee }))).players.map((p: any) => [Number(p.id), p]));
  const performances = db.prepare('SELECT * FROM event_performances WHERE competition_id=? ORDER BY id').all(competitionId).filter((p: any) => selected.has(Number(p.player_id)));
  const music = db.prepare('SELECT * FROM event_music_files WHERE competition_id=? ORDER BY id').all(competitionId).filter((m: any) => selected.has(Number(m.player_id)));
  const payments = db.prepare('SELECT * FROM event_registration_payments WHERE competition_id=? ORDER BY paid_at,id').all(competitionId).filter((p: any) => selected.has(Number(p.player_id)));
  const scores = db.prepare('SELECT player_id,COUNT(*) AS count FROM event_scores WHERE competition_id=? GROUP BY player_id').all(competitionId);
  const judges = db.prepare("SELECT group_id,COUNT(*) AS count FROM event_group_judges WHERE competition_id=? AND COALESCE(status,'active')='active' GROUP BY group_id").all(competitionId);
  const scoreCount = new Map<number, number>(scores.map((p: any) => [Number(p.player_id), Number(p.count)]));
  const judgeCount = new Map<number, number>(judges.map((p: any) => [Number(p.group_id), Number(p.count)]));
  const latest = new Map<number, any>();
  const files = new Map<number, any[]>(), ledger = new Map<number, any[]>();
  for (const p of performances) latest.set(Number(p.player_id), p);
  for (const m of music) files.set(Number(m.player_id), [...(files.get(Number(m.player_id)) || []), m]);
  for (const p of payments) ledger.set(Number(p.player_id), [...(ledger.get(Number(p.player_id)) || []), p]);
  const current = (id: number) => (files.get(id) || []).find(m => Number(m.id) === Number(latest.get(id)?.music_file_id));
  const musicLink = (id: number) => new URL(`/api/event/music/${id}`, origin).href;
  const identity = (id: number) => {
    const p = byId.get(id), n = numbered.get(id);
    return { '报名ID': id, '报名编号': n.programNumber, '选手编号': n.contestantNumber, '选手姓名': text(p.name), '组别名称': text(p.group_name) };
  };
  const performanceByMusic = new Map(performances.map((p: any) => [Number(p.music_file_id), p]));
  const filename = (m: any) => {
    const id = Number(m.player_id);
    const p = byId.get(id);
    const performance = performanceByMusic.get(Number(m.id)) ?? latest.get(id);
    return eventMusicFilename(p.group_name, performance?.sequence_no, p.name, performance?.title,
      eventMusicExtension(text(m.file_url)) || path.extname(text(m.file_name)).toLowerCase().replace(/[^.a-z0-9]/g, ''));
  };
  const registrations = ids.map(id => {
    const p = byId.get(id), performance = latest.get(id), m = current(id), history = ledger.get(id) || [];
    return { '赛事名称': text(competition.name), ...identity(id), '人员档案ID': p.member_id || '', '手机号': text(p.phone), '性别': text(p.gender), '生日': text(p.birthday),
      '领队机构': text(p.organization), '领队老师': text(p.teacher), '节目名称': text(performance?.title), '出场顺序': performance?.sequence_no || '',
      '报名状态': status(p.status), '审核状态': status(p.audit_status), '报名费（元）': money(p.registration_fee), '已缴金额（元）': money(p.paid_amount),
      '未缴金额（元）': money(Math.max(0, money(p.registration_fee) - money(p.paid_amount))), '缴费状态': status(p.paid_status), '缴费时间': text(p.paid_at), '缴费方式': method(p.payment_method),
      '收款记录合计（元）': money(history.filter(x => x.kind === 'charge').reduce((sum, x) => sum + Number(x.amount), 0)),
      '退款记录合计（元）': money(history.filter(x => x.kind === 'refund').reduce((sum, x) => sum + Number(x.amount), 0)), '收退款记录数': history.length,
      '音乐上传状态': m ? '已上传' : files.get(id)?.length ? '有历史文件，未关联当前节目' : '未上传', '音乐文件名': m ? filename(m) : '',
      '音乐时长': formatEventMusicDuration(m?.duration_seconds), '音乐大小（字节）': m ? Number(m.file_size || 0) : '',
      '音乐上传时间': text(m?.uploaded_at), '音乐审核状态': status(m?.audit_status), '音乐审核备注': text(m?.audit_remark), '音乐审核时间': text(m?.audited_at),
      '音乐入口（需登录）': m ? musicLink(m.id) : '', '音乐文件记录数': files.get(id)?.length || 0,
      '评分状态': status(p.score_status), '评分记录数': scoreCount.get(id) || 0, '组别评委数': judgeCount.get(Number(p.group_id)) || 0,
      '关联订单ID': p.order_id || '', '备注': text(p.remark), '报名时间': text(p.registered_at), '创建时间': text(p.created_at), '更新时间': text(p.updated_at) };
  });
  const musicRows = music.map((m: any) => ({ ...identity(Number(m.player_id)), '音乐文件ID': m.id, '是否当前音乐': Number(current(Number(m.player_id))?.id) === Number(m.id) ? '是' : '否',
    '音乐文件名': filename(m), '音乐时长': formatEventMusicDuration(m.duration_seconds), '音乐大小（字节）': Number(m.file_size || 0),
    '上传时间': text(m.uploaded_at), '审核状态': status(m.audit_status), '审核备注': text(m.audit_remark), '审核时间': text(m.audited_at), '音乐入口（需登录）': musicLink(m.id) }));
  const paymentRows = payments.map((p: any) => ({ ...identity(Number(p.player_id)), '收退款记录ID': p.id, '类型': p.kind === 'refund' ? '退款' : p.kind === 'charge' ? '收款' : text(p.kind),
    '金额（元）': money(p.amount), '方式': method(p.method), '收退款时间': text(p.paid_at), '备注': text(p.remark), '创建时间': text(p.created_at) }));
  const registrationById = new Map(ids.map((id, index) => [id, registrations[index]]));
  const missingMusic = music.flatMap((m: any, index: number) => formatEventMusicDuration(m.duration_seconds) ? [] : [{
    index, fileUrl: text(m.file_url), registration: Number(current(Number(m.player_id))?.id) === Number(m.id)
      ? registrationById.get(Number(m.player_id)) : undefined,
  }]);
  return { missingMusic, name: text(competition.name), registrations, music: musicRows, payments: paymentRows };
}
