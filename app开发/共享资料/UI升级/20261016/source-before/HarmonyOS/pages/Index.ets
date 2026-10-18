import { http } from '@kit.NetworkKit';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { picker, fileIo } from '@kit.CoreFileKit';
import { Row, WriteBody } from '../services/Models';
import { platform, PlatformFailure, secureMedia } from '../services/PlatformApi';

interface Route { screen: string; title: string; path: string; auth: boolean; staff: boolean; eventID: number; groupID: number; }
interface VideoTime { time: number; }
interface VideoDuration { duration: number; }

@Entry
@Component
struct Index {
  @State private route: Route = { screen: 'home', title: '线上学院', path: '/public/series', auth: false, staff: false, eventID: 0, groupID: 0 };
  @State private rows: Row[] = [];
  @State private detail: Row = {};
  @State private query: string = '';
  @State private busy: boolean = false;
  @State private error: string = '';
  @State private loggedIn: boolean = false;
  @State private staffLoggedIn: boolean = false;
  @State private phone: string = '';
  @State private code: string = '';
  @State private username: string = '';
  @State private password: string = '';
  @State private consent: boolean = false;
  @State private name: string = '';
  @State private organization: string = '';
  @State private teacher: string = '';
  @State private performanceTitle: string = '';
  @State private remark: string = '';
  @State private paymentKind: string = 'charge';
  @State private paymentMethod: string = 'wechat';
  @State private amount: string = '';
  @State private paidAt: string = '';
  @State private playURL: string = '';
  @State private musicName: string = '';
  private music?: ArrayBuffer;
  @State private mirror: boolean = false;
  @State private loop: boolean = false;
  private requestKey: string = '';
  private history: Route[] = [];
  private generation: number = 0;
  private selected: Row = {};
  private controller: VideoController = new VideoController();
  private position: number = 0;
  private duration: number = 0;
  private revision: number = 0;
  private lastCheckpoint: number = 0;
  private checkpointPending: boolean = false;

  aboutToAppear(): void { this.load(); }
  aboutToDisappear(): void { this.saveProgress(); this.controller.pause(); this.generation++; }
  onBackPress(): boolean { if (this.history.length === 0) return false; this.back(); return true; }
  private go(screen: string, title: string, path: string = '', auth: boolean = false, eventID: number = 0, groupID: number = 0, staff: boolean = false): void {
    this.saveProgress(); this.controller.pause(); this.playURL = '';
    this.history.push(this.route);
    this.route = { screen: screen, title: title, path: path, auth: auth, eventID: eventID, groupID: groupID, staff: staff };
    this.query = ''; this.rows = []; this.detail = {}; this.error = ''; this.generation++; this.load();
  }
  private back(): void {
    this.saveProgress(); this.controller.pause(); this.playURL = '';
    const previous = this.history.pop(); if (!previous) return;
    this.route = previous; this.query = ''; this.rows = []; this.detail = {}; this.generation++; this.load();
  }
  private tab(screen: string, title: string, path: string, auth: boolean = false): void {
    this.history = []; this.go(screen, title, path, auth); this.history = [];
  }
  private async load(): Promise<void> {
    const version = this.generation; const route = this.route;
    this.busy = true; this.error = '';
    try {
      if (!route.path) return;
      if (route.staff && !platform.staff) throw new PlatformFailure('请使用工作人员账号登录', 401);
      if (route.auth && !route.staff && !platform.credentials) throw new PlatformFailure('请先登录', 401);
      const lists = ['home', 'offline', 'events', 'catalog', 'certificates', 'staffHome', 'staffGroups'];
      if (lists.includes(route.screen)) {
        const value = route.staff ? await platform.staffRequest<Row[]>(route.path) : await platform.request<Row[]>(route.path, http.RequestMethod.GET, undefined, route.auth);
        if (version === this.generation) this.rows = value || [];
      } else if (route.screen === 'records') {
        const value = await platform.request<Row[]>(route.path, http.RequestMethod.GET, undefined, true);
        if (version === this.generation) this.rows = value || [];
      } else if (route.screen === 'video') {
        const id = Number(this.selected.id || this.selected.video_id);
        const progress = await platform.request<Row>('/video/' + id + '/progress', http.RequestMethod.GET, undefined, true);
        if (version !== this.generation) return;
        this.revision = progress?.revision || 0; this.position = progress?.progress || 0;
        const value = await platform.request<Row>(route.path, http.RequestMethod.GET, undefined, true);
        if (version !== this.generation) return;
        if (!value.authorized || !secureMedia(value.play_url || '')) throw new PlatformFailure('当前没有此课节的有效学习权限', 403);
        this.playURL = value.play_url || ''; this.detail = value;
      } else {
        const value = route.staff ? await platform.staffRequest<Row>(route.path) : await platform.request<Row>(route.path, http.RequestMethod.GET, undefined, route.auth);
        if (version !== this.generation) return;
        this.detail = value || {};
        if (route.screen === 'shop') this.rows = value.products || [];
        if (route.screen === 'staffEntries') this.rows = (value.players || []).filter((row: Row) => route.groupID === 0 || row.groupId === route.groupID);
        if (route.screen === 'staffContestants') this.rows = value.contestants || [];
        if (route.screen === 'messages') this.rows = value.items || [];
        if (route.screen === 'staffLedger') this.rows = [];
      }
    } catch (failure) {
      if (version === this.generation) this.error = failure instanceof Error ? failure.message : '网络请求失败，请重试';
    } finally {
      if (version === this.generation) { this.busy = false; this.loggedIn = platform.credentials !== undefined; this.staffLoggedIn = platform.staff !== undefined; }
    }
  }
  private filtered(): Row[] {
    const terms = this.query.trim().toLocaleLowerCase().split(/\s+/);
    return this.rows.filter((row: Row) => {
      const text = [row.name, row.series_name, row.course_name, row.teacher, row.category, row.groupName, row.musicName, row.performanceTitle, row.phone, row.organization, row.programNumber, row.contestantNumber].join(' ').toLocaleLowerCase();
      return terms.every((term: string) => text.includes(term));
    });
  }
  private title(row: Row): string { return row.name || row.courseName || row.course_name || row.series_name || row.title || row.playerName || row.label || '记录'; }
  private summary(row: Row): string {
    return [row.subtitle, row.teacher, row.category, row.groupName, row.contestantNumber, row.programNumber, row.sequenceNo ? '出场顺序 ' + row.sequenceNo : '', row.musicName ? '音乐：' + row.musicName : '', row.paidStatus, row.content].filter((text: string | undefined) => text !== undefined && text !== '').join(' · ');
  }
  private async write(path: string, body: WriteBody, method: http.RequestMethod = http.RequestMethod.POST, staff: boolean = false): Promise<void> {
    if (this.busy) return; const version = this.generation; this.busy = true; this.error = '';
    try {
      if (staff) await platform.staffRequest<Row>(path, method, body); else await platform.request<Row>(path, method, body, true);
      if (version === this.generation) { this.error = '操作已完成，请刷新查看平台最新记录'; this.rows = []; }
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '提交失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private confirm(message: string, submit: () => void): void {
    AlertDialog.show({ title: '请确认', message: message, primaryButton: { value: '取消', action: () => {} }, secondaryButton: { value: '确认', action: submit } });
  }
  private tap(row: Row): void {
    this.selected = row;
    if (this.route.screen === 'home') this.go('catalog', this.title(row), '/public/series/' + Number(row.id) + '/courses');
    else if (this.route.screen === 'offline') { this.go('offlineDetail', this.title(row)); this.detail = row; }
    else if (this.route.screen === 'events') this.go('event', this.title(row), '/events/' + Number(row.id), false, Number(row.id));
    else if (this.route.screen === 'staffHome') this.go('staffCompetition', this.title(row), '', false, Number(row.id), 0, true);
    else if (this.route.screen === 'staffGroups') {
      const eventID = this.route.eventID; this.go('staffGroup', this.title(row), '', false, eventID, Number(row.id), true); this.detail = row;
    } else if (['staffEntries', 'staffPersonEntries'].includes(this.route.screen)) this.go('staffPlayer', this.title(row), '/event/players/' + Number(row.id), false, this.route.eventID, this.route.groupID, true);
    else if (this.route.screen === 'staffContestants') { this.go('staffPersonEntries', row.contestantNumber + ' · ' + this.title(row), '', false, this.route.eventID, 0, true); this.rows = row.entries || []; this.detail = row; }
    else if (this.route.screen === 'certificates') this.openURL(row.verifyUrl || '');
    else if (this.route.screen === 'shop') { this.go('product', this.title(row)); this.detail = row; }
    else if (this.route.screen === 'records' && (row.series_id || row.video_id)) {
      if (row.series_id) this.go('catalog', this.title(row), '/public/series/' + row.series_id + '/courses'); else this.startVideo(row);
    } else if (this.route.screen === 'messages') {
      this.go('message', row.title || '消息'); this.detail = row;
      this.write('/member/messages/' + row.recipientId + '/read', {}, http.RequestMethod.PATCH);
    }
  }
  private startVideo(row: Row): void {
    if (!platform.credentials) { this.go('login', '手机号登录'); return; }
    this.selected = row; this.go('video', this.title(row), '/video/' + Number(row.id || row.video_id) + '/play', true);
  }
  private async login(): Promise<void> {
    if (this.busy || !this.consent || !/^1[3-9][0-9]{9}$/.test(this.phone)) { this.error = '请填写有效手机号并阅读同意协议'; return; }
    this.busy = true;
    try { await platform.login(this.phone, this.code); this.loggedIn = true; this.code = ''; this.tab('account', '个人中心', '/member/profile', true); }
    catch (failure) { this.error = failure instanceof Error ? failure.message : '登录失败'; }
    finally { this.busy = false; }
  }
  private async loginStaff(): Promise<void> {
    if (this.busy) return; this.busy = true; const secret = this.password; this.password = '';
    try { await platform.loginStaff(this.username, secret); this.staffLoggedIn = true; this.go('staffHome', '赛事管理', '/event/competitions', false, 0, 0, true); }
    catch (failure) { this.error = failure instanceof Error ? failure.message : '登录失败'; }
    finally { this.busy = false; }
  }
  private async sendCode(): Promise<void> {
    if (!this.consent || !/^1[3-9][0-9]{9}$/.test(this.phone) || this.busy) { this.error = '请填写有效手机号并阅读同意协议'; return; }
    this.busy = true;
    try { await platform.request<Row>('/send-code', http.RequestMethod.POST, { phone: this.phone }); this.error = '验证码已发送'; }
    catch (failure) { this.error = failure instanceof Error ? failure.message : '发送失败'; }
    finally { this.busy = false; }
  }
  private openURL(url: string): void {
    if (!secureMedia(url) || !/^https:\/\/(www\.)?swod\.com\.cn\//.test(url) && !url.startsWith('https://admin.swod.com.cn/api/certificates/')) return;
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    context.startAbility({ action: 'ohos.want.action.viewData', uri: url }).catch(() => { this.error = '暂时无法打开链接'; });
  }

  private async chooseMusic(): Promise<void> {
    const version = this.generation;
    try {
      const pickerView = new picker.DocumentViewPicker(this.getUIContext().getHostContext() as common.UIAbilityContext);
      const options: picker.DocumentSelectOptions = { maxSelectNumber: 1, fileSuffixFilters: ['音乐|.mp3,.wav,.m4a,.aac,.flac'] };
      const files = await pickerView.select(options); if (files.length !== 1 || version !== this.generation) return;
      const file = fileIo.openSync(files[0], fileIo.OpenMode.READ_ONLY);
      try {
        const size = fileIo.statSync(file.fd).size;
        if (size <= 0 || size > 10 * 1024 * 1024) throw new Error('音乐文件不能超过10MB');
        const bytes = new ArrayBuffer(size);
        const read = fileIo.readSync(file.fd, bytes); if (read !== size) throw new Error('音乐读取不完整，请重新选择');
        const filename = decodeURIComponent(files[0].split('/').pop() || 'music.mp3');
        if (!/\.(mp3|wav|m4a|aac|flac)$/i.test(filename)) throw new Error('请选择 MP3、WAV、M4A、AAC 或 FLAC 音乐');
        this.music = bytes; this.musicName = filename;
      } finally { fileIo.closeSync(file); }
    } catch (failure) { this.error = failure instanceof Error ? failure.message : '文件选择失败，请重试'; }
  }
  private async register(): Promise<void> {
    if (this.busy || !this.music || !this.name.trim() || !/^1[3-9][0-9]{9}$/.test(this.phone) || !this.performanceTitle.trim()) { this.error = '请填写姓名、手机号、节目名称并选择音乐'; return; }
    this.busy = true; const version = this.generation;
    try {
      await platform.registerWithMusic(this.route.eventID, { groupId: String(this.route.groupID), name: this.name.trim(), phone: this.phone, organization: this.organization, teacher: this.teacher, performanceTitle: this.performanceTitle.trim(), remark: this.remark }, this.musicName, this.music);
      if (version === this.generation) { this.error = '报名与音乐已提交，付款及处理进度请在赛事记录中查看'; this.music = undefined; }
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '报名失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private async saveProgress(): Promise<void> {
    if (!this.playURL || this.checkpointPending || this.duration <= 0 || !platform.credentials) return;
    this.checkpointPending = true; const id = Number(this.selected.id || this.selected.video_id); const version = this.generation;
    try {
      const result = await platform.request<Row>('/video/' + id + '/progress', http.RequestMethod.POST, { progress: Math.min(this.position, this.duration), duration: this.duration, revision: this.revision }, true);
      if (version === this.generation) this.revision = result.revision || this.revision;
    } catch (failure) {
      if (failure instanceof PlatformFailure && failure.status === 409) {
        try {
          const current = await platform.request<Row>('/video/' + id + '/progress', http.RequestMethod.GET, undefined, true);
          if (version === this.generation) { this.revision = current.revision || 0; this.error = '另一设备已更新进度，本次没有覆盖'; }
        } catch (refreshError) { if (version === this.generation) this.error = '学习进度尚未同步，请检查网络'; }
      } else if (version === this.generation) this.error = '学习进度尚未同步，请检查网络';
    } finally { this.checkpointPending = false; }
  }
  private staffEntries(people: boolean = false): void {
    this.go(people ? 'staffContestants' : 'staffEntries', people ? '选手汇总' : '报名和音乐', '/event/entry-summary?competitionId=' + this.route.eventID, false, this.route.eventID, this.route.groupID, true);
  }
  private editPlayer(): void {
    const row = this.detail; this.selected = row; this.name = row.name || ''; this.phone = row.phone || ''; this.organization = row.organization || ''; this.teacher = row.teacher || ''; this.performanceTitle = row.performanceTitle || ''; this.remark = row.remark || '';
    this.go('staffEditor', '修正报名资料', '', false, this.route.eventID, 0, true);
  }
  private payment(): void {
    this.selected = this.detail; this.amount = String(this.detail.registrationFee || 0); this.paymentKind = 'charge'; this.paymentMethod = 'wechat'; this.paidAt = new Date().toISOString(); this.remark = ''; this.requestKey = util.generateRandomUUID();
    this.go('staffPayment', '登记实际缴费 / 退款', '', false, this.route.eventID, 0, true);
  }
  @Builder
  private action(label: string, submit: () => void) { Button(label).fontSize(14).fontColor('#9F1D20').backgroundColor('#F5EEEE').constraintSize({ minHeight: 48 }).width('100%').margin({ top: 4, bottom: 4 }).onClick(submit).enabled(!this.busy) }
  @Builder
  private card(row: Row) {
    Column({ space: 5 }) {
      Text(this.title(row)).fontSize(16).fontWeight(FontWeight.Medium).width('100%')
      if (this.summary(row)) { Text(this.summary(row)).fontSize(12).fontColor('#6A6262').width('100%') }
    }.padding(12).backgroundColor(Color.White).borderRadius(8).width('100%').constraintSize({ minHeight: 64 }).margin({ bottom: 6 }).onClick(() => this.tap(row))
  }
  @Builder
  private loginForm() {
    TextInput({ placeholder: '手机号', text: this.phone }).type(InputType.PhoneNumber).onChange((v: string) => { this.phone = v; })
    TextInput({ placeholder: '短信验证码', text: this.code }).type(InputType.Number).onChange((v: string) => { this.code = v; })
    Row() { Checkbox().select(this.consent).onChange((v: boolean) => { this.consent = v; }); Text('我已阅读并同意隐私政策和服务条款').fontSize(12).layoutWeight(1) }
    this.action('阅读隐私政策', () => this.openURL('https://www.swod.com.cn/privacy'))
    this.action('阅读服务条款', () => this.openURL('https://www.swod.com.cn/terms'))
    this.action('获取验证码', () => { this.sendCode(); })
    this.action('登录', () => { this.login(); })
    Text('本机号码与微信快捷登录正在接入验证，当前使用短信登录。').fontSize(12)
  }
  @Builder
  private staffForm() {
    Text('工作人员账号独立登录，平台核验赛事归属和权限。').fontSize(13)
    TextInput({ placeholder: '工作人员账号', text: this.username }).onChange((v: string) => { this.username = v; })
    TextInput({ placeholder: '密码', text: this.password }).type(InputType.Password).onChange((v: string) => { this.password = v; })
    this.action('登录赛事管理', () => { this.loginStaff(); })
  }
  @Builder
  private staffEditor() {
    TextInput({ placeholder: '姓名', text: this.name }).onChange((v: string) => { this.name = v; })
    TextInput({ placeholder: '手机号', text: this.phone }).type(InputType.PhoneNumber).onChange((v: string) => { this.phone = v; })
    TextInput({ placeholder: '机构', text: this.organization }).onChange((v: string) => { this.organization = v; })
    TextInput({ placeholder: '指导老师', text: this.teacher }).onChange((v: string) => { this.teacher = v; })
    TextInput({ placeholder: '节目名称', text: this.performanceTitle }).onChange((v: string) => { this.performanceTitle = v; })
    TextInput({ placeholder: '备注', text: this.remark }).onChange((v: string) => { this.remark = v; })
    Text('缴费状态通过独立流水登记，编号由平台管理。').fontSize(12)
    this.action('保存修正', () => this.confirm('确认保存本条报名资料？', () => { this.write('/event/players/' + this.selected.id, { name: this.name, phone: this.phone, organization: this.organization, teacher: this.teacher, performanceTitle: this.performanceTitle, remark: this.remark }, http.RequestMethod.PUT, true); }))
  }
  @Builder
  private paymentForm() {
    Text(this.selected.name + ' · ' + this.selected.groupName).fontSize(15)
    Select([{ value: '实际缴费' }, { value: '实际退款' }]).selected(this.paymentKind === 'charge' ? 0 : 1).onSelect((index: number) => { this.paymentKind = index === 0 ? 'charge' : 'refund'; })
    TextInput({ placeholder: '金额（元）', text: this.amount }).type(InputType.Number).onChange((v: string) => { this.amount = v; })
    Select([{ value: '微信' }, { value: '支付宝' }, { value: '银行卡' }, { value: '现金' }, { value: '其他' }]).selected(0).onSelect((index: number) => { this.paymentMethod = ['wechat', 'alipay', 'bank', 'cash', 'other'][index]; })
    TextInput({ placeholder: '实际时间（ISO日期时间）', text: this.paidAt }).onChange((v: string) => { this.paidAt = v; })
    TextInput({ placeholder: '备注', text: this.remark }).onChange((v: string) => { this.remark = v; })
    Text('单条报名一次缴清；退款须全额退回。此处登记实际流水，款项须另行完成。').fontSize(12)
    this.action('提交实际流水', () => this.confirm('确认已经实际完成收款或退款，并登记 ¥' + this.amount + '？', () => { this.write('/event/players/' + this.selected.id + '/payments', { kind: this.paymentKind, method: this.paymentMethod, amount: Number(this.amount), paidAt: this.paidAt, remark: this.remark, requestKey: this.requestKey }, http.RequestMethod.POST, true); }))
  }
  @Builder
  private content() {
    if (this.route.screen === 'home') {
      Row({ space: 8 }) { Image($r('app.media.brand_logo')).width(36).height(36); Text('SWOD · 伊娃东方舞').fontSize(16) }.width('100%')
      this.action('继续学习', () => this.go('records', '最近学习', '/member/recent-courses', true))
      this.action('我的课程', () => this.go('records', '我的课程', '/member/authorized-series', true))
      this.action('学习助手 · 30 分钟练习', () => this.go('assistant', '学习助手'))
    }
    if (this.route.screen === 'assistant') { Text('30分钟：热身6 · 技巧18 · 复习6').fontSize(18); this.action('继续上次课程', () => this.go('records', '最近学习', '/member/recent-courses', true)) }
    if (this.route.screen === 'offline') { this.action('期次课时与核销', () => this.go('schedule', '期次课时', '/offline/overview', true)) }
    if (this.route.screen === 'events') {
      this.action('我的报名与成绩', () => this.go('myEvents', '赛事记录', '/member/events', true))
      this.action('工作人员 · 赛事管理', () => this.go(this.staffLoggedIn ? 'staffHome' : 'staffLogin', '赛事管理', this.staffLoggedIn ? '/event/competitions' : '', false, 0, 0, true))
    }
    if (this.route.screen === 'login') { this.loginForm() }
    if (this.route.screen === 'staffLogin') { this.staffForm() }
    if (this.route.screen === 'staffEditor') { this.staffEditor() }
    if (this.route.screen === 'staffPayment') { this.paymentForm() }
    if (this.route.screen === 'staffHome') { this.action('退出赛事管理', () => { platform.staff = undefined; this.staffLoggedIn = false; this.go('staffLogin', '工作人员登录'); }) }
    if (this.route.screen === 'account') {
      if (!this.loggedIn) { this.action('手机号登录', () => this.go('login', '手机号登录')) }
      else {
        Text(this.detail.name || '我的学习空间').fontSize(18)
        this.action('我的课程', () => this.go('records', '我的课程', '/member/authorized-series', true))
        this.action('学习消息', () => this.go('messages', '学习消息', '/member/messages?limit=20&cursor=0', true))
        this.action('我的证书', () => this.go('certificates', '我的证书', '/certificates', true))
        this.action('学习笔记', () => this.go('records', '学习笔记', '/notes/all', true))
        this.action('学习书签', () => this.go('records', '学习书签', '/bookmarks/all', true))
        this.action('登录设备', () => this.go('records', '登录设备', '/devices', true))
        this.action('退出登录', () => this.confirm('退出当前账号？', () => { platform.logout().catch(() => {}); this.loggedIn = false; this.tab('account', '个人中心', ''); }))
      }
      this.action('工作人员 · 赛事管理', () => this.go(this.staffLoggedIn ? 'staffHome' : 'staffLogin', '赛事管理', this.staffLoggedIn ? '/event/competitions' : '', false, 0, 0, true))
      this.action('隐私政策', () => this.openURL('https://www.swod.com.cn/privacy'))
      this.action('服务条款', () => this.openURL('https://www.swod.com.cn/terms'))
      Text('SWOD 1.0.0 (3)').fontSize(12)
    }
    if (this.route.screen === 'event') {
      Text(this.detail.competition?.name || '').fontSize(18)
      Text(this.detail.competition?.description || '').fontSize(14)
      Text('完整组别名称').fontSize(15)
      ForEach(this.detail.groups || [], (group: Row) => { this.action(group.name || '', () => { this.selected = group; this.name = ''; this.performanceTitle = ''; this.music = undefined; this.musicName = ''; this.go('register', '赛事报名', '', true, this.route.eventID, Number(group.id)); }) }, (group: Row) => String(group.id))
      Text('赛程').fontSize(15)
      ForEach(this.detail.sessions || [], (session: Row) => { Text([session.name, session.startsAt, session.venue].join(' · ')).fontSize(13) }, (session: Row) => String(session.id))
      Text('已发布成绩').fontSize(15)
      ForEach(this.detail.rankings || [], (rank: Row) => { Text([rank.rankNo, rank.playerName, rank.groupName, rank.publishedTotal].join(' · ')).fontSize(13) }, (rank: Row) => String(rank.id))
    }
    if (this.route.screen === 'register') {
      if (!this.loggedIn) { this.action('登录后报名', () => this.go('login', '手机号登录')) }
      else {
        Text(this.selected.name || '').fontSize(18)
        TextInput({ placeholder: '姓名', text: this.name }).onChange((v: string) => { this.name = v; })
        TextInput({ placeholder: '手机号', text: this.phone }).type(InputType.PhoneNumber).onChange((v: string) => { this.phone = v; })
        TextInput({ placeholder: '机构（选填）', text: this.organization }).onChange((v: string) => { this.organization = v; })
        TextInput({ placeholder: '节目名称', text: this.performanceTitle }).onChange((v: string) => { this.performanceTitle = v; })
        this.action(this.musicName ? '更换音乐：' + this.musicName : '选择参赛音乐（10MB以内）', () => { this.chooseMusic(); })
        this.action('提交报名与音乐', () => this.confirm('确认提交报名、节目名称与音乐？', () => { this.register(); }))
      }
    }
    if (this.route.screen === 'catalog') {
      ForEach(this.rows, (unit: Row) => {
        Column({ space: 4 }) { Text(unit.name || '').fontSize(16); ForEach(unit.videos || [], (lesson: Row) => { this.action((unit.name || '') + ' · ' + (lesson.name || ''), () => this.startVideo({ id: lesson.id, name: unit.name })) }, (lesson: Row) => String(lesson.id)) }.width('100%')
      }, (unit: Row) => String(unit.id))
    }
    if (this.route.screen === 'video' && this.playURL) {
      Video({ src: this.playURL, controller: this.controller }).width('100%').height(230).controls(true).loop(this.loop).scale({ x: this.mirror ? -1 : 1 })
        .onPrepared((event?: VideoDuration) => { this.duration = event?.duration || 0; this.controller.setCurrentTime(this.position); })
        .onUpdate((event?: VideoTime) => { this.position = event?.time || 0; if (Date.now() - this.lastCheckpoint > 15000) { this.lastCheckpoint = Date.now(); this.saveProgress(); } })
        .onError(() => { this.error = '视频暂时无法播放，请返回后重试'; })
      Row() { Checkbox().select(this.mirror).onChange((v: boolean) => { this.mirror = v; }); Text('镜像'); Checkbox().select(this.loop).onChange((v: boolean) => { this.loop = v; }); Text('循环') }
      TextInput({ placeholder: '本节学习笔记', text: this.remark }).onChange((v: string) => { this.remark = v; })
      this.action('保存笔记', () => { this.write('/notes', { video_id: Number(this.selected.id || this.selected.video_id), timestamp_seconds: this.position, content: this.remark }); })
    }
    if (this.route.screen === 'offlineDetail' || this.route.screen === 'product') {
      Text(this.detail.description || '').fontSize(14)
      if (this.route.screen === 'offlineDetail') { Text([this.detail.start_date, this.detail.end_date, this.detail.location].join(' · ')).fontSize(13); this.action('查看期次课时', () => this.go('schedule', '期次课时', '/offline/overview', true)) }
      else { Text('¥' + this.detail.price + ' · 库存 ' + this.detail.stock).fontSize(16); Text('下单及支付根据平台开放状态显示，当前可查看商品。').fontSize(13) }
    }
    if (this.route.screen === 'schedule' || this.route.screen === 'booking') {
      Text('购买课程期次的课时，到课后核销扣减，无需预约。').fontSize(14)
      Text('已购期次课时').fontSize(16)
      ForEach(this.detail.entitlements || [], (row: Row) => { Text(row.course_name + ' · ' + row.course_period + ' · 剩余 ' + row.available_sessions + ' 课时 · 已核销 ' + row.used_sessions + ' 课时').fontSize(14) }, (row: Row) => String(row.id))
      Text('核销记录').fontSize(16)
      ForEach(this.detail.consumes || [], (row: Row) => { Text(row.course_name + ' · ' + row.consume_date + ' · 核销 ' + row.count + ' 课时').fontSize(14) }, (row: Row) => String(row.id))
    }
    if (this.route.screen === 'staffCompetition') {
      this.action('报名和音乐 · 节目汇总', () => this.staffEntries())
      this.action('选手汇总 · 一人多项报名', () => this.staffEntries(true))
      this.action('完整组别与出场顺序', () => this.go('staffGroups', '组别管理', '/event/groups?competitionId=' + this.route.eventID, false, this.route.eventID, 0, true))
      this.action('开放报名', () => this.confirm('开放当前赛事报名？', () => { this.write('/event/competitions/' + this.route.eventID, { action: 'openRegistration' }, http.RequestMethod.PATCH, true); }))
      this.action('关闭报名', () => this.confirm('关闭当前赛事报名？', () => { this.write('/event/competitions/' + this.route.eventID, { action: 'closeRegistration' }, http.RequestMethod.PATCH, true); }))
    }
    if (this.route.screen === 'staffGroup') {
      Text(this.detail.name || '').fontSize(18)
      this.action('报名、音乐与出场顺序', () => this.staffEntries())
      this.action('随机安排本组出场顺序', () => this.confirm('重新随机编排本组有效报名？编号保持独立。', () => { this.write('/event/players/batch', { action: 'randomize_sequence', competitionId: this.route.eventID, groupId: this.route.groupID }, http.RequestMethod.PATCH, true); }))
    }
    if (this.route.screen === 'staffPlayer') {
      Text([this.detail.name, this.detail.phone, this.detail.groupName, this.detail.organization, this.detail.teacher, this.detail.performanceTitle, this.detail.musicName, this.detail.paidStatus].join('\n')).fontSize(15)
      Text('出场顺序 ' + this.detail.sequenceNo + ' · 应收 ¥' + this.detail.registrationFee + ' · 已收 ¥' + this.detail.paidAmount).fontSize(14)
      this.action('修正报名资料', () => this.editPlayer())
      this.action('登记实际缴费 / 退款', () => this.payment())
    }
    if (['staffEntries', 'staffContestants'].includes(this.route.screen)) {
      Text('共 ' + (this.detail.contestants || []).length + ' 名选手 · ' + (this.detail.players || []).length + ' 个节目').fontSize(14)
      Text('完整记录先编号，再搜索；选手编号、节目编号与出场顺序分别管理。').fontSize(12)
    }
    if (this.route.screen === 'myEvents') { ForEach(this.detail.entries || [], (row: Row) => { this.card(row) }, (row: Row) => String(row.id)) }
    if (this.route.screen === 'message') { Text(this.detail.content || '').fontSize(16) }
    if (this.route.screen !== 'catalog' && this.rows.length > 0) {
      TextInput({ placeholder: '搜索名称、老师、组别或音乐', text: this.query }).onChange((v: string) => { this.query = v; })
      ForEach(this.filtered(), (row: Row) => { this.card(row) }, (row: Row) => String(row.id || row.video_id || row.series_id))
    }
    if (this.route.screen === 'messages' && this.detail.hasMore) { this.action('下一页', () => this.go('messages', '学习消息', '/member/messages?limit=20&cursor=' + this.detail.nextCursor, true)) }
    if (this.busy) { LoadingProgress().width(32).height(32) }
    if (this.error) { Text(this.error).fontSize(14).fontColor('#9F1D20'); this.action('刷新', () => { this.load(); }); if (!this.loggedIn && this.route.auth && !this.route.staff) { this.action('手机号登录', () => this.go('login', '手机号登录')) } }
    if (!this.busy && !this.error && this.rows.length === 0 && ['home', 'offline', 'events', 'records', 'certificates'].includes(this.route.screen)) { Text('暂无可展示的记录').fontSize(14) }
  }
  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Button('‹').width(44).height(44).backgroundColor(Color.Transparent).fontColor('#9F1D20').onClick(() => this.back())
        Text(this.route.title).fontSize(18).fontWeight(FontWeight.Medium).layoutWeight(1)
        Button('刷新').height(44).backgroundColor(Color.Transparent).fontColor('#9F1D20').onClick(() => { this.load(); })
      }.padding({ left: 8, right: 8 }).width('100%')
      Scroll() { Column({ space: 8 }) { this.content() }.padding(12).width('100%') }.layoutWeight(1).width('100%')
      Row() {
        Button('学院').layoutWeight(1).height(52).fontSize(12).backgroundColor(Color.White).fontColor('#9F1D20').onClick(() => this.tab('home', '线上学院', '/public/series'))
        Button('线下课').layoutWeight(1).height(52).fontSize(12).backgroundColor(Color.White).fontColor('#9F1D20').onClick(() => this.tab('offline', '线下课程', '/public/offline-courses'))
        Button('赛事').layoutWeight(1).height(52).fontSize(12).backgroundColor(Color.White).fontColor('#9F1D20').onClick(() => this.tab('events', '东方舞赛事', '/events'))
        Button('商城').layoutWeight(1).height(52).fontSize(12).backgroundColor(Color.White).fontColor('#9F1D20').onClick(() => this.tab('shop', '商城', '/shop/products'))
        Button('我的').layoutWeight(1).height(52).fontSize(12).backgroundColor(Color.White).fontColor('#9F1D20').onClick(() => this.tab('account', '个人中心', platform.credentials ? '/member/profile' : '', true))
      }.width('100%')
    }.backgroundColor('#FAF8F6').width('100%').height('100%')
  }
}
