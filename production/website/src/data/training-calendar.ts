/**
 * 课程日历数据配置
 * 
 * 包含所有线下集训课程的时间、地点、价格等信息
 * 数据结构与 courses.ts 中的线下课程保持一致
 * 支持从学员管理系统API动态获取数据
 */

import { getPublicCourses } from '../lib/api';

export interface TrainingCourse {
  id: string | number;
  title: string;
  description: string;
  fullDescription: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: 'offline';
  type: string;
  instructor: string;
  duration: string;
  level: string;
  outline: string[];
  dateRange: string;
  startDate: string; // ISO 格式日期，用于日历排序
  endDate: string;   // ISO 格式日期
  location?: string;
  isNew?: boolean;
  isHot?: boolean;
  capacity?: number; // 人数限制
  highlights?: string[]; // 课程亮点
}

/**
 * 2026年线下集训课程列表
 * 按时间顺序排列
 */
export const offlineCourses: TrainingCourse[] = [
  {
    id: '16',
    title: '五一舞感集训营（中高阶）',
    description: '五一黄金周线下集训，专注舞感培养与技巧提升',
    fullDescription: '为期5天的 intensive 集训，每天5小时，专为中高阶学员设计。通过密集训练，快速提升舞感表现力，掌握 complex 组合动作。适合已有一定基础，希望突破瓶颈的学员。',
    price: 2580,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'bootcamp',
    instructor: '伊娃老师',
    duration: '5天/每天5小时',
    level: '中高阶',
    outline: ['舞感基础理论', '核心技巧强化', '复杂组合训练', '舞台表现力提升', '结业考核'],
    dateRange: '5月1日-5月5日',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    location: '长沙总部',
    isHot: true,
    capacity: 20,
    highlights: ['舞感专项提升', '高阶组合训练', '一对一指导', '录像回顾'],
  },
  {
    id: '17',
    title: '技巧集训营（基础）',
    description: '五一黄金周线下集训，零基础学员的技巧入门',
    fullDescription: '为期5天的 intensive 基础技巧训练，每天5小时。从最基础的动作开始，系统掌握东方舞核心技巧。适合零基础或基础薄弱的学员。',
    price: 1980,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'bootcamp',
    instructor: '七七老师, 海艳老师',
    duration: '5天/每天5小时',
    level: '基础',
    outline: ['基础站姿与重心', '胯部基础技巧', '肩部与手臂基础', '步伐基础训练', '简单组合练习'],
    dateRange: '5月6日-5月10日',
    startDate: '2026-05-06',
    endDate: '2026-05-10',
    location: '长沙总部',
    isHot: true,
    capacity: 25,
    highlights: ['零基础友好', '系统入门', '小班教学', '课后辅导'],
  },
  {
    id: '18',
    title: '第五届国际门徒班（基础进阶）',
    description: '20天 intensive 门徒班，完整的东方舞师资培训',
    fullDescription: '为期20天的 intensive 课程，每天5小时。从基础到进阶，系统学习东方舞完整知识体系。结业后可获得门徒班证书，优秀学员有机会成为助教。',
    price: 12800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师',
    duration: '20天/每天5小时',
    level: '基础进阶',
    outline: ['第一周：基础体系建立', '第二周：技巧深化', '第三周：教学法入门', '第四周：综合考核'],
    dateRange: '5月11日-5月30日',
    startDate: '2026-05-11',
    endDate: '2026-05-30',
    location: '长沙总部',
    isHot: true,
    capacity: 15,
    highlights: ['师资认证', '就业推荐', '终身复训', '弟子圈入群'],
  },
  {
    id: '19',
    title: 'Ailda Lin林洛亦黄金震撼营（大师班）',
    description: '国际名师Ailda Lin亲授，震撼体验国际教学法',
    fullDescription: '7天 intensive 大师班，每天4小时。Ailda Lin老师带来独创的黄金教学法，融合国际感、纯埃风、高级范。适合希望拓展视野、提升国际感的学员。',
    price: 4580,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'masterclass',
    instructor: 'Ailda Lin（林洛亦）',
    duration: '7天/每天4小时',
    level: '中级及以上',
    outline: ['国际教学法理念', '国际感训练', '纯埃风体验', '高级范组合', '结业展示'],
    dateRange: '6月1日-6月7日',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    location: '长沙总部',
    isHot: true,
    capacity: 30,
    highlights: ['国际名师亲授', '独家教学法', '大师合影', '限量名额'],
  },
  {
    id: '20',
    title: 'SWOD技巧集训营（基础）',
    description: 'SWOD系统基础技巧 intensive 训练',
    fullDescription: '为期30天的 intensive 训练，每天5小时。系统掌握SWOD基础技巧体系，从身体激活到复合训练，全面夯实基础。适合零基础和希望系统学习的学员。',
    price: 5980,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师, 七七老师',
    duration: '30天/每天5小时',
    level: '基础',
    outline: ['身体激活与调整', '基础技巧分解', '复合技巧训练', '教学法入门', '考核认证'],
    dateRange: '6月8日-7月7日',
    startDate: '2026-06-08',
    endDate: '2026-07-07',
    location: '长沙总部',
    isHot: true,
    capacity: 20,
    highlights: ['SWOD系统认证', '30天蜕变', '师资培训', '就业推荐'],
  },
  {
    id: '21',
    title: '东方舞技巧整合系统认证班（中阶）',
    description: '技巧整合系统认证培训',
    fullDescription: '12天认证培训，每天6小时。系统学习技巧整合理论，掌握复杂技巧组合编排。适合有一定基础，希望成为专业教师的学员。',
    price: 6800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师, 七七老师',
    duration: '12天/每天6小时',
    level: '中阶',
    outline: ['技巧整合理论', '复杂组合编排', '教学法进阶', '模拟教学', '认证考核'],
    dateRange: '7月20日-7月31日',
    startDate: '2026-07-20',
    endDate: '2026-07-31',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 18,
    highlights: ['中阶认证', '技巧整合', '教学法进阶', '结业证书'],
  },
  {
    id: '22',
    title: '东方舞技巧整合系统认证班（高阶）',
    description: '高阶技巧整合系统认证培训',
    fullDescription: '为期20天的 intensive 认证培训，每天6小时。深入学习高阶技巧整合，具备独立编舞和教学能力。通过考核者可获得高级认证证书。',
    price: 9800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师, 七七老师',
    duration: '20天/每天6小时',
    level: '高阶',
    outline: ['高阶整合理论', '独立试编训练', '教学法高级', '实战教学演练', '高级认证考核'],
    dateRange: '7月20日-8月8日',
    startDate: '2026-07-20',
    endDate: '2026-08-08',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 12,
    highlights: ['高阶认证', '独立编舞', '高级教学法', 'VIP服务'],
  },
  {
    id: '23',
    title: '敦煌舞基础集训营',
    description: '敦煌舞入门集训，感受中国古典舞韵',
    fullDescription: '6天集训，每天6小时。从敦煌舞基础手位、脚位开始，学习标志性动作和组合。适合喜欢中国古典舞，希望拓展舞蹈风格的学员。含住宿安排。',
    price: 3800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'bootcamp',
    instructor: '刘炼老师',
    duration: '6天/每天6小时',
    level: '基础',
    outline: ['敦煌舞基础理论', '手位与脚位训练', '标志性动作学习', '简单组合练习', '结业展示'],
    dateRange: '8月15日-8月20日',
    startDate: '2026-08-15',
    endDate: '2026-08-20',
    location: '长沙总部',
    isNew: true,
    capacity: 20,
    highlights: ['敦煌舞特色', '古典舞韵', '含住宿', '文化体验'],
  },
  {
    id: '24',
    title: 'SWOD东方舞与民间舞高级班',
    description: '东方舞与民间舞融合高级课程',
    fullDescription: '15天高级课程，每天6小时。学习东方舞与民间舞的融合技巧，拓展舞蹈表现力。适合已有基础，希望提升综合能力的学员。',
    price: 8800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师',
    duration: '15天/每天6小时',
    level: '高级',
    outline: ['民间舞基础', '东方舞与民间舞融合', '复杂组合编排', '舞台表现力', '结业考核'],
    dateRange: '9月1日-9月15日',
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 15,
    highlights: ['融合创新', '高级认证', '舞台表现', '结业录像'],
  },
  {
    id: '25',
    title: '国庆黄金周集训营（整合舞方向）',
    description: '国庆黄金周线下集训，专注整合舞方向',
    fullDescription: '为期6天的黄金周集训，每天6小时。专注整合舞方向训练，提升综合表现力。适合已有基础，希望在特定方向深入发展的学员。',
    price: 3800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'bootcamp',
    instructor: '伊娃老师',
    duration: '6天/每天6小时',
    level: '中级及以上',
    outline: ['整合舞理论', '深度技巧训练', '组合编排', '舞台表现力', '结业展示'],
    dateRange: '10月1日-10月6日',
    startDate: '2026-10-01',
    endDate: '2026-10-06',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 25,
    highlights: ['黄金周集训', '整合舞专题', '国庆特惠', '结业展示'],
  },
  {
    id: '26',
    title: '双师教学能力集训营',
    description: '双师教学能力专项集训',
    fullDescription: '为期7天的集训，每天6小时。学习双师教学技巧，提升教学能力和课堂组织能力。适合已有教学经验，希望提升教学水平的学员。',
    price: 4800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '七七老师, 海艳老师',
    duration: '7天/每天6小时',
    level: '中级及以上',
    outline: ['双师教学理论', '课堂组织技巧', '教学互动技巧', '模拟教学演练', '考核认证'],
    dateRange: '10月7日-10月13日',
    startDate: '2026-10-07',
    endDate: '2026-10-13',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 18,
    highlights: ['双师教学', '课堂管理', '教学认证', '实战演练'],
  },
  {
    id: '27',
    title: '东方舞技巧体系认证班（教师）',
    description: '东方舞技巧体系教师认证培训',
    fullDescription: '12天教师认证培训，每天6小时。系统学习东方舞技巧体系，掌握教学方法。通过考核者可获得教师认证证书。',
    price: 5800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '海艳老师, 七七老师',
    duration: '12天/每天6小时',
    level: '中级',
    outline: ['技巧体系理论', '教学法', '课堂组织', '模拟教学', '认证考核'],
    dateRange: '10月15日-10月26日',
    startDate: '2026-10-15',
    endDate: '2026-10-26',
    location: '长沙总部',
    isNew: true,
    capacity: 20,
    highlights: ['教师认证', '技巧体系', '教学法', '就业推荐'],
  },
  {
    id: '28',
    title: '东方舞中阶-高阶认证班',
    description: '中阶到高阶跨越认证培训',
    fullDescription: '为期10天的认证培训，每天6小时。系统学习中阶到高阶的门槛技巧，具备高阶教学能力。适合已有中阶基础，希望突破到高阶的学员。',
    price: 6800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '七七老师, 伊娃老师',
    duration: '10天/每天6小时',
    level: '中阶-高阶',
    outline: ['中阶到高阶理论', '高阶技巧训练', '教学法进阶', '技巧整合', '认证考核'],
    dateRange: '11月1日-11月10日',
    startDate: '2026-11-01',
    endDate: '2026-11-10',
    location: '长沙总部',
    isNew: true,
    capacity: 15,
    highlights: ['阶跃突破', '高阶认证', '技巧进阶', '一对一指导'],
  },
  {
    id: '29',
    title: '东方舞高阶认证班',
    description: '东方舞最高阶认证培训',
    fullDescription: '为期10天的高阶认证培训，每天6小时。系统学习高阶技巧，具备独立编舞和高级教学能力。通过考核者可获得最高阶认证证书。',
    price: 8800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师',
    duration: '10天/每天6小时',
    level: '高阶',
    outline: ['高阶技巧理论', '独立编舞训练', '高级教学法', '实战教学', '高阶认证考核'],
    dateRange: '11月20日-11月29日',
    startDate: '2026-11-20',
    endDate: '2026-11-29',
    location: '长沙总部',
    isNew: true,
    capacity: 12,
    highlights: ['最高阶认证', '独立编舞', 'VIP教学', '终身复训'],
  },
  {
    id: '30',
    title: '埃及大师Tito Seif特训营',
    description: '埃及国宝级大师Tito Seif亲授特训营',
    fullDescription: '6天特训营，每天6小时。Tito Seif老师亲授正宗埃及东方舞技巧。这是难得的学习机会，适合希望学习正宗埃及风格的学员。',
    price: 8800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'masterclass',
    instructor: 'Tito Seif（埃及）',
    duration: '6天/每天6小时',
    level: '高级',
    outline: ['正宗埃及风格', '传统节奏体验', '传统编舞学习', '实战演练', '结业展示'],
    dateRange: '12月20日-12月25日',
    startDate: '2026-12-20',
    endDate: '2026-12-25',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 30,
    highlights: ['埃及大师亲授', '正宗风格', '限量名额', '大师合影'],
  },
  {
    id: '31',
    title: '东方舞技巧体系认证班（年终班）',
    description: '年终东方舞技巧体系认证培训',
    fullDescription: '为期5天的年终认证培训，每天6小时。系统学习东方舞技巧体系全年内容，综合考核。适合全年学习后希望系统巩固的学员。',
    price: 9800,
    image: '/images/courses/2026-schedule.jpg',
    category: 'offline',
    type: 'certification',
    instructor: '伊娃老师',
    duration: '5天/每天6小时',
    level: '中高级',
    outline: ['全年内容梳理', '技巧整合', '教学法综合', '综合考核', '年终认证'],
    dateRange: '12月26日-12月30日',
    startDate: '2026-12-26',
    endDate: '2026-12-30',
    location: '长沙总部',
    isNew: true,
    isHot: true,
    capacity: 20,
    highlights: ['年终总结', '综合认证', '新年特惠', '年会参与'],
  },
];

/**
 * 获取当前月份的课程
 */
export function getCurrentMonthCourses(): TrainingCourse[] {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  return offlineCourses.filter(course => {
    const startMonth = parseInt(course.startDate.split('-')[1], 10);
    const startYear = parseInt(course.startDate.split('-')[0], 10);
    return startYear === currentYear && startMonth === currentMonth;
  });
}

/**
 * 获取即将开始的课程（未来30天内）
 */
export function getUpcomingCourses(): TrainingCourse[] {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return offlineCourses.filter(course => {
    const startDate = new Date(course.startDate);
    return startDate >= now && startDate <= thirtyDaysLater;
  });
}

/**
 * 按月份分组课程
 */
export function getCoursesByMonth(): Record<string, TrainingCourse[]> {
  const grouped: Record<string, TrainingCourse[]> = {};
  
  offlineCourses.forEach(course => {
    const month = course.startDate.split('-')[1];
    const monthName = getMonthName(parseInt(month, 10));
    
    if (!grouped[monthName]) {
      grouped[monthName] = [];
    }
    grouped[monthName].push(course);
  });
  
  return grouped;
}

/**
 * 获取月份名称
 */
function getMonthName(month: number): string {
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];
  return monthNames[month - 1] || '';
}

/**
 * 从API获取动态课程数据
 * 如果API失败，返回静态数据
 */
export async function getDynamicCourses(): Promise<TrainingCourse[]> {
  try {
    const apiCourses = await getPublicCourses();
    if (apiCourses && apiCourses.length > 0) {
      // 将API数据转换为TrainingCourse格式
      return apiCourses.map((course: any) => ({
        id: course.id,
        title: course.name,
        description: course.description || '',
        fullDescription: course.description || '',
        price: course.price,
        image: course.image || '/images/courses/2026-schedule.jpg',
        category: 'offline',
        type: course.type || 'bootcamp',
        instructor: course.instructor || '',
        duration: `${course.sessions || 0}天`,
        level: course.level || '',
        outline: course.outline ? JSON.parse(course.outline) : [],
        dateRange: course.dateRange || '',
        startDate: course.startDate || '',
        endDate: course.endDate || '',
        location: '长沙总部',
        isHot: false,
        isNew: false,
        capacity: course.capacity || 20,
        highlights: course.highlights ? JSON.parse(course.highlights) : [],
      }));
    }
  } catch (error) {
    console.error('API获取课程失败，使用静态数据:', error);
  }
  // API失败时返回静态数据
  return offlineCourses;
}
