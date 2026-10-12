function score(value) { return value === null || value === undefined || value === '' ? '—' : Number(value).toFixed(3).replace(/\.?0+$/, ''); }
function player(row, index = 0) {
  const rankNo = Number(row.rankNo || 0);
  return { ...row, rankNo, displayNo: row.playerNo || String(index + 1).padStart(3, '0'), displayInitial: String(row.name || row.playerName || '选').slice(0, 1), rankClass: rankNo === 1 ? 'gold' : rankNo === 2 ? 'silver' : rankNo === 3 ? 'bronze' : 'normal', rankLabel: ['','冠军','亚军','季军'][rankNo] || (rankNo ? `第${rankNo}名` : '未公布'), scoreText: score(row.publishedTotal), identityText: [row.playerNo ? `编号 ${row.playerNo}` : '',row.organization,row.teacher ? `指导老师 ${row.teacher}` : ''].filter(Boolean).join(' · ') };
}
function registrationOpen(row) { return row.registrationStatus === 'open' && (!row.registrationStart || Date.parse(row.registrationStart) <= Date.now()) && (!row.registrationEnd || Date.parse(row.registrationEnd) >= Date.now()); }
function page(rows, current, size = 20) { const pages = Math.max(1, Math.ceil(rows.length / size));const number = Math.max(1,Math.min(pages,Number(current)||1));return { rows:rows.slice((number-1)*size,number*size),number,pages,total:rows.length }; }
module.exports={score,player,registrationOpen,page};
