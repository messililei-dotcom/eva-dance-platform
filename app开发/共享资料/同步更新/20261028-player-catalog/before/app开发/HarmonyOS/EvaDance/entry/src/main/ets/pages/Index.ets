import { http } from '@kit.NetworkKit';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { webview } from '@kit.ArkWeb';
import { picker, fileIo } from '@kit.CoreFileKit';
import { Row, WriteBody, PaymentFlags, MediaQuality } from '../services/Models';
import { platform, PlatformFailure, secureMedia, coverImageURL, externalURLAllowed, ApiMethod } from '../services/PlatformApi';
import { coursePrice, originalPrice, offlineCopy, offlineDescription, canPurchasePeriod, groupedCourses, catalogLessons } from '../services/CoursePresentation';
import { CarrierLogin } from '../services/CarrierLogin';
import { eventCount, eventAggregate, eventDates, eventState } from '../services/EventPresentation';
import { SwodTheme } from '../services/SwodTheme';
import { goodsInput, paymentURL, orderStatus } from '../services/ShopCheckout';
import { productPrice, productStock } from '../services/ProductPresentation';

interface Route { screen: string; title: string; path: string; auth: boolean; staff: boolean; eventID: number; groupID: number; }
interface VideoTime { time: number; }
interface VideoDuration { duration: number; }

@Entry
@Component
struct Index {
  @State private activeTab: string = 'home';
  @State private route: Route = { screen: 'home', title: '线上学院', path: '/public/series', auth: false, staff: false, eventID: 0, groupID: 0 };
  @State private rows: Row[] = [];
  @State private detail: Row = {};
  @State private query: string = '';
  @State private courseCardHeights: Map<string, number> = new Map<string, number>();
  @State private catalogPage: number = 1;
  @State private currentLessonID: string = '';
  @State private progressRows: Row[] = [];
  @State private videoPlaylist: Row[] = [];
  @State private videoCatalogOpen: boolean = false;
  @State private videoQuery: string = '';
  @State private videoLimit: number = 50;
  private lastAuthorization: number = 0;
  private authorizationPending: boolean = false;
  @State private videoQualities: MediaQuality[] = [];
  @State private videoQuality: number = 0;
  private qualityResume: number = -1;
  private qualityChanging: boolean = false;
  @State private offlineRows: Row[] = [];
  @State private courseOrderID: string = '';
  @State private shopPayment: PaymentFlags = {};
  @State private quantity: string = '1';
  @State private refundReason: string = '';
  @State private recipient: string = '';
  @State private shippingPhone: string = '';
  @State private shippingAddress: string = '';
  private goodsRequestKey: string = '';
  private goodsFingerprint: string = '';
  private checkoutProduct: Row = {};
  private courseRequestKey: string = '';
  private catalogScroller: Scroller = new Scroller();
  @State private busy: boolean = false;
  @State private error: string = '';
  @State private webURL: string = '';
  @State private webLoading: boolean = false;
  @State private webError: string = '';
  private webController: webview.WebviewController = new webview.WebviewController();
  @State private unlockedSeries: string[] = [];
  @State private courseAccessReady: boolean = false;
  @State private loggedIn: boolean = false;
  @State private staffLoggedIn: boolean = false;
  @State private phone: string = '';
  @State private code: string = '';
  @State private memberPassword: string = '';
  @State private memberLoginMode: string = 'sms';
  @State private username: string = '';
  @State private password: string = '';
  @State private consent: boolean = false;
  @State private carrierReady: boolean = false;
  @State private carrierHint: string = '正在检查本机号码登录…';
  @State private smsSeconds: number = 0;
  @State private loginNotice: string = '';
  private smsSentTimes: Map<string, number> = new Map<string, number>();
  private smsTimer: number = -1;
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
  @State private history: Route[] = [];
  private generation: number = 0;
  private selected: Row = {};
  @State private selectedPlaybackRate: number = 1;
  @State private holdingSpeed: boolean = false;
  private videoPlaying: boolean = false;
  private holdTimer: number = -1;
  private holdX: number = 0;
  private holdY: number = 0;
  private endHoldSpeed(): void {
    if (this.holdTimer >= 0) clearTimeout(this.holdTimer);
    this.holdTimer = -1; this.holdingSpeed = false;
  }
  private onVideoTouch(event: TouchEvent): void {
    if (event.type === TouchType.Down) {
      this.endHoldSpeed();
      if (!this.videoPlaying || event.touches.length !== 1 || event.touches[0].y > 190) return;
      this.holdX = event.touches[0].x; this.holdY = event.touches[0].y;
      this.holdTimer = setTimeout(() => { this.holdTimer = -1; if (this.videoPlaying) this.holdingSpeed = true; }, 400);
    } else if (event.type === TouchType.Move) {
      if (event.touches.length !== 1 || Math.max(Math.abs(event.touches[0].x - this.holdX), Math.abs(event.touches[0].y - this.holdY)) > 12) this.endHoldSpeed();
    } else { this.endHoldSpeed(); }
  }
  onPageHide(): void { this.endHoldSpeed(); this.videoPlaying = false; this.controller.pause(); this.saveProgress(); }
  private controller: VideoController = new VideoController();
  private playbackPosition: number = 0;
  private duration: number = 0;
  private revision: number = 0;
  private lastCheckpoint: number = 0;
  private checkpointPending: boolean = false;

  aboutToAppear(): void { this.load(); }
  onPageShow(): void { if (!this.busy && (this.route.screen === 'home' || this.route.path.startsWith('/member/authorized-series'))) this.load(); }
  aboutToDisappear(): void { if (this.smsTimer >= 0) clearInterval(this.smsTimer); this.carrierLogin.cancel(); this.endHoldSpeed(); this.videoPlaying = false; this.saveProgress(); this.controller.pause(); this.generation++; }
  onBackPress(): boolean { if (this.history.length === 0) return false; this.back(); return true; }
  private go(screen: string, title: string, path: string = '', auth: boolean = false, eventID: number = 0, groupID: number = 0, staff: boolean = false): void {
    this.endHoldSpeed(); this.videoPlaying = false; this.saveProgress(); this.controller.pause(); this.playURL = '';
    this.history.push(this.route);
    if (screen === 'login') { this.phone = ''; this.code = ''; this.memberPassword = ''; this.consent = false; this.memberLoginMode = 'sms'; this.loginNotice = ''; }
    this.route = { screen: screen, title: title, path: path, auth: auth, eventID: eventID, groupID: groupID, staff: staff };
    this.query = ''; this.rows = []; this.detail = {}; this.error = ''; this.refundReason = ''; this.generation++; this.load();
  }
  private back(): void {
    this.endHoldSpeed(); this.videoPlaying = false; this.saveProgress(); this.controller.pause(); this.playURL = '';
    const previous = this.history.pop(); if (!previous) return;
    this.route = previous; this.query = ''; this.rows = []; this.detail = {}; this.generation++; this.load();
  }
  private tab(screen: string, title: string, path: string, auth: boolean = false): void {
    this.activeTab = screen;
    this.history = []; this.go(screen, title, path, auth); this.history = [];
  }
  private isCourseUnlocked(row: Row): boolean {
    return !!platform.credentials && this.unlockedSeries.includes(String(row.series_id || row.id));
  }
  private currentSeriesID(): string { return this.route.path.split('/')[3] || ''; }
  private async prepareMemberLogin(): Promise<void> {
    const version = this.generation;
    this.busy = false; this.carrierReady = false; this.carrierHint = '正在检查本机号码登录…';
    if (this.smsTimer >= 0) clearInterval(this.smsTimer);
    this.updateSMSCooldown();
    this.smsTimer = setInterval(() => {
      if (this.route.screen !== 'login') { clearInterval(this.smsTimer); this.smsTimer = -1; return; }
      this.updateSMSCooldown();
    }, 1000);
    try {
      const config = await platform.request<Row>('/config');
      if (version !== this.generation) return;
      this.carrierReady = config.oneTapLogin === true;
      this.carrierHint = this.carrierReady ? '由运营商验证本机号码，登录前请同意下方协议' : '本机号码登录暂未开放，请使用短信验证或账号密码登录';
    } catch { if (version === this.generation) this.carrierHint = '暂时无法检查本机号码登录，请使用短信验证'; }
  }
  private updateSMSCooldown(): void {
    const sent = this.smsSentTimes.get(this.phone) || 0;
    this.smsSeconds = sent ? Math.max(0, Math.min(60, Math.ceil((60000 - (Date.now() - sent)) / 1000))) : 0;
  }
  private validLoginInput(): boolean {
    return !this.busy && this.consent && /^1[3-9][0-9]{9}$/.test(this.phone) &&
      (this.memberLoginMode === 'password' ? this.memberPassword.length > 0 : /^[0-9]{6}$/.test(this.code));
  }
  private async load(): Promise<void> {
    if (this.route.screen === 'login') { await this.prepareMemberLogin(); return; }
    if (['offlineDetail', 'product'].includes(this.route.screen) && !this.route.path) { this.busy = false; this.error = ''; return; }
    const version = this.generation; const route = this.route;
    this.busy = true; this.error = '';
    try {
      if (!route.path) return;
      if (route.staff && !platform.staff) throw new PlatformFailure('请使用工作人员账号登录', 401);
      if (route.auth && !route.staff && !platform.credentials) throw new PlatformFailure('请先登录', 401);
      if (route.screen === 'home' || route.screen === 'catalog' || route.path.startsWith('/member/authorized-series')) {
        this.unlockedSeries = []; this.courseAccessReady = !platform.credentials;
        const member = platform.credentials?.memberId;
        if (member) { try {
          const rights = await platform.request<Row[]>('/member/authorized-series', http.RequestMethod.GET, undefined, true);
          if (version !== this.generation || member !== platform.credentials?.memberId) return;
          this.unlockedSeries = rights.map((row: Row) => String(row.series_id || row.id)); this.courseAccessReady = true;
        } catch { this.courseAccessReady = false; } }
      }
      const lists = ['home', 'offline', 'events', 'catalog', 'certificates', 'staffHome', 'staffGroups'];
      if (lists.includes(route.screen)) {
        const value = route.staff ? await platform.staffRequest<Row[]>(route.path) : await platform.request<Row[]>(route.path, http.RequestMethod.GET, undefined, route.auth);
        if (version === this.generation) {
          if (route.screen === 'offline') { this.offlineRows = value || []; this.rows = groupedCourses(value || []); } else this.rows = value || [];
          if (route.screen === 'catalog') { this.catalogPage = 1; this.progressRows = []; if (platform.credentials) { try { const progress = await platform.request<Row[]>(route.path.replace('/courses', '/progress'), http.RequestMethod.GET, undefined, true); if (version === this.generation) this.progressRows = progress; } catch { /* Unknown progress is never displayed as completed. */ } } }
        }
      } else if (route.screen === 'records') {
        const value = await platform.request<Row[]>(route.path, http.RequestMethod.GET, undefined, true);
        if (version === this.generation) this.rows = value || [];
      } else if (route.screen === 'video') {
        const id = Number(this.selected.id || this.selected.video_id);
        const progress = await platform.request<Row>('/video/' + id + '/progress', http.RequestMethod.GET, undefined, true);
        if (version !== this.generation) return;
        this.revision = progress?.revision || 0; this.playbackPosition = Number(progress?.duration || 0) > 0 && Number(progress?.progress || 0) >= Number(progress?.duration || 0) ? 0 : progress?.progress || 0;
        const value = await platform.request<Row>(route.path, http.RequestMethod.GET, undefined, true);
        if (version !== this.generation) return;
        if (!value.authorized || !secureMedia(value.play_url || '')) throw new PlatformFailure('当前没有此课节的有效学习权限', 403);
        this.videoQualities = [{ value: 'auto', label: '自动', url: value.play_url || '' }];
        for (const quality of value.quality_options || []) { if (quality.url === this.videoQualities[0].url) this.videoQualities[0] = quality; if (secureMedia(quality.url) && !this.videoQualities.some((item: MediaQuality) => item.url === quality.url)) this.videoQualities.push(quality); }
        this.videoQuality = 0; this.qualityResume = -1; this.qualityChanging = false;
        this.playURL = value.play_url || ''; this.detail = value;
      } else {
        const value = route.staff ? await platform.staffRequest<Row>(route.path) : await platform.request<Row>(route.path, http.RequestMethod.GET, undefined, route.auth);
        if (version !== this.generation) return;
        if (route.screen === 'courseCheckout' && (!value?.offer || value.offer.priceFen === undefined ||
          !Number.isSafeInteger(value.offer.priceFen) || value.offer.priceFen < 0 ||
          value.offer.sessions === undefined || !Number.isFinite(value.offer.sessions) || value.offer.sessions <= 0)) {
          throw new PlatformFailure('课程订单信息暂不可用，请重新加载', 502);
        }
        this.detail = value || {};
        if (route.screen === 'shop') { this.rows = value.products || []; this.shopPayment = value.payment || {}; }
        if (route.screen === 'shopOrders') this.rows = value.orders || [];
        if (route.screen === 'goodsCheckout') {
          this.recipient = value.shipping?.recipient || ''; this.shippingPhone = value.shipping?.phone || ''; this.shippingAddress = value.shipping?.address || '';
          const catalog = await platform.request<Row>('/shop/products');
          if (version !== this.generation) return;
          this.shopPayment = catalog.payment || {};
          const fresh = (catalog.products || []).find((product: Row) => String(product.id) === String(this.checkoutProduct.id));
          if (!fresh) throw new Error('商品已下架，请返回商城重新选择');
          this.checkoutProduct = fresh; this.detail = fresh;
        }
        if (route.screen === 'staffEntries') this.rows = (value.players || []).filter((row: Row) => route.groupID === 0 || row.groupId === route.groupID);
        if (route.screen === 'staffContestants') this.rows = value.contestants || [];
        if (route.screen === 'messages') this.rows = value.items || [];
        if (route.screen === 'staffLedger') this.rows = [];
      }
    } catch (failure) {
      if (version === this.generation) {
        this.rows = []; this.detail = {};
        if (route.screen === 'offline') this.offlineRows = [];
        this.error = failure instanceof Error ? failure.message : '网络请求失败，请重试';
      }
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
    if (this.route.screen === 'home') return [row.teacher, row.category, row.total_courses !== undefined ? row.total_courses + ' 节课程' : ''].filter((text: string | undefined) => !!text).join(' · ');
    return [row.subtitle, row.teacher, row.category, this.route.screen === 'home' && row.total_courses !== undefined ? row.total_courses + ' 节课程' : '', this.route.screen === 'offline' ? [row.start_date, row.location, '期次课时'].filter((v: string | undefined) => !!v).join(' · ') : '', row.groupName, row.contestantNumber, row.programNumber, row.sequenceNo ? '出场顺序 ' + row.sequenceNo : '', row.musicName ? '音乐：' + row.musicName : '', row.paidStatus, row.content].filter((text: string | undefined) => text !== undefined && text !== '').join(' · ');
  }
  private eventResult(row: Row): string {
    if (row.resultPublished !== true) return '成绩待公示';
    const label = row.awardName || (Number(row.rankNo) > 0 ? '第' + row.rankNo + '名' : '成绩已公示');
    return label + (row.totalScore === undefined || row.totalScore === null ? '' : ' · ' + row.totalScore + '分');
  }
  private eventAudit(value: string): string { return value === 'pending' ? '待审核' : value === 'approved' ? '审核通过' : value === 'rejected' ? '未通过' : value || '待审核'; }
  private eventPaid(value: string): string { return value === 'unpaid' ? '待缴费' : value === 'pending' ? '待确认' : value === 'paid' ? '已缴费' : value === 'refunded' ? '已退款' : value; }
  private async write(path: string, body: WriteBody, method: ApiMethod = http.RequestMethod.POST, staff: boolean = false): Promise<void> {
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
    else if (this.route.screen === 'shopOrders') this.go('shopOrder', '订单详情', '/shop/orders/' + String(row.id), true);
    else if (this.route.screen === 'records' && (row.series_id || row.video_id)) {
      if (row.series_id) this.go('catalog', this.title(row), '/public/series/' + row.series_id + '/courses'); else this.startVideo(row);
    } else if (this.route.screen === 'messages') {
      this.go('message', row.title || '消息'); this.detail = row;
      this.write('/member/messages/' + row.recipientId + '/read', {}, 'PATCH');
    }
  }
  private startVideo(row: Row): void {
    if (!platform.credentials) { this.go('login', '手机号登录'); return; }
    const fromVideo = this.route.screen === 'video';
    if (this.route.screen === 'catalog') this.videoPlaylist = catalogLessons(this.rows, this.progressRows);
    else if (!fromVideo) this.videoPlaylist = [];
    // Capture the old lesson checkpoint before changing the selected lesson.
    this.saveProgress(); this.duration = 0; this.playbackPosition = 0; this.revision = 0;
    this.videoQuery = ''; this.videoLimit = 50; this.lastAuthorization = Date.now();
    this.currentLessonID = String(row.id || row.video_id); this.videoCatalogOpen = false; this.videoQualities = []; this.qualityChanging = false; this.qualityResume = -1;
    this.selected = row; this.go('video', this.title(row), '/video/' + Number(row.id || row.video_id) + '/play', true);
    if (fromVideo) this.history.pop();
  }
  private async verifyVideoAccess(): Promise<void> {
    if (this.authorizationPending || this.route.screen !== 'video' || Date.now() - this.lastAuthorization < 60000) return;
    const version = this.generation; this.authorizationPending = true;
    try {
      const result = await platform.request<Row>('/video/' + this.currentLessonID + '/play', http.RequestMethod.GET, undefined, true);
      if (version !== this.generation) return;
      if (!result.authorized) throw new Error('学习权限已变化，请返回课程重新加载');
      this.lastAuthorization = Date.now();
    } catch (failure) {
      if (version === this.generation) { this.endHoldSpeed(); this.controller.pause(); this.videoPlaying = false; this.playURL = ''; this.error = '权限验证失败，请返回后重试'; }
    } finally { this.authorizationPending = false; }
  }
  private carrierLogin: CarrierLogin = new CarrierLogin();
  private async loginCarrier(): Promise<void> {
    if (this.busy) return;
    if (!this.consent) { this.error = '请阅读并同意隐私政策和服务条款'; return; }
    const version = this.generation; this.busy = true; this.error = '';
    try {
      const config = await platform.request<Row>('/config');
      if (version !== this.generation) return;
      if (!config.oneTapLogin) throw new Error('本机号码登录暂未开放，请使用短信登录');
      const token = await this.carrierLogin.token(this.getUIContext().getHostContext() as common.UIAbilityContext);
      if (version !== this.generation) return;
      await platform.loginWithCarrier(token, () => version === this.generation && this.route.screen === 'login');
      if (version !== this.generation) return;
      this.loggedIn = true; this.tab('account', '个人中心', '/member/profile', true);
    } catch (failure) {
      if (version === this.generation && failure instanceof Error && failure.message !== '已取消本机号码登录') this.error = failure.message;
    } finally { if (version === this.generation) this.busy = false; }
  }
  private async login(): Promise<void> {
    if (this.busy || !this.consent || !/^1[3-9][0-9]{9}$/.test(this.phone)) { this.error = '请填写有效手机号并阅读同意协议'; return; }
    if (this.memberLoginMode === 'password' && !this.memberPassword) { this.error = '请输入密码'; return; }
    if (this.memberLoginMode === 'sms' && !/^[0-9]{6}$/.test(this.code)) { this.error = '请填写六位验证码'; return; }
    const version = this.generation;
    const secret = this.memberPassword;
    this.memberPassword = '';
    this.busy = true;
    try {
      if (this.memberLoginMode === 'password') await platform.loginWithPassword(this.phone, secret, () => version === this.generation && this.route.screen === 'login');
      else await platform.login(this.phone, this.code, () => version === this.generation && this.route.screen === 'login');
      if (version !== this.generation) return;
      this.loggedIn = true; this.code = ''; this.tab('account', '个人中心', '/member/profile', true);
    }
    catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '登录失败'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private async loginStaff(): Promise<void> {
    if (this.busy) return; this.busy = true; const secret = this.password; this.password = '';
    try { await platform.loginStaff(this.username, secret); this.staffLoggedIn = true; this.go('staffHome', '赛事管理', '/event/competitions', false, 0, 0, true); }
    catch (failure) { this.error = failure instanceof Error ? failure.message : '登录失败'; }
    finally { this.busy = false; }
  }
  private async sendCode(): Promise<void> {
    this.updateSMSCooldown();
    if (!this.consent || !/^1[3-9][0-9]{9}$/.test(this.phone) || this.busy || this.smsSeconds > 0) { this.error = '请填写有效手机号、同意协议并等待验证码冷却结束'; return; }
    const phone = this.phone; const version = this.generation; this.busy = true; this.error = ''; this.loginNotice = '';
    try {
      await platform.request<Row>('/send-code', http.RequestMethod.POST, { phone: phone });
      this.smsSentTimes.set(phone, Date.now()); this.updateSMSCooldown();
      if (version === this.generation) this.loginNotice = '验证码已发送，请查收短信';
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '发送失败'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private openURL(url: string): void {
    if (!externalURLAllowed(url)) return;
    this.webController = new webview.WebviewController();
    this.webURL = url; this.webLoading = true; this.webError = '';
    const title = url === 'https://beian.miit.gov.cn/' ? '备案查询' :
      url.endsWith('/privacy') ? '隐私政策' : url.endsWith('/terms') ? '服务条款' :
      url.endsWith('/contact') ? '微信客服' : url.includes('/checkout/online/') ? '确认课程订单' : '证书查询';
    this.go('web', title);
  }
  private openCourseCheckout(seriesID: string): void {
    if (!/^[1-9][0-9]*$/.test(seriesID)) { this.error = '课程信息暂不可用，请刷新后重试'; return; }
    this.openURL('https://www.swod.com.cn/checkout/online/' + seriesID);
  }
  private finishWebLoad(): void {
    this.webLoading = false;
    // The native app already supplies installation and tabs on every embedded site page.
    if (this.webURL.startsWith('https://www.swod.com.cn/')) {
      this.webController.runJavaScript("if (!document.getElementById('swod-native-reader-style')) { const style = document.createElement('style'); style.id = 'swod-native-reader-style'; style.textContent = '.pwa-install-card, .mobile-app-tabbar { display: none !important; }'; document.head.appendChild(style); }").catch(() => {});
    }
  }
  private reloadWeb(): void {
    this.webError = ''; this.webLoading = true;
    try { this.webController.refresh(); }
    catch { this.webLoading = false; this.webError = '网页尚未就绪，请返回后重试'; }
  }

  private beginGoodsCheckout(): void {
    if (!platform.credentials) { this.go('login', '手机号登录'); return; }
    this.checkoutProduct = this.detail; this.quantity = '1'; this.goodsRequestKey = ''; this.goodsFingerprint = '';
    this.go('goodsCheckout', '确认商品订单', '/shop/shipping', true);
  }
  private async launchPayment(orderID: string): Promise<void> {
    const member = platform.credentials?.memberId; const version = this.generation;
    const payment = await platform.request<Row>('/shop/orders/' + orderID + '/pay', http.RequestMethod.POST, {}, true);
    if (version !== this.generation || member !== platform.credentials?.memberId) return;
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    await context.openLink(paymentURL(payment));
  }
  private async submitGoods(provider: string): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.error = ''; const version = this.generation;
    try {
      if (provider === 'alipay' ? !this.shopPayment.alipay : !this.shopPayment.wechat) throw new Error('该支付方式暂未开放，请刷新后重试');
      const fingerprint = [this.checkoutProduct.id, this.checkoutProduct.priceFen, this.quantity, this.recipient, this.shippingPhone, this.shippingAddress, provider].join('|');
      if (fingerprint !== this.goodsFingerprint) { this.goodsFingerprint = fingerprint; this.goodsRequestKey = util.generateRandomUUID(); }
      const input = goodsInput(this.checkoutProduct, Number(this.quantity), this.recipient, this.shippingPhone, this.shippingAddress, 'express', provider, this.goodsRequestKey);
      const created = await platform.request<Row>('/shop/orders', http.RequestMethod.POST, input, true);
      if (version !== this.generation) return;
      if (!created.order?.id) throw new Error('订单创建结果待确认，请前往我的订单查看');
      const id = String(created.order.id);
      this.go('shopOrder', '订单详情', '/shop/orders/' + id, true);
      // The order remains available even when the user cancels the external cashier.
      try { await this.launchPayment(id); } catch (failure) { this.error = failure instanceof Error ? failure.message : '支付页面未能打开，可在此继续付款'; }
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '下单失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private async orderAction(verb: string): Promise<void> {
    if (this.busy || !this.detail.order?.id) return;
    if (verb === 'refund' && (!this.refundReason.trim() || this.refundReason.length > 300)) { this.error = '请填写退款原因，最多300字'; return; }
    this.busy = true; this.error = ''; const version = this.generation; const id = String(this.detail.order.id);
    try {
      if (verb === 'pay') await this.launchPayment(id);
      else {
        const result = await platform.request<Row>('/shop/orders/' + id + '/' + verb, http.RequestMethod.POST, verb === 'refund' ? { reason: this.refundReason.trim() } : {}, true);
        if (version === this.generation) { this.detail = result; if (verb === 'refresh' && result.order?.status === 'pending') this.error = '尚未确认付款，请勿重复付款，稍后再同步'; }
      }
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '订单操作失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }

  private filteredLessons(): Row[] { const query = this.query.trim().toLocaleLowerCase(); return catalogLessons(this.rows, this.progressRows).filter((lesson: Row) => !query || (lesson.name || '').toLocaleLowerCase().includes(query)); }
  private catalogPages(): number { return Math.max(1, Math.ceil(this.filteredLessons().length / 50)); }
  private lessonDuration(lesson: Row): string { const seconds = Math.floor(Number(lesson.duration || 0)); return seconds > 0 ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : '时长待更新'; }
  private async submitCourse(provider: string): Promise<void> {
    if (this.busy || !this.detail.offer || !this.detail.payment || (provider === 'alipay' ? !this.detail.payment.alipay : !this.detail.payment.wechat)) return;
    this.busy = true; this.error = ''; const generation = this.generation;
    try {
      if (!this.courseOrderID) { const created = await platform.request<Row>('/shop/orders', http.RequestMethod.POST, {kind:'offline', targetId:Number(this.selected.source_id), provider:provider, expectedTotalFen:Number(this.detail.offer.priceFen), requestKey:this.courseRequestKey + provider}, true); if (generation !== this.generation) return; this.courseOrderID = String(created.order?.id || ''); }
      if (!this.courseOrderID) throw new Error('订单创建结果待确认，请勿重复付款');
      const payment = await platform.request<Row>('/shop/orders/' + this.courseOrderID + '/pay', http.RequestMethod.POST, {}, true);
      if (generation !== this.generation) return;
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext; await context.openLink(paymentURL(payment));
    } catch (failure) { if (generation === this.generation) this.error = failure instanceof Error ? failure.message : '支付失败'; }
    finally { if (generation === this.generation) this.busy = false; }
  }
  private async refreshCourse(): Promise<void> { if (this.busy || !this.courseOrderID) return; this.busy = true; const version = this.generation; try {const result = await platform.request<Row>('/shop/orders/' + this.courseOrderID + '/refresh', http.RequestMethod.POST, {}, true); if (version !== this.generation) return; if (['paid','completed'].includes(result.order?.status || '')) this.go('schedule','期次课时','/offline/overview?course_ids='+this.selected.source_id,true); else this.error='支付结果待确认，请勿重复付款';} catch (failure) {this.error = failure instanceof Error ? failure.message : '状态同步失败';} finally {this.busy=false;} }
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
      const fields: Record<string, string> = {};
      fields['groupId'] = String(this.route.groupID); fields['name'] = this.name.trim();
      fields['phone'] = this.phone; fields['organization'] = this.organization;
      fields['teacher'] = this.teacher; fields['performanceTitle'] = this.performanceTitle.trim(); fields['remark'] = this.remark;
      await platform.registerWithMusic(this.route.eventID, fields, this.musicName, this.music);
      if (version === this.generation) { this.error = '报名与音乐已提交，付款及处理进度请在赛事记录中查看'; this.music = undefined; }
    } catch (failure) { if (version === this.generation) this.error = failure instanceof Error ? failure.message : '报名失败，请重试'; }
    finally { if (version === this.generation) this.busy = false; }
  }
  private async saveProgress(): Promise<void> {
    if (!this.playURL || this.checkpointPending || this.duration <= 0 || !platform.credentials) return;
    this.checkpointPending = true; const id = Number(this.selected.id || this.selected.video_id); const version = this.generation;
    try {
      const result = await platform.request<Row>('/video/' + id + '/progress', http.RequestMethod.POST, { progress: Math.min(this.playbackPosition, this.duration), duration: this.duration, revision: this.revision }, true);
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
  private action(label: string, submit: () => void) { Button(label, { type: ButtonType.Normal }).fontSize(16).fontColor(SwodTheme.primary).backgroundColor(SwodTheme.surface).borderRadius(14).padding({ left: 16, right: 16, top: 14, bottom: 14 }).constraintSize({ minHeight: 52 }).width('100%').margin({ top: 4, bottom: 4 }).onClick(submit).enabled(!this.busy).accessibilityText(label) }
  @Builder
  private intro(title: string, subtitle: string) {
    Column({ space: 8 }) {
      Text(title).fontSize(22).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
      Text(subtitle).fontSize(14).fontColor(SwodTheme.muted).width('100%')
    }.alignItems(HorizontalAlign.Start).width('100%').padding({ top: 6, bottom: 10 })
  }
  @Builder
  private shortcut(label: string, icon: Resource, submit: () => void, primary: boolean = false) {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 8 }) { Image(icon).width(24).height(24); Text(label).fontSize(14).fontWeight(FontWeight.Medium).fontColor(SwodTheme.primary) }.padding(12)
    }.layoutWeight(1).constraintSize({ minHeight: 64 }).borderRadius(14).backgroundColor(primary ? SwodTheme.tonal : SwodTheme.surface).onClick(submit).accessibilityText(label)
  }
  @Builder
  private navItem(label: string, screen: string, icon: Resource, title: string, path: string, auth: boolean = false) {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 6 }) {
        Image(icon).width(24).height(24)
        Text(label).fontSize(12).fontWeight(this.activeTab === screen ? FontWeight.Bold : FontWeight.Normal).fontColor(this.activeTab === screen ? SwodTheme.primary : SwodTheme.muted)
      }.padding({ top: 10, bottom: 10 })
    }.layoutWeight(1).constraintSize({ minHeight: 68 }).borderRadius(14).backgroundColor(this.activeTab === screen ? SwodTheme.tonal : SwodTheme.surface).onClick(() => this.tab(screen, title, path, auth)).accessibilityText(label + (this.activeTab === screen ? '，已选中' : ''))
  }
  @Builder
  private card(row: Row) {
    Row({ space: 14 }) {
      if (this.route.screen === 'home' || this.route.screen === 'offline') {
        if (coverImageURL(row.cover_image || '')) { Image(coverImageURL(row.cover_image || '')).width(112).height(this.courseCardHeights.get(String(row.id || row.source_id || row.name)) || 96).objectFit(ImageFit.Contain).borderRadius(12).accessibilityLevel('no') }
        else { Image($r('app.media.nav_learn_on')).width(112).height(this.courseCardHeights.get(String(row.id || row.source_id || row.name)) || 96).objectFit(ImageFit.ScaleDown).backgroundColor(SwodTheme.tonal).borderRadius(12).accessibilityLevel('no') }
      }
      Column({ space: 8 }) {
        Text(this.title(row)).fontSize(17).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
        if (this.summary(row)) { Text(this.summary(row)).fontSize(14).fontColor(SwodTheme.muted).width('100%') }
        if (this.route.screen === 'shop') {
          Text(productPrice(row)).fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary)
          Text(productStock(row)).fontSize(14).fontColor(SwodTheme.muted)
        }
        if ((this.route.screen === 'home' || this.route.path.startsWith('/member/authorized-series')) && this.isCourseUnlocked(row)) { Text('✓ 已解锁').fontSize(16).fontColor('#15803d'); Text('继续学习').fontSize(14).fontColor('#15803d') } else if (this.route.screen === 'home' && !this.courseAccessReady) { Text('学习权益暂无法确认').fontSize(12).fontColor(SwodTheme.muted) } else if (row.price !== undefined) { Text(coursePrice(row)).fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary); if (originalPrice(row)) { Text(originalPrice(row)).fontSize(12).fontColor(SwodTheme.muted).decoration({ type: TextDecorationType.LineThrough }) } }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start).onAreaChange((_old: Area, area: Area) => {
        if (this.route.screen !== 'home' && this.route.screen !== 'offline') return;
        const key = String(row.id || row.source_id || row.name);
        const height = Math.min(160, Math.max(84, Number(area.height)));
        if (Number.isFinite(height) && Math.abs((this.courseCardHeights.get(key) || 0) - height) > 1) {
          const next = new Map<string, number>(this.courseCardHeights); next.set(key, height); this.courseCardHeights = next;
        }
      })
    }.padding(12).backgroundColor(SwodTheme.surface).borderRadius(12).width('100%').constraintSize({ minHeight: 64 }).margin({ bottom: 8 }).onClick(() => this.tap(row)).accessibilityText(this.title(row) + '，' + this.summary(row) + '，查看详情')
  }
  @Builder
  private eventMetric(value: string, label: string, hero: boolean = false) {
    Column({ space: 4 }) {
      Text(value).fontSize(hero ? 18 : 12).fontWeight(FontWeight.Bold).fontColor(hero ? SwodTheme.onPrimary : SwodTheme.primary)
      Text(label).fontSize(11).fontColor(hero ? SwodTheme.onPrimary : SwodTheme.muted)
    }.layoutWeight(1).padding({ top: 8, bottom: 8 })
  }
  @Builder
  private eventTile(row: Row) {
    Column({ space: 0 }) {
      Stack({ alignContent: Alignment.TopStart }) {
        if (row.coverUrl || row.cover_url) {
          Image(coverImageURL(row.coverUrl || row.cover_url || '')).width('100%').aspectRatio(1.25).objectFit(ImageFit.Contain).backgroundColor(SwodTheme.tonal).accessibilityLevel('no')
        } else {
          Column({ space: 8 }) { Image($r('app.media.nav_trophy_on')).width(32).height(32); Text('暂无封面').fontSize(12).fontColor(SwodTheme.muted) }.width('100%').aspectRatio(1.25).justifyContent(FlexAlign.Center).backgroundColor(SwodTheme.tonal)
        }
        Text(eventState(row)).fontSize(11).fontWeight(FontWeight.Bold)
          .fontColor(eventState(row) === '报名中' ? SwodTheme.onPrimary : SwodTheme.ink)
          .backgroundColor(eventState(row) === '报名中' ? SwodTheme.primary : SwodTheme.surface)
          .padding({ left: 8, right: 8, top: 5, bottom: 5 }).borderRadius(12).margin(6)
      }.width('100%')
      Column({ space: 8 }) {
        Text(eventDates(row)).fontSize(11).fontColor(SwodTheme.muted).width('100%').constraintSize({ minHeight: 28 })
        Text(row.location || row.city || row.venue || '地点待定').fontSize(11).fontColor(SwodTheme.muted).width('100%')
        Text(row.name || '赛事').fontSize(15).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%').constraintSize({ minHeight: 48 })
        Divider().color(SwodTheme.tonal)
        Row() {
          this.eventMetric(eventCount(row.groupCount), '组别')
          this.eventMetric(eventCount(row.playerCount), '选手')
          this.eventMetric(eventCount(row.judgeCount), '评委')
        }.width('100%')
        Button(eventState(row) === '报名中' ? '点击报名 ›' : '查看详情 ›', { type: ButtonType.Normal })
          .fontSize(14).fontWeight(FontWeight.Bold).fontColor(SwodTheme.onPrimary).backgroundColor(SwodTheme.primary).borderRadius(8)
          .constraintSize({ minHeight: 44 }).width('100%').onClick(() => this.go('event', row.name || '赛事详情', '/events/' + Number(row.id), false, Number(row.id)))
      }.padding(10).width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').backgroundColor(SwodTheme.surface).borderRadius(14).clip(true)
      .onClick(() => this.go('event', row.name || '赛事详情', '/events/' + Number(row.id), false, Number(row.id)))
  }
  @Builder
  private eventsPage() {
    Row({ space: 6 }) {
      TextInput({ placeholder: '搜索赛事或地点', text: this.query }).layoutWeight(1).height(44).fontSize(14)
        .fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).backgroundColor(SwodTheme.surface).borderRadius(12).onChange((v: string) => { this.query = v; })
      Button('我的比赛', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 44, minWidth: 44 }).onClick(() => this.go('myEvents', '我的比赛', '/member/events', true))
      Button('管理', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 44, minWidth: 44 }).accessibilityText('赛事管理').onClick(() => this.go(this.staffLoggedIn ? 'staffHome' : 'staffLogin', '赛事管理', this.staffLoggedIn ? '/event/competitions' : '', false, 0, 0, true))
    }.width('100%')

    Column({ space: 14 }) {
      Text('东方舞赛事平台').fontSize(12).fontColor(SwodTheme.onPrimary).width('100%')
      Text('AiwaRaks赛事平台').fontSize(22).fontWeight(FontWeight.Bold).fontColor(SwodTheme.onPrimary).width('100%')
      Row() {
        this.eventMetric(this.busy || this.error ? '—' : String(this.rows.length), '赛事总数', true)
        this.eventMetric(this.busy || this.error ? '—' : eventAggregate(this.rows, true), '累计参赛', true)
        this.eventMetric(this.busy || this.error ? '—' : eventAggregate(this.rows, false), '记录数据', true)
      }.width('100%')
    }.padding(18).width('100%').backgroundColor(SwodTheme.primary).borderRadius(16)
    GridRow({ columns: { xs: 2, sm: 2, md: 2, lg: 2 }, gutter: 12 }) {
      ForEach(this.rows.filter((row: Row) => !this.query.trim() || ((row.name || '') + ' ' + (row.location || row.city || row.venue || '')).toLowerCase().includes(this.query.trim().toLowerCase())), (row: Row) => {
        GridCol() { this.eventTile(row) }.margin({ bottom: 12 })
      }, (row: Row) => String(row.id))
    }.width('100%')
    if (!this.busy && !this.error && this.query.trim() && this.rows.filter((row: Row) => ((row.name || '') + ' ' + (row.location || row.city || row.venue || '')).toLowerCase().includes(this.query.trim().toLowerCase())).length === 0) {
      Text('未找到匹配赛事，请更换名称或地点').fontSize(14).fontColor(SwodTheme.muted).width('100%')
    }
  }
  @Builder
  private loginForm() {
    Column({ space: 8 }) {
      Image($r('app.media.brand_logo')).width(80).height(80).padding(8).objectFit(ImageFit.Contain).backgroundColor(Color.White).borderRadius(18).accessibilityLevel('no')
      Text('伊娃东方舞').fontSize(26).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink)
      Text('舞者成长系统').fontSize(14).fontColor(SwodTheme.muted)
    }.width('100%').padding({ top: 12, bottom: 20 })
    Column({ space: 12 }) {
      Button('手机号一键登录', { type: ButtonType.Normal })
        .fontSize(17).fontWeight(FontWeight.Bold).fontColor(this.carrierReady && this.consent && !this.busy ? Color.White : SwodTheme.muted)
        .backgroundColor(this.carrierReady && this.consent && !this.busy ? SwodTheme.primary : SwodTheme.tonal)
        .borderRadius(12).constraintSize({ minHeight: 48 }).width('100%')
        .enabled(this.carrierReady && this.consent && !this.busy).onClick(() => this.loginCarrier())
      Text(this.carrierHint).fontSize(12).fontColor(SwodTheme.muted).textAlign(TextAlign.Center).width('100%')
      Text(this.memberLoginMode === 'sms' ? '或使用验证码登录' : '或使用账号密码登录').fontSize(12).fontColor(SwodTheme.muted).textAlign(TextAlign.Center).width('100%').margin({ top: 4 })
      Text('手机号').fontSize(14).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
      TextInput({ placeholder: '请输入手机号', text: this.phone }).type(InputType.PhoneNumber)
        .backgroundColor(SwodTheme.canvas).fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).constraintSize({ minHeight: 48 })
        .enabled(!this.busy).onChange((v: string) => { this.phone = v; this.code = ''; this.error = ''; this.updateSMSCooldown(); }).accessibilityText('手机号')
      if (this.memberLoginMode === 'sms') {
        Text('验证码').fontSize(14).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
        Row({ space: 10 }) {
          TextInput({ placeholder: '请输入验证码', text: this.code }).type(InputType.Number).layoutWeight(1)
            .backgroundColor(SwodTheme.canvas).fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).constraintSize({ minHeight: 48 })
            .enabled(!this.busy).onChange((v: string) => { this.code = v; }).accessibilityText('短信验证码')
          Button(this.smsSeconds > 0 ? this.smsSeconds + ' 秒后重发' : '获取验证码', { type: ButtonType.Normal })
            .fontSize(14).fontColor(SwodTheme.primary).backgroundColor(SwodTheme.tonal).borderRadius(12).width(124).constraintSize({ minHeight: 48 })
            .enabled(!this.busy && this.consent && /^1[3-9][0-9]{9}$/.test(this.phone) && this.smsSeconds === 0).onClick(() => this.sendCode())
        }.width('100%')
      } else {
        Text('账号密码').fontSize(14).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%')
        TextInput({ placeholder: '请输入账号密码', text: this.memberPassword }).type(InputType.Password)
          .backgroundColor(SwodTheme.canvas).fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).constraintSize({ minHeight: 48 })
          .enabled(!this.busy).onChange((v: string) => { this.memberPassword = v; }).accessibilityText('账号密码')
      }
      Row({ space: 4 }) {
        Checkbox().select(this.consent).selectedColor(SwodTheme.primary).onChange((v: boolean) => { this.consent = v; }).enabled(!this.busy).accessibilityText('我已阅读并同意以下协议')
        Column({ space: 0 }) {
          Text('我已阅读并同意').fontSize(12).fontColor(SwodTheme.muted).width('100%')
          Flex({ wrap: FlexWrap.Wrap }) {
            Button('《隐私政策》', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 44 }).onClick(() => this.openURL('https://www.swod.com.cn/privacy'))
            Button('《服务条款》', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 44 }).onClick(() => this.openURL('https://www.swod.com.cn/terms'))
          }.width('100%')
        }.layoutWeight(1)
      }.width('100%')
      if (this.error) { Text(this.error).fontSize(14).fontColor(SwodTheme.primary).width('100%') }
      if (this.loginNotice) { Text(this.loginNotice).fontSize(14).fontColor(SwodTheme.muted).width('100%') }
      Button(this.memberLoginMode === 'sms' ? '验证码登录' : '密码登录', { type: ButtonType.Normal })
        .fontSize(17).fontWeight(FontWeight.Bold).fontColor(this.validLoginInput() ? Color.White : SwodTheme.muted)
        .backgroundColor(this.validLoginInput() ? SwodTheme.primary : SwodTheme.tonal).borderRadius(12).constraintSize({ minHeight: 48 }).width('100%')
        .enabled(this.validLoginInput()).onClick(() => this.login())
      Text('授权失败时可使用短信验证码登录').fontSize(12).fontColor(SwodTheme.muted).textAlign(TextAlign.Center).width('100%')
      Button(this.memberLoginMode === 'sms' ? '使用账号密码登录' : '使用验证码登录', { type: ButtonType.Normal })
        .fontSize(14).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 44 }).width('100%')
        .enabled(!this.busy).onClick(() => { this.memberLoginMode = this.memberLoginMode === 'sms' ? 'password' : 'sms'; this.memberPassword = ''; this.code = ''; this.error = ''; })
    }.width('100%').constraintSize({ maxWidth: 440 }).padding(20).backgroundColor(SwodTheme.surface).borderRadius(20)
    Button('返回', { type: ButtonType.Normal }).fontSize(14).fontColor(SwodTheme.primary).backgroundColor(SwodTheme.tonal).constraintSize({ minHeight: 44 })
      .margin({ top: 10 }).onClick(() => { this.memberPassword = ''; this.code = ''; this.carrierLogin.cancel(); this.back(); })
    Text('与官网、小程序共用学习账号').fontSize(12).fontColor(SwodTheme.muted).textAlign(TextAlign.Center).width('100%')
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
    this.intro('东方舞圈', '登录后同步课程、学习进度与个人资料')
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
    if (['home', 'offline', 'shop'].includes(this.route.screen)) {
      TextInput({ placeholder: this.route.screen === 'home' ? '搜索课程、老师或分类' : this.route.screen === 'shop' ? '搜索商品' : '搜索课程或期次', text: this.query })
        .height(44).fontSize(14).fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).backgroundColor(SwodTheme.surface).borderRadius(12).onChange((v: string) => { this.query = v; })
    }
    if (this.route.screen === 'home') {
      this.intro('伊娃东方舞', '线上学院 · 从基础到进阶，找到适合你的课程')
      Row({ space: 10 }) {
        this.shortcut('我的课程', $r('app.media.nav_learn_on'), () => this.go('records', '我的课程', '/member/authorized-series', true))
        this.shortcut('课时与核销', $r('app.media.nav_calendar_on'), () => this.go('schedule', '期次课时', '/offline/overview', true))
        this.shortcut('报名与成绩', $r('app.media.nav_trophy_on'), () => this.go('myEvents', '我的比赛', '/member/events', true))
      }.width('100%').margin({ bottom: 12 })
      Text('课程列表').fontSize(20).fontWeight(FontWeight.Bold).fontColor(SwodTheme.ink).width('100%').margin({ top: 8, bottom: 8 })
    }
    if (this.route.screen === 'assistant') { Text('30分钟：热身6 · 技巧18 · 复习6').fontSize(18); this.action('继续上次课程', () => this.go('records', '最近学习', '/member/recent-courses', true)) }
    if (this.route.screen === 'offline') { this.intro('线下课', '购买课程期次的课时，到课后核销扣减，无需预约。'); this.action('期次课时与核销', () => this.go('schedule', '期次课时', '/offline/overview', true)) }
    if (this.route.screen === 'events') { this.eventsPage() }
    if (this.route.screen === 'shop') { this.intro('伊娃甄选', '东方舞生活 · 官方商城') }
    if (this.route.screen === 'login') { this.loginForm() }
    if (this.route.screen === 'staffLogin') { this.staffForm() }
    if (this.route.screen === 'staffEditor') { this.staffEditor() }
    if (this.route.screen === 'staffPayment') { this.paymentForm() }
    if (this.route.screen === 'staffHome') { this.action('退出赛事管理', () => { platform.staff = undefined; this.staffLoggedIn = false; this.go('staffLogin', '工作人员登录'); }) }
    if (this.route.screen === 'account') {
      this.intro(this.loggedIn ? '我的学习空间' : '欢迎来到伊娃东方舞', '课程、比赛、证书与订单')
      if (!this.loggedIn) { this.action('手机号登录', () => this.go('login', '手机号登录')) }
      else {
        Text(this.detail.name || '我的学习空间').fontSize(18)
        this.action('我的课程', () => this.go('records', '我的课程', '/member/authorized-series', true))
        this.action('课时余额与核销记录', () => this.go('schedule', '期次课时', '/offline/overview', true))
        this.action('我的比赛', () => this.go('myEvents', '我的比赛', '/member/events', true))
        this.action('我的订单', () => this.go('shopOrders', '我的订单', '/shop/orders', true))
        this.action('学习消息', () => this.go('messages', '学习消息', '/member/messages?limit=20&cursor=0', true))
        this.action('我的证书', () => this.go('certificates', '我的证书', '/certificates', true))
        this.action('学习笔记', () => this.go('records', '学习笔记', '/notes/all', true))
        this.action('学习书签', () => this.go('records', '学习书签', '/bookmarks/all', true))
        this.action('登录设备', () => this.go('records', '登录设备', '/devices', true))
        this.action('退出登录', () => this.confirm('退出当前账号？', () => { platform.logout().catch(() => {}); this.loggedIn = false; this.tab('account', '个人中心', ''); }))
      }
      this.action('工作人员 · 赛事管理', () => this.go(this.staffLoggedIn ? 'staffHome' : 'staffLogin', '赛事管理', this.staffLoggedIn ? '/event/competitions' : '', false, 0, 0, true))
      this.action('客服与售后', () => this.go('support', '客服与售后'))
      this.action('隐私政策', () => this.openURL('https://www.swod.com.cn/privacy'))
      this.action('服务条款', () => this.openURL('https://www.swod.com.cn/terms'))
      Button({ type: ButtonType.Normal }) {
        Text($r('app.string.app_filing_number')).fontSize(12).fontColor(SwodTheme.muted)
      }.backgroundColor(SwodTheme.surface).constraintSize({ minHeight: 48 }).width('100%')
        .onClick(() => this.openURL('https://beian.miit.gov.cn/'))
        .accessibilityText('App备案号，湘ICP备2026005683号-5A，打开工信部备案查询')
      Text('SWOD 1.0.0').fontSize(12)
    }
    if (this.route.screen === 'support') {
      this.intro('课程与订单客服', '购买、学习权限及售后问题可直接联系课程顾问')
      Text('海艳老师：153 6787 0529').fontSize(16)
      Text('伊琳老师：193 1002 9982').fontSize(16)
      this.action('查看微信客服二维码', () => this.openURL('https://www.swod.com.cn/contact'))
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
        this.intro('东方舞圈', '登录后同步课程、学习进度与个人资料')
    TextInput({ placeholder: '手机号', text: this.phone }).type(InputType.PhoneNumber).onChange((v: string) => { this.phone = v; })
        TextInput({ placeholder: '机构（选填）', text: this.organization }).onChange((v: string) => { this.organization = v; })
        TextInput({ placeholder: '节目名称', text: this.performanceTitle }).onChange((v: string) => { this.performanceTitle = v; })
        this.action(this.musicName ? '更换音乐：' + this.musicName : '选择参赛音乐（10MB以内）', () => { this.chooseMusic(); })
        this.action('提交报名与音乐', () => this.confirm('确认提交报名、节目名称与音乐？', () => { this.register(); }))
      }
    }
    if (this.route.screen === 'catalog') {
      if (this.unlockedSeries.includes(this.currentSeriesID()) && platform.credentials) {
        Text('✓ 已解锁').fontSize(16).fontColor('#15803d')
      } else if (!this.courseAccessReady) {
        Text('暂无法确认学习权益，请重试').fontSize(14).fontColor(SwodTheme.muted)
        this.action('重试查询学习权益', () => this.load())
      } else {
        this.action('立即购买 · 前往官方支付', () => this.openCourseCheckout(this.currentSeriesID()))
      }
      this.action('客服与售后', () => this.go('support', '客服与售后'))
      Row() { Text('课节目录 · 共 ' + catalogLessons(this.rows, this.progressRows).length + ' 节').fontSize(18).fontWeight(FontWeight.Bold).layoutWeight(1); if (catalogLessons(this.rows, this.progressRows).some((lesson: Row) => String(lesson.id) === this.currentLessonID)) { Button('定位当前').constraintSize({ minHeight: 48 }).onClick(() => { this.query = ''; const index = catalogLessons(this.rows, this.progressRows).findIndex((lesson: Row) => String(lesson.id) === this.currentLessonID); this.catalogPage = index >= 0 ? Math.floor(index / 50) + 1 : 1; this.catalogScroller.scrollEdge(Edge.Top); }) } }
      TextInput({ placeholder: '搜索课节名称', text: this.query }).height(44).fontSize(14).backgroundColor(SwodTheme.surface).borderRadius(12).onChange((value: string) => { this.query = value; this.catalogPage = 1; })
      if (this.catalogPages() > 1) {
        Row({ space: 12 }) { Button('上一页').constraintSize({ minHeight: 48 }).enabled(this.catalogPage > 1).onClick(() => { this.catalogPage--; this.catalogScroller.scrollEdge(Edge.Top); }); Text('第 ' + this.catalogPage + ' / ' + this.catalogPages() + ' 页').layoutWeight(1).textAlign(TextAlign.Center); Button('下一页').constraintSize({ minHeight: 48 }).enabled(this.catalogPage < this.catalogPages()).onClick(() => { this.catalogPage++; this.catalogScroller.scrollEdge(Edge.Top); }) }.width('100%')
      }
      ForEach(this.filteredLessons().slice((this.catalogPage - 1) * 50, this.catalogPage * 50), (lesson: Row) => {
        Row({ space: 12 }) {
          Text(String(lesson.ordinal)).fontSize(14).width(32).height(32).textAlign(TextAlign.Center).backgroundColor(SwodTheme.tonal).borderRadius(8)
          Column({ space: 8 }) { Text(lesson.name || '').fontSize(16).fontWeight(FontWeight.Medium).width('100%'); Text((lesson.mediaKind === 'audio' ? '音频 · ' : '视频 · ') + this.lessonDuration(lesson) + (String(lesson.id) === this.currentLessonID ? ' · 当前课节' : '')).fontSize(12).fontColor(SwodTheme.muted) }.layoutWeight(1).alignItems(HorizontalAlign.Start)
          Text(lesson.percent === undefined ? '进度待同步' : lesson.percent >= 100 ? '已学完' : lesson.percent > 0 ? '已学 ' + lesson.percent + '%' : '未开始').fontSize(12).fontColor(SwodTheme.muted)
        }.width('100%').padding(16).constraintSize({ minHeight: 72 }).borderRadius(12).backgroundColor(String(lesson.id) === this.currentLessonID ? SwodTheme.tonal : SwodTheme.surface).onClick(() => this.startVideo(lesson)).accessibilityText((lesson.mediaKind === 'audio' ? '音频 · ' : '视频 · ') + '第 ' + lesson.ordinal + ' 节，' + lesson.name + '，选择播放')
      }, (lesson: Row) => String(lesson.id))
      if (this.filteredLessons().length === 0 && !this.busy && !this.error) {
        Text('未找到匹配课节').fontSize(14).fontColor(SwodTheme.muted)
        if (this.query.trim()) { this.action('清空搜索', () => { this.query = ''; this.catalogPage = 1; }) }
      }
    }
    if (this.route.screen === 'video' && this.playURL) {
      if (this.selected.mediaKind === 'audio') {
        Column({ space: 12 }) {
          Image($r('app.media.brand_logo')).width(96).height(96).objectFit(ImageFit.Contain)
          Text('音频课').fontSize(20).fontWeight(FontWeight.Bold)
          Text('本课为音频讲解，请点击播放收听。').fontSize(15)
        }.width('100%').padding(24).backgroundColor(SwodTheme.tonal).borderRadius(16)
      }
      Video({ src: this.playURL, controller: this.controller, currentProgressRate: this.holdingSpeed ? 2 : this.selectedPlaybackRate }).width('100%').height(this.selected.mediaKind === 'audio' ? 72 : 230).objectFit(ImageFit.Contain).controls(true).loop(this.loop).scale({ x: this.mirror ? -1 : 1 })
        .onPrepared((event?: VideoDuration) => { this.duration = event?.duration || 0; const position = this.qualityResume >= 0 ? this.qualityResume : this.playbackPosition; this.controller.setCurrentTime(Math.max(0, Math.min(position, this.duration))); this.playbackPosition = position; this.qualityResume = -1; this.qualityChanging = false; })
        .onUpdate((event?: VideoTime) => { if (this.qualityChanging) return; this.playbackPosition = event?.time || 0; if (Date.now() - this.lastCheckpoint > 15000) { this.lastCheckpoint = Date.now(); this.saveProgress(); this.verifyVideoAccess(); } })
        .onStart(() => { this.videoPlaying = true; })
        .onPause(() => { this.endHoldSpeed(); this.videoPlaying = false; })
        .onFinish(() => { this.endHoldSpeed(); this.videoPlaying = false; this.saveProgress(); })
        .onTouch((event: TouchEvent) => { this.onVideoTouch(event); })
        .onError(() => { this.qualityChanging = false; this.endHoldSpeed(); this.videoPlaying = false; this.error = '媒体暂时无法播放，请返回后重试'; })
      if (this.videoQualities.length > 1) {
        Select(this.videoQualities.map((quality: MediaQuality): SelectOption => ({ value: quality.label }))).selected(this.videoQuality).value(this.videoQualities[this.videoQuality]?.label || '自动').onSelect((index: number) => {
          if (index < 0 || index >= this.videoQualities.length || index === this.videoQuality) return;
          this.endHoldSpeed(); this.videoPlaying = false; this.controller.pause(); this.qualityResume = this.playbackPosition; this.qualityChanging = true; this.videoQuality = index; this.playURL = this.videoQualities[index].url;
        }).enabled(this.duration > 0 && !this.qualityChanging).accessibilityText('视频清晰度')
      }
      if (this.holdingSpeed) { Text('2 倍播放 · 松手恢复').fontSize(14) }
      if (this.videoPlaylist.length > 0) {
        Row({ space: 8 }) {
          Button('上一节').constraintSize({ minHeight: 48 }).layoutWeight(1).enabled(this.videoPlaylist.findIndex((row: Row) => String(row.id) === this.currentLessonID) > 0).onClick(() => { const at = this.videoPlaylist.findIndex((row: Row) => String(row.id) === this.currentLessonID); if (at > 0) this.startVideo(this.videoPlaylist[at - 1]); })
          Button('目录').constraintSize({ minHeight: 48 }).layoutWeight(1).onClick(() => { this.videoCatalogOpen = !this.videoCatalogOpen; })
          Button('下一节').constraintSize({ minHeight: 48 }).layoutWeight(1).enabled(this.videoPlaylist.findIndex((row: Row) => String(row.id) === this.currentLessonID) >= 0 && this.videoPlaylist.findIndex((row: Row) => String(row.id) === this.currentLessonID) + 1 < this.videoPlaylist.length).onClick(() => { const at = this.videoPlaylist.findIndex((row: Row) => String(row.id) === this.currentLessonID); if (at >= 0 && at + 1 < this.videoPlaylist.length) this.startVideo(this.videoPlaylist[at + 1]); })
        }.width('100%')
        if (this.videoCatalogOpen) {
          Text('课节目录 · 共 ' + this.videoPlaylist.length + ' 节').fontSize(18).fontWeight(FontWeight.Bold)
          TextInput({ placeholder: '搜索课节', text: this.videoQuery }).onChange((value: string) => { this.videoQuery = value; this.videoLimit = 50; })
          ForEach(this.videoPlaylist.filter((row: Row) => (row.name || '').toLowerCase().includes(this.videoQuery.toLowerCase())).slice(0, this.videoLimit), (row: Row) => {
            this.action((String(row.id) === this.currentLessonID ? '当前课节 · ' : '') + (row.name || ''), () => { if (String(row.id) !== this.currentLessonID) this.startVideo(row); })
          }, (row: Row) => String(row.id))
          if (this.videoPlaylist.filter((row: Row) => (row.name || '').toLowerCase().includes(this.videoQuery.toLowerCase())).length > this.videoLimit) { this.action('显示更多课节', () => { this.videoLimit += 50; }) }
        }
      }
      Row({ space: 8 }) {
        ForEach([0.75, 1, 1.25, 1.5], (rate: number) => {
          Button(rate + ' 倍').onClick(() => { this.endHoldSpeed(); this.selectedPlaybackRate = rate; }).backgroundColor(this.selectedPlaybackRate === rate ? SwodTheme.tonal : SwodTheme.surface).fontColor(SwodTheme.ink)
        }, (rate: number) => String(rate))
      }
      Row() { Checkbox().select(this.mirror).onChange((v: boolean) => { this.mirror = v; }); Text('镜像'); Checkbox().select(this.loop).onChange((v: boolean) => { this.loop = v; }); Text('循环') }
      TextInput({ placeholder: '本节学习笔记', text: this.remark }).onChange((v: string) => { this.remark = v; })
      this.action('保存笔记', () => { this.write('/notes', { video_id: Number(this.selected.id || this.selected.video_id), timestamp_seconds: this.playbackPosition, content: this.remark }); })
    }
    if (this.route.screen === 'offlineDetail') {
      if (coverImageURL(this.detail.cover_image || '')) { Image(coverImageURL(this.detail.cover_image || '')).width('100%').aspectRatio(4 / 3).objectFit(ImageFit.Contain).borderRadius(12).accessibilityText((this.detail.name || '') + '课程封面') }
      Text('课程介绍').fontSize(18).fontWeight(FontWeight.Bold)
      Text(offlineDescription(this.detail)).fontSize(16).lineHeight(26)
      ForEach(offlineCopy(this.detail)?.outline || this.detail.outline || [], (text: string, index: number) => { Text((index + 1) + '. ' + text).fontSize(14).lineHeight(24) }, (text: string) => text)
      Text('课程期次').fontSize(18).fontWeight(FontWeight.Bold)
      ForEach(this.offlineRows.filter((period: Row) => (period.group_key || period.name) === (this.detail.group_key || this.detail.name)), (period: Row) => {
        Column({ space: 12 }) {
          Text(period.subtitle || period.start_date || '期次安排').fontSize(17).fontWeight(FontWeight.Bold)
          Text([period.start_date || '', period.end_date || '', period.location || ''].filter((value: string) => !!value).join(' · ')).fontSize(14)
          Text(coursePrice(period) + ' · ' + period.total_courses + ' 课时').fontSize(16).fontColor(SwodTheme.primary)
          Text('已报名 ' + (period.total_students || 0) + ' 人（匿名）').fontSize(12).fontColor(SwodTheme.muted)
          if (canPurchasePeriod(period)) { this.action('购买本期课时', () => { this.selected = period; this.courseOrderID = ''; this.courseRequestKey = util.generateRandomUUID(); this.go('courseCheckout', '确认课程订单', '/shop/courses/offline/' + period.source_id, true); }) } else { Text('本期暂不可购买，请查看期次安排或咨询课程顾问').fontSize(12) }
          this.action('查看本期课时', () => this.go('schedule', '期次课时', '/offline/overview?course_ids=' + period.source_id, true))
        }.padding(16).width('100%').backgroundColor(SwodTheme.surface).borderRadius(16)
      }, (period: Row) => String(period.id))
    }
    if (this.route.screen === 'courseCheckout' && this.detail.offer) {
      Text(this.detail.offer?.name || '').fontSize(20).fontWeight(FontWeight.Bold)
      Text('期次安排：' + (this.detail.offer?.period || '')).fontSize(16)
      Text('购买课时：' + (this.detail.offer?.sessions || 0) + ' 课时').fontSize(16)
      Text('¥' + (Number(this.detail.offer?.priceFen || 0) / 100).toFixed(2)).fontSize(22).fontColor(SwodTheme.primary)
      Text('付款后开通所选期次课时，到课后核销扣减，无需预约。').fontSize(14)
      if (this.detail.payment?.alipay) { this.action('支付宝支付', () => { this.submitCourse('alipay'); }) }
      if (this.detail.payment?.wechat) { this.action('微信支付', () => { this.submitCourse('wechat'); }) }
      if (!this.detail.payment?.alipay && !this.detail.payment?.wechat) { Text('支付服务暂不可用，请刷新后重试。').fontSize(14) }
      this.action('我的订单', () => this.go('shopOrders', '我的订单', '/shop/orders', true))
      if (this.courseOrderID) { this.action('同步付款结果并查看课时', () => { this.refreshCourse(); }) }
    }
    if (this.route.screen === 'shop' || this.route.screen === 'product' || this.route.screen === 'goodsCheckout' || this.route.screen === 'shopOrders') {
      this.action('我的订单', () => this.go('shopOrders', '我的订单', '/shop/orders', true))
    }
    if (this.route.screen === 'product') {
      if (this.detail.image) { Image(this.detail.image).width('100%').height(260).objectFit(ImageFit.Contain).borderRadius(12) }
      Text(this.detail.detailText || this.detail.description || '').fontSize(14).lineHeight(23)
      Text([this.detail.color, this.detail.size, this.detail.spec].filter((value: string) => !!value).join(' · ')).fontSize(16)
      Text(productPrice(this.detail) + ' · ' + productStock(this.detail)).fontSize(18)
      if (Number(this.detail.stock) > 0) { this.action('立即购买', () => this.beginGoodsCheckout()) }
    }
    if (this.route.screen === 'goodsCheckout' && this.detail.id) {
      Text(this.title(this.detail)).fontSize(20).fontWeight(FontWeight.Bold)
      Text([this.detail.color, this.detail.size, this.detail.spec].filter((value: string) => !!value).join(' · ')).fontSize(15)
      Text(productPrice(this.detail) + ' · ' + productStock(this.detail)).fontSize(16)
      Text('购买数量').fontSize(15)
      TextInput({ text: this.quantity, placeholder: '1至99件，不超过可售库存' }).type(InputType.Number).onChange((value: string) => { this.quantity = value; }).accessibilityText('购买数量')
      Text('收件人').fontSize(15)
      TextInput({ text: this.recipient, placeholder: '填写收件人姓名' }).maxLength(40).onChange((value: string) => { this.recipient = value; }).accessibilityText('收件人')
      Text('联系电话').fontSize(15)
      TextInput({ text: this.shippingPhone, placeholder: '填写收件联系电话' }).type(InputType.PhoneNumber).maxLength(25).onChange((value: string) => { this.shippingPhone = value; }).accessibilityText('收件联系电话')
      Text('收货地址 · 快递包邮').fontSize(15)
      TextArea({ text: this.shippingAddress, placeholder: '省、市、区、街道及门牌号' }).maxLength(300).height(100).onChange((value: string) => { this.shippingAddress = value; }).accessibilityText('完整收货地址')
      Text('合计：¥' + (Number(this.detail.priceFen || 0) * (Number(this.quantity) || 0) / 100).toFixed(2)).fontSize(22).fontColor(SwodTheme.primary)
      if (this.shopPayment.alipay) { this.action('提交订单并支付宝支付', () => this.submitGoods('alipay')) }
      if (this.shopPayment.wechat) { this.action('提交订单并微信支付', () => this.submitGoods('wechat')) }
      if (!this.shopPayment.alipay && !this.shopPayment.wechat) { Text('支付服务暂不可用，请刷新后重试。').fontSize(14) }
    }
    if (this.route.screen === 'shopOrders') {
      ForEach(this.rows, (order: Row) => {
        Column({ space: 8 }) {
          Text('订单 ' + order.id).fontSize(14)
          Text(orderStatus(order.status || '') + ' · ¥' + (Number(order.totalFen || 0) / 100).toFixed(2)).fontSize(17).fontWeight(FontWeight.Bold)
          this.action('查看订单', () => this.go('shopOrder', '订单详情', '/shop/orders/' + order.id, true))
        }.padding(16).width('100%').backgroundColor(SwodTheme.surface).borderRadius(12)
      }, (order: Row) => String(order.id))
      if (!this.busy && !this.error && this.rows.length === 0) { Text('暂无订单').fontSize(16) }
    }
    if (this.route.screen === 'shopOrder' && this.detail.order) {
      Text('订单 ' + this.detail.order.id).fontSize(14)
      Text(orderStatus(this.detail.order.status || '')).fontSize(20).fontWeight(FontWeight.Bold)
      Text('订单金额：¥' + (Number(this.detail.order.totalFen || 0) / 100).toFixed(2)).fontSize(20)
      ForEach(this.detail.order.items || [], (item: Row) => { Text((item.name || '') + ' · ' + (item.spec || '') + ' × ' + item.quantity).fontSize(15) }, (item: Row) => String(item.productId || item.name))
      if (this.detail.order.recipient) { Text(this.detail.order.recipient + ' · ' + (this.detail.order.phone || '')).fontSize(15); Text(this.detail.order.address || '自提订单').fontSize(15) }
      if (this.detail.order.trackingNo) { Text((this.detail.order.carrier || '') + ' · ' + this.detail.order.trackingNo).fontSize(15) }
      if (this.detail.order.status === 'pending') {
        this.action('继续付款', () => this.orderAction('pay'))
        this.action('取消订单', () => this.confirm('确认取消未支付订单？', () => this.orderAction('cancel')))
      }
      this.action('同步付款与订单状态', () => this.orderAction('refresh'))
      if (this.detail.order.status === 'shipped') { this.action('确认收货', () => this.confirm('确认已经收到商品？', () => this.orderAction('received'))) }
      if (['paid', 'shipped', 'completed'].includes(this.detail.order.status || '')) {
        Text('退款原因').fontSize(15)
        TextArea({ text: this.refundReason, placeholder: '请说明退款原因，最多300字' }).maxLength(300).height(100).onChange((value: string) => { this.refundReason = value; }).accessibilityText('退款原因')
        this.action('申请退款', () => this.confirm('确认申请退款？', () => this.orderAction('refund'))) }
      this.action('返回我的订单', () => this.go('shopOrders', '我的订单', '/shop/orders', true))
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
      this.action('开放报名', () => this.confirm('开放当前赛事报名？', () => { this.write('/event/competitions/' + this.route.eventID, { action: 'openRegistration' }, 'PATCH', true); }))
      this.action('关闭报名', () => this.confirm('关闭当前赛事报名？', () => { this.write('/event/competitions/' + this.route.eventID, { action: 'closeRegistration' }, 'PATCH', true); }))
    }
    if (this.route.screen === 'staffGroup') {
      Text(this.detail.name || '').fontSize(18)
      this.action('报名、音乐与出场顺序', () => this.staffEntries())
      this.action('随机安排本组出场顺序', () => this.confirm('重新随机编排本组有效报名？编号保持独立。', () => { this.write('/event/players/batch', { action: 'randomize_sequence', competitionId: this.route.eventID, groupId: this.route.groupID }, 'PATCH', true); }))
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
    if (this.route.screen === 'myEvents') {
      ForEach(this.detail.entries || [], (row: Row) => {
        Column({ space: 10 }) {
          Text(row.competitionName || '赛事').fontSize(18).fontWeight(FontWeight.Bold)
          Text((row.groupName || '未分组') + (row.playerNo ? ' · 选手号 ' + row.playerNo : '')).fontSize(15)
          if (row.entrantName) { Text('参赛人：' + row.entrantName).fontSize(14) }
          if (row.performanceTitle) { Text('节目：' + row.performanceTitle).fontSize(14) }
          Text(this.eventAudit(row.auditStatus || '') + ' · ' + this.eventPaid(row.paidStatus || '') + ' · ' + (row.startDate || '')).fontSize(14).fontColor(SwodTheme.muted)
          Text(this.eventResult(row)).fontSize(16).fontWeight(FontWeight.Bold).fontColor(SwodTheme.primary)
          if (Number(row.competitionId) > 0) { this.action('赛事详情', () => this.go('event', row.competitionName || '赛事详情', '/events/' + Number(row.competitionId), false, Number(row.competitionId))) }
        }.width('100%').alignItems(HorizontalAlign.Start).padding(20).backgroundColor(SwodTheme.surface).borderRadius(16)
      }, (row: Row) => String(row.playerId || row.id))
      if (!this.busy && !this.error && (this.detail.entries || []).length === 0) { Text('暂无比赛报名和结果记录').fontSize(15).fontColor(SwodTheme.muted) }
    }
    if (this.route.screen === 'message') { Text(this.detail.content || '').fontSize(16) }
    if (this.route.screen !== 'catalog' && this.route.screen !== 'shopOrders' && this.route.screen !== 'events' && this.rows.length > 0) {
      if (!['home', 'offline', 'shop'].includes(this.route.screen)) {
      TextInput({ placeholder: this.route.screen === 'home' ? '搜索课程、老师或分类' : '搜索名称、老师、组别或音乐', text: this.query }).height(44).fontSize(14).fontColor(SwodTheme.ink).placeholderColor(SwodTheme.muted).backgroundColor(SwodTheme.surface).borderRadius(12).onChange((v: string) => { this.query = v; })
      }
      ForEach(this.filtered(), (row: Row) => { this.card(row) }, (row: Row) => String(row.id || row.video_id || row.series_id))
      if (!this.busy && !this.error && this.query.trim() && this.filtered().length === 0) {
        Text('未找到匹配结果，请更换关键词').fontSize(14).fontColor(SwodTheme.muted)
        this.action('清空搜索', () => { this.query = ''; })
      }
    }
    if (this.route.screen === 'messages' && this.detail.hasMore) { this.action('下一页', () => this.go('messages', '学习消息', '/member/messages?limit=20&cursor=' + this.detail.nextCursor, true)) }
    if (this.busy) { Row({ space: 12 }) { LoadingProgress().width(24).height(24).color(SwodTheme.primary); Text('正在加载…').fontSize(14).fontColor(SwodTheme.muted) }.padding(20).width('100%').justifyContent(FlexAlign.Center) }
    if (this.error && this.route.screen !== 'login') { Text(this.error).fontSize(14).fontColor(SwodTheme.primary); this.action('重新加载', () => { this.load(); }); if (!this.loggedIn && this.route.auth && !this.route.staff) { this.action('手机号登录', () => this.go('login', '手机号登录')) } }
    if (!this.busy && !this.error && this.rows.length === 0 && ['home', 'offline', 'events', 'records', 'certificates'].includes(this.route.screen)) { Text('暂无可展示的记录，请稍后刷新').fontSize(14).fontColor(SwodTheme.muted).padding(24) }
  }
  build() {
    Column({ space: 0 }) {
      if (this.history.length > 0) {
      Row({ space: 8 }) {
        if (this.history.length > 0) { Button({ type: ButtonType.Normal }) { Image($r('app.media.nav_back_on')).width(24).height(24) }.width(48).height(48).backgroundColor(Color.Transparent).onClick(() => this.back()).accessibilityText('返回上一页') }
        Blank().layoutWeight(1)
        if (this.route.screen === 'events') {
          Button('我的比赛', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 48, minWidth: 48 }).onClick(() => this.go('myEvents', '我的比赛', '/member/events', true))
          Button('赛事管理', { type: ButtonType.Normal }).fontSize(12).fontColor(SwodTheme.primary).backgroundColor(Color.Transparent).constraintSize({ minHeight: 48, minWidth: 48 }).onClick(() => this.go(this.staffLoggedIn ? 'staffHome' : 'staffLogin', '赛事管理', this.staffLoggedIn ? '/event/competitions' : '', false, 0, 0, true))
        }
        Button('刷新', { type: ButtonType.Normal }).constraintSize({ minWidth: 48, minHeight: 48 }).backgroundColor(Color.Transparent).fontColor(SwodTheme.primary).enabled(!(this.route.screen === 'login' && this.busy)).onClick(() => { if (this.route.screen === 'web') this.reloadWeb(); else this.load(); })
      }.padding({ left: 12, right: 12, top: 0, bottom: 0 }).width('100%').backgroundColor(SwodTheme.surface)
      }
      if (this.route.screen === 'web') {
        Column({ space: 0 }) {
          if (this.webLoading) { Row({ space: 8 }) { LoadingProgress().width(20).height(20).color(SwodTheme.primary); Text('正在加载网页…').fontSize(14).fontColor(SwodTheme.muted) }.padding(8).justifyContent(FlexAlign.Center).width('100%') }
          if (this.webError) {
            Column({ space: 8 }) { Text(this.webError).fontSize(14).fontColor(SwodTheme.primary); this.action('重新加载网页', () => this.reloadWeb()) }.padding(16).width('100%')
          }
          Web({ src: this.webURL, controller: this.webController }).width('100%').layoutWeight(1)
            .javaScriptAccess(true).domStorageAccess(true).fileAccess(false).geolocationAccess(false).mixedMode(MixedMode.None)
            .onPageBegin(() => { this.webLoading = true; this.webError = ''; })
            .onPageEnd(() => this.finishWebLoad())
            .onLoadIntercept((event: OnLoadInterceptEvent) => {
              if (!event.data.isMainFrame()) return false;
              const url = event.data.getRequestUrl();
              if (this.webURL.includes('/checkout/online/') && /^https:\/\/(openapi\.alipay\.com|mapi\.alipay\.com|wx\.tenpay\.com)\//.test(url)) {
                const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
                context.openLink(url).catch(() => { this.webError = '暂时无法打开支付收银台，请返回订单页重试'; });
                return true;
              }
              const blocked = url !== 'about:blank' && !externalURLAllowed(url);
              if (blocked) { this.webError = '该链接暂不支持在应用中打开'; this.webLoading = false; }
              return blocked;
            })
            .onErrorReceive((event: OnErrorReceiveEvent) => { if (event.request.isMainFrame()) { this.webLoading = false; this.webError = '网页暂时无法加载，请检查网络后重试'; } })
            .onHttpErrorReceive((event: OnHttpErrorReceiveEvent) => { if (event.request.isMainFrame()) { this.webLoading = false; this.webError = '网页暂时不可用，请稍后重试'; } })
        }.layoutWeight(1).width('100%')
      } else {
        Scroll(this.catalogScroller) { Column({ space: 8 }) { this.content() }.alignItems(this.route.screen === 'login' ? HorizontalAlign.Center : HorizontalAlign.Start).padding({ left: 16, right: 16, top: 4, bottom: 16 }).width('100%').constraintSize({ maxWidth: 760 }) }.layoutWeight(1).width('100%')
      }
      Row({ space: 4 }) {
        this.navItem('线上学院', 'home', this.activeTab === 'home' ? $r('app.media.nav_learn_on') : $r('app.media.nav_learn'), '线上学院', '/public/series')
        this.navItem('线下课', 'offline', this.activeTab === 'offline' ? $r('app.media.nav_calendar_on') : $r('app.media.nav_calendar'), '线下课程', '/public/offline-courses')
        this.navItem('赛事', 'events', this.activeTab === 'events' ? $r('app.media.nav_trophy_on') : $r('app.media.nav_trophy'), '东方舞赛事', '/events')
        this.navItem('商城', 'shop', this.activeTab === 'shop' ? $r('app.media.nav_bag_on') : $r('app.media.nav_bag'), '商城', '/shop/products')
        this.navItem('个人中心', 'account', this.activeTab === 'account' ? $r('app.media.nav_person_on') : $r('app.media.nav_person'), '个人中心', platform.credentials ? '/member/profile' : '', true)
      }.padding(6).width('100%').backgroundColor(SwodTheme.surface)
    }.backgroundColor(SwodTheme.canvas).width('100%').height('100%')
  }
}
