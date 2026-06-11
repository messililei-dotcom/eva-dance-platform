const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

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
const apiJs = read("utils/api.js");
const previewHtml = read("preview/index.html");

const checks = [
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
  }
];

const failed = checks.filter(item => !item.ok);
if (failed.length) {
  failed.forEach(item => console.error(`✗ ${item.message}`));
  process.exit(1);
}

console.log("小程序开发版与本地预览版共享配置检查通过");
