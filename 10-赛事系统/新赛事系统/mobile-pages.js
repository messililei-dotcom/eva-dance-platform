const legacy = window.LEGACY_DATA;
const data = legacy.normalized;

const byId = (rows, key = "id") => new Map(rows.map((row) => [row[key], row]));
const competitions = byId(data.competitions);
const groups = byId(data.groups);
const users = byId(data.users);
const playersByComp = groupBy(data.players, "cid");

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeCssUrl(value) {
  return String(value || '').replace(/["'()\\\r\n]/g, encodeURIComponent);
}

function groupBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key] ?? "未关联";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
    return map;
  }, new Map());
}

function fmt(value) {
  if (value === null || value === undefined || value === "") return "未填写";
  return escapeHtml(value);
}

function dateRange(start, end) {
  const s = String(start || "").slice(0, 10).replaceAll("-", ".");
  const e = String(end || "").slice(0, 10).replaceAll("-", ".");
  return escapeHtml(s && e ? `${s} - ${e}` : s || "待定");
}

function shortDate(start, end) {
  return escapeHtml(`${String(start || "").slice(5, 10)}–${String(end || "").slice(5, 10)}`.replaceAll("-", "."));
}

function pickEvent() {
  return [...data.competitions].sort((a, b) => (b.signup || 0) - (a.signup || 0) || String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];
}

function image(comp) {
  return safeCssUrl(comp?.comps_posterPic || comp?.comps_defaultAvatar || "");
}

function eventCard(comp, secondary = false) {
  const count = playersByComp.get(comp.id)?.length || comp.playerCount || 0;
  return `
    <div class="list-event">
      <div class="list-poster" style="background-image:url('${image(comp)}')"></div>
      <div>
        <h3>${fmt(comp.comps_name)}</h3>
        <p>${fmt(comp.citys)}</p>
        <p>${dateRange(comp.startDate, comp.endDate)}</p>
        <p>报名截止：${escapeHtml(String(comp.startDate || "").slice(0, 10))} 23:59</p>
        <div class="row">
          <span>已报名 ${count} 人</span>
          <button class="${secondary ? "secondary" : ""}" type="button">${secondary ? "赛事详情" : "立即报名"}</button>
        </div>
      </div>
    </div>
  `;
}

function renderEventsPage() {
  const host = document.querySelector("#events-hero");
  if (!host) return;
  const event = pickEvent();
  host.style.setProperty("--hero-image", `url('${image(event)}')`);
  host.innerHTML = `
    <span class="status-pill">报名中</span>
    <h2>${fmt(event.comps_name)}</h2>
    <p>绽放 · 自信 · 超越</p>
    <p>${dateRange(event.startDate, event.endDate)}</p>
    <p>中国 · ${fmt(event.citys)}</p>
  `;
  const features = [
    ["▤", "赛事报名", "在线报名参赛", "#ff5b7f"],
    ["▦", "赛事日程", "查看赛程安排", "#57a7ff"],
    ["♙", "组别查询", "查看组别信息", "#ffa83d"],
    ["♪", "音乐上传", "上传参赛音乐", "#9b72ff"],
    ["▣", "赛事规则", "比赛规则说明", "#44c878"],
  ];
  document.querySelector("#events-feature-grid").innerHTML = features
    .map(([icon, title, text, color]) => `<div class="feature"><i style="background:${color}">${icon}</i><strong>${title}</strong><span>${text}</span></div>`)
    .join("");
  const all = [...data.competitions].sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));
  document.querySelector("#open-events").innerHTML = all.slice(0, 2).map((comp) => eventCard(comp)).join("");
  document.querySelector("#upcoming-events").innerHTML = all.slice(2, 4).map((comp) => eventCard(comp, true)).join("");
  enhanceMobileInteractions();
}

function renderProfilePage() {
  const host = document.querySelector("#profile-head");
  if (!host) return;
  const player = data.players.find((item) => item.name) || data.players[0];
  const user = users.get(player.uid);
  const playerEvents = data.players.filter((item) => item.uid === player.uid).slice(0, 4);
  const events = playerEvents.length ? playerEvents : data.players.slice(0, 4);
  host.innerHTML = `
    <div class="profile-avatar">${fmt(player.name).slice(0, 1)}</div>
    <div>
      <h2>${fmt(player.name)}</h2>
      <p>${fmt(player.group_name || user?.nickname)}</p>
      <p>舞龄 4年 ｜ 累计参赛 ${events.length + 8} 次</p>
    </div>
    <span>›</span>
  `;
  document.querySelector("#profile-stats").innerHTML = [
    [events.length + 8, "参赛次数"],
    [8, "获奖次数"],
    [3, "冠军次数"],
    [12, "最高排名"],
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#journey-list").innerHTML = events.map((item, index) => {
    const comp = competitions.get(item.cid) || data.competitions[index];
    const group = groups.get(item.tid);
    const awards = ["冠军", "亚军", "季军", "第 4 名"];
    return `
      <div class="timeline-item">
        <div class="timeline-year">${escapeHtml(String(comp?.startDate || "2025").slice(0, 4))}<span>${shortDate(comp?.startDate, comp?.endDate)}</span></div>
        <div class="timeline-poster" style="background-image:url('${image(comp)}')"></div>
        <div class="timeline-info">
          <span class="award">${awards[index] || "入围"}</span>
          <h3>${fmt(comp?.comps_name)}</h3>
          <p>${fmt(comp?.citys)}</p>
          <p>${fmt(group?.group_name)}</p>
          <p>《${fmt(item.show_name || "参赛作品")}》</p>
          <p>总分 ${Number(item.score || (9.685 - index * 0.143)).toFixed(3)}　评委平均分 ${(9.69 - index * 0.15).toFixed(2)} ›</p>
        </div>
      </div>
    `;
  }).join("");
  enhanceMobileInteractions();
}

function renderDetailPage() {
  const hero = document.querySelector("#detail-hero");
  if (!hero) return;
  const event = pickEvent();
  hero.style.setProperty("--hero-image", `url('${image(event)}')`);
  hero.innerHTML = `
    <span class="status-pill">报名中</span>
    <span class="share-pill">分享</span>
    <h2>${fmt(event.comps_name)}</h2>
    <p>绽放 · 自信 · 超越</p>
    <p>${dateRange(event.startDate, event.endDate)}</p>
    <p>中国 · ${fmt(event.citys)}</p>
  `;
  document.querySelector("#stage-card").innerHTML = [
    ["▤", "报名中", "04.01–06.10", "#9b72ff"],
    ["▦", "报名截止", "06.10 23:59", "#aeb4bf"],
    ["♙", "比赛日程", shortDate(event.startDate, event.endDate), "#ffa83d"],
    ["▥", "成绩发布", "敬请期待", "#44c878"],
    ["♕", "颁奖典礼", "敬请期待", "#f3bd3e"],
  ].map(([icon, title, text, color]) => `<div class="stage"><i style="background:${color}">${icon}</i><strong>${title}</strong><span>${text}</span></div>`).join("");
  document.querySelector("#detail-actions").innerHTML = [
    ["▤", "我要报名", "立即报名", "#ff5b7f"],
    ["♙", "组别查询", "查看组别", "#57a7ff"],
    ["♪", "音乐上传", "上传参赛音乐", "#ffa83d"],
    ["▣", "赛事指南", "参赛必读", "#9b72ff"],
    ["⌖", "场馆信息", "交通住宿", "#44c878"],
    ["●", "咨询客服", "在线咨询", "#57a7ff"],
  ].map(([icon, title, text, color]) => `<div class="detail-action"><i style="background:${color}">${icon}</i><strong>${title}</strong><span>${text}</span></div>`).join("");
  document.querySelector("#event-intro").textContent = event.intro || `${event.comps_name} 是 AiwaRaks 打造的高规格东方舞赛事，旨在为全球东方舞爱好者提供专业、公平、公开的舞台，传递东方舞艺术的魅力与文化价值。`;
  document.querySelector("#basic-info").innerHTML = `
    <div class="section-head"><h2>赛事基本信息</h2><a>查看更多 ›</a></div>
    <div class="info-list">
      <div class="info-row"><span>主办单位</span>${fmt(event.create_by || "AiwaRaks东方舞艺术中心")}</div>
      <div class="info-row"><span>比赛时间</span>${dateRange(event.startDate, event.endDate)}</div>
      <div class="info-row"><span>比赛地点</span>${fmt(event.citys)}</div>
      <div class="info-row"><span>报名截止</span>${escapeHtml(String(event.startDate || "").slice(0, 10))} 23:59</div>
      <div class="info-row"><span>咨询电话</span>${fmt(event.tel || "400-888-8888")}</div>
    </div>
  `;
  document.querySelector("#event-news").innerHTML = `
    <div class="section-head"><h2>赛事动态</h2><a>查看更多 ›</a></div>
    <div class="news-list">
      <div class="news-row"><b>重要</b><span>赛事音乐上传通道已开启，请及时上传参赛音乐文件</span><em>05-12</em></div>
      <div class="news-row"><b style="background:#2f9bff">通知</b><span>赛事分组及比赛顺序将在赛前公布</span><em>05-08</em></div>
      <div class="news-row"><b style="background:#34c878">活动</b><span>大师课程 & 选手之夜预告，精彩不容错过！</span><em>05-05</em></div>
    </div>
  `;
  enhanceMobileInteractions();
}

function enhanceMobileInteractions() {
  document.addEventListener("touchstart", () => {}, { passive: true, once: true });
  document.querySelectorAll("button, a, .list-event, .stage, .detail-action, .timeline-item").forEach((element) => {
    if (element.dataset.touchBound) return;
    element.dataset.touchBound = "true";
    element.addEventListener("touchstart", () => element.classList.add("touch-active"), { passive: true });
    element.addEventListener("touchend", () => element.classList.remove("touch-active"), { passive: true });
    element.addEventListener("touchcancel", () => element.classList.remove("touch-active"), { passive: true });
  });
}

renderEventsPage();
renderProfilePage();
renderDetailPage();
