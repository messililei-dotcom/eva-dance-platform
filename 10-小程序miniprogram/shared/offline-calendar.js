const { contentText } = require('./review-text');
const DAY = 86400000;
function dateValue(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const time = Date.parse(text + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text ? time : null;
}
function color(row) {
  const type = String(row.category || row.type || '');
  if (/集训|bootcamp/.test(type)) return 'rose';
  if (/传承|masterclass/.test(type)) return 'green';
  if (/认证|certification/.test(type)) return 'blue';
  return 'gold';
}
function buildCalendar(rows, year, month) {
  const first = Date.UTC(year, month - 1, 1), end = Date.UTC(year, month, 0);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - offset * DAY;
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const items = (rows || []).map((row, index) => ({ row, index, start: dateValue(row.start_date), end: dateValue(row.end_date || row.start_date) }))
    .filter(item => item.start !== null && item.end !== null && item.end >= item.start)
    .sort((a,b) => a.start-b.start || b.end-a.end || a.index-b.index);
  const weeks = [];
  for (let week=0; week<Math.ceil((offset + new Date(end).getUTCDate())/7);week++) {
    const weekStart = start + week * 7 * DAY, weekEnd = weekStart + 6 * DAY, lanes=[];
    const segments=items.filter(item=>item.start<=weekEnd && item.end>=weekStart).map(item=>{
      const left=Math.max(0,Math.round((item.start-weekStart)/DAY)),right=Math.min(6,Math.round((item.end-weekStart)/DAY));
      let lane=lanes.findIndex(until=>until<left);if(lane<0)lane=lanes.length;lanes[lane]=right;
      return { key:item.index, id:item.row.id, name:contentText(item.row.name, '线下活动'), label:`${contentText(item.row.name, '线下活动')}，${item.row.start_date}至${item.row.end_date || item.row.start_date}`, tone:color(item.row), left:left/7*100, width:(right-left+1)/7*100, top:44+lane*36 };
    });
    weeks.push({key:week,height:Math.max(116,52+lanes.length*36),segments,days:Array.from({length:7},(_,i)=>{const date=new Date(weekStart+i*DAY);return {key:date.toISOString().slice(0,10),day:date.getUTCDate(),outside:date.getUTCMonth()!==month-1,today:date.toISOString().slice(0,10)===today};})});
  }
  return {calendarYear:year,calendarMonth:month,calendarTitle:`${year}年${month}月`,calendarCount:items.filter(item=>item.start<=end && item.end>=first).length,calendarWeeks:weeks};
}
function swipeMonth(dx,dy) { return Math.abs(dx)>=48 && Math.abs(dx)>Math.abs(dy)*1.5 ? (dx<0 ? 1 : -1) : 0; }
module.exports={buildCalendar,swipeMonth};
