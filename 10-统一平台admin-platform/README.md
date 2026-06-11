# 伊娃东方舞统一平台 admin-platform

本工程是伊娃东方舞统一数字化运营平台的新后台主工程。

固定目录：

```text
10-统一平台admin-platform
```

## 开发原则

从现在开始：

```text
新功能主开发只进入本工程
原有系统文件不再作为主开发目标
原有系统只作为数据源、逻辑参考和迁移对象
```

原有系统包括：

```text
03-学员管理系统/学员管理系统
04-网课系统开发计划
07-电商系统
09-财务系统
```

禁止：

```text
iframe 拼装旧后台
多个后台并行设计
多个登录入口
多套权限系统
直接把旧页面当新平台页面
```

必须：

```text
统一登录
统一 Layout
统一 API Client
统一学员中心
统一订单中心
统一权限
统一数据适配层
```

## 技术栈

```text
Next.js 14
React 18
TypeScript
Ant Design 5
ECharts
Axios
```

## 本地开发

```bash
npm run dev
```

默认端口：

```text
http://localhost:3003
```

生产访问恢复：

```text
docs/生产访问恢复说明.md
deploy/admin-platform.nginx.conf
scripts/production-healthcheck.sh
```

## 生产域名

```text
www.dongfangwuquan.com
admin.dongfangwuquan.com
learn.dongfangwuquan.com
miniapi.dongfangwuquan.com
```

其中：

```text
www.dongfangwuquan.com -> 品牌官网
admin.dongfangwuquan.com -> 统一管理后台
learn.dongfangwuquan.com -> 唯一学习中心学员端，对应 /learn
miniapi.dongfangwuquan.com -> 网课小程序 API
```

四端链接统一维护在：

```text
src/lib/platform-links.ts
docs/四端链接矩阵.md
```

## API 来源

当前通过环境变量配置统一 API：

```text
NEXT_PUBLIC_API_URL
```

开发期可指向旧学员系统 API：

```text
http://localhost:3000/api
```

生产期应指向：

```text
https://api.dongfangwuquan.com
```

## 核心文档

重规划方案：

```text
docs/统一平台重规划升级方案.md
docs/四端链接矩阵.md
```

## 阶段目标

Phase 1：

```text
登录
后台 Layout
学习中心 /learn
首页总览
学员中心
详情
订单中心
电商库存总览
财务总览
权限菜单
```

Phase 2：

```text
线下培训
线上课程
学习进度
授权管理
小程序数据
```

Phase 3：

```text
电商完整业务
财务完整业务
CRM
营销
```

Phase 4：

```text
数据分析
AI 客服
自动化运营
智能推荐
```

## 验收标准

每一阶段必须满足：

```text
npm run build 通过
核心页面有真实数据或专业空状态
不依赖旧后台页面拼装
不修改旧系统主业务文件
```
