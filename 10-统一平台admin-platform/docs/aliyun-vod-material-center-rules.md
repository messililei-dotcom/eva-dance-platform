# 阿里云 VOD 素材中心接入规则

## 核心原则

素材中心的 `MaterialFolder` 是唯一目录来源。阿里云 VOD/OSS 负责存储和播放；当 VOD 存在素材中心缺失的视频时，系统自动补齐为素材中心记录，并放入根级默认文件夹 `默认素材`。

## 文件夹规则

- 新素材必须保存 `folder_id`，未指定时进入根级默认文件夹 `默认素材`。
- 创建、改名、移动文件夹时，同一父级下不能重名。
- 文件夹不能移动到自身或自己的子文件夹下。
- 素材批量移动、单个素材编辑必须校验目标文件夹存在。
- 删除普通文件夹时，该文件夹直属素材移动到 `默认素材`，子文件夹回到根级。
- 禁止删除 `默认素材`。

## 云端对象规则

- 云端路径只作为存储定位，不作为素材中心目录依据。
- 云端对象前缀使用稳定 ID：`material-center/folder-{folder_id}/...`。
- 可读文件夹名称只作为路径快照，目录重命名或拖拽移动不触发云端大文件搬迁。
- 业务播放优先使用 `vod_video_id` 获取播放地址或播放凭证。
- `file_url` 可以保存临时播放地址或外部直链，但不能替代 `vod_video_id`。
- VOD 已存在但 `Material.vod_video_id` 未匹配的视频，自动导入素材中心默认根目录，`file_path` 记录为 `vod:{VideoId}`。
- 素材中心记录绑定的 VOD 视频已不存在时，未被课程引用的素材自动删除；已被课程引用的素材清空失效 VOD 绑定并标记失败，避免破坏课程关联。

## VOD 配置

- `ALIYUN_VOD_REGION=cn-shenzhen`
- `ALIYUN_VOD_STORAGE_LOCATION=outin-c9ad447e607d11f18b5700163e18773e.oss-cn-shenzhen.aliyuncs.com`
- `ALIYUN_VOD_APP_ID=app-1000000`
- `ALIYUN_VOD_TEMPLATE_GROUP_ID=` 可按转码模板配置填写。

## 素材表字段约定

- `folder_id`：素材中心目录归属。
- `vod_video_id`：视频/音频在 VOD 的播放和管理 ID。
- `vod_media_id`：辅助媒资或其他云端媒资 ID。
- `file_path`：本地上传兼容路径，VOD 素材可保存 `vod:{VideoId}`。
- `file_url`：直链或播放地址缓存。
- `thumbnail`：素材封面，优先使用 VOD 截图或上传封面。

## 存量视频迁移

迁移脚本：`scripts/migrate-material-videos-to-vod.js`

默认只预览，不上传、不改数据库：

```bash
node scripts/migrate-material-videos-to-vod.js
```

如果源视频不在项目 `public/uploads` 下，指定原视频所在目录，脚本会按素材名称匹配：

```bash
node scripts/migrate-material-videos-to-vod.js --source-root=/path/to/videos
```

真正迁移时加 `--execute`。建议先小批量：

```bash
node scripts/migrate-material-videos-to-vod.js --limit=1 --execute
node scripts/migrate-material-videos-to-vod.js --ids=274,275 --execute
```

脚本只写入 `vod_video_id`、`vod_media_id` 和转码状态，不改 `id`、`folder_id`、`file_path`、`file_url`、`CourseVideo.material_id`。因此小程序和官网现有链接仍可回退到原路径。
