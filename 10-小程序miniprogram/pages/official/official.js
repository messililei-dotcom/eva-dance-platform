const runtimeConfig = require("../../shared/runtime-config");

Page({
  data: {
    url: runtimeConfig.officialWebsiteUrl || "https://www.dongfangwuquan.com"
  }
});
