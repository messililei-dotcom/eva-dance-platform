const config = require('./runtime-config');
const HOME = '/pages/home/home';
const titles = { mall:'伊娃甄选 · 官方商城', messages:'伊娃东方舞 · 通知', home:'伊娃东方舞线上学院', system:'伊娃东方舞 · 全部课程', offline:'伊娃东方舞 · 线下课程', events:'伊娃东方舞赛事', profile:'伊娃东方舞 · 个人中心', 'commerce-orders':'伊娃东方舞 · 课程订单', login:'伊娃东方舞 · 学员登录', admin:'伊娃东方舞', 'profile-edit':'伊娃东方舞 · 学员中心' };
const descriptions = { home:'系统课程与东方舞学习，查看课程介绍和目录', system:'从基础训练到成品舞，找到适合自己的课程', offline:'查看导师、课程安排和期次，了解线下培训', events:'查看赛事介绍、赛程与报名安排', mall:'精选舞服、练习装备与配饰，查看商品详情', profile:'查看个人课程、学习记录与服务', messages:'登录后查看自己的课程与服务通知', login:'登录后同步课程与个人服务', 'commerce-orders':'登录后查看自己的课程订单', 'profile-edit':'登录后管理自己的个人资料', admin:'东方舞课程、赛事与精选好物' };
function text(value) { return String(value || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim(); }
function cover(item = {}) {
  const value = String(item.cover_image || item.coverImage || item.coverUrl || item.cover_url || item.image || '').trim();
  if (/^https:\/\/[^/\s]+\//i.test(value) || /^\/images\//.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) {
    const origin = /^\/api\/shop\/images\//.test(value) ? config.officialWebsiteUrl : config.apiBase.replace(/\/api\/mini\/?$/,'');
    return origin + value;
  }
  return '/images/logo-20261005.png';
}
function link(route, params) {
  const query = Object.keys(params || {}).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return route + (query ? '?' + query : '');
}
function card(title, route, params, item = {}, detail = '') {
  const heading=text(title) || '伊娃东方舞', intro=text(detail) || '了解东方舞课程与服务';
  return {title:heading.slice(0,48)+' · '+intro.slice(0,36),path:link(route,params),imageUrl:cover(item)};
}
function intro(item = {}, fallback) { return text(item.descriptionText || item.description || item.summary || item.subtitle || item.introduction) || fallback; }
function resolveShare(page, route) {
  const d=page.data || {},o=page.shareOptions || {};
  if (route==='event-judge') return resolveShare({data:{id:d.id,competition:d.competition}},'event-detail');
  if (route==='course-checkout' && d.kind==='event') return resolveShare({data:{}},'events');
  if (route==='course-checkout') return resolveShare({data:d.kind==='offline'?{courseId:Number(d.id)+900000,course:d.offer}:{id:d.id,series:d.offer}},d.kind==='offline'?'offline-detail':'detail');
  if (route==='shop-product') {
    const p=d.product || {},id=d.id || o.id;
    if (!id || d.error) return resolveShare({data:{}},'mall');
    return card(p.name || '伊娃甄选商品','/pages/shop-product/shop-product',{id},p,intro(p,p.specText || [p.category,p.spec,p.size,p.color].filter(Boolean).join(' · ') || '查看商品详情与规格，快递包邮'));
  }
  if (['shop-checkout','shop-orders'].includes(route)) return resolveShare({data:{}},'mall');
  if (route==='player' || route==='detail') {
    const p=(route==='player'?d.course:d.series) || {},id=route==='player'?(d.seriesId || o.seriesId):(d.id || o.id);
    if (!id || d.loadError || d.playbackError==='课程已隐藏或下架') return resolveShare({data:{}},'home');
    return card(p.name || '东方舞课程','/pages/detail/detail',{id},p,intro(p,p.teacher ? `${p.teacher} · 查看课程介绍和目录` : '查看课程介绍和完整目录'));
  }
  if (route==='offline-detail' && !(d.courseId || o.id)) return resolveShare({data:{}},'offline');
  if (['event-detail','event-group','event-register','event-player'].includes(route) && !(d.id || d.competitionId || o.id)) return resolveShare({data:{}},'events');
  if (route==='offline-detail') return card(d.course?.name || '线下课程','/pages/offline-detail/offline-detail',{id:d.courseId || o.id},d.course || {},intro(d.course,d.course?.teacherText || '查看导师、课程安排和期次'));
  if (['event-detail','event-group','event-register','event-player'].includes(route)) return card(d.competition?.name || '东方舞赛事','/pages/event-detail/event-detail',{id:d.id || d.competitionId || o.id},d.competition || {},intro(d.competition,d.competition?.dateText || '查看赛事介绍、组别与报名安排'));
  const item=route==='mall'?d.visibleProducts?.[0]:route==='home'?d.carouselCourses?.[0]:route==='system'?d.courses?.[0]:route==='offline'?d.visibleCourses?.[0]:route==='events'?d.visibleEvents?.[0]:{};
  return card(titles[route],route==='admin'?HOME:`/pages/${route}/${route}`,{},item || {},descriptions[route]);
}
const landingPages = new Set(['home','mall','detail','offline-detail','event-detail']);
async function preview(page, route, options) {
  const target=landingPages.has(options._sharePage) ? options._sharePage : route;
  let data={},id=options.id || options.seriesId;
  page.setData({sharePreview:resolveShare({data:{},shareOptions:{}},target)});
  try {
    const api=require('../utils/api');
    if (id && ['detail','player'].includes(target)) data=target==='player'?{seriesId:id,course:await api.getSeriesMeta(id)}:{id,series:await api.getSeriesMeta(id)};
    else if (id && target==='shop-product') {const result=await api.request('/shop/products',{auth:false});const product=(result.products || []).find(p=>String(p.id)===String(id));data=product?{id,product}:{error:'商品已下架'};}
    else if (id && ['event-detail','event-group','event-register','event-player'].includes(target)) {const result=await api.getEventDetail(id);data={id,competition:result.competition};}
    else if (id && target==='offline-detail') {const rows=await api.getOfflineCourses();const course=(rows || []).find(p=>String(p.id)===String(id));data=course?{courseId:id,course}:{};}
    page.setData({sharePreview:resolveShare({data,shareOptions:{}},target)});
  } catch { /* Keep the public branded preview; do not request a login or private data. */ }
}
function withShare(route, definition) {
  const {onLoad,onReady,onShow}=definition;
  return Object.assign({},definition,{
    data:Object.assign({},definition.data,{sharePreview:null}),
    onLoad(options={}) {
      this.shareOptions=options;
      const scene=typeof wx==='undefined' ? 0 : wx.getEnterOptionsSync ? wx.getEnterOptionsSync().scene : wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync().scene : 0;
      if (scene===1154) { this.sharePreviewMode=true;return preview(this,route,options); }
      // Timeline keeps the original page path. Resolve our public target before any private/player load.
      if (options._sharePage && options._sharePage!==route && landingPages.has(options._sharePage)) {
        const target=options._sharePage,params={};
        if (['detail','offline-detail','event-detail'].includes(target) && /^[\w-]{1,100}$/.test(String(options.id || ''))) params.id=options.id;
        this.shareRedirecting=true;
        return wx.reLaunch({url:link(`/pages/${target}/${target}`,params)});
      }
      return onLoad && onLoad.call(this,options);
    },
    onShow() { if (!this.shareRedirecting && !this.sharePreviewMode) return onShow && onShow.call(this); },
    onReady() {
      if(this.sharePreviewMode)return;
      wx.showShareMenu({withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
      return onReady && onReady.call(this);
    },
    onShareAppMessage() {return resolveShare(this,route);},
    onShareTimeline() {
      const result=resolveShare(this,route),target=result.path.split('/')[2];
      let query=result.path.split('?')[1] || '';
      if(target!==route)query+=(query?'&':'')+'_sharePage='+encodeURIComponent(target);
      return {title:result.title,imageUrl:result.imageUrl,query};
    }
  });
}
module.exports={withShare,resolveShare};
