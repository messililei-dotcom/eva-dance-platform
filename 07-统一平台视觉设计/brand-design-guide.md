# 伊娃东方舞 — 统一品牌设计规范

> 版本：v1.0 | 适用平台：admin.dongfangwuquan.com（统一管理后台）  
> 技术栈：Ant Design 5.x + Nex.js 14 + Tailwind CSS

---

## 1. 品牌色体系

### 1.1 主色（Primary）

| 色名 | 色值 | Token | 用途 |
|------|------|-------|------|
| 深红 / Crimson | `#8B1A1A` | `colorPrimary` | 按钮主色、品牌强调、重点文字、错误态 |
| 金色 / Gold | `#C8A96E` | `colorGold` | 品牌点缀、高亮、勋章/荣誉、VIP标识 |

### 1.2 主色扩展

```less
@crimson:      #8B1A1A;
@crimson-dark: #6B1010;   // hover / active / 深色背景
@crimson-light:#A83030;   // 浅色背景上使用
@crimson-50:   #F9EEEE;   // 极浅背景 / 表格行悬停

@gold:         #C8A96E;
@gold-dark:    #B8944E;   // 按钮 hover
@gold-light:   #D8C48E;   // 浅色点缀
@gold-pale:    #E8D5B7;   // 边框 / 分割线
@gold-50:      #FAF7F0;   // 极浅背景
```

### 1.3 中性色 / Neutral

| 色名 | 色值 | 用途 |
|------|------|------|
| 纯黑 | `#1A1A1A` | 正文标题 |
| 深灰 | `#4A4A4A` | 正文 |
| 中灰 | `#7A7A7A` | 次级文字 / 说明 |
| 浅灰 | `#9CA3AF` | 禁用文字 / 占位符 |
| 极浅灰 | `#F0F0F0` | 边框 / 分割线 |
| 背景灰 | `#FAFAFA` | 页面背景 |
| 暖白 | `#FAF7F2` | 暖色调背景 |
| 纯白 | `#FFFFFF` | 卡片 / 弹窗背景 |

### 1.4 功能色 / Semantic

| 类型 | 色值 | 用途 |
|------|------|------|
| 成功 | `#22C55E` | 支付成功、完成状态 |
| 警告 | `#F59E0B` | 待处理、风险提醒 |
| 错误 | `#EF4444` | 失败、错误提示 |
| 信息 | `#3B82F6` | 信息提示、链接 |
| 链接 | `#C8A96E`（gold） | 统一链接色 |

### 1.5 后台专用功能色

| 场景 | 色值 | 用途 |
|------|------|------|
| 深紫渐变 | `#1e1b4b` → `#312e81` → `#4c1d95` | 登录页背景 |
| 紫色主色 | `#a855f7` / `#7c3aed` | 登录页按钮、Logo 图标颜色 |
| 通知红点 | `#F5222D` | Badge 未读 |

---

## 2. 字体规范

### 2.1 字体栈

```css
/* 标题 / 品牌 */
font-family: 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif;

/* 正文 / UI */
font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei',
             'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif;

/* 数字 */
font-feature-settings: 'tnum';   /* tabular numbers 等宽数字 */
```

### 2.2 字号层级（Ant Design Token）

```json
{
  "fontSize": 14,
  "fontSizeSM": 12,
  "fontSizeLG": 16,
  "fontSizeXL": 20,
  "fontSizeHeading1": 28,
  "fontSizeHeading2": 24,
  "fontSizeHeading3": 20,
  "fontSizeHeading4": 18,
  "fontSizeHeading5": 16
}
```

### 2.3 字重

| 层级 | 字重 | 场景 |
|------|------|------|
| 品牌标题 | 700 (Bold) | 页面标题、LOGO |
| 模块标题 | 600 (Semibold) | 卡片标题、弹窗标题 |
| 正文 | 400 (Regular) | 默认内容 |
| 辅助 | 400 (Regular) | 说明文字 |

---

## 3. 间距规范

### 3.1 基础间距（Ant Design Token）

```json
{
  "marginXXS": 4,
  "marginXS": 8,
  "marginSM": 12,
  "margin": 16,
  "marginMD": 20,
  "marginLG": 24,
  "marginXL": 32,
  "marginXXL": 48
}
```

### 3.2 常用布局间距

| 场景 | 间距 |
|------|------|
| 页面内边距 | `padding: 24px` |
| 卡片间距 | `gap: 16px` (Row gutter) |
| 表单项间距 | `margin-bottom: 24px` |
| 列表项间距 | `margin-bottom: 12px` |
| 按钮间距 | `gap: 8px` |
| 侧栏内边距 | `padding: 16px` |

---

## 4. 圆角规范

| 层级 | 值 | 场景 |
|------|-----|------|
| 无 | `0` | 弹窗、大布局 |
| 小 | `4px` | 输入框、小按钮 |
| 中 | `6px` | 卡片、表格、列表项 |
| 大 | `8px` | 按钮、卡片主区域 |
| 圆 | `12px` | 特殊卡片、数据展示卡片 |
| 全圆 | `50%` | 头像、标签 |

---

## 5. 阴影规范

| 层级 | 效果 | 场景 |
|------|------|------|
| flat | `none` | 表格、列表 |
| sm | `0 1px 2px rgba(0,0,0,0.05)` | 卡片 hover |
| md | `0 4px 12px rgba(0,0,0,0.08)` | 普通卡片 |
| lg | `0 8px 24px rgba(0,0,0,0.12)` | 弹窗、下拉菜单 |
| xl | `0 20px 60px rgba(0,0,0,0.15)` | 大弹窗 / Modal |
| glow-gold | `0 4px 20px rgba(200,169,110,0.3)` | 金色高亮卡片 |
| glow-crimson | `0 4px 20px rgba(139,26,26,0.2)` | 深红强调元素 |

---

## 6. 图标风格

- **图标库**：使用 `@ant-design/icons`
- **风格**：线框风格（Outlined），5.x 默认
- **大小**：`16px`（默认），`20px`（导航菜单），`24px`（数据卡片图标）
- **颜色**：继承文本色，或使用功能色指定的品牌色

---

## 7. 后台 Layout 规范

### 7.1 页面结构

```
┌────────────────────────────────────────────┐
│  Header (64px)                             │
│  ┌───────────┬────────────────────────┐    │
│  │ 折叠按钮   │ 面包屑   搜索  通知 头像 │    │
│  └───────────┴────────────────────────┘    │
├──────────┬─────────────────────────────────┤
│ Sider    │  Content                        │
│ (200px   │  padding: 24px                  │
│  collaps │  ┌─────────────────────────┐    │
│  -ible)  │  │  数据卡片 Grid          │    │
│          │  ├─────────────────────────┤    │
│  Logo    │  │  表格 / 列表            │    │
│  菜单    │  ├─────────────────────────┤    │
│          │  │  分页                   │    │
│          │  └─────────────────────────┘    │
├──────────┴─────────────────────────────────┤
│  Footer (可选)                              │
└────────────────────────────────────────────┘
```

### 7.2 Header 规范

| 项目 | 值 |
|------|-----|
| 高度 | `64px` |
| 背景色 | `#FFFFFF` |
| 底部边框 | `1px solid #F0F0F0` |
| 内边距 | `0 24px` |
| 面包屑 | 左侧，使用 Breadcrumb 组件 |
| 搜索 | 居中，宽度 `200px` |
| 通知 | 右侧，Badge 组件 |
| 头像 | 右侧，展示管理员姓名/头像 |

### 7.3 Sider 规范

| 项目 | 值 |
|------|-----|
| 展开宽度 | `200px` |
| 折叠宽度 | `64px` / `80px` |
| 背景 | `#FFFFFF`（亮色）/ `#141414`（暗色） |
| 右边框 | `1px solid #F0F0F0` |
| 顶部 Logo 区域 | 高度 `64px`，居中/左对齐 |

### 7.4 内容区规范

| 项目 | 值 |
|------|-----|
| 内边距 | `24px`（页面），`24px`（卡片） |
| 卡片背景 | `#FFFFFF` |
| 卡片圆角 | `8px` |
| 全局背景 | `#FAFAFA` / `#F5F5F5` |

---

## 8. 暗色主题规范

### 8.1 基础色

| Token | 亮色 | 暗色 |
|-------|------|------|
| `colorBgLayout` | `#FAFAFA` | `#141414` |
| `colorBgContainer` | `#FFFFFF` | `#1D1D1D` |
| `colorBgElevated` | `#FFFFFF` | `#262626` |
| `colorBorder` | `#D9D9D9` | `#424242` |
| `colorText` | `#4A4A4A` | `#E5E5E5` |
| `colorTextHeading` | `#1A1A1A` | `#FFFFFF` |

### 8.2 品牌色在暗色背景上

- 深红 `#8B1A1A` → 暗色下使用 `#C62828`（更亮，保持可读性）
- 金色 `#C8A96E` → 保持不变（已足够亮）
- 紫色品牌元素 → 保持不变

---

## 9. 响应式断点

```json
{
  "mobile":  "max-width: 576px",
  "tablet":  "min-width: 576px",
  "desktop": "min-width: 992px",
  "wide":    "min-width: 1200px",
  "ultra":   "min-width: 1600px"
}
```

后台以桌面优先设计，最低支持 `1280px` 宽度。

---

## 10. 品牌应用示例

### 按钮

| 按钮类型 | 背景 | 文字 | Hover |
|----------|------|------|-------|
| Primary | `#8B1A1A` （crimson） | `#FFFFFF` | `#6B1010` |
| Gold | `#C8A96E` | `#FFFFFF` | `#B8944E` |
| Default | `#FFFFFF` | `#4A4A4A` | `#F9EEEE` |
| Text | transparent | `#8B1A1A` | `#F9EEEE` |

### 标签 / Tag

| 类型 | 背景 | 边框 | 文字 |
|------|------|------|------|
| 成功 | `#F0FFF4` | `#22C55E` | `#22C55E` |
| 待处理 | `#FFFBEB` | `#F59E0B` | `#F59E0B` |
| 金牌会员 | `#FAF7F0` | `#C8A96E` | `#C8A96E` |
| VIP | `#F9EEEE` | `#8B1A1A` | `#8B1A1A` |

---

> **更新记录**  
> v1.0 - 2026-05-23 - 初始版本发布  
> 基于官方网站 tailwind theme 与 admin-platform 现有实现统一提取
