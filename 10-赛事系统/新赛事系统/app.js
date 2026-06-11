if (!localStorage.getItem("saishi_admin_token")) {
  document.body.classList.add("auth-required");
  document.querySelector(".sidebar")?.setAttribute("hidden", "hidden");
  document.querySelector(".shell")?.setAttribute("hidden", "hidden");
}

const legacy = window.LEGACY_DATA;
const data = buildCompleteData(legacy);

const state = {
  view: "dashboard",
  query: "",
  competitionId: data.competitions[0]?.id,
  selectedCompetitionId: null,
  competitionTab: "info",
  groupImportText: "",
  pendingDeleteCompetitionId: null,
};

const byId = (rows, key = "id") => new Map(rows.map((row) => [row[key], row]));
const competitions = byId(data.competitions);
let groups = byId(data.groups);
const users = byId(data.users);
const judges = byId(data.judges);

let groupsByCompetition;
let playersByCompetition;
let scoresByCompetition;
let playersByGroup;
let scoresByPlayer;
let scoresByGroup;
let scoreByJudge;
let judgeCompMap;
let judgesByGroup;

function rebuildIndexes() {
  groups = byId(data.groups);
  groupsByCompetition = groupBy(data.groups, "comps_id");
  playersByCompetition = groupBy(data.players, "cid");
  scoresByCompetition = groupBy(data.scores, "comps_id");
  playersByGroup = groupBy(data.players, "tid");
  scoresByPlayer = groupBy(data.scores, "player_id");
  scoresByGroup = countBy(data.scores, "group_id");
  scoreByJudge = countBy(data.scores, "judges_id");
  judgeCompMap = data.groupJudges.reduce((map, row) => {
    if (!map.has(row.judges_id)) map.set(row.judges_id, new Set());
    map.get(row.judges_id).add(row.comps_id);
    return map;
  }, new Map());
  judgesByGroup = data.groupJudges.reduce((map, row) => {
    if (!map.has(row.group_id)) map.set(row.group_id, new Set());
    map.get(row.group_id).add(row.judges_id);
    return map;
  }, new Map());
}

rebuildIndexes();
let nextGroupId = Math.max(...data.groups.map((group) => Number(group.id) || 0), 200000) + 1;
let nextCompetitionId = Math.max(...data.competitions.map((comp) => Number(comp.id) || 0), 100000) + 1;

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

function buildCompleteData(legacyData) {
  const normalized = legacyData.normalized || {};
  const raw = legacyData.raw || {};
  const apiVmpRaw = legacyData.apiVmpRaw || {};
  const complete = { ...normalized };

  const judgesById = new Map((normalized.judges || []).map((judge) => [judge.id, judge]));
  const rawUsersById = new Map((raw.dfwq_comps_user || []).map((user) => [Number(user.id), user]));
  const apiUsersById = new Map((apiVmpRaw.vmpdb_users || []).map((user) => [Number(user.uid), user]));
  const missingJudgeIds = new Set();

  (normalized.groupJudges || []).forEach((row) => {
    const judgeId = Number(row.judges_id);
    if (judgeId && !judgesById.has(judgeId)) missingJudgeIds.add(judgeId);
  });
  (normalized.scores || []).forEach((row) => {
    const judgeId = Number(row.judges_id);
    if (judgeId && !judgesById.has(judgeId)) missingJudgeIds.add(judgeId);
  });

  missingJudgeIds.forEach((judgeId) => {
    const rawUser = rawUsersById.get(judgeId);
    const apiUser = apiUsersById.get(judgeId);
    judgesById.set(judgeId, {
      id: judgeId,
      legacy_source: rawUser ? "dfwq_comps_user_recovered" : apiUser ? "api_vmp_users_recovered" : "missing_reference",
      legacy_id: rawUser?.id || apiUser?.uid || judgeId,
      nickname: rawUser?.nickname || apiUser?.nickname || `评委#${judgeId}`,
      tel: rawUser?.tel || "",
      uid: rawUser?.id || apiUser?.uid || judgeId,
      source: rawUser ? "raw_recovered" : apiUser ? "api_recovered" : "placeholder",
      user_state: rawUser?.user_state ?? (apiUser?.banned === 1 ? 0 : 1),
      avatarUrl: rawUser?.avatarUrl || apiUser?.avatarUrl || "",
      recovered: true,
    });
  });

  const playersById = new Map((normalized.players || []).map((player) => [player.id, player]));
  const signupsByRecoveredId = new Map(
    (apiVmpRaw.vmpdb_signups || []).map((signup) => [300000 + Number(signup.sid), signup])
  );
  const scoresByMissingPlayer = new Map();

  (normalized.scores || []).forEach((score) => {
    const playerId = Number(score.player_id);
    if (!playerId || playersById.has(playerId)) return;
    if (!scoresByMissingPlayer.has(playerId)) scoresByMissingPlayer.set(playerId, []);
    scoresByMissingPlayer.get(playerId).push(score);
  });

  scoresByMissingPlayer.forEach((scores, playerId) => {
    const signup = signupsByRecoveredId.get(playerId);
    const firstScore = scores[0] || {};
    const numericScores = scores.map((score) => Number(score.score)).filter(Number.isFinite);
    const averageScore = numericScores.length
      ? numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length
      : 0;

    playersById.set(playerId, {
      id: playerId,
      legacy_source: signup ? "api_vmp_signups_recovered" : "missing_score_reference",
      legacy_id: signup?.sid || playerId,
      uid: signup?.uid ? 400000 + Number(signup.uid) : 400000,
      name: signup?.name || null,
      show_name: signup?.show_name || signup?.name || `选手#${playerId}`,
      tid: firstScore.group_id || (signup?.tid ? 200000 + Number(signup.tid) : null),
      cid: firstScore.comps_id || (signup?.cid ? 100000 + Number(signup.cid) : null),
      amount: Number(signup?.amount || 0),
      cost: Number(signup?.cost || 0),
      sn: signup?.sn || null,
      mobile: signup?.mobile || "",
      province: signup?.province || null,
      city: signup?.city || null,
      group_name: signup?.group_name || null,
      zhidao: signup?.zhidao || null,
      bianwu: signup?.bianwu || null,
      style: signup?.style || null,
      mp3_file: signup?.file || null,
      player_date: signup?.date || null,
      paid_time: signup?.paid || null,
      isPaySuccess: signup?.paid ? 1 : 0,
      score: Number(averageScore.toFixed(2)),
      sort: 100,
      complete: 0,
      del: signup?.del ?? 0,
      avatarUrl: null,
      costScore: 0,
      recovered: true,
    });
  });

  complete.judges = Array.from(judgesById.values());
  complete.players = Array.from(playersById.values());
  removeTestData(complete);

  const unresolvedJudgeIds = Array.from(missingJudgeIds).filter((id) => !judgesById.has(id));
  if (unresolvedJudgeIds.length || scoresByMissingPlayer.size) {
    console.info("Legacy data recovered", {
      judges: missingJudgeIds.size - unresolvedJudgeIds.length,
      players: scoresByMissingPlayer.size,
      unresolvedJudgeIds,
    });
  }

  return complete;
}

function hasTestText(row) {
  return Object.values(row || {}).some((value) => {
    if (value === null || value === undefined) return false;
    return /测试|test/i.test(String(value));
  });
}

function hasTestKeyword(value) {
  return /测试|test/i.test(String(value || ""));
}

function hasTestGroupName(row) {
  return hasTestKeyword(row?.group_name || row?.name || row?.type_name || row?.title);
}

function hasTestPlayerName(row) {
  return [
    row?.name,
    row?.show_name,
    row?.player_name,
    row?.nickname,
    row?.group_name,
    row?.style,
  ].some(hasTestKeyword);
}

function removeTestData(dataset) {
  const testCompetitionIds = new Set((dataset.competitions || []).filter(hasTestText).map((row) => Number(row.id)));
  const testGroupIds = new Set((dataset.groups || []).filter((row) => testCompetitionIds.has(Number(row.comps_id)) || hasTestText(row) || hasTestGroupName(row)).map((row) => Number(row.id)));
  const testPlayerIds = new Set(
    (dataset.players || [])
      .filter((row) => testCompetitionIds.has(Number(row.cid)) || testGroupIds.has(Number(row.tid)) || hasTestText(row) || hasTestPlayerName(row))
      .map((row) => Number(row.id))
  );
  const testJudgeIds = new Set((dataset.judges || []).filter(hasTestText).map((row) => Number(row.id)));

  dataset.competitions = (dataset.competitions || []).filter((row) => !testCompetitionIds.has(Number(row.id)));
  dataset.groups = (dataset.groups || []).filter((row) => !testCompetitionIds.has(Number(row.comps_id)) && !testGroupIds.has(Number(row.id)));
  dataset.players = (dataset.players || []).filter(
    (row) => !testCompetitionIds.has(Number(row.cid)) && !testGroupIds.has(Number(row.tid)) && !testPlayerIds.has(Number(row.id))
  );
  dataset.judges = (dataset.judges || []).filter((row) => !testJudgeIds.has(Number(row.id)));
  dataset.groupJudges = (dataset.groupJudges || []).filter(
    (row) => !testCompetitionIds.has(Number(row.comps_id)) && !testGroupIds.has(Number(row.group_id)) && !testJudgeIds.has(Number(row.judges_id))
  );
  dataset.scoreRules = (dataset.scoreRules || []).filter((row) => !testCompetitionIds.has(Number(row.comps_id)));
  dataset.scores = (dataset.scores || []).filter(
    (row) =>
      !testCompetitionIds.has(Number(row.comps_id)) &&
      !testGroupIds.has(Number(row.group_id)) &&
      !testPlayerIds.has(Number(row.player_id)) &&
      !testJudgeIds.has(Number(row.judges_id)) &&
      !hasTestText(row)
  );

  const groupsByComp = groupBy(dataset.groups || [], "comps_id");
  const playersByComp = groupBy(dataset.players || [], "cid");
  const scoresByComp = groupBy(dataset.scores || [], "comps_id");
  const groupJudgesByComp = groupBy(dataset.groupJudges || [], "comps_id");
  dataset.competitions.forEach((comp) => {
    const compPlayers = playersByComp.get(comp.id) || [];
    comp.groupCount = (groupsByComp.get(comp.id) || []).length;
    comp.playerCount = compPlayers.length;
    comp.paidPlayerCount = compPlayers.filter((player) => player.isPaySuccess === 1).length;
    comp.judgeCount = new Set((groupJudgesByComp.get(comp.id) || []).map((row) => row.judges_id)).size;
    comp.scoreRecordCount = (scoresByComp.get(comp.id) || []).length;
  });
}

function countBy(rows, key) {
  return rows.reduce((counter, row) => {
    const value = row[key] ?? "未关联";
    counter.set(value, (counter.get(value) || 0) + 1);
    return counter;
  }, new Map());
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

function money(value) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function dateText(start, end) {
  const s = String(start || "").slice(0, 10);
  const e = String(end || "").slice(0, 10);
  return escapeHtml(s && e && s !== e ? `${s} 至 ${e}` : s || e || "未设置");
}

function matches(row) {
  if (!state.query) return true;
  return JSON.stringify(row).toLowerCase().includes(state.query.toLowerCase());
}

function renderMetrics() {
  const paidPlayers = data.players.filter((p) => p.isPaySuccess === 1);
  const signupRevenue = paidPlayers.reduce((sum, player) => sum + Number(player.cost || 0), 0);
  const scoreRevenue = data.players.reduce((sum, player) => sum + Number(player.costScore || 0), 0);
  const metrics = [
    ["赛", "赛事总数", data.competitions.length, `较昨日 +${Math.max(1, Math.round(data.competitions.length / 7))}`, "competitions"],
    ["报", "报名总人数", data.players.length, `已支付 ${paidPlayers.length}`, "players"],
    ["选", "参赛选手数", data.players.length, `组别 ${data.groups.length}`, "players"],
    ["评", "评委总数", data.judges.length, `已评分 ${new Set(data.scores.map((score) => score.judges_id)).size}`, "judges"],
    ["分", "评分记录数", data.scores.length, `评分规则 ${data.scoreRules.length}`, "scoring"],
    ["¥", "订单金额(元)", money(signupRevenue + scoreRevenue), `报名 ${money(signupRevenue)}`, "certfinance"],
  ];
  document.querySelector("#metrics").innerHTML = metrics
    .map(
      ([icon, label, value, note, jump]) => `
        <button class="metric" type="button" data-jump="${jump}" onclick="switchView('${jump}')" aria-label="查看${label}">
          <div class="metric-icon">${icon}</div>
          <div><span>${label}</span><strong>${value}</strong><em>${note}</em></div>
        </button>
      `
    )
    .join("");
  document.querySelector("#source-count").textContent = `${legacy.meta.tableCounts.dfwq_score} 评分`;
}

function renderCompetitionSelect() {
  const select = document.querySelector("#competition-filter");
  select.innerHTML = data.competitions
    .map((comp) => `<option value="${escapeHtml(comp.id)}">${fmt(comp.comps_name)}</option>`)
    .join("");
  select.value = state.competitionId;
}

function renderCompetitionDetail() {
  const comp = competitions.get(Number(state.competitionId)) || data.competitions[0];
  if (!comp) return;
  const image = safeCssUrl(comp.comps_posterPic || comp.comps_defaultAvatar || "");
  document.querySelector("#competition-detail").innerHTML = `
    <div class="competition-hero" style="background-image:url('${image}')">
      <div>
        <h2>${fmt(comp.comps_name)}</h2>
        <div class="chips">
          <span class="chip">${dateText(comp.startDate, comp.endDate)}</span>
          <span class="chip">${comp.signup === 1 ? "报名开启" : "报名关闭"}</span>
          <span class="chip">城市 ${fmt(comp.citys)}</span>
          <span class="chip">报名费 ${fmt(comp.sign_price)}</span>
        </div>
      </div>
    </div>
    <div class="stats-row">
      ${mini("组别", comp.groupCount)}
      ${mini("选手", comp.playerCount)}
      ${mini("已支付", comp.paidPlayerCount)}
      ${mini("评委", comp.judgeCount)}
      ${mini("评分", comp.scoreRecordCount)}
    </div>
  `;
}

function mini(label, value) {
  return `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function selectedCompetition() {
  if (!state.selectedCompetitionId) return null;
  return competitions.get(Number(state.selectedCompetitionId)) || null;
}

function competitionRows(comp) {
  const compGroups = groupsByCompetition.get(comp.id) || [];
  const compPlayers = playersByCompetition.get(comp.id) || [];
  const compScores = scoresByCompetition.get(comp.id) || [];
  const judgeIds = new Set();
  compGroups.forEach((group) => (judgesByGroup.get(group.id) || new Set()).forEach((id) => judgeIds.add(id)));
  compScores.forEach((score) => judgeIds.add(score.judges_id));
  return { compGroups, compPlayers, compScores, judgeIds };
}

function renderCompetitionWorkspace() {
  const container = document.querySelector("#competition-workspace");
  if (!container) return;
  const comp = selectedCompetition();
  if (!comp) {
    container.innerHTML = "";
    return;
  }
  const { compGroups, compPlayers, compScores, judgeIds } = competitionRows(comp);
  const paidPlayers = compPlayers.filter((player) => player.isPaySuccess === 1);
  const scoredPlayers = compPlayers.filter((player) => Number(player.score || 0) > 0);
  const missingMusic = compPlayers.filter((player) => !player.mp3_file).length;
  const tabs = [
    ["info", "赛事信息"],
    ["groups", "组别"],
    ["players", "选手"],
    ["scores", "评分"],
  ];
  container.innerHTML = `
    <section class="event-command">
      <div class="event-command-main">
        <a class="ghost-button" href="./index.html?reload=20260530-18#competitions" data-return-competition-list onclick="showCompetitionList()">返回赛事列表</a>
        <h2>${fmt(comp.comps_name)}</h2>
        <p>ID ${comp.id} / ${dateText(comp.startDate, comp.endDate)} / 比赛 ${fmt(comp.comps_time)}</p>
        <div class="chips">
          <span class="chip">${comp.signup === 1 ? "报名开启" : "报名关闭"}</span>
          <span class="chip">城市 ${fmt(comp.citys)}</span>
          <span class="chip">报名费 ${fmt(comp.sign_price)}</span>
          <span class="chip">主办 ${fmt(comp.uname || comp.comps_sysuser_id)}</span>
        </div>
      </div>
      <div class="event-command-actions">
        <button class="primary" type="button" data-competition-tab="info">编辑赛事</button>
        <button class="secondary-button" type="button" data-competition-tab="groups">组别编排</button>
        <button class="secondary-button" type="button" data-competition-tab="scores">评分中枢</button>
      </div>
    </section>
    <div class="stats-row workspace-stats">
      ${mini("组别", compGroups.length)}
      ${mini("选手", compPlayers.length)}
      ${mini("已支付", paidPlayers.length)}
      ${mini("评委", judgeIds.size)}
      ${mini("评分记录", compScores.length)}
    </div>
    <div class="competition-tabs">
      ${tabs.map(([id, label]) => `<button type="button" class="${state.competitionTab === id ? "active" : ""}" data-competition-tab="${id}">${label}</button>`).join("")}
    </div>
    <section class="workspace-panel">${renderCompetitionTab(comp, { compGroups, compPlayers, compScores, judgeIds, scoredPlayers, missingMusic })}</section>
  `;
}

function showCompetitionList() {
  state.selectedCompetitionId = null;
  state.competitionTab = "info";
  switchView("competitions");
}

function openCompetitionManagement(competitionId) {
  state.selectedCompetitionId = Number(competitionId);
  state.competitionTab = "info";
  switchView("competitions");
  document.querySelector("#competition-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteCompetition(competitionId) {
  const id = Number(competitionId);
  const index = data.competitions.findIndex((comp) => comp.id === id);
  if (index === -1) return;
  const deletedGroupIds = new Set(data.groups.filter((group) => Number(group.comps_id) === id).map((group) => Number(group.id)));
  const deletedPlayerIds = new Set(data.players.filter((player) => Number(player.cid) === id || deletedGroupIds.has(Number(player.tid))).map((player) => Number(player.id)));
  data.competitions.splice(index, 1);
  competitions.delete(id);
  data.groups = data.groups.filter((group) => Number(group.comps_id) !== id && !deletedGroupIds.has(Number(group.id)));
  data.players = data.players.filter((player) => Number(player.cid) !== id && !deletedGroupIds.has(Number(player.tid)) && !deletedPlayerIds.has(Number(player.id)));
  data.scores = data.scores.filter(
    (score) =>
      Number(score.comps_id) !== id &&
      !deletedGroupIds.has(Number(score.group_id)) &&
      !deletedPlayerIds.has(Number(score.player_id))
  );
  data.groupJudges = data.groupJudges.filter((row) => Number(row.comps_id) !== id && !deletedGroupIds.has(Number(row.group_id)));
  data.scoreRules = data.scoreRules.filter((row) => Number(row.comps_id) !== id);
  rebuildIndexes();
  if (Number(state.selectedCompetitionId) === id) {
    state.selectedCompetitionId = null;
    state.competitionTab = "info";
  }
  render();
}

function ensureDeleteCompetitionModal() {
  if (document.querySelector("#delete-competition-modal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="delete-competition-modal" class="modal-backdrop" hidden>
        <section class="modal-panel confirm-panel" role="dialog" aria-modal="true" aria-labelledby="delete-competition-title">
          <div class="modal-head">
            <div>
              <h2 id="delete-competition-title">确认删除赛事</h2>
              <p>删除后该赛事及关联数据会从当前页面中移除。</p>
            </div>
            <button class="icon-button modal-close" type="button" data-close-delete-competition aria-label="关闭">×</button>
          </div>
          <div class="confirm-body">
            <span class="danger-icon">删</span>
            <div>
              <strong id="delete-competition-name">未选择赛事</strong>
              <p>关联组别、选手、评分、评委授权会一并清理。当前原型只会删除页面内存数据，刷新后会恢复。</p>
            </div>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-close-delete-competition>取消</button>
            <button class="primary danger-primary" type="button" data-confirm-delete-competition>确认删除</button>
          </div>
        </section>
      </div>
    `
  );
  document.querySelector("#create-competition-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    createCompetitionFromForm();
  });
}

function openDeleteCompetitionModal(competitionId) {
  const comp = competitions.get(Number(competitionId));
  if (!comp) return;
  state.pendingDeleteCompetitionId = Number(competitionId);
  ensureDeleteCompetitionModal();
  document.querySelector("#delete-competition-name").textContent = comp.comps_name || `ID ${comp.id}`;
  document.querySelector("#delete-competition-modal").hidden = false;
}

function closeDeleteCompetitionModal() {
  const modal = document.querySelector("#delete-competition-modal");
  if (modal) modal.hidden = true;
  state.pendingDeleteCompetitionId = null;
}

function confirmDeleteCompetition() {
  if (!state.pendingDeleteCompetitionId) return;
  const id = state.pendingDeleteCompetitionId;
  closeDeleteCompetitionModal();
  deleteCompetition(id);
}

function ensureCreateCompetitionModal() {
  if (document.querySelector("#create-competition-modal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="create-competition-modal" class="modal-backdrop" hidden>
        <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-competition-title">
          <div class="modal-head">
            <div>
              <h2 id="create-competition-title">新建赛事</h2>
              <p>填写赛事基础档案，创建后可继续进入赛事管理配置组别和评分。</p>
            </div>
            <button class="icon-button modal-close" type="button" data-close-create-competition aria-label="关闭">×</button>
          </div>
          <form id="create-competition-form" class="modal-form">
            <label class="form-field wide">
              <span>赛事名称</span>
              <input name="comps_name" type="text" placeholder="例如：AiwaRaks国际东方舞艺术节" required />
            </label>
            <label class="form-field">
              <span>主办方</span>
              <input name="uname" type="text" placeholder="未填写" />
            </label>
            <label class="form-field">
              <span>城市地点</span>
              <input name="citys" type="text" placeholder="例如：中国·杭州" />
            </label>
            <label class="form-field">
              <span>比赛时间</span>
              <input name="comps_time" type="datetime-local" />
            </label>
            <label class="form-field">
              <span>报名开始</span>
              <input name="startDate" type="date" />
            </label>
            <label class="form-field">
              <span>报名截止</span>
              <input name="endDate" type="date" />
            </label>
            <label class="form-field">
              <span>报名开关</span>
              <select name="signup">
                <option value="1">开启</option>
                <option value="0">关闭</option>
              </select>
            </label>
            <label class="form-field">
              <span>报名费</span>
              <input name="sign_price" type="number" min="0" step="1" placeholder="0" />
            </label>
            <label class="form-field">
              <span>联系电话</span>
              <input name="tel" type="tel" placeholder="手机号或微信" />
            </label>
            <label class="form-field wide">
              <span>赛事介绍</span>
              <textarea name="intro" rows="4" placeholder="可填写主办方、协办方、地址、咨询方式等"></textarea>
            </label>
            <p id="create-competition-error" class="form-error" hidden></p>
          </form>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-close-create-competition>取消</button>
            <button class="primary" type="button" data-confirm-create-competition>创建赛事</button>
          </div>
        </section>
      </div>
    `
  );
}

function openCreateCompetitionModal() {
  ensureCreateCompetitionModal();
  const modal = document.querySelector("#create-competition-modal");
  const form = document.querySelector("#create-competition-form");
  const error = document.querySelector("#create-competition-error");
  form?.reset();
  if (error) {
    error.hidden = true;
    error.textContent = "";
  }
  modal.hidden = false;
  form?.elements.comps_name?.focus();
}

function closeCreateCompetitionModal() {
  const modal = document.querySelector("#create-competition-modal");
  if (modal) modal.hidden = true;
}

function showCreateCompetitionError(message) {
  const error = document.querySelector("#create-competition-error");
  if (!error) return;
  error.textContent = message;
  error.hidden = !message;
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 16);
}

function createCompetitionFromForm() {
  const form = document.querySelector("#create-competition-form");
  if (!form) return;
  const formData = new FormData(form);
  const name = String(formData.get("comps_name") || "").trim();
  if (!name) {
    showCreateCompetitionError("请填写赛事名称");
    form.elements.comps_name?.focus();
    return;
  }

  const id = nextCompetitionId++;
  const newCompetition = {
    id,
    legacy_source: "manual_create",
    legacy_id: id,
    comps_name: name,
    startDate: String(formData.get("startDate") || ""),
    endDate: String(formData.get("endDate") || ""),
    sort: data.competitions.length + 1,
    signup: Number(formData.get("signup") || 0),
    comps_time: formatDateTimeLocal(formData.get("comps_time")),
    tel: String(formData.get("tel") || "").trim(),
    citys: String(formData.get("citys") || "").trim(),
    wxChannelId: null,
    vidLogo: null,
    vidQrcode: null,
    videoUrl: null,
    comps_posterPic: "",
    comps_defaultAvatar: null,
    intro: String(formData.get("intro") || "").trim(),
    sign_price: Number(formData.get("sign_price") || 0),
    create_by: "lilei",
    player_num: 0,
    member_visibility: 0,
    del: 0,
    end: 0,
    uname: String(formData.get("uname") || "").trim(),
    groupCount: 0,
    playerCount: 0,
    paidPlayerCount: 0,
    scoredPlayerCount: 0,
    judgeCount: 0,
    scoreRecordCount: 0,
  };

  data.competitions.unshift(newCompetition);
  competitions.set(id, newCompetition);
  state.competitionId = id;
  state.selectedCompetitionId = id;
  state.competitionTab = "info";
  closeCreateCompetitionModal();
  switchView("competitions");
  render();
  document.querySelector("#competition-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.openCompetitionManagement = openCompetitionManagement;
window.deleteCompetition = deleteCompetition;
window.openDeleteCompetitionModal = openDeleteCompetitionModal;
window.openCreateCompetitionModal = openCreateCompetitionModal;
window.showCompetitionList = showCompetitionList;

function renderCompetitionTab(comp, rows) {
  const tab = state.competitionTab;
  if (tab === "groups") return renderCompetitionGroups(comp, rows.compGroups);
  if (tab === "players") return renderCompetitionPlayers(comp, rows.compPlayers);
  if (tab === "scores") return renderCompetitionScores(comp, rows);
  return renderCompetitionInfo(comp, rows);
}

function renderCompetitionInfo(comp, rows) {
  const intro = escapeHtml(comp.intro || "暂无赛事介绍").replace(/\n/g, "<br>");
  return `
    <div class="workspace-grid">
      <article class="workspace-card">
        <h3>赛事档案</h3>
        <dl class="info-list">
          <div><dt>赛事名称</dt><dd>${fmt(comp.comps_name)}</dd></div>
          <div><dt>比赛时间</dt><dd>${fmt(comp.comps_time)}</dd></div>
          <div><dt>报名周期</dt><dd>${dateText(comp.startDate, comp.endDate)}</dd></div>
          <div><dt>城市地点</dt><dd>${fmt(comp.citys)}</dd></div>
          <div><dt>联系电话</dt><dd>${fmt(comp.tel)}</dd></div>
          <div><dt>报名费用</dt><dd>${fmt(comp.sign_price)}</dd></div>
        </dl>
      </article>
      <article class="workspace-card">
        <h3>现场待办</h3>
        <div class="todo-list">
          <div class="todo-item"><strong>未上传音乐</strong><span>${rows.missingMusic}</span></div>
          <div class="todo-item"><strong>待评分选手</strong><span>${Math.max(0, rows.compPlayers.length - rows.scoredPlayers.length)}</span></div>
          <div class="todo-item"><strong>待复核评分</strong><span>${rows.compScores.length}</span></div>
          <div class="todo-item"><strong>授权评委</strong><span>${rows.judgeIds.size}</span></div>
        </div>
      </article>
      <article class="workspace-card wide">
        <h3>赛事介绍</h3>
        <p class="event-intro">${intro}</p>
      </article>
    </div>
  `;
}

function renderCompetitionGroups(comp, compGroups) {
  return `
    <div class="section-title">
      <h2>组别管理</h2>
      <button class="secondary-button" type="button" data-open-group-import>批量导入组别</button>
    </div>
    <div class="table-wrap compact-table">
      <table>
        <thead><tr><th>组别</th><th>报名费</th><th>选手</th><th>评委</th><th>评分记录</th><th>状态</th></tr></thead>
        <tbody>
          ${compGroups.map((group) => {
            const players = playersByGroup.get(group.id) || [];
            const scoreCount = scoresByGroup.get(group.id) || 0;
            const judgeCount = (judgesByGroup.get(group.id) || new Set()).size;
            const status = group.end === 1 ? ["已结束", "good"] : scoreCount > 0 ? ["评分中", ""] : ["待开始", "warn"];
            return `
              <tr>
                <td><strong>${fmt(group.group_name || group.name)}</strong><small>ID ${group.id} / 排序 ${fmt(group.sort)}</small></td>
                <td>${fmt(group.cost)}</td>
                <td>${players.length}</td>
                <td>${judgeCount}</td>
                <td>${scoreCount}</td>
                <td><span class="badge ${status[1]}">${status[0]}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function parseGroupImport(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cells = line
        .split(/\t|,|，|\|/)
        .map((cell) => cell.trim())
        .filter(Boolean);
      const name = cells[0] || `未命名组别 ${index + 1}`;
      const cost = Number(cells[1]) || 0;
      const sort = Number(cells[2]) || index + 1;
      return { name, cost, sort };
    });
}

function ensureGroupImportModal() {
  if (document.querySelector("#group-import-modal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="group-import-modal" class="modal-backdrop" hidden>
        <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="group-import-title">
          <div class="modal-head">
            <div>
              <h2 id="group-import-title">批量导入组别</h2>
              <p>每行一个组别，支持：组别名称、报名费、排序。</p>
            </div>
            <button class="icon-button modal-close" type="button" data-close-group-import aria-label="关闭">×</button>
          </div>
          <textarea id="group-import-text" class="import-textarea" spellcheck="false">少儿东方舞组,500,1
青少年东方舞组,500,2
成人东方舞组,600,3</textarea>
          <div class="import-preview">
            <div class="section-title compact">
              <h3>导入预览</h3>
              <span id="group-import-count">0 条</span>
            </div>
            <div class="table-wrap compact-table import-preview-table">
              <table>
                <thead><tr><th>组别</th><th>报名费</th><th>排序</th></tr></thead>
                <tbody id="group-import-preview-rows"></tbody>
              </table>
            </div>
          </div>
          <div class="modal-actions">
            <button class="secondary-button" type="button" data-close-group-import>取消</button>
            <button class="primary" type="button" data-confirm-group-import>导入组别</button>
          </div>
        </section>
      </div>
    `
  );
  document.querySelector("#group-import-text").addEventListener("input", (event) => {
    state.groupImportText = event.target.value;
    renderGroupImportPreview();
  });
}

function openGroupImportModal() {
  ensureGroupImportModal();
  const modal = document.querySelector("#group-import-modal");
  const input = document.querySelector("#group-import-text");
  if (!state.groupImportText) state.groupImportText = input.value;
  input.value = state.groupImportText;
  modal.hidden = false;
  renderGroupImportPreview();
  input.focus();
}

function closeGroupImportModal() {
  const modal = document.querySelector("#group-import-modal");
  if (modal) modal.hidden = true;
}

function renderGroupImportPreview() {
  const rows = parseGroupImport(document.querySelector("#group-import-text")?.value || "");
  const count = document.querySelector("#group-import-count");
  const tbody = document.querySelector("#group-import-preview-rows");
  if (!count || !tbody) return;
  count.textContent = `${rows.length} 条`;
  tbody.innerHTML = rows
    .slice(0, 20)
    .map(
      (row) => `
        <tr>
          <td><strong>${fmt(row.name)}</strong></td>
          <td>${row.cost}</td>
          <td>${row.sort}</td>
        </tr>
      `
    )
    .join("");
}

function importGroupsToSelectedCompetition() {
  const comp = selectedCompetition();
  if (!comp) return;
  const input = document.querySelector("#group-import-text");
  const rows = parseGroupImport(input?.value || "");
  if (!rows.length) return;
  const existingGroups = groupsByCompetition.get(comp.id) || [];
  const baseSort = Math.max(0, ...existingGroups.map((group) => Number(group.sort) || 0));
  const imported = rows.map((row, index) => {
    const group = {
      id: nextGroupId++,
      comps_id: comp.id,
      group_name: row.name,
      cost: row.cost,
      sort: row.sort || baseSort + index + 1,
      end: 0,
      legacy_source: "manual_import",
    };
    data.groups.push(group);
    groups.set(group.id, group);
    return group;
  });
  groupsByCompetition.set(comp.id, [...existingGroups, ...imported].sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0)));
  comp.groupCount = (groupsByCompetition.get(comp.id) || []).length;
  state.groupImportText = "";
  closeGroupImportModal();
  renderCompetitionWorkspace();
  renderCompetitions();
  labelMobileTables();
}

function renderCompetitionPlayers(comp, compPlayers) {
  return `
    <div class="section-title">
      <h2>选手报名</h2>
      <button class="secondary-button" type="button">导出选手</button>
    </div>
    <div class="table-wrap compact-table">
      <table>
        <thead><tr><th>编号</th><th>选手/节目</th><th>组别</th><th>手机号</th><th>音乐</th><th>支付</th><th>成绩</th></tr></thead>
        <tbody>
          ${compPlayers.slice(0, 120).map((player) => {
            const group = groups.get(player.tid);
            return `
              <tr>
                <td>${fmt(player.signOrder || player.startOrder || player.id)}<small>${player.id}</small></td>
                <td><strong>${fmt(player.name || player.show_name)}</strong><small>${fmt(player.group_name || player.style)}</small></td>
                <td>${fmt(group?.group_name)}</td>
                <td>${fmt(player.mobile)}</td>
                <td><span class="badge ${player.mp3_file ? "good" : "warn"}">${player.mp3_file ? "已上传" : "待上传"}</span></td>
                <td><span class="badge ${player.isPaySuccess === 1 ? "good" : "warn"}">${player.isPaySuccess === 1 ? "已支付" : "未支付"}</span></td>
                <td>${fmt(player.score)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCompetitionScores(comp, rows) {
  const groupScores = rows.compGroups
    .map((group) => {
      const players = playersByGroup.get(group.id) || [];
      const scoreCount = scoresByGroup.get(group.id) || 0;
      const judgeCount = (judgesByGroup.get(group.id) || new Set()).size;
      const playerScoreCount = players.reduce((sum, player) => sum + (scoresByPlayer.get(player.id) || []).length, 0);
      return { group, players, scoreCount, judgeCount, playerScoreCount };
    })
    .sort((a, b) => b.scoreCount - a.scoreCount)
    .slice(0, 80);
  return `
    <div class="section-title">
      <h2>评分中枢</h2>
      <button class="secondary-button" type="button">发布成绩</button>
    </div>
    <div class="score-tools">
      <article><span>评分规则</span><strong>${data.scoreRules.length}</strong></article>
      <article><span>授权评委</span><strong>${rows.judgeIds.size}</strong></article>
      <article><span>原始评分</span><strong>${rows.compScores.length}</strong></article>
      <article><span>已评分选手</span><strong>${rows.scoredPlayers.length}</strong></article>
    </div>
    <div class="table-wrap compact-table">
      <table>
        <thead><tr><th>组别</th><th>选手</th><th>评委</th><th>评分记录</th><th>评分覆盖</th><th>状态</th></tr></thead>
        <tbody>
          ${groupScores.map(({ group, players, scoreCount, judgeCount, playerScoreCount }) => {
            const expected = Math.max(1, players.length * Math.max(1, judgeCount));
            const coverage = Math.min(100, Math.round((playerScoreCount / expected) * 100));
            const status = scoreCount === 0 ? ["未开始", "warn"] : coverage >= 80 ? ["可复核", "good"] : ["评分中", ""];
            return `
              <tr>
                <td><strong>${fmt(group.group_name || group.name)}</strong><small>ID ${group.id}</small></td>
                <td>${players.length}</td>
                <td>${judgeCount}</td>
                <td>${scoreCount}</td>
                <td><div class="progress"><span style="width:${coverage}%"></span></div><small>${coverage}%</small></td>
                <td><span class="badge ${status[1]}">${status[0]}</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDataFlow() {
  const rows = [
    ["旧后端 SQL", "保留赛事、组别、报名、评分、系统账号等核心表。"],
    ["小程序 mp-vote", "保留首页、报名、个人中心、评委打分、排行接口语义。"],
    ["产赛用户.xlsx", `${data.checks.excelUserRows} 条用户，按用户 ID 与 SQL 用户合并。`],
    ["评委数据.xlsx", `${data.checks.excelJudgeRows} 条评委，按手机号与 SQL 用户合并。`],
  ];
  document.querySelector("#data-flow").innerHTML = rows
    .map(([title, text]) => `<div class="flow-item"><strong>${title}</strong><span>${text}</span></div>`)
    .join("");
}

function renderDashboardPanels() {
  renderTodayEvents();
  renderSignupTrend();
  renderDonuts();
  renderTodos();
  renderLatestPlayers();
  renderNotices();
}

function renderTodayEvents() {
  const rows = [...data.competitions]
    .sort((a, b) => String(b.comps_time || b.startDate || "").localeCompare(String(a.comps_time || a.startDate || "")))
    .slice(0, 4);
  document.querySelector("#today-event-rows").innerHTML = rows
    .map((comp) => {
      const active = comp.signup === 1;
      return `
        <tr>
          <td><strong>${fmt(comp.comps_name)}</strong></td>
          <td>${escapeHtml(String(comp.comps_time || comp.startDate || "").slice(0, 16))}</td>
          <td>${fmt(comp.citys)}</td>
          <td><span class="badge ${active ? "good" : "warn"}">${active ? "进行中" : "未开始"}</span></td>
          <td><a href="#competitions" data-jump="competitions">进入管理</a></td>
        </tr>
      `;
    })
    .join("");
}

function renderSignupTrend() {
  const trend = buildTrend();
  const max = Math.max(...trend.map((item) => item.value), 1);
  const points = trend
    .map((item, index) => {
      const x = 20 + index * (560 / Math.max(trend.length - 1, 1));
      const y = 190 - (item.value / max) * 150;
      return `${x},${y}`;
    })
    .join(" ");
  const circles = trend
    .map((item, index) => {
      const x = 20 + index * (560 / Math.max(trend.length - 1, 1));
      const y = 190 - (item.value / max) * 150;
      return `<circle cx="${x}" cy="${y}" r="4"><title>${escapeHtml(item.label)}: ${escapeHtml(item.value)}</title></circle>`;
    })
    .join("");
  document.querySelector("#signup-trend").innerHTML = `
    <svg viewBox="0 0 600 210" preserveAspectRatio="none" aria-label="报名趋势">
      <polyline points="${points}" fill="none" stroke="#2f7df6" stroke-width="3" />
      <polygon points="${points} 580,190 20,190" fill="rgba(47,125,246,.12)" />
      <g fill="#2f7df6">${circles}</g>
    </svg>
    <div class="line-labels">${trend.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")}</div>
  `;
}

function buildTrend() {
  const counts = new Map();
  for (const player of data.players) {
    const key = String(player.sign_time || "").slice(5, 10);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);
  if (top.length >= 7) return top.map(([label, value]) => ({ label, value }));
  return ["05-08", "05-09", "05-10", "05-11", "05-12", "05-13", "05-14"].map((label, index) => ({
    label,
    value: [1250, 1680, 1410, 1760, 1600, 1520, 2010][index],
  }));
}

function renderDonuts() {
  const active = data.competitions.filter((comp) => comp.signup === 1).length;
  const closed = data.competitions.length - active;
  const scored = data.competitions.filter((comp) => comp.scoreRecordCount > 0).length;
  const pending = Math.max(0, data.competitions.length - active - scored);
  document.querySelector("#event-status-chart").innerHTML = donutHtml(`${data.competitions.length}\\n赛事总数`, [
    ["进行中", active, "var(--green)"],
    ["未开始", pending, "var(--accent-2)"],
    ["已结束", scored, "var(--purple)"],
    ["已取消", closed, "#f5a524"],
  ]);

  const paid = data.players.filter((player) => player.isPaySuccess === 1).length;
  const unpaid = data.players.length - paid;
  const scoredPlayers = data.players.filter((player) => Number(player.score || 0) > 0).length;
  document.querySelector("#signup-channel-chart").innerHTML = donutHtml(`${data.players.length}\\n报名总数`, [
    ["小程序", paid, "var(--accent-2)"],
    ["官网", unpaid, "var(--green)"],
    ["合作机构", scoredPlayers, "var(--purple)"],
    ["其他", data.checks.excelUsersOnly, "#f5a524"],
  ]);
}

function donutHtml(center, rows) {
  const total = rows.reduce((sum, row) => sum + Number(row[1] || 0), 0) || 1;
  let cursor = 0;
  const stops = rows
    .map(([_, value, color]) => {
      const start = cursor;
      cursor += (Number(value || 0) / total) * 100;
      return `${color} ${start}% ${cursor}%`;
    })
    .join(", ");
  return `
    <div class="donut" data-center="${center}" style="background: conic-gradient(${stops})"></div>
    <div class="legend">
      ${rows
        .map(([label, value, color]) => `<div class="legend-item"><span><i class="dot" style="background:${color}"></i>${label}</span><strong>${value}</strong></div>`)
        .join("")}
    </div>
  `;
}

function renderTodos() {
  const unpaid = data.players.filter((player) => player.isPaySuccess !== 1).length;
  const noMusic = data.players.filter((player) => !player.mp3_file).length;
  const unscored = data.players.filter((player) => !Number(player.score || 0)).length;
  const rows = [
    ["待审核的选手", Math.min(unpaid, 99)],
    ["待审核的音乐文件", Math.min(noMusic, 99)],
    ["待处理的退款申请", 12],
    ["待发布的成绩", Math.min(unscored, 99)],
    ["待发放的证书", Math.min(data.players.filter((player) => Number(player.score || 0) > 0).length, 99)],
  ];
  document.querySelector("#todo-list").innerHTML = rows
    .map(([label, value]) => `<div class="todo-item"><strong>${label}</strong><span>${value}</span></div>`)
    .join("");
}

function renderLatestPlayers() {
  document.querySelector("#latest-player-rows").innerHTML = [...data.players]
    .sort((a, b) => String(b.sign_time || "").localeCompare(String(a.sign_time || "")))
    .slice(0, 4)
    .map((player) => {
      const comp = competitions.get(player.cid);
      const group = groups.get(player.tid);
      return `
        <tr>
          <td><strong>${fmt(player.name)}</strong></td>
          <td>${fmt(comp?.comps_name)}</td>
          <td>${fmt(group?.group_name)}</td>
          <td>${escapeHtml(String(player.sign_time || "").slice(0, 16))}</td>
          <td><span class="badge ${player.isPaySuccess === 1 ? "good" : "warn"}">${player.isPaySuccess === 1 ? "已支付" : "待支付"}</span></td>
          <td><a href="#players" data-jump="players">查看详情</a></td>
        </tr>
      `;
    })
    .join("");
}

function renderNotices() {
  const rows = [
    ["重要", "AiwaRaks赛事管理平台迁移快照已生成", "今日"],
    ["通知", "评分系统升级维护计划已写入规划文档", "05-28"],
    ["活动", "现场评分闭环与大屏控制进入 MVP 范围", "05-28"],
    ["公告", "旧系统数据保留策略：原始凭证不覆盖不删除", "05-28"],
  ];
  document.querySelector("#notice-list").innerHTML = rows
    .map(([type, text, date]) => `<div class="notice-item"><strong><span class="notice-type">${type}</span>${text}</strong><span>${date}</span></div>`)
    .join("");
}

function renderCompetitions() {
  const competitionListWrap = document.querySelector("#competition-list-wrap");
  if (competitionListWrap) {
    competitionListWrap.hidden = !!state.selectedCompetitionId;
  }
  const competitionRows = document.querySelector("#competition-rows");
  if (!competitionRows) return;
  if (state.selectedCompetitionId) {
    competitionRows.innerHTML = "";
    return;
  }
  competitionRows.innerHTML = data.competitions
    .filter(matches)
    .map(
      (comp) => {
        const compId = Number(comp.id) || 0;
        return `
        <tr class="competition-row ${Number(state.selectedCompetitionId) === compId ? "selected" : ""}" data-competition-id="${compId}" tabindex="0">
          <td><strong>${fmt(comp.comps_name)}</strong><small>ID ${fmt(comp.id)} / 主办 ${fmt(comp.uname || comp.comps_sysuser_id)}</small></td>
          <td>${dateText(comp.startDate, comp.endDate)}<small>比赛 ${fmt(comp.comps_time)}</small></td>
          <td><span class="badge ${comp.signup === 1 ? "good" : "warn"}">${comp.signup === 1 ? "开启" : "关闭"}</span></td>
          <td>${comp.groupCount}</td>
          <td>${comp.playerCount}<small>${comp.paidPlayerCount} 已支付</small></td>
          <td>${comp.judgeCount}</td>
          <td>${comp.scoreRecordCount}</td>
          <td>
            <div class="row-actions">
              <button class="text-button" type="button" data-manage-competition="${compId}" onclick="openCompetitionManagement(${compId})">管理</button>
              <button class="text-button danger" type="button" data-delete-competition="${compId}" onclick="openDeleteCompetitionModal(${compId})">删除</button>
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join("");
}

function renderPlayers() {
  document.querySelector("#player-rows").innerHTML = data.players
    .filter((player) => !hasTestPlayerName(player) && !hasTestGroupName(groups.get(player.tid)))
    .filter(matches)
    .slice(0, 500)
    .map((player) => {
      const comp = competitions.get(player.cid);
      const group = groups.get(player.tid);
      return `
        <tr>
          <td>${fmt(player.signOrder || player.startOrder || player.id)}<small>${player.id}</small></td>
          <td><strong>${fmt(player.name)}</strong><small>${fmt(player.show_name)}</small></td>
          <td>${fmt(comp?.comps_name)}</td>
          <td>${fmt(group?.group_name)}</td>
          <td>${fmt(player.group_name)}<small>${fmt(player.zhidao || player.bianwu)}</small></td>
          <td><span class="badge ${player.isPaySuccess === 1 ? "good" : "warn"}">${player.isPaySuccess === 1 ? "已支付" : "未支付"}</span></td>
          <td>${fmt(player.score)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMusic() {
  const cleanMusicPlayers = data.players.filter((player) => !hasTestPlayerName(player) && !hasTestGroupName(groups.get(player.tid)));
  const rows = cleanMusicPlayers.filter(matches).slice(0, 500);
  const uploaded = cleanMusicPlayers.filter((player) => !!player.mp3_file).length;
  const missing = cleanMusicPlayers.length - uploaded;
  const withDuration = cleanMusicPlayers.filter((player) => !!player.mp3Time).length;
  document.querySelector("#music-summary").innerHTML = [
    ["已上传", uploaded],
    ["未上传", missing],
    ["有时长", withDuration],
  ].map(([label, value]) => `<span class="badge">${label} ${value}</span>`).join("");
  document.querySelector("#music-rows").innerHTML = rows.map((player) => {
    const comp = competitions.get(player.cid);
    const group = groups.get(player.tid);
    const uploadedFile = !!player.mp3_file;
    const status = uploadedFile && player.mp3Time ? ["可通过", "good"] : uploadedFile ? ["待补时长", "warn"] : ["待上传", "warn"];
    return `
      <tr>
        <td><strong>${fmt(player.name)}</strong><small>${fmt(player.show_name)}</small></td>
        <td>${fmt(comp?.comps_name)}</td>
        <td>${fmt(group?.group_name)}</td>
        <td>${fmt(player.mp3FileName || (uploadedFile ? "已上传文件" : "未上传"))}</td>
        <td>${fmt(player.mp3Time)}</td>
        <td><span class="badge ${status[1]}">${status[0]}</span></td>
      </tr>
    `;
  }).join("");
}

function renderJudges() {
  document.querySelector("#judge-rows").innerHTML = data.judges
    .filter(matches)
    .map((judge) => {
      const comps = Array.from(judgeCompMap.get(judge.id) || []);
      return `
        <tr>
          <td><strong>${fmt(judge.nickname)}</strong><small>ID ${fmt(judge.id)}</small></td>
          <td>${fmt(judge.tel)}</td>
          <td><span class="badge">${fmt(judge.source)}</span></td>
          <td>${comps.length}<small>${comps.map((id) => competitions.get(id)?.comps_name).filter(Boolean).slice(0, 2).map(escapeHtml).join(" / ")}</small></td>
          <td>${scoreByJudge.get(judge.id) || 0}</td>
          <td>${judge.user_state === 0 ? "冻结" : "正常/未知"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCertFinance() {
  const paidPlayers = data.players.filter((player) => player.isPaySuccess === 1);
  const signupRevenue = paidPlayers.reduce((sum, player) => sum + Number(player.cost || 0), 0);
  const scoreRevenue = data.players.reduce((sum, player) => sum + Number(player.costScore || 0), 0);
  const scored = data.players.filter((player) => Number(player.score || 0) > 0);
  const organizations = new Set(data.players.map((player) => player.group_name).filter(Boolean));
  document.querySelector("#certfinance-metrics").innerHTML = [
    ["收入", money(signupRevenue + scoreRevenue), `报名 ${money(signupRevenue)} / 查分 ${money(scoreRevenue)}`],
    ["证书候选", scored.length, "按成绩结果生成"],
    ["已支付报名", paidPlayers.length, "进入统一订单中心"],
    ["机构/老师", organizations.size, "复盘统计维度"],
  ].map(([label, value, note]) => `<article class="metric"><div class="metric-icon">证</div><div><span>${label}</span><strong>${value}</strong><em>${note}</em></div></article>`).join("");
  document.querySelector("#certificate-rows").innerHTML = scored.slice(0, 8).map((player) => {
    const comp = competitions.get(player.cid);
    const group = groups.get(player.tid);
    return `
      <tr>
        <td><strong>${fmt(player.name)}</strong><small>${fmt(player.show_name)}</small></td>
        <td>${fmt(comp?.comps_name)}</td>
        <td>${fmt(group?.group_name)}</td>
        <td>${Number(player.score || 0).toFixed(2)}</td>
        <td><span class="badge warn">待生成</span></td>
      </tr>
    `;
  }).join("");
  document.querySelector("#finance-breakdown").innerHTML = [
    ["报名订单收入", money(signupRevenue)],
    ["成绩查看收入", money(scoreRevenue)],
    ["待对账记录", data.players.filter((player) => player.isPaySuccess !== 1 && Number(player.cost || 0) > 0).length],
    ["证书发放记录", "待建 event_certificates"],
  ].map(([label, value]) => `<div class="todo-item"><strong>${label}</strong><span>${value}</span></div>`).join("");
}

function renderScoring() {
  const scoredPlayers = data.players.filter((p) => Number(p.score || 0) > 0).length;
  const groupsWithScores = new Set(data.scores.map((score) => score.group_id)).size;
  const groupsWithoutScores = data.groups.length - groupsWithScores;
  const judgesWithScores = new Set(data.scores.map((score) => score.judges_id)).size;
  document.querySelector("#score-summary").innerHTML = [
    ["评分规则", data.scoreRules.length],
    ["原始评分", data.scores.length],
    ["已评分选手", scoredPlayers],
    ["已评分评委", judgesWithScores],
  ]
    .map(([label, value]) => `<span class="badge">${label} ${value}</span>`)
    .join("");

  const controlCards = [
    ["评委授权开关", data.groupJudges.length, "按赛事/组别/评委授权，后续可做启停与有效期。"],
    ["组别评分锁定", groupsWithScores, `${groupsWithoutScores} 个组别暂无评分，需要现场状态区分。`],
    ["漏评分提醒", data.players.length - scoredPlayers, "根据选手、评委、评分项矩阵计算漏评。"],
    ["异常分预警", "待建", "对偏离均值、极端分、重复提交做复核提示。"],
    ["复核后发布", data.competitions.length, "原始分、计算分、发布分三层留痕。"],
    ["重算记录", "待建", "每次去最高最低分、权重变化、重新发布都写日志。"],
  ];
  document.querySelector("#scoring-controls").innerHTML = controlCards
    .map(([label, value, note]) => `<article class="control-card"><span>${label}</span><strong>${value}</strong><p>${note}</p></article>`)
    .join("");

  document.querySelector("#scoring-rows").innerHTML = data.groups
    .filter(matches)
    .slice(0, 500)
    .map((group) => {
      const players = playersByGroup.get(group.id) || [];
      const scoreCount = scoresByGroup.get(group.id) || 0;
      const judgeCount = (judgesByGroup.get(group.id) || new Set()).size;
      const scored = players.filter((player) => Number(player.score || 0) > 0).length;
      const status = scoreCount === 0 ? ["未开始", "warn"] : scored >= players.length && players.length > 0 ? ["可复核", "good"] : ["进行中", ""];
      return `
        <tr>
          <td>${fmt(competitions.get(group.comps_id)?.comps_name)}</td>
          <td><strong>${fmt(group.group_name)}</strong><small>ID ${group.id} / 排序 ${fmt(group.sort)}</small></td>
          <td>${players.length}<small>${scored} 已有总分</small></td>
          <td>${judgeCount}</td>
          <td>${scoreCount}</td>
          <td><span class="badge ${status[1]}">${status[0]}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderRoadmap() {
  const layers = [
    {
      title: "平台公共层",
      text: "统一平台承接账号、会员、订单、支付、文件、证书、消息、权限、操作日志，避免赛事系统重复造公共能力。",
      tags: ["账号", "会员", "订单", "支付", "文件", "证书", "消息", "权限", "操作日志"],
    },
    {
      title: "赛事业务层",
      text: "赛事保持独立业务域，专注现场比赛能力和业务状态机，核心数据进入 event_* 表域。",
      tags: ["赛事", "组别", "报名", "选手", "节目", "音乐", "评委", "评分", "排名", "奖项", "大屏"],
    },
    {
      title: "运营增长层",
      text: "赛事不是终点，选手、机构、老师和成绩数据继续沉淀到课程、会员、电商、训练营和复训营。",
      tags: ["课程推荐", "会员转化", "二次销售", "赛事复盘", "学员画像", "机构资源库", "老师资源库"],
    },
  ];
  document.querySelector("#architecture-layers").innerHTML = layers
    .map(
      (layer) => `
        <article class="layer-card">
          <h3>${layer.title}</h3>
          <p>${layer.text}</p>
          <div class="layer-tags">${layer.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
        </article>
      `
    )
    .join("");

  const lifeline = [
    ["评委授权开关", "控制评委只进入授权赛事与组别，支持启停、有效期和组长权限。"],
    ["组别评分锁定", "评分中、待复核、已锁定、已发布、已归档状态清晰可控。"],
    ["单个选手评分状态", "每位选手展示未评分、部分评分、评分完成和异常状态。"],
    ["漏评分提醒", "按选手、评委、评分项矩阵检测漏评并提示计分组。"],
    ["异常分预警", "识别极端分、偏离均值、重复提交和越权评分。"],
    ["去最高最低分", "支持去最高分、去最低分、权重、小数位和并列规则。"],
    ["复核后发布", "原始分、计算分、发布分三层分离，复核后再进入榜单。"],
    ["发布后留痕", "发布、撤回、重算、调整都进入日志，成绩不可无痕修改。"],
  ];
  document.querySelector("#scoring-lifeline").innerHTML = lifeline
    .map(([title, text]) => `<article class="lifeline-card"><h3>${title}</h3><p>${text}</p></article>`)
    .join("");

  const phases = [
    ["第一阶段", "历史数据迁移 + 只读后台", "先能查旧赛事、旧选手、旧评委、旧成绩。"],
    ["第二阶段", "新赛事后台 MVP", "赛事、组别、报名、选手、音乐、评委、评分规则。"],
    ["第三阶段", "现场评分闭环", "评委端、主控台、大屏、成绩计算、排名发布。"],
    ["第四阶段", "小程序报名端升级", "报名、支付、音乐上传、成绩查询、证书领取。"],
    ["第五阶段", "证书 + 财务 + 数据看板", "自动证书、收入统计、报名统计、机构统计、老师统计。"],
    ["第六阶段", "商业化增长", "赛事选手转课程、会员、电商、训练营、复训营。"],
  ];
  document.querySelector("#phase-roadmap").innerHTML = phases
    .map(([step, title, text]) => `<article class="phase-card"><span>${step}</span><h3>${title}</h3><p>${text}</p></article>`)
    .join("");
}

function countDuplicates(values) {
  const seen = new Set();
  const dup = new Set();
  values.forEach((value) => {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  });
  return dup.size;
}

function labelMobileTables() {
  document.querySelectorAll(".table-wrap table").forEach((table) => {
    const labels = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        cell.setAttribute("data-label", labels[index] || "");
      });
    });
  });
}

function switchView(view) {
  if (!document.querySelector(`#${view}`)) {
    view = "dashboard";
  }
  state.view = view;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === view));
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: ["总览", "AiwaRaks赛事、学员、课程、会员与商业转化的一体化运营中枢。"],
    competitions: state.selectedCompetitionId ? ["赛事管理", "赛事档案、报名开关、组别、选手和评分记录。"] : ["赛事", "点击赛事进入赛事管理，查看档案、报名开关、组别、选手和评分记录。"],
    players: ["报名记录", "最多显示 500 条，可用搜索精确定位。"],
    music: ["音乐审核", "参赛音乐上传、时长核对、文件审核和现场风险提示。"],
    scoring: ["评分记录", "评委授权、评分锁定、漏评提醒、异常预警、复核发布。"],
    judges: ["评委", "SQL 评委与 Excel 评委按手机号合并去重。"],
    certfinance: ["证书财务", "证书发放、报名收入、查分收入、机构老师统计。"],
    roadmap: ["路线图", "产品定位、三层架构、评分生命线和六阶段开发路线。"],
  };
  document.querySelector("#view-title").textContent = titles[view][0];
  document.querySelector("#view-subtitle").textContent = titles[view][1];
  if (location.hash.slice(1) !== view) {
    history.replaceState(null, "", `#${view}`);
  }
  render();
}

function bindDashboardLinks() {
}

function setupResponsiveChrome() {
  const menuButton = document.querySelector('.topbar .icon-button[aria-label="菜单"]');
  const mobileQuery = window.matchMedia("(max-width: 720px)");
  let userToggledMenu = false;

  function syncMenuState() {
    if (!mobileQuery.matches) {
      document.body.classList.remove("nav-collapsed");
      menuButton?.setAttribute("aria-expanded", "true");
      userToggledMenu = false;
      return;
    }
    if (!userToggledMenu) {
      document.body.classList.add("nav-collapsed");
      menuButton?.setAttribute("aria-expanded", "false");
    }
  }

  menuButton?.addEventListener("click", () => {
    if (!mobileQuery.matches) return;
    userToggledMenu = true;
    const collapsed = document.body.classList.toggle("nav-collapsed");
    menuButton.setAttribute("aria-expanded", String(!collapsed));
  });

  document.addEventListener("touchstart", () => {}, { passive: true, once: true });
  mobileQuery.addEventListener?.("change", syncMenuState);
  syncMenuState();
}

function render() {
  renderMetrics();
  renderCompetitionSelect();
  renderDashboardPanels();
  renderCompetitionWorkspace();
  renderCompetitions();
  renderPlayers();
  renderMusic();
  renderJudges();
  renderCertFinance();
  renderScoring();
  renderRoadmap();
  labelMobileTables();
  bindDashboardLinks();
}

setupResponsiveChrome();

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.body.classList.add("nav-collapsed");
    if (button.dataset.view === "competitions") {
      showCompetitionList();
      return;
    }
    switchView(button.dataset.view);
  });
});

document.addEventListener("click", (event) => {
  const jumpTarget = event.target.closest("[data-jump]");
  const returnCompetitionList = event.target.closest("[data-return-competition-list]");
  const tabTarget = event.target.closest("[data-competition-tab]");
  const competitionRow = event.target.closest("[data-competition-id]");
  const manageCompetition = event.target.closest("[data-manage-competition]");
  const deleteCompetitionButton = event.target.closest("[data-delete-competition]");
  const openGroupImport = event.target.closest("[data-open-group-import]");
  const closeGroupImport = event.target.closest("[data-close-group-import]");
  const confirmGroupImport = event.target.closest("[data-confirm-group-import]");
  const closeDeleteCompetition = event.target.closest("[data-close-delete-competition]");
  const confirmDeleteCompetitionButton = event.target.closest("[data-confirm-delete-competition]");
  const openCreateCompetition = event.target.closest("[data-open-create-competition]");
  const closeCreateCompetition = event.target.closest("[data-close-create-competition]");
  const confirmCreateCompetition = event.target.closest("[data-confirm-create-competition]");
  if (openCreateCompetition) {
    openCreateCompetitionModal();
    return;
  }
  if (closeCreateCompetition) {
    closeCreateCompetitionModal();
    return;
  }
  if (confirmCreateCompetition) {
    createCompetitionFromForm();
    return;
  }
  if (openGroupImport) {
    openGroupImportModal();
    return;
  }
  if (closeGroupImport) {
    closeGroupImportModal();
    return;
  }
  if (confirmGroupImport) {
    importGroupsToSelectedCompetition();
    return;
  }
  if (closeDeleteCompetition) {
    closeDeleteCompetitionModal();
    return;
  }
  if (confirmDeleteCompetitionButton) {
    confirmDeleteCompetition();
    return;
  }
  if (returnCompetitionList) {
    event.preventDefault();
    showCompetitionList();
    document.querySelector("#competitions")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (manageCompetition) {
    openCompetitionManagement(manageCompetition.dataset.manageCompetition);
    return;
  }
  if (deleteCompetitionButton) {
    openDeleteCompetitionModal(deleteCompetitionButton.dataset.deleteCompetition);
    return;
  }
  if (jumpTarget) {
    event.preventDefault();
    if (jumpTarget.dataset.jump === "competitions") {
      showCompetitionList();
      return;
    }
    switchView(jumpTarget.dataset.jump);
    return;
  }
  if (tabTarget) {
    state.competitionTab = tabTarget.dataset.competitionTab;
    renderCompetitionWorkspace();
    labelMobileTables();
    return;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const competitionRow = event.target.closest("[data-competition-id]");
  if (!competitionRow) return;
  event.preventDefault();
  openCompetitionManagement(competitionRow.dataset.competitionId);
});

document.querySelector("#competition-filter").addEventListener("change", (event) => {
  state.competitionId = Number(event.target.value);
  renderSignupTrend();
});

document.querySelector("#search-input").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

document.querySelector("#export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(legacy, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `legacy-competition-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

switchView(location.hash.slice(1) || "dashboard");
