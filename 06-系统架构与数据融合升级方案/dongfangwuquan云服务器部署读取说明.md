# dongfangwuquan 云服务器部署读取说明

## 1. 主后台与 API

云服务器后台服务读取这个文件夹：

```text
/Users/lilei/Desktop/伊娃东方舞-开发工程/03-学员管理系统/学员管理系统
```

部署到服务器后建议目录：

```text
/www/wwwroot/dongfangwuquan/admin-platform
```

启动入口：

```text
server/server.js
```

对应域名：

```text
admin.dongfangwuquan.com
api.dongfangwuquan.com
auth.dongfangwuquan.com
```

当前后台、统一登录、会员中心、订单中心、电商主库总览都在这个工程内。

注意：

```text
不要上传本地 server/dance.db 覆盖云端数据库。
```

云端数据库必须单独备份、单独迁移。

## 2. 官网

云服务器官网服务读取这个文件夹：

```text
/Users/lilei/Desktop/伊娃东方舞-开发工程/02-官方网站工程设计/官方网站
```

部署到服务器后建议目录：

```text
/www/wwwroot/dongfangwuquan/official-website
```

对应域名：

```text
www.dongfangwuquan.com
```

生产构建：

```text
npm run build
```

## 3. 电商工作台

如果电商工作台继续独立运行，读取这个文件夹：

```text
/Users/lilei/Desktop/伊娃东方舞-开发工程/07-电商系统
```

部署到服务器后建议目录：

```text
/www/wwwroot/dongfangwuquan/commerce-workbench
```

注意：

```text
电商数据应同步写入主后台数据库，不再把 data/inventory-store.json 当最终数据源。
```

生产环境启动时应配置：

```text
MAIN_DB_PATH=/www/wwwroot/dongfangwuquan/admin-platform/server/dance.db
```

## 4. 学习中心

当前可继续读取网课工程：

```text
/Users/lilei/Desktop/伊娃东方舞-开发工程/04-网课系统开发计划
```

对应域名：

```text
learn.dongfangwuquan.com
```

后续应逐步合并登录与会员数据到主后台。

## 5. 推荐 Nginx 域名指向

```text
www.dongfangwuquan.com      -> official-website
admin.dongfangwuquan.com    -> admin-platform
api.dongfangwuquan.com      -> admin-platform /api
auth.dongfangwuquan.com     -> admin-platform /login 与认证 API
learn.dongfangwuquan.com    -> student-platform / 网课系统
static.dongfangwuquan.com   -> CDN / uploads / 静态资源
```

## 6. 上传原则

必须上传：

```text
源码
package.json
package-lock.json
server
public / 静态文件
构建产物
```

禁止直接覆盖上传：

```text
server/dance.db
*.db
*.sqlite
node_modules
.env
日志文件
临时测试文件
```

数据库升级必须走迁移脚本或人工备份后执行。
