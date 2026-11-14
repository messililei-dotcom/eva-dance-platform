import { distributeScores } from '../services/ScoreAllocation';
import { http } from '@kit.NetworkKit';
import { platform } from '../services/PlatformApi';
import { SwodTheme } from '../services/SwodTheme';
interface JudgeCriterion { key: string; name: string; maxScore: number; }
interface JudgeRecord { id: number; name: string; player_no?: string; player_count?: number; scored_count?: number; my_score?: number | null; performance_title?: string; scoring_status?: string; }
interface JudgeData { competition?: JudgeRecord; judge?: JudgeRecord; group?: JudgeRecord; player?: JudgeRecord; groups?: JudgeRecord[]; players?: JudgeRecord[]; criteria?: JudgeCriterion[]; currentScore?: JudgeScore; }
interface JudgeScore { values: Record<string, number>; status: string; needsRescore?: boolean; }
@Component
export struct JudgeWorkspace {
  competitionId: number = 0;
  @State private data: JudgeData = {};
  @State private groupId: number = 0;
  @State private playerId: number = 0;
  @State private values: Record<string, string> = {};
  @State private busy: boolean = false;
  @State private saving: boolean = false;
  @State private error: string = '';
  @State private filter: number = 0;
  @State private query: string = '';
  @State private page: number = 1;
  @State private totalDraft: string = '';
  @State private editingTotal: boolean = false;
  private totalWeights: number[] = [];
  private generation: number = 0;
  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.generation++; }
  private path(): string { return '/events/' + this.competitionId + '/judge' + (this.groupId ? '?groupId=' + this.groupId : '') + (this.playerId ? '&playerId=' + this.playerId : ''); }
  private locked(): boolean { return this.data.group?.scoring_status === 'locked'; }
  private rows(): JudgeRecord[] { return (this.groupId ? this.data.players || [] : this.data.groups || []).filter((row: JudgeRecord) => !this.groupId || this.filter===0 || (this.filter===1 ? row.my_score==null : row.my_score!=null)).filter((row: JudgeRecord) => !this.query || (row.name + ' ' + (row.player_no || '')).toLowerCase().includes(this.query.toLowerCase())); }
  private total(): string { return (this.data.criteria || []).reduce((sum: number, c: JudgeCriterion) => sum + (Number(this.values[c.key]) || 0), 0).toFixed(2); }
  private async load(): Promise<void> {
    if (this.saving) return;
    const version = ++this.generation; const session = platform.credentials?.sessionId;
    this.busy = true; this.error = ''; this.data = {}; this.values = {}; this.editingTotal=false;this.totalDraft='';this.totalWeights=[];
    try {
      if (!session) throw new Error('请使用获授权评委的学习账号登录');
      const data = await platform.request<JudgeData>(this.path(), http.RequestMethod.GET, undefined, true);
      if (version !== this.generation || session !== platform.credentials?.sessionId) return;
      this.data = data;
      const values: Record<string, string> = {};
      (data.criteria || []).forEach((c: JudgeCriterion) => { if (data.currentScore?.values[c.key] !== undefined) values[c.key] = String(data.currentScore.values[c.key]); });
      this.values = values;
    } catch (failure) { if (version === this.generation && session === platform.credentials?.sessionId) this.error = failure instanceof Error ? failure.message : '加载失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private confirmScore(): void {
    if (this.busy || this.saving || this.locked() || !this.data.criteria?.length) return;
    if(this.editingTotal && (!this.totalDraft.trim() || !Number.isFinite(Number(this.totalDraft)) || Number(this.totalDraft)<0 || Number(this.totalDraft)>(this.data.criteria || []).reduce((s: number,c: JudgeCriterion) => s+c.maxScore,0))){this.error='请填写有效总分';return;}
    const scores: Record<string, number> = {};
    for (const c of this.data.criteria) {
      const raw = this.values[c.key] || ''; const n = Number(raw);
      if (!raw.trim() || !Number.isFinite(n) || n < 0 || n > c.maxScore) { this.error = '请填写' + c.name + '（0–' + c.maxScore + '分）'; return; }
      scores[c.key] = n;
    }
    const generation = this.generation; const session = platform.credentials?.sessionId;
    AlertDialog.show({ title: '确认提交本人的评分？', message: (this.data.player?.name || '') + ' · 合计 ' + this.total() + ' 分', primaryButton: { value: '取消', action: () => {} }, secondaryButton: { value: '确认提交', action: () => { if (generation === this.generation && session === platform.credentials?.sessionId) this.submit(scores); } } });
  }
  private async submit(scores: Record<string, number>): Promise<void> {
    if (this.saving || this.locked()) return;
    const version = this.generation; const session = platform.credentials?.sessionId;
    this.saving = true; this.error = '';
    try {
      await platform.request<JudgeScore>(this.path(), http.RequestMethod.POST, { scores: scores }, true);
      if (version !== this.generation || session !== platform.credentials?.sessionId) return;
      this.saving = false; await this.load();
    } catch (failure) { if (version === this.generation && session === platform.credentials?.sessionId) this.error = failure instanceof Error ? failure.message : '提交失败，请重试'; }
    finally { this.saving = false; }
  }
  build() {
    Column({ space: 12 }) {
      Text(this.data.competition?.name || '评委工作台').fontSize(23).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%').padding(16).backgroundColor(SwodTheme.surface).borderRadius(14)
      if (this.data.judge) { Text('评委：' + this.data.judge.name).fontSize(14).fontColor(SwodTheme.muted) }
      if (this.groupId) { Button(this.playerId ? '返回选手列表' : '返回评分组别').enabled(!this.busy && !this.saving).onClick(() => { if (this.playerId) this.playerId = 0; else this.groupId = 0; this.query = ''; this.page = 1; this.load(); }) }
      if (this.busy) { Text('正在加载评委工作台…') }
      if (this.error) { Text(this.error).fontColor(SwodTheme.primary); Button('重新加载').enabled(!this.busy && !this.saving).onClick(() => this.load()) }
      if (this.data.judge && !this.playerId) {
        if(this.groupId) {
          Text('评分进度 ' + (this.data.players || []).filter((r: JudgeRecord) => r.my_score!=null).length + ' / ' + (this.data.players || []).length).fontSize(18).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink)
          Progress({value:(this.data.players || []).filter((r: JudgeRecord) => r.my_score!=null).length,total:Math.max(1,(this.data.players || []).length),type:ProgressType.Linear}).width('100%').color(SwodTheme.primary)
          Row({space:8}) { ForEach(['全部','未评分','已评分'],(label: string,index: number) => { Button(label).layoutWeight(1).height(44).backgroundColor(this.filter===index?SwodTheme.primary:SwodTheme.surface).fontColor(this.filter===index?SwodTheme.onPrimary:SwodTheme.ink).onClick(() => { this.filter=index;this.page=1; }) }) }.width('100%')
        }
        TextInput({ placeholder: '搜索名称或选手号' , text: this.query }).onChange((v: string) => { this.query = v; this.page = 1; })
        ForEach(this.rows().slice((this.page - 1) * 50, this.page * 50), (row: JudgeRecord) => {
          Button({ type: ButtonType.Normal }) {
            Column({ space: 6 }) {
              Text((row.player_no || '') + ' ' + row.name).fontSize(16).width('100%')
              Text(this.groupId ? (row.my_score === null || row.my_score === undefined ? '未评分' : '本人评分：' + row.my_score) : '已评分 ' + (row.scored_count || 0) + ' / ' + (row.player_count || 0)).fontSize(13).fontColor(SwodTheme.muted)
            }.padding(12).width('100%').alignItems(HorizontalAlign.Start)
          }.width('100%').backgroundColor(SwodTheme.surface).fontColor(SwodTheme.ink).onClick(() => { if (!this.groupId) this.groupId = row.id; else this.playerId = row.id; this.query = ''; this.page = 1; this.load(); })
        }, (row: JudgeRecord) => String(row.id))
        Row({ space: 12 }) {
          Button('上一页').enabled(this.page > 1).onClick(() => { this.page--; })
          Text(this.page + ' / ' + Math.max(1, Math.ceil(this.rows().length / 50)))
          Button('下一页').enabled(this.page * 50 < this.rows().length).onClick(() => { this.page++; })
        }
        if (!this.rows().length && !this.busy) { Text('暂无可评分记录') }
      }
      if (this.data.player && !this.busy) {
        Text('选手：' + this.data.player.name).fontSize(18)
        Text(this.data.player.performance_title || '')
        if (this.locked()) { Text('该组别评分已锁定，只能查看') }
        if (this.data.currentScore?.needsRescore) { Text('评分规则已变化，请按当前规则重新评分') }
        Text("输入分数，或左右拖动调节").fontSize(14).fontColor(SwodTheme.muted)
        ForEach(this.data.criteria || [], (c: JudgeCriterion) => {
          Text(c.name + '（0–' + c.maxScore + '分）').fontSize(15)
          TextInput({ placeholder: '请输入分数', text: this.values[c.key] || '' }).height(48).backgroundColor(SwodTheme.surface).border({ width: 1, color: SwodTheme.registrationLine }).borderRadius(8).type(InputType.NUMBER_DECIMAL).enabled(!this.locked() && !this.saving).onChange((v: string) => { const values: Record<string, string> = {}; Object.keys(this.values).forEach((key: string) => { values[key] = this.values[key]; }); values[c.key] = v; this.values = values; this.editingTotal = false; })
          Slider({ value: Math.min(c.maxScore, Math.max(0, Number(this.values[c.key]) || 0)), min: 0, max: c.maxScore, step: 0.01 }).width('100%').height(44).selectedColor(SwodTheme.primary).blockColor(SwodTheme.primary).enabled(!this.locked() && !this.saving).onChange((v: number) => { const values: Record<string, string> = {};Object.keys(this.values).forEach((key: string) => { values[key] = this.values[key]; });values[c.key]=v.toFixed(2);this.values=values;this.editingTotal=false; })
        }, (c: JudgeCriterion) => c.key)
        Text('总分（可修改）').fontSize(18).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink)
        TextInput({ text: this.editingTotal ? this.totalDraft : this.total(), placeholder: '请输入总分' }).height(52).type(InputType.NUMBER_DECIMAL).fontSize(24).fontColor(SwodTheme.primary).backgroundColor(SwodTheme.surface).enabled(!this.locked() && !this.saving).onFocus(() => { this.totalWeights=(this.data.criteria || []).map((c: JudgeCriterion) => Number(this.values[c.key]) || 0);this.totalDraft=this.total();this.editingTotal=true; }).onChange((v: string) => { this.totalDraft=v;this.editingTotal=true;if(!v.trim() || !Number.isFinite(Number(v)))return;try { const criteria=this.data.criteria || [];const next=distributeScores(criteria.map((c: JudgeCriterion) => c.maxScore),this.totalWeights,Number(v));const values: Record<string,string>={};criteria.forEach((c: JudgeCriterion,i: number) => { values[c.key]=next[i].toFixed(2); });this.values=values; } catch {} })
        Text('修改总分，各项按比例分配 · 满分 ' + (this.data.criteria || []).reduce((s: number,c: JudgeCriterion) => s+c.maxScore,0) + ' 分').fontSize(14).fontColor(SwodTheme.muted)
        Button(this.saving ? '正在提交…' : this.data.currentScore?.status ? '修改本人评分' : '提交评分').enabled(!this.locked() && !this.saving).constraintSize({ minHeight: 48 }).width('100%').backgroundColor(SwodTheme.primary).fontColor(SwodTheme.onPrimary).borderRadius(10).onClick(() => this.confirmScore())
      }
    }.width('100%').padding(12).backgroundColor(SwodTheme.registrationCanvas).alignItems(HorizontalAlign.Start)
  }
}
