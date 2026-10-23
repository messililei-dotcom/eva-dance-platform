const fs = require('fs');
const path = require('path');

const DEFAULT_LEGACY_PATH = path.resolve(
  process.cwd(),
  '../..',
  '10-赛事系统/新赛事系统/public/legacy-data.js'
);

const LEGACY_DATA_PATH = process.env.LEGACY_DATA_PATH || DEFAULT_LEGACY_PATH;
const OUTPUT_PATH = path.resolve(process.cwd(), 'public/data/events-news.json');

const INVALID_NAME_RE = /(备份|测试|111|册数|大大大塞|比赛比是|3333)/;

const CITY_MAP = {
  '430100': '湖南长沙',
  '440300': '广东深圳',
  '410300': '河南洛阳',
};

function readLegacyData(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const json = source
    .replace(/^\s*window\.LEGACY_DATA\s*=\s*/, '')
    .replace(/;\s*$/, '');
  return JSON.parse(json);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
}

function extractDateFromText(text) {
  if (!text) return null;
  return normalizeDate(text);
}

function getEventDate(comp) {
  return (
    normalizeDate(comp.startDate) ||
    extractDateFromText(comp.intro) ||
    normalizeDate(comp.comps_time) ||
    `${getEventYear(comp)}-01-01`
  );
}

function getEventYear(comp) {
  const sources = [comp.startDate, comp.endDate, comp.comps_time, comp.comps_name, comp.intro];
  for (const source of sources) {
    const match = String(source || '').match(/20\d{2}/);
    if (match) return match[0];
  }
  return '2024';
}

function getDateRange(comp) {
  const start = normalizeDate(comp.startDate) || extractDateFromText(comp.intro) || normalizeDate(comp.comps_time);
  const end = normalizeDate(comp.endDate);
  if (start && end && start !== end) return `${start} 至 ${end}`;
  if (start) return start;
  return `${getEventYear(comp)}年`;
}

function getLocation(comp) {
  const city = String(comp.citys || '').trim();
  if (city) return CITY_MAP[city] || city;

  const intro = String(comp.intro || '');
  const addressMatch = intro.match(/(?:地址|地点)[:：]\s*([^\n]+)/);
  if (addressMatch) return addressMatch[1].trim();

  if (comp.comps_name.includes('长沙')) return '湖南长沙';
  if (comp.comps_name.includes('洛阳')) return '河南洛阳';
  if (comp.comps_name.includes('佛山')) return '广东佛山';
  if (comp.comps_name.includes('百色')) return '广西百色';
  if (comp.comps_name.includes('福清')) return '福建福清';
  return '赛事现场';
}

function dataWeight(comp) {
  return (
    Number(comp.scoreRecordCount || 0) * 4 +
    Number(comp.playerCount || comp.player_num || 0) * 2 +
    Number(comp.groupCount || 0) +
    Number(comp.judgeCount || 0)
  );
}

function normalizeNameForDedupe(name) {
  return String(name || '')
    .replace(/\s+/g, '')
    .replace(/[（(]?备份[）)]?/g, '')
    .replace(/^中国[·-]?/, '中国')
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeSlug(comp) {
  return `event-${getEventYear(comp)}-${comp.id}`;
}

function playerName(player) {
  return (
    player.player_name ||
    player.name ||
    player.show_name ||
    player.nickname ||
    '未命名选手'
  );
}

function playerScore(player) {
  const value = player.final_score ?? player.score;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function buildIndexes(normalized) {
  const groupsByComp = new Map();
  const playersByGroup = new Map();
  const scoresByComp = new Map();
  const judgesByComp = new Map();

  for (const group of normalized.groups || []) {
    const compId = group.competition_id ?? group.comps_id;
    if (!groupsByComp.has(compId)) groupsByComp.set(compId, []);
    groupsByComp.get(compId).push(group);
  }

  for (const player of normalized.players || []) {
    const groupId = player.group_id ?? player.tid;
    if (!playersByGroup.has(groupId)) playersByGroup.set(groupId, []);
    playersByGroup.get(groupId).push(player);
  }

  for (const score of normalized.scores || []) {
    const compId = score.competition_id ?? score.comps_id;
    scoresByComp.set(compId, (scoresByComp.get(compId) || 0) + 1);
    if (score.judges_id != null) {
      if (!judgesByComp.has(compId)) judgesByComp.set(compId, new Set());
      judgesByComp.get(compId).add(score.judges_id);
    }
  }

  return { groupsByComp, playersByGroup, scoresByComp, judgesByComp };
}

function getChampions(comp, groups, playersByGroup) {
  return groups
    .map((group) => {
      const groupPlayers = (playersByGroup.get(group.id) || [])
        .filter((player) => player.del !== 1)
        .map((player) => ({ player, score: playerScore(player) }))
        .filter((entry) => entry.score != null)
        .sort((a, b) => b.score - a.score);

      const winner = groupPlayers[0];
      if (!winner) return null;

      return {
        groupName: group.name || group.group_name || '未命名组别',
        winner: playerName(winner.player),
        score: Number(winner.score.toFixed(3)),
      };
    })
    .filter(Boolean);
}

function makeSummary(comp, stats, location, dateRange) {
  return `${comp.comps_name}于${dateRange}在${location}举行，赛事设置${stats.groups}个组别，汇聚${stats.players}位参赛选手，累计形成${stats.scores}条评分记录，呈现专业、热烈而有序的东方舞赛事现场。`;
}

function makeContent(comp, stats, champions, location, dateRange) {
  const title = escapeHtml(comp.comps_name);
  const safeLocation = escapeHtml(location);
  const safeDateRange = escapeHtml(dateRange);
  const championRows = champions.slice(0, 30).map((item) => (
    `<li><strong>${escapeHtml(item.groupName)}</strong>：${escapeHtml(item.winner)}</li>`
  )).join('');
  const moreText = champions.length > 30
    ? `<p>更多组别冠军名单详见页面下方完整榜单。</p>`
    : '';

  return [
    `<p>${title}于${safeDateRange}在${safeLocation}举行。来自不同地区的东方舞爱好者、专业舞者与赛事评审齐聚现场，以舞台表现、音乐理解和技术完成度共同呈现了一场兼具专业性与观赏性的赛事。</p>`,
    `<p>本届赛事围绕不同年龄、风格和表演形式设置了${stats.groups}个组别，共有${stats.players}位选手完成报名与登台展示。赛事过程中，评委团队累计完成${stats.scores}条评分记录，以清晰的评分维度保障比赛流程公开、稳定、有序。</p>`,
    `<p>从个人独舞到团体作品，从传统东方舞语汇到融合编创表达，选手们在舞台上展现了扎实的基本功、细腻的音乐处理和鲜明的个人风格。现场的每一次亮相，既是对日常训练成果的检验，也是东方舞艺术在城市舞台上的集中呈现。</p>`,
    champions.length
      ? `<h2>冠军名单</h2><ul>${championRows}</ul>${moreText}`
      : `<h2>成绩回顾</h2><p>赛事成绩数据已完成归档，页面下方同步展示本场赛事的核心统计信息。</p>`,
    `<p>${title}不仅记录了一场比赛的完成，也见证了东方舞学习者从课堂走向舞台的成长路径。未来，AiwaRaks赛事平台将继续沉淀赛事数据、传播优秀作品，并为更多舞者提供专业展示与交流的机会。</p>`,
  ].join('\n');
}

function generateNews(data) {
  const normalized = data.normalized || {};
  const { groupsByComp, playersByGroup, scoresByComp, judgesByComp } = buildIndexes(normalized);

  const validCompetitions = (normalized.competitions || [])
    .filter((comp) => comp && comp.comps_name)
    .filter((comp) => !INVALID_NAME_RE.test(comp.comps_name))
    .filter((comp) => Number(comp.playerCount || comp.player_num || 0) > 0);

  const deduped = new Map();
  for (const comp of validCompetitions) {
    const key = `${normalizeNameForDedupe(comp.comps_name)}-${getEventYear(comp)}`;
    const existing = deduped.get(key);
    if (!existing || dataWeight(comp) > dataWeight(existing)) {
      deduped.set(key, comp);
    }
  }

  return Array.from(deduped.values())
    .map((comp) => {
      const groups = (groupsByComp.get(comp.id) || []).filter((group) => group.del !== 1);
      const location = getLocation(comp);
      const dateRange = getDateRange(comp);
      const stats = {
        groups: Number(comp.groupCount || groups.length || 0),
        players: Number(comp.playerCount || comp.player_num || 0),
        scores: Number(comp.scoreRecordCount || scoresByComp.get(comp.id) || 0),
        judges: Number(comp.judgeCount || judgesByComp.get(comp.id)?.size || 0),
      };
      const champions = getChampions(comp, groups, playersByGroup);

      return {
        id: makeSlug(comp),
        slug: makeSlug(comp),
        title: comp.comps_name,
        date: getEventDate(comp),
        dateRange,
        location,
        coverImage: comp.comps_posterPic || comp.videoCover || comp.vidLogo || comp.comps_defaultAvatar || null,
        summary: makeSummary(comp, stats, location, dateRange),
        content: makeContent(comp, stats, champions, location, dateRange),
        stats,
        champions,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.stats.players - a.stats.players);
}

function main() {
  if (!fs.existsSync(LEGACY_DATA_PATH)) {
    throw new Error(`legacy-data.js not found: ${LEGACY_DATA_PATH}`);
  }

  const data = readLegacyData(LEGACY_DATA_PATH);
  const news = generateNews(data);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(news, null, 2)}\n`, 'utf8');

  console.log(`Generated ${news.length} event news items`);
  console.log(`Source: ${LEGACY_DATA_PATH}`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main();
}

module.exports = { generateNews };
