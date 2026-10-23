const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'student-api.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const homeDataStart = source.indexOf('getHomeData: async');
const recommendationStart = source.indexOf('const recommend', homeDataStart);

if (homeDataStart < 0 || recommendationStart < 0) {
  throw new Error('无法定位官网个人中心课程加载逻辑');
}

const profileCourseSelection = source.slice(homeDataStart, recommendationStart);
if (profileCourseSelection.includes('.slice(')) {
  throw new Error('官网个人中心必须展示全部有效课程，不得对课程列表做数量截断');
}

if (!profileCourseSelection.includes('.map(normalizeCourse);')) {
  throw new Error('官网个人中心课程列表缺少完整映射逻辑');
}

console.log('官网个人中心课程全量展示检查通过');
