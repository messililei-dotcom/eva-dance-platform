# H5 接入准备

2026-10-03 已创建官网号码认证方案 FC220000013785054；页面地址 `https://www.swod.com.cn/`，源地址 `https://www.swod.com.cn`。

H5 方案不使用 App Bundle ID、包签名或 App SDKSecret。网站需独立接入官方 JS SDK 与服务端 H5 认证接口，临时授权凭据由服务端颁发；阿里云 AccessKey 不得暴露到网页。根据实际接入能力选择 H5 取号或本机号码校验，不把“校验通过”之外的客户端自报手机号当作身份。

业务仍进入统一会员体系，保留短信登录。Wi-Fi、无 SIM、微信内置浏览器及运营商不支持场景需要回退；不得提前承诺全浏览器一键登录。

控制台创建成功不等于网站已启用。本轮未接入网页 SDK、未进行真实号码认证，也未更改现有网站登录。

官方参考：https://help.aliyun.com/zh/pnvs/developer-reference/number-authentication-server-integration
