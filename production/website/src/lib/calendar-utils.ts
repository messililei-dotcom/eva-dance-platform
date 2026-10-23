import { TrainingCourse } from '@/data/training-calendar';

/**
 * 将课程按日期范围展开为每日数据
 * @param courses 课程列表
 * @param year 目标年份
 * @param month 目标月份 (1-12, 0表示全年)
 * @returns 按日期组织的课程数据
 */
export function expandCoursesByDateRange(
  courses: TrainingCourse[],
  year: number,
  month: number = 0
): Record<string, TrainingCourse[]> {
  const dailyCourses: Record<string, TrainingCourse[]> = {};

  courses.forEach(course => {
    const startDate = new Date(course.startDate);
    const endDate = new Date(course.endDate);
    
    // 确保日期有效
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('Invalid date range for course:', course.id, course.title);
      return;
    }

    // 如果指定了月份，只处理该月份的数据
    if (month > 0) {
      const startMonth = startDate.getMonth() + 1;
      const endMonth = endDate.getMonth() + 1;
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();

      // 检查课程是否与目标月份有交集
      if (!((startYear < year || (startYear === year && startMonth <= month)) &&
            (endYear > year || (endYear === year && endMonth >= month)))) {
        return; // 课程与目标月份无交集
      }
    }

    // 从开始日期遍历到结束日期
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      const currentDay = currentDate.getDate();

      // 如果指定了月份，跳过其他月份
      if (month > 0 && (currentYear !== year || currentMonth !== month)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      
      if (!dailyCourses[dateKey]) {
        dailyCourses[dateKey] = [];
      }
      dailyCourses[dateKey].push(course);

      // 移动到下一天
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  return dailyCourses;
}

/**
 * 获取指定月份的日历数据
 * @param courses 课程列表
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 日历格子数据
 */
export function getCalendarDays(
  courses: TrainingCourse[],
  year: number,
  month: number
) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0=Sunday, 6=Saturday

  // 获取该月份的每日课程数据
  const dailyCourses = expandCoursesByDateRange(courses, year, month);

  const days = [];
  
  // 前置空白（上个月的填充）
  for (let i = 0; i < startWeekday; i++) {
    days.push({ type: 'empty', day: 0, courses: [] });
  }
  
  // 当前月的实际日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      type: 'day',
      day,
      courses: dailyCourses[dateKey] || [],
    });
  }

  return days;
}