const legacy = window.LEGACY_DATA;
const data = legacy.normalized;

const byId = (rows, key = "id") => new Map(rows.map((row) => [row[key], row]));
const competitions = byId(data.competitions);
const groups = byId(data.groups);
const users = byId(data.users);

const groupsByComp = groupBy(data.groups, "comps_id");
const playersByComp = groupBy(data.players, "cid");
const playersByGroup = groupBy(data.players, "tid");
const scoresByGroup = groupBy(data.scores, "group_id");
const judgesByGroup = data.groupJudges.reduce((map, row) => {
  if (!map.has(row.group_id)) map.set(row.group_id, new Set());
  map.get(row.group_id).add(row.judges_id);
  return map;
}, new Map());

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
  return value;
}

function pickEvent() {
  return [...data.competitions]
    .sort((a, b) => (b.scoreRecordCount || 0) - (a.scoreRecordCount || 0) || (b.playerCount || 0) - (a.playerCount || 0))[0];
}

function pickGroup(event) {
  const eventGroups = groupsByComp.get(event.id) || [];
  return eventGroups
    .sort((a, b) => (scoresByGroup.get(b.id)?.length || 0) - (scoresByGroup.get(a.id)?.length || 0) || (playersByGroup.get(b.id)?.length || 0) - (playersByGroup.get(a.id)?.length || 0))[0] || data.groups[0];
}

function rankPlayers(group, event) {
  const base = playersByGroup.get(group.id) || playersByComp.get(event.id) || [];
  return base
    .map((player, index) => ({
      ...player,
      rankScore: Number(player.score || 0) || Math.max(6, 9.8 - index * 0.083),
      code: String(player.startOrder || player.signOrder || index + 1).padStart(3, "0"),
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 10);
}

const event = pickEvent();
const group = pickGroup(event);
const ranked = rankPlayers(group, event);
const groupPlayers = playersByGroup.get(group.id) || playersByComp.get(event.id) || [];
const currentIndex = Math.min(22, Math.max(0, groupPlayers.length ? Math.floor(groupPlayers.length / 3) : 0));
const currentPlayer = groupPlayers[currentIndex] || ranked[0] || data.players[0];
const previousPlayer = groupPlayers[currentIndex - 1] || ranked[1] || currentPlayer;
const nextPlayer = groupPlayers[currentIndex + 1] || ranked[2] || currentPlayer;

function render() {
  renderHeader();
  renderEventInfo();
  renderProgress();
  renderStats();
  renderRank();
  renderSession();
  renderJudges();
  renderAnnouncements();
  renderContestants();
  tickClock();
  setInterval(tickClock, 1000);
}

function renderHeader() {
  document.querySelector("#screen-event-title").textContent = event.comps_name || "AiwaRaks东方舞公开赛";
  document.title = `${event.comps_name || "AiwaRaks"} · 赛事大屏`;
}

function renderEventInfo() {
  const judges = new Set((data.groupJudges || []).filter((row) => row.comps_id === event.id).map((row) => row.judges_id));
  const rows = [
    ["赛事名称", event.comps_name],
    ["比赛时间", `${String(event.startDate || "").slice(0, 10)} - ${String(event.endDate || "").slice(5, 10)}`],
    ["比赛地点", event.citys || "现场主会场"],
    ["当前场次", group.group_name || "组别赛"],
    ["当前组别", group.group_name || "未设置"],
    ["当前节目", currentPlayer.show_name || currentPlayer.name],
    ["参赛选手", groupPlayers.length || event.playerCount],
    ["评委人数", judges.size || (judgesByGroup.get(group.id) || new Set()).size],
  ];
  document.querySelector("#event-info").innerHTML = rows.map(([key, value]) => `<dt>${key}</dt><dd>${fmt(value)}</dd>`).join("");
}

function renderProgress() {
  const finished = Math.max(1, ranked.filter((player) => Number(player.score || 0) > 0).length);
  const total = Math.max(groupPlayers.length, ranked.length, 1);
  const percent = Math.round((finished / total) * 100);
  const ring = document.querySelector("#event-progress-ring");
  ring.style.setProperty("--progress", `${percent}%`);
  ring.querySelector("span").textContent = `${percent}%`;
  document.querySelector("#event-progress-list").innerHTML = [
    ["已完成", Math.max(1, Math.round(total * 0.32)), "var(--green)"],
    ["进行中", 1, "var(--cyan)"],
    ["待进行", Math.max(0, total - Math.round(total * 0.32) - 1), "#8fb5d6"],
  ]
    .map(([label, value, color]) => `<div class="progress-line"><span><i style="background:${color}"></i>${label}</span><strong>${value} 场</strong></div>`)
    .join("");
}

function renderStats() {
  document.querySelector("#live-stats").innerHTML = [
    ["报名人数", data.players.length, "var(--cyan)"],
    ["参赛选手", groupPlayers.length || event.playerCount, "var(--purple)"],
    ["参赛组别", (groupsByComp.get(event.id) || []).length, "var(--orange)"],
    ["评委人数", (judgesByGroup.get(group.id) || new Set()).size || data.judges.length, "var(--green)"],
  ]
    .map(([label, value, color]) => `<div class="stat-box"><span><i style="background:${color}"></i>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderRank() {
  document.querySelector("#rank-group-name").textContent = group.group_name || "当前组别";
  document.querySelector("#rank-rows").innerHTML = ranked
    .map((player, index) => {
      const medalClass = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : "";
      const rank = index < 3 ? `<span class="medal ${medalClass}">${index + 1}</span>` : index + 1;
      return `
        <tr>
          <td>${rank}</td>
          <td>${player.code}</td>
          <td><strong>${fmt(player.name)}</strong></td>
          <td>${fmt(player.group_name)}</td>
          <td class="score">${player.rankScore.toFixed(3)}</td>
          <td>${player.rankScore.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSession() {
  const total = Math.max(groupPlayers.length, ranked.length, 1);
  document.querySelector("#current-session").textContent = group.group_name || "当前组别";
  document.querySelector("#current-count-main").textContent = `${Math.min(currentIndex + 1, total)}/${total}`;
  document.querySelector("#session-status").innerHTML = [
    ["已完成", Math.max(1, Math.round(total * 0.32)), "var(--green)"],
    ["正在比赛", 1, "var(--orange)"],
    ["待出场", Math.max(0, total - currentIndex - 1), "#8fb5d6"],
  ]
    .map(([label, value, color]) => `<li><span style="color:${color}">●</span> ${label} <strong>${value} 人</strong></li>`)
    .join("");
}

function renderJudges() {
  const judgeIds = Array.from(judgesByGroup.get(group.id) || []).slice(0, 7);
  const fallback = data.judges.slice(0, 7).map((judge) => judge.id);
  const ids = judgeIds.length ? judgeIds : fallback;
  document.querySelector("#judge-status").innerHTML = ids
    .map((id, index) => {
      const judge = users.get(id) || data.judges.find((item) => item.id === id) || { nickname: `评委${index + 1}` };
      const total = Math.max(1, Math.min(23, ranked.length + 13));
      const done = total - (index % 3 === 1 ? 1 : 0);
      const percent = Math.round((done / total) * 100);
      return `
        <div class="judge-row">
          <strong>${fmt(judge.nickname || `评委${index + 1}`)}</strong>
          <span>${done}</span>
          <span>${total - done}</span>
          <div class="judge-bar"><span style="width:${percent}%"></span></div>
          <span>${percent}%</span>
        </div>
      `;
    })
    .join("");
}

function renderAnnouncements() {
  document.querySelector("#announcements").innerHTML = [
    ["重要", "评委会议将在15:00在评委休息室召开", "13:50"],
    ["通知", "请未上传音乐的选手尽快完成上传", "13:30"],
    ["通知", `接下来进行${group.group_name || "当前组别"}`, "13:20"],
    ["活动", "AiwaRaks大师课将于明日10:00开始", "12:40"],
  ]
    .map(([type, text, time]) => `<div class="announcement"><b>${type}</b><span>${text}</span><em>${time}</em></div>`)
    .join("");
}

function renderContestants() {
  document.querySelector("#previous-player").innerHTML = playerCard("下一位选手", previousPlayer, "准备中", "00:45");
  document.querySelector("#current-player").innerHTML = playerCard(`当前选手 ${currentPlayer.startOrder || currentPlayer.signOrder || ""}`, currentPlayer, "表演中", "01:28");
  document.querySelector("#next-player").innerHTML = playerCard("之后选手", nextPlayer, "准备中", "");
}

function playerCard(label, player, state, time) {
  const user = users.get(player.uid);
  const avatar = user?.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : String(player.name || "选").slice(0, 1);
  return `
    <div class="player-avatar">${avatar}</div>
    <div>
      <p>${label}</p>
      <h3>${String(player.startOrder || player.signOrder || "").padStart(3, "0")}　${fmt(player.name)}</h3>
      <p>${fmt(player.group_name)}</p>
      <p>节目：${fmt(player.show_name)}</p>
      <span class="state">${state} ${time}</span>
    </div>
  `;
}

function tickClock() {
  const now = new Date();
  document.querySelector("#clock-time").textContent = now.toLocaleTimeString("zh-CN", { hour12: false });
  document.querySelector("#clock-date").textContent = `${now.toISOString().slice(0, 10)}　星期${"日一二三四五六"[now.getDay()]}`;
}

render();
