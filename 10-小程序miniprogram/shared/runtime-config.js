(function(root) {
  var runtimeConfig = {
    apiBase: "https://admin.dongfangwuquan.com/api/mini",
    loginApiBase: "https://admin.dongfangwuquan.com/api/mini",
    fallbackApiBases: [],
    fallbackLoginApiBases: [],
    officialWebsiteUrl: "https://www.dongfangwuquan.com",
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
