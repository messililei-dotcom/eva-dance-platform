(function(root) {
  var runtimeConfig = {
    apiBase: "https://admin.swod.com.cn/api/mini",
    loginApiBase: "https://admin.swod.com.cn/api/mini",
    fallbackApiBases: [],
    fallbackLoginApiBases: [],
    officialWebsiteUrl: "https://www.swod.com.cn",
    pwaAuthBase: "https://www.swod.com.cn",
    memberId: null,
    memberName: null,
    reviewMode: false
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = runtimeConfig;
  }

  if (root) {
    root.EVA_MINI_RUNTIME_CONFIG = runtimeConfig;
  }
})(typeof window !== "undefined" ? window : null);
