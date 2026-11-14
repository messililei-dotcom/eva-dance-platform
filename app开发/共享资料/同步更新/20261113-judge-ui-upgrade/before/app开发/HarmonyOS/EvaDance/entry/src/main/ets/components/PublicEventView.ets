import { platform, coverImageURL } from '../services/PlatformApi';
import { SwodTheme } from '../services/SwodTheme';
import { eventState, eventDates } from '../services/EventPresentation';
import { Row as ModelRow } from '../services/Models';
interface EventRecord {
  id?: number | string; name?: string; code?: string; coverUrl?: string; cover_url?: string; avatarUrl?: string;
  startDate?: string; endDate?: string; location?: string; venue?: string; organizer?: string; description?: string;
  registrationStatus?: string; registrationStart?: string; registrationEnd?: string; status?: string; registrationFee?: number;
  registrationPublic?: boolean; judgeScoresPublic?: boolean; groupCount?: number; approvedPlayerCount?: number | null; judgeCount?: number;
  playerCount?: number | null; rankingCount?: number; groupId?: number | string; playerId?: number | string; groupName?: string; playerName?: string;
  playerNo?: string; organization?: string; teacher?: string; performanceTitle?: string; title?: string; bio?: string;
  category?: string; ageRange?: string; danceType?: string; entryType?: string; rankNo?: number; publishedTotal?: number | null; score?: number | null; resultPublished?: boolean;
}
interface EventData { competition?: EventRecord; group?: EventRecord; player?: EventRecord; groups?: EventRecord[]; players?: EventRecord[]; judges?: EventRecord[]; rankings?: EventRecord[]; sessions?: EventSession[]; judgeScores?: EventRecord[]; }
interface EventSession { id: number; name: string; startsAt?: string; venue?: string; }
@Component
export struct PublicEventView {
  @Prop @Watch('routeChanged') eventID: number = 0;
  @Prop @Watch('routeChanged') groupID: number = 0;
  @Prop @Watch('routeChanged') playerID: number = 0;
  @Prop @Watch('routeChanged') revision: number = 0;
  onOpenGroup: (groupID: number) => void = () => {};
  onOpenPlayer: (groupID: number, playerID: number) => void = () => {};
  onRegister: (groupID: number) => void = () => {};
  onJudge: () => void = () => {};
  onMine: () => void = () => {};
  @State private data: EventData = {};
  @State private busy: boolean = false;
  @State private error: string = '';
  @State private panel: number = 1;
  @State private query: string = '';
  @State private page: number = 1;
  private version: number = 0;
  aboutToAppear(): void { this.reload(); }
  aboutToDisappear(): void { this.version++; }
  private routeChanged(): void { this.page = 1; this.query = ''; this.reload(); }
  private mode(): string { return this.playerID > 0 ? 'player' : this.groupID > 0 ? 'group' : 'event'; }
  private async reload(): Promise<void> {
    const version = ++this.version; this.busy = true; this.error = ''; this.data = {};
    const path = '/events/' + this.eventID + (this.groupID > 0 ? '/groups/' + this.groupID : '') + (this.playerID > 0 ? '/players/' + this.playerID : '');
    try { const data = await platform.request<EventData>(path); if (version === this.version) this.data = data; }
    catch (failure) { if (version === this.version) this.error = failure instanceof Error ? failure.message : '赛事加载失败，请重试'; }
    finally { if (version === this.version) this.busy = false; }
  }
  private state(): string { return eventState(this.data.competition as ModelRow); }
  private dates(): string { return eventDates(this.data.competition as ModelRow); }
  private count(value: number | null | undefined, fallback: number): string { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : String(fallback); }
  private score(value: number | null | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, '') : '—'; }
  private rank(row: EventRecord): string { const rank = row.rankNo || 0; return rank === 1 ? '冠军' : rank === 2 ? '亚军' : rank === 3 ? '季军' : rank > 0 ? '第' + rank + '名' : '成绩待公示'; }
  private rows(): EventRecord[] {
    const rows = this.mode() === 'group' ? this.data.players || [] : this.panel === 1 ? this.data.groups || [] : this.panel === 2 ? this.data.players || [] : this.panel === 3 ? this.data.judges || [] : this.data.rankings || [];
    const query = this.query.trim().toLowerCase();
    return rows.filter((row: EventRecord) => !query || [row.name, row.playerName, row.groupName, row.playerNo, row.organization, row.teacher, row.category, row.danceType, row.ageRange].join(' ').toLowerCase().includes(query));
  }
  private visible(): EventRecord[] { const rows = this.rows(); const page = Math.min(this.page, Math.max(1, Math.ceil(rows.length / 20))); return rows.slice((page - 1) * 20, page * 20); }
  private published(): boolean { return Number(this.data.group?.rankingCount) > 0 || (this.data.players || []).some((row: EventRecord) => row.resultPublished === true); }
  private podium(): EventRecord[] { return (this.data.players || []).filter((row: EventRecord) => Number(row.rankNo) > 0 && Number(row.rankNo) <= 3).sort((a: EventRecord, b: EventRecord) => [2, 1, 3].indexOf(Number(a.rankNo)) - [2, 1, 3].indexOf(Number(b.rankNo))); }
  private empty(): string { return this.query ? '未找到匹配记录' : this.mode() === 'group' || this.panel === 2 ? this.data.competition?.registrationPublic ? '暂无报名选手' : '报名信息尚未公开' : this.panel === 1 ? '没有找到符合条件的组别' : this.panel === 3 ? '评委阵容暂未公布' : '成绩经统一平台审核发布后在这里公示'; }
  @Builder private info(label: string, value: string) {
    Column({ space: 8 }) { Row({ space: 16 }) { Text(label).fontSize(14).fontColor(SwodTheme.muted).layoutWeight(1); Text(value).fontSize(14).fontColor(SwodTheme.ink).layoutWeight(1).textAlign(TextAlign.End) }.width('100%'); Divider().color(SwodTheme.registrationLine) }.width('100%')
  }
  @Builder private avatar(row: EventRecord) {
    if (coverImageURL(row.avatarUrl || '')) { Image(coverImageURL(row.avatarUrl || '')).width(44).height(44).borderRadius(22).objectFit(ImageFit.Cover).accessibilityLevel('no') }
    else { Text((row.name || row.playerName || '选').slice(0, 1)).width(44).height(44).textAlign(TextAlign.Center).fontSize(18).fontColor(SwodTheme.primary).backgroundColor(SwodTheme.tonal).borderRadius(22).accessibilityLevel('no') }
  }
  @Builder private metric(value: string, label: string) { Column({ space: 5 }) { Text(value).fontSize(24).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink); Text(label).fontSize(14).fontColor(SwodTheme.muted) }.layoutWeight(1) }
  @Builder private hero() {
    Column({ space: 14 }) {
      Stack({ alignContent: Alignment.TopStart }) {
        if (coverImageURL(this.data.competition?.coverUrl || this.data.competition?.cover_url || '')) { Image(coverImageURL(this.data.competition?.coverUrl || this.data.competition?.cover_url || '')).width('100%').height('100%').objectFit(ImageFit.Cover).accessibilityLevel('no') }
        Text(this.state()).fontSize(12).fontWeight(FontWeight.Bold).padding(8).borderRadius(10).fontColor(SwodTheme.onPrimary).backgroundColor(SwodTheme.primary).margin(10)
      }.width('100%').aspectRatio(2.4).backgroundColor(SwodTheme.tonal).borderRadius(14).clip(true)
      Text(this.data.competition?.name || '').fontSize(24).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
      Text(this.dates() + ' · ' + (this.data.competition?.location || this.data.competition?.venue || '地点待定')).fontSize(14).fontColor(SwodTheme.muted).width('100%')
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private overview() {
    Column({ space: 14 }) {
      Text('赛事信息').fontSize(21).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
      this.info('主办方', this.data.competition?.organizer || '伊娃东方舞')
      this.info('比赛地点', this.data.competition?.location || this.data.competition?.venue || '地点待定')
      this.info('报名状态', this.state())
      this.info('报名费用', Number(this.data.competition?.registrationFee) > 0 ? '¥' + this.data.competition?.registrationFee : '免费')
      Text((this.data.competition?.description || '赛事介绍正在完善中。').replace(/<[^>]*>/g, '')).fontSize(16).fontColor(SwodTheme.muted).width('100%')
    }.padding(16).backgroundColor(SwodTheme.surface).borderRadius(14).width('100%')
    if ((this.data.sessions || []).length) {
      Column({ space: 12 }) { Text('赛事日程').fontSize(20).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); ForEach(this.data.sessions || [], (session: EventSession) => { Column({ space: 6 }) { Text(session.name).fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text((session.startsAt || '') + ' · ' + (session.venue || '场地待定')).fontSize(14).fontColor(SwodTheme.muted).width('100%'); Divider().color(SwodTheme.registrationLine) }.width('100%') }, (session: EventSession) => String(session.id)) }.padding(16).backgroundColor(SwodTheme.surface).borderRadius(14).width('100%')
    }
    if (platform.credentials) { Button('我的报名、音乐与缴费').constraintSize({ minHeight: 48 }).width('100%').borderRadius(10).backgroundColor(SwodTheme.surface).fontColor(SwodTheme.primary).onClick(this.onMine) }
  }
  @Builder private participant(row: EventRecord, result: boolean) {
    Button({ type: ButtonType.Normal }) {
      Row({ space: 10 }) {
        if (result) { Column({ space: 4 }) { Text(Number(row.rankNo) > 0 ? String(row.rankNo) : '—').fontSize(20).fontColor(SwodTheme.primary); Text(this.rank(row)).fontSize(12).fontColor(SwodTheme.muted) }.width(54) }
        this.avatar(row)
        Column({ space: 6 }) { Text(row.name || row.playerName || '').fontSize(17).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text([row.groupName, row.playerNo ? '编号 ' + row.playerNo : '', row.organization || row.teacher].filter((value: string | undefined) => !!value).join(' · ')).fontSize(13).fontColor(SwodTheme.muted).width('100%') }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        if (result) { Column({ space: 4 }) { Text(this.score(row.publishedTotal)).fontSize(17).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary); Text('最终得分').fontSize(12).fontColor(SwodTheme.muted) } }
        Text('›').fontSize(20).fontColor(SwodTheme.muted)
      }.width('100%').padding({ top: 10, bottom: 10 })
    }.width('100%').padding(0).backgroundColor(Color.Transparent).borderRadius(0).onClick(() => this.onOpenPlayer(Number(row.groupId || this.groupID), Number(row.playerId || row.id)))
  }
  @Builder private rowPanel() {
    Column({ space: 12 }) {
      Text(this.mode() === 'group' ? this.published() ? '成绩排名' : '参赛选手' : ['概览', '组别', '选手', '评委', '成绩'][this.panel]).fontSize(20).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
      TextInput({ placeholder: this.mode() === 'event' && this.panel === 1 ? '搜索组别、舞种或年龄' : this.panel === 3 && this.mode() === 'event' ? '搜索评委' : '搜索选手、编号或机构', text: this.query }).height(48).fontSize(16).backgroundColor(SwodTheme.field).borderRadius(10).onChange((value: string) => { this.query = value; this.page = 1; })
      ForEach(this.visible(), (row: EventRecord) => {
        if (this.mode() === 'event' && this.panel === 1) {
          Button({ type: ButtonType.Normal }) { Row({ space: 12 }) { Column({ space: 6 }) { Text(row.name || '').fontSize(17).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text((row.playerCount == null ? '报名信息未公开' : row.playerCount + ' 位选手') + ' · ' + (Number(row.rankingCount) > 0 ? row.rankingCount + ' 项成绩' : '成绩待公布')).fontSize(14).fontColor(SwodTheme.muted).width('100%') }.layoutWeight(1); Text('›').fontSize(20).fontColor(SwodTheme.muted) }.width('100%').padding({ top: 10, bottom: 10 }) }.width('100%').padding(0).backgroundColor(Color.Transparent).onClick(() => this.onOpenGroup(Number(row.id)))
        } else if (this.mode() === 'event' && this.panel === 3) {
          Row({ space: 12 }) { this.avatar(row); Column({ space: 6 }) { Text(row.name || '').fontSize(17).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text((row.title || '赛事评委') + ' · ' + (row.organization || '伊娃东方舞')).fontSize(14).fontColor(SwodTheme.muted).width('100%'); if (row.bio) { Text(row.bio.replace(/<[^>]*>/g, '')).fontSize(14).fontColor(SwodTheme.muted).width('100%') } }.layoutWeight(1) }.width('100%')
        } else { this.participant(row, this.mode() === 'group' ? this.published() : this.panel === 4) }
        Divider().color(SwodTheme.registrationLine)
      }, (row: EventRecord) => String(row.id || row.playerId))
      if (!this.rows().length) { Text(this.empty()).fontSize(15).fontColor(SwodTheme.muted).width('100%').padding({ top: 30, bottom: 30 }).textAlign(TextAlign.Center) }
      if (this.rows().length > 20) {
        Row({ space: 8 }) { Button('上一页').constraintSize({ minHeight: 44 }).enabled(this.page > 1).onClick(() => { this.page--; }); Text(this.page + ' / ' + Math.ceil(this.rows().length / 20) + ' · ' + this.rows().length + ' 条').fontSize(13).fontColor(SwodTheme.muted).layoutWeight(1).textAlign(TextAlign.Center); Button('下一页').constraintSize({ minHeight: 44 }).enabled(this.page * 20 < this.rows().length).onClick(() => { this.page++; }) }.width('100%')
      }
    }.padding(16).backgroundColor(SwodTheme.surface).borderRadius(14).width('100%').alignItems(HorizontalAlign.Start)
  }
  @Builder private groupPage() {
    Column({ space: 14 }) {
      Text(this.data.competition?.name || '').fontSize(14).fontColor(SwodTheme.muted).width('100%'); Text(this.data.group?.name || '').fontSize(26).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text([this.data.group?.category, this.data.group?.ageRange, this.data.group?.danceType, this.data.group?.entryType].filter((value: string | undefined) => !!value).join(' · ')).fontSize(14).fontColor(SwodTheme.muted).width('100%'); Text((this.data.competition?.registrationPublic ? (this.data.players || []).length : '—') + ' 位已报名选手 · ' + (this.data.group?.rankingCount || 0) + ' 项已公布成绩').fontSize(14).fontColor('#C8A96E').width('100%')
    }.padding({ top: 12, bottom: 20 }).width('100%')
    Divider().color(SwodTheme.registrationLine)
    if (this.podium().length) { Text('荣誉榜').fontSize(24).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary).width('100%').textAlign(TextAlign.Center); Text('成绩经赛事平台审核发布').fontSize(14).fontColor(SwodTheme.muted).width('100%').textAlign(TextAlign.Center); Row({ space: 8 }) { ForEach(this.podium(), (row: EventRecord) => { Button({ type: ButtonType.Normal }) { Column({ space: 8 }) { Text('🏆 ' + this.rank(row)).fontSize(14).fontColor(SwodTheme.primary); this.avatar(row); Text(row.name || '').fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink); Text(this.score(row.publishedTotal) + ' 分').fontSize(14).fontColor(SwodTheme.muted) }.padding({ left: 6, right: 6, top: row.rankNo === 1 ? 30 : 14, bottom: 16 }).width('100%') }.padding(0).layoutWeight(1).backgroundColor(row.rankNo === 1 ? SwodTheme.tonal : SwodTheme.surface).borderRadius(12).onClick(() => this.onOpenPlayer(this.groupID, Number(row.id))) }, (row: EventRecord) => String(row.id)) }.width('100%').alignItems(VerticalAlign.Bottom) }
    this.rowPanel()
  }
  @Builder private playerPage() {
    Column({ space: 12 }) { this.avatar(this.data.player || {}); Text(this.data.player?.name || '').fontSize(25).fontWeight(FontWeight.Bold).fontColor('#DFC080'); Text(this.data.competition?.name || '').fontSize(14).fontColor('#DFC080'); Button((this.data.group?.name || '') + ' ›').constraintSize({ minHeight: 44 }).backgroundColor(Color.Transparent).fontColor('#DFC080').onClick(() => this.onOpenGroup(this.groupID)) }.padding(20).width('100%').backgroundColor('#17283D').borderRadius(14)
    Column({ space: 14 }) { Text('参赛详情').fontSize(20).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); this.info('编号', this.data.player?.playerNo || '未编号'); if (this.data.player?.organization) { this.info('机构 / 舞蹈室', this.data.player.organization) }
      if (this.data.player?.teacher) { this.info('指导老师', this.data.player.teacher) }
      this.info('节目名称', this.data.player?.performanceTitle || '未填写') }.padding(16).width('100%').backgroundColor(SwodTheme.surface).borderRadius(14)
    Column({ space: 8 }) { Text(this.rank(this.data.player || {})).fontSize(16).fontColor(SwodTheme.primary); Text(this.score(this.data.player?.publishedTotal)).fontSize(34).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary); Text('最终得分').fontSize(14).fontColor(SwodTheme.muted) }.padding(20).width('100%').backgroundColor(SwodTheme.surface).borderRadius(14)
    Column({ space: 14 }) { Text('评委评分').fontSize(20).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); if (!this.data.competition?.judgeScoresPublic) { Text('个人评分未公开，评委身份可通过评委入口查看。').fontSize(14).fontColor(SwodTheme.muted).width('100%') }
      ForEach(this.data.judgeScores || [], (judge: EventRecord) => { Row({ space: 10 }) { this.avatar(judge); Column({ space: 4 }) { Text(judge.name || '').fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%'); Text(judge.title || '').fontSize(13).fontColor(SwodTheme.muted).width('100%') }.layoutWeight(1); Text(judge.score == null ? '未公开' : this.score(judge.score)).fontSize(17).fontColor(SwodTheme.primary) }.width('100%'); Divider().color(SwodTheme.registrationLine) }, (judge: EventRecord) => String(judge.id)); if (!(this.data.judgeScores || []).length) { Text('评分发布后在此展示').fontSize(14).fontColor(SwodTheme.muted).width('100%') } }.padding(16).width('100%').backgroundColor(SwodTheme.surface).borderRadius(14)
  }
  build() {
    Column({ space: 14 }) {
      if (this.busy) { LoadingProgress().width(28).height(28); Text('赛事加载中…').fontSize(15).fontColor(SwodTheme.muted) }
      if (this.error) { Text(this.error).fontSize(15).fontColor(SwodTheme.primary); Button('重新加载').constraintSize({ minHeight: 48 }).onClick(() => this.reload()) }
      if (this.data.competition) {
        if (this.mode() === 'player') { this.playerPage() }
        else if (this.mode() === 'group') { this.groupPage() }
        else {
          this.hero()
          Button('评委入口').constraintSize({ minHeight: 44 }).fontSize(16).borderRadius(10).backgroundColor(SwodTheme.surface).fontColor(SwodTheme.primary).onClick(this.onJudge)
          Row({ space: 6 }) { this.metric(this.count(this.data.competition.groupCount, (this.data.groups || []).length), '组别'); this.metric(this.data.competition.registrationPublic ? this.count(this.data.competition.approvedPlayerCount, (this.data.players || []).length) : '—', '选手'); this.metric(this.count(this.data.competition.judgeCount, (this.data.judges || []).length), '评委') }.padding(16).backgroundColor(SwodTheme.surface).borderRadius(14).width('100%')
          Scroll() { Row({ space: 8 }) { ForEach(['概览', '组别', '选手', '评委', '成绩'], (label: string, index: number) => { Button(label).fontSize(16).constraintSize({ minHeight: 44 }).borderRadius(24).backgroundColor(index === this.panel ? SwodTheme.primary : SwodTheme.surface).fontColor(index === this.panel ? SwodTheme.onPrimary : SwodTheme.ink).onClick(() => { this.panel = index; this.page = 1; this.query = ''; }) }) } }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%')
          if (this.panel === 0) { this.overview() } else { this.rowPanel() }
          Button(this.state() === '报名中' ? '立即报名' : this.state()).constraintSize({ minHeight: 48 }).width('100%').fontSize(18).fontWeight(FontWeight.Bold).borderRadius(10).backgroundColor(SwodTheme.primary).fontColor(SwodTheme.onPrimary).enabled(this.state() === '报名中').onClick(() => this.onRegister(0))
        }
      }
    }.padding(10).width('100%').constraintSize({ maxWidth: 760 }).backgroundColor(SwodTheme.registrationCanvas).alignItems(HorizontalAlign.Start)
  }
}
