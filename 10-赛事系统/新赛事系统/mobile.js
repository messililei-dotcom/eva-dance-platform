const legacy = window.LEGACY_DATA;
const data = legacy.normalized;

const byId = (rows, key = "id") => new Map(rows.map((row) => [row[key], row]));
const groups = byId(data.groups);

function fmt(value) {
  if (value === null || value === undefined || value === "") return "未填写";
  return value;
}

function dateRange(start, end) {
  const s = String(start || "").slice(0, 10).replaceAll("-", ".");
  const e = String(end || "").slice(5, 10).replaceAll("-", ".");
  return s && e ? `${s} - ${e}` : s || "待定";
}

function pickEvent() {
  return [...data.competitions].sort((a, b) => {
    const signup = (b.signup || 0) - (a.signup || 0);
    if (signup) return signup;
    return String(b.startDate || "").localeCompare(String(a.startDate || ""));
  })[0];
}

const event = pickEvent();
const players = data.players.filter((player) => player.cid === event.id);

function renderHero() {
  const hero = document.querySelector("#hero-card");
  const poster = event.comps_posterPic || event.comps_defaultAvatar || "";
  if (poster) hero.style.setProperty("--hero-image", `url("${poster}")`);
  document.querySelector("#hero-year").textContent = `${String(event.startDate || "2025").slice(0, 4)} AiwaRaks`;
  document.querySelector("#hero-title").textContent = event.comps_name || "东方舞国际公开赛";
  document.querySelector("#hero-date").textContent = dateRange(event.startDate, event.endDate);
  document.querySelector("#hero-place").textContent = event.citys ? `中国 · ${event.citys}` : "中国 · 现场";
}

function renderFeatures() {
  const rows = [
    ["▣", "赛事报名", "在线报名参赛", "#ff5b7f"],
    ["▦", "赛事日程", "查看赛程安排", "#9b72ff"],
    ["♜", "成绩查询", "实时成绩查询", "#ffa83d"],
    ["▤", "证书领取", "电子证书下载", "#44c878"],
    ["♙", "评委阵容", "评委信息介绍", "#57a7ff"],
    ["♕", "赛事规则", "比赛规则说明", "#ff8a66"],
  ];
  document.querySelector("#feature-grid").innerHTML = rows
    .map(([icon, title, text, color]) => `<div class="feature"><i style="background:${color}">${icon}</i><strong>${title}</strong><span>${text}</span></div>`)
    .join("");
}

function renderUpcoming() {
  const group = groups.get(players[0]?.tid);
  document.querySelector("#upcoming-event").innerHTML = `
    <div class="event-poster" style="background-image:url('${event.comps_posterPic || ""}')"><strong>${event.comps_name}</strong></div>
    <div class="event-info">
      <h3>${fmt(event.comps_name)}</h3>
      <p><span>报名时间</span>${String(event.comps_enter_time || event.startDate || "").slice(0, 10)} - ${String(event.startDate || "").slice(0, 10)}</p>
      <p><span>比赛时间</span>${dateRange(event.startDate, event.endDate)}</p>
      <p><span>比赛地点</span>${fmt(event.citys)}</p>
      <p><span>热门组别</span>${fmt(group?.group_name)}</p>
      <button type="button">立即报名</button>
    </div>
  `;
}

function renderQuick() {
  const rows = [
    ["♙", "我的报名", "查看报名记录", "#57a7ff"],
    ["♪", "音乐上传", "上传比赛音乐", "#44c878"],
    ["▰", "我的订单", "查看支付记录", "#ffa83d"],
    ["●", "消息通知", "系统消息", "#9b72ff"],
    ["♥", "关注选手", "支持喜爱的选手", "#ff5b7f"],
  ];
  document.querySelector("#quick-grid").innerHTML = rows
    .map(([icon, title, text, color]) => `<div class="quick"><i style="background:${color}">${icon}</i><strong>${title}</strong><span>${text}</span></div>`)
    .join("");
}

function renderData() {
  const organizations = new Set(data.players.map((player) => player.group_name).filter(Boolean));
  const rows = [
    [data.players.length, "累计报名人次"],
    [data.players.length, "参赛选手"],
    [data.judges.length, "合作评委"],
    [data.competitions.length + organizations.size, "举办赛事场次"],
  ];
  document.querySelector("#data-grid").innerHTML = rows
    .map(([value, label]) => `<div class="data-item"><strong>${Number(value).toLocaleString("zh-CN")}</strong><span>${label}</span></div>`)
    .join("");
}

function renderNotice() {
  document.querySelector("#notice-text").textContent = `${event.comps_name || "AiwaRaks赛事"}报名已开启！`;
}

function render() {
  renderHero();
  renderFeatures();
  renderUpcoming();
  renderQuick();
  renderData();
  renderNotice();
  enhanceMobileInteractions();
}

function enhanceMobileInteractions() {
  document.addEventListener("touchstart", () => {}, { passive: true, once: true });
  document.querySelectorAll("button, a, .feature, .quick, .event-card, .notice-bar").forEach((element) => {
    if (element.dataset.touchBound) return;
    element.dataset.touchBound = "true";
    element.addEventListener("touchstart", () => element.classList.add("touch-active"), { passive: true });
    element.addEventListener("touchend", () => element.classList.remove("touch-active"), { passive: true });
    element.addEventListener("touchcancel", () => element.classList.remove("touch-active"), { passive: true });
  });
}

render();
