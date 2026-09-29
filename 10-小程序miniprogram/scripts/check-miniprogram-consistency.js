const fs = require("fs");
const path = require("path");
const { findCourseVideoSelection } = require("../shared/course-video-selection");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const readWorkspace = file => fs.readFileSync(path.join(root, "..", file), "utf8");

const requiredFiles = [
  "shared/runtime-config.js",
  "app.js",
  "utils/api.js",
  "preview/index.html"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`缺少文件: ${file}`);
  }
}

const appJs = read("app.js");
const appJson = read("app.json");
const apiJs = read("utils/api.js");
const homeJs = read("pages/home/home.js");
const reviewTextJs = read("shared/review-text.js");
const popularityJs = read("shared/popularity.js");
const playerJs = read("pages/player/player.js");
const playerWxml = read("pages/player/player.wxml");
const profileWxml = read("pages/profile/profile.wxml");
const runtimeConfigJs = read("shared/runtime-config.js");
const websiteEcosystem = readWorkspace("02-官方网站工程设计/官方网站/ecosystem.config.js");
const adminEcosystem = readWorkspace("10-统一平台admin-platform/ecosystem.config.js");
const websiteLogin = readWorkspace("02-官方网站工程设计/官方网站/src/app/api/mini/student-login/route.ts");
const adminLogin = readWorkspace("10-统一平台admin-platform/src/app/api/mini/student-login/route.ts");
const previewHtml = read("preview/index.html");
const reviewMode = /reviewMode:\s*true/.test(read("shared/runtime-config.js"));

const checks = [
  {
    ok: findCourseVideoSelection([
      { videoId: 120, materialId: 1594 },
      { videoId: 1594, materialId: 2215 }
    ], "1594").videoId === 1594,
    message: "课节链接需要优先按视频 ID 匹配，再兼容旧素材 ID"
  },
  {
    ok: appJs.includes("./shared/runtime-config"),
    message: "app.js 需要读取 shared/runtime-config"
  },
  {
    ok: apiJs.includes("../shared/runtime-config") && apiJs.includes("fallbackApiBases"),
    message: "utils/api.js 需要使用共享 API 配置和备用地址"
  },
  {
    ok: previewHtml.includes("EVA_MINI_RUNTIME_CONFIG"),
    message: "preview/index.html 需要读取共享运行配置"
  },
  {
    ok: runtimeConfigJs.includes('apiBase: "https://admin.swod.com.cn/api/mini"')
      && runtimeConfigJs.includes('loginApiBase: "https://admin.swod.com.cn/api/mini"')
      && runtimeConfigJs.includes('officialWebsiteUrl: "https://www.swod.com.cn"'),
    message: "小程序必须使用与官网一致的 swod.com.cn 正式域名"
  },
  {
    ok: websiteEcosystem.includes("ADMIN_DB_PATH: '/www/wwwroot/dongfangwuquan/admin-platform/admin.db'")
      && adminEcosystem.includes("ADMIN_DB_PATH: './admin.db'")
      && websiteEcosystem.includes("ADMIN_SESSION_SECRET: envValue('ADMIN_SESSION_SECRET')")
      && adminEcosystem.includes("ADMIN_SESSION_SECRET: sharedSecret"),
    message: "官网与小程序接口必须指向同一 admin-platform/admin.db 并共享会话密钥"
  },
  {
    ok: websiteLogin.includes("upsertPhoneMember") && adminLogin.includes("upsertPhoneMember")
      && websiteLogin.includes("sourceMemberId") && adminLogin.includes("sourceMemberId"),
    message: "官网与小程序手机号登录必须复用统一 Member 身份合并逻辑"
  },
  {
    ok: reviewMode
      ? appJson.includes('"pages/home/home"') && appJson.includes('"pages/player/player"')
      : appJson.includes('"pagePath": "pages/home/home"') && appJson.includes('"text": "线上学院"'),
    message: "提审版需要保留课程浏览入口；正式版首页需要显示为线上学院"
  },
  {
    ok: reviewMode ? appJson.includes('"pages/events/events"') : appJson.includes('"pagePath": "pages/events/events"') && appJson.includes('"text": "赛事"'),
    message: "需要提供赛事栏目"
  },
  {
    ok: appJson.includes('"pagePath": "pages/offline/offline"') && appJson.includes('"text": "线下课"'),
    message: "主导航需要提供线下课栏目"
  },
  {
    ok: apiJs.includes("getOfflineOverview") && apiJs.includes("bookOfflineSession")
      && apiJs.includes("cancelOfflineBooking") && apiJs.includes("checkinOfflineBooking"),
    message: "线下课需要接入课次、预约、取消和签到核销接口"
  },
  {
    ok: appJson.includes("pages/detail/detail"),
    message: "视频关闭时需要注册图文课程详情页"
  },
  {
    ok: !homeJs.includes("Math.random") && !homeJs.includes("shuffle("),
    message: "课程必须沿用线上学院排序"
  },
  {
    ok: !reviewTextJs.includes(".replace("),
    message: "线上学院课程名称和介绍不能在小程序中改写"
  },
  {
    ok: popularityJs.includes("PUBLIC_STUDENT_BASE_MIN = 500")
      && popularityJs.includes("PUBLIC_STUDENT_BASE_MAX = 1000")
      && popularityJs.includes("total_students")
      && popularityJs.includes("stableStudentBase"),
    message: "线上课程对外学员数必须使用后台真实数据加500至1000的不重复稳定基数"
  },
  {
    ok: apiJs.includes("_sessionRetried") && apiJs.includes("ensureSilentLogin(true)") && apiJs.includes("statusCode"),
    message: "登录失效后需要静默续期并且只重试一次"
  },
  {
    ok: playerJs.includes("findCourseVideoSelection") && playerJs.includes("materialId")
      && playerWxml.includes("搜索课节") && playerWxml.includes("<video")
      && playerWxml.includes("bindtimeupdate=\"onTimeUpdate\"") && playerWxml.includes("播放本节课程"),
    message: "课程页需要同步课节定位、临时搜索，并提供可操作的视频播放器"
  },
  {
    ok: profileWxml.includes("重新连接"),
    message: "个人中心连接失败后需要提供重新连接入口"
  },
  {
    ok: !reviewMode && apiJs.includes("getFeatures") && playerJs.includes("videoFeature.enabled")
      && playerWxml.includes("<video")
      && appJson.includes('"pages/profile/profile"'),
    message: "发布版保留播放器能力，由后台功能配置控制是否开放"
  }
];

const failed = checks.filter(item => !item.ok);
if (failed.length) {
  failed.forEach(item => console.error(`✗ ${item.message}`));
  process.exit(1);
}

console.log("小程序开发版与本地预览版共享配置检查通过");
