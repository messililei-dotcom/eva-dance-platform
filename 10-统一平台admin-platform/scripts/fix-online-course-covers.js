const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'admin.db');
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backup = `/tmp/admin-db-before-course-cover-fix-${stamp}.db`;
fs.copyFileSync(dbPath, backup);

const websiteRoot = '/www/wwwroot/dongfangwuquan/website/public/images/courses/online';
const targetRoot = path.join(process.cwd(), 'public', 'uploads', 'online-course', 'series-covers');
fs.mkdirSync(targetRoot, { recursive: true });

const mapping = {
  1: '舞蹈运动呼吸学伊娃东方舞SWOD系统.jpg',
  3: 'S曲线舞感秘笈胸腰训练SWOD系统国际训练营.jpg',
  4: '东方舞技巧大全-主图.jpg',
  5: '云弟子班东方舞技巧大全全课包伊娃东方舞SWOD系统.jpg',
  6: '全力出肌舞蹈核心风暴能量储备充电站身体能力开发.jpg',
  7: '旋转训练黄金陀螺建基强核SWOD系统国际训练营.jpg',
  8: '疯狂西米全维度解锁锻造营SWOD系统国际训练营.jpg',
  10: '7+1-主图.jpg',
  12: '全名师东方舞零基础入门课.jpg',
  14: '甩发专攻伊娃东方舞SWOD系统.jpg',
  15: '编舞师东方舞蹈编舞师训练课为自己而舞.jpg',
  16: '编舞师第二阶段SWOD创编系统艺术创作者.jpg',
  17: '舞者英语国际课堂入门东方舞国际交流基础课Engli.jpg',
  18: '手臂全维度精雕系统课SWOD系统国际训练营.jpg',
  19: '零基础亲传教练系统课伊娃东方舞SWOD零基础入门.jpg',
};

const db = new Database(dbPath);
const update = db.prepare("UPDATE CourseSeries SET cover_image = ?, updated_at = datetime('now','localtime') WHERE id = ?");
const result = [];

for (const [id, file] of Object.entries(mapping)) {
  const src = path.join(websiteRoot, file);
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
  const course = db.prepare('SELECT id, name FROM CourseSeries WHERE id = ?').get(id);
  if (!course) throw new Error(`course missing ${id}`);
  const ext = path.extname(file);
  const diskName = `${String(course.name).replace(/[\\/:*?"<>|]/g, '_')}-official${ext}`;
  const dest = path.join(targetRoot, diskName);
  fs.copyFileSync(src, dest);
  const url = `/api/course/series/cover/${encodeURIComponent(diskName)}`;
  update.run(url, id);
  result.push({ id: Number(id), name: course.name, file: diskName, url });
}

db.close();
console.log(JSON.stringify({ backup, updated: result.length, result }, null, 2));
