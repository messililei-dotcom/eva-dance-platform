/**
 * 线下课程测试数据生成脚本
 * 生成：50门课程、500名学员、2000条缴费、5000条消课
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'admin.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦 开始生成测试数据...\n');

// ===== 1. 生成课程 (50门) =====
const courseTypes = ['集训', '次卡', '年卡', '私教', '小班课'];
const teachers = ['伊娃老师', '海艳', '七七', '林亦洛', '名师团队', '李磊', '王曼妮'];
const adjectives = ['极致', '精英', '超级', '魔鬼', '金牌', '王牌', '经典', '大师', '高级', '专业'];
const nouns = ['技巧训练营', '舞感提升班', '形体塑造课', '基训营', '作品班', '强化班', '入门班', '进阶班', '大师班', '密训营'];
const subTypes = ['基本功', '成品舞', '技巧提升', '核心训练', '旋转训练', '西米强化', '舞码教学'];

console.log('生成课程...');
const insertCourse = db.prepare(`
  INSERT INTO Course (name, type, price, startDate, endDate, sessions, teacher, subType, status, capacity, remaining)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
`);

let courseCount = 0;
const courseIds = [];
const txCourses = db.transaction(() => {
  // 先保留原有的真实课程
  for (let i = 0; i < 50; i++) {
    const name = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}`;
    const type = courseTypes[Math.floor(Math.random() * courseTypes.length)];
    const price = [0, 680, 980, 1280, 1980, 2980, 3980, 5980, 9800, 12800][Math.floor(Math.random() * 10)];
    const startDate = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    const endDate = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    const sessions = Math.floor(Math.random() * 30) + 5;
    const teacher = teachers[Math.floor(Math.random() * teachers.length)];
    const subType = subTypes[Math.floor(Math.random() * subTypes.length)];
    const capacity = Math.floor(Math.random() * 50) + 10;
    const remaining = Math.floor(Math.random() * capacity);

    const result = insertCourse.run(name, type, price, startDate, endDate, sessions, teacher, subType, capacity, remaining);
    courseIds.push(Number(result.lastInsertRowid));
    courseCount++;
  }
});
txCourses();
console.log(`  ✅ 已生成 ${courseCount} 门课程`);

// ===== 2. 生成学员 (500名) =====
const firstName = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
  '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史',
  '顾', '侯', '邵', '孟', '龙', '万', '段', '漕', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文'];
const lastName = ['美丽', '静', '芳', '娟', '秀英', '敏', '丽', '萍', '红', '玲', '桂英', '英', '玉兰', '桂兰', '秀兰',
  '鑫', '明', '强', '华', '磊', '军', '杰', '涛', '斌', '勇', '超', '伟', '刚', '波', '辉',
  '雪', '婷', '琳', '瑶', '悦', '倩', '萌', '莹', '颖', '琪', '娅', '璇', '璐', '瑶', '彤',
  '雨桐', '梓萱', '梓涵', '诗涵', '可欣', '紫萱', '一诺', '子涵', '子萱', '思涵', '一鸣', '浩然', '子豪', '俊杰', '宇轩',
  '嘉琪', '思琪', '心怡', '文静', '诗琪', '子琪', '子怡', '梦琪', '雅静', '静怡', '紫怡', '文婷', '雨婷', '梦婷', '佳琪'];

const levels = ['星澜舞者', '月芽舞者', '体验学员', '金牌学员', 'VIP学员', '传承弟子'];
const provinces = ['湖南', '广东', '北京', '上海', '浙江', '江苏', '四川', '湖北'];
const cities = {
  '湖南': ['长沙', '株洲', '湘潭', '衡阳', '岳阳', '益阳', '常德', '张家界'],
  '广东': ['广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', '汕头'],
  '北京': ['朝阳区', '海淀区', '东城区', '西城区', '丰台区', '通州区'],
  '上海': ['浦东新区', '黄浦区', '徐汇区', '静安区', '长宁区', '普陀区'],
  '浙江': ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '台州'],
  '江苏': ['南京', '苏州', '无锡', '常州', '南通', '徐州', '扬州', '镇江'],
  '四川': ['成都', '绵阳', '德阳', '宜宾', '南充', '泸州', '自贡', '乐山'],
  '湖北': ['武汉', '黄石', '十堰', '宜昌', '襄阳', '荆州', '荆门', '孝感']
};

console.log('生成学员...');
const insertMember = db.prepare(`
  INSERT INTO Member (name, phone, gender, level, province, city, status, register_date, remark)
  VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
`);

let memberCount = 0;
const memberIds = [];
const usedPhones = new Set();

const txMembers = db.transaction(() => {
  for (let i = 0; i < 500; i++) {
    const fn = firstName[Math.floor(Math.random() * firstName.length)];
    const ln = lastName[Math.floor(Math.random() * lastName.length)];
    const name = fn + ln;
    let phone;
    do {
      phone = `1${['38','39','50','51','52','55','56','57','58','59','86','87','88','89'][Math.floor(Math.random() * 14)]}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
    } while (usedPhones.has(phone));
    usedPhones.add(phone);
    const gender = Math.random() > 0.15 ? '女' : '男';
    const level = levels[Math.floor(Math.random() * levels.length)];
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const city = cities[province][Math.floor(Math.random() * cities[province].length)];
    const registerDate = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    const result = insertMember.run(name, phone, gender, level, province, city, registerDate, '');
    memberIds.push(Number(result.lastInsertRowid));
    memberCount++;
  }
});
txMembers();
console.log(`  ✅ 已生成 ${memberCount} 名学员`);

// ===== 3. 生成缴费记录 (2000条) =====
const paymentMethods = ['微信', '支付宝', '现金', '刷卡', '转账'];
const salesNames = ['伊娃老师', '海艳', '七七', '课程顾问A', '课程顾问B', '客服小林', '客服小张'];

console.log('生成缴费记录...');
const insertPayment = db.prepare(`
  INSERT INTO Payment (memberId, memberName, memberPhone, courseId, courseName, amount, date, payment, sales, remark, remainingSessions, channel, paymentStatus)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'management', 'paid')
`);

let paymentCount = 0;
const paymentIdMap = {}; // memberId -> array of paymentIds

const txPayments = db.transaction(() => {
  for (let i = 0; i < 2000; i++) {
    const memberId = memberIds[Math.floor(Math.random() * memberIds.length)];
    const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId);
    if (!member) continue;
    const course = db.prepare('SELECT id, name, type, price FROM Course WHERE id=?').get(courseIds[Math.floor(Math.random() * courseIds.length)]);
    if (!course) continue;
    const amount = course.type === '次卡' ? course.price : [course.price, course.price * 0.8, course.price * 0.9, 0, Math.floor(course.price * 1.2)].filter(Boolean)[Math.floor(Math.random() * 5)];
    const date = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    const payment = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const sales = salesNames[Math.floor(Math.random() * salesNames.length)];
    const remainingSessions = course.type === '次卡' ? Math.floor(Math.random() * 20) + 1 : 0;
    const result = insertPayment.run(
      member.id, member.name, member.phone || '',
      course.id, course.name, amount || 0,
      date, payment, sales, '',
      remainingSessions
    );
    if (!paymentIdMap[member.id]) paymentIdMap[member.id] = [];
    paymentIdMap[member.id].push(Number(result.lastInsertRowid));
    paymentCount++;
  }
});
txPayments();
console.log(`  ✅ 已生成 ${paymentCount} 条缴费记录`);

// ===== 4. 生成消课记录 (5000条) =====
console.log('生成消课记录...');
const insertConsume = db.prepare(`
  INSERT INTO ConsumeRecord (memberId, memberName, memberPhone, courseId, courseName, count, consumeDate, operator, remark)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let consumeCount = 0;
const txConsumes = db.transaction(() => {
  for (let i = 0; i < 5000; i++) {
    const memberId = memberIds[Math.floor(Math.random() * memberIds.length)];
    const member = db.prepare('SELECT name, phone FROM Member WHERE id=?').get(memberId);
    if (!member) continue;
    const course = db.prepare('SELECT id, name FROM Course WHERE id=?').get(courseIds[Math.floor(Math.random() * courseIds.length)]);
    if (!course) continue;
    const count = Math.floor(Math.random() * 3) + 1;
    const consumeDate = `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    insertConsume.run(
      member.id, member.name, member.phone || '',
      course.id, course.name, count,
      consumeDate, '李小雷', ''
    );
    consumeCount++;
  }
});
txConsumes();
console.log(`  ✅ 已生成 ${consumeCount} 条消课记录`);

console.log('\n📊 数据统计:');
console.log(`  课程: ${courseCount} 门`);
console.log(`  学员: ${memberCount} 名`);
console.log(`  缴费: ${paymentCount} 条`);
console.log(`  消课: ${consumeCount} 条`);

db.close();
console.log('\n✅ 测试数据生成完毕!');
