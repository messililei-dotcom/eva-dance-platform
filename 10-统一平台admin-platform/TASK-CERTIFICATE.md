# 证书系统全平台统一合并 - CodeX 开发任务

## 项目信息
- 项目路径：`~/Desktop/伊娃东方舞-开发工程/10-统一平台admin-platform`
- 技术栈：Next.js 14 (App Router) + TypeScript + Ant Design + SQLite (better-sqlite3)
- 数据库：admin.db (已存在于项目根目录)
- 编译命令：`npm run build`（使用 NEXT_DIST_DIR=.next-build）

## 数据库表结构

### Certificate 表（已有）
```sql
CREATE TABLE IF NOT EXISTS Certificate (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_no TEXT NOT NULL UNIQUE,
  series_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  pdf_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### event_certificates 表（已有，赛事证书）
```sql
CREATE TABLE IF NOT EXISTS event_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL,
  group_id INTEGER DEFAULT 0,
  player_id INTEGER NOT NULL,
  award_id INTEGER DEFAULT 0,
  certificate_no TEXT NOT NULL UNIQUE,
  certificate_url TEXT DEFAULT '',
  issued_at TEXT DEFAULT '',
  issued_by TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 现有文件

### 后端 API
- `src/app/api/certificates/route.ts` — GET 方法（已有），返回证书列表，需要加 POST 方法
- `src/app/api/certificates/stats/route.ts` — GET 统计
- `src/app/api/mini/certificates/route.ts` — 小程序端证书API（已有 GET）
- `src/app/api/training-db.ts` — 包含 `hasAuth()` 函数（检查 Authorization header）

### 前端页面
- `src/app/(admin)/certificates/page.tsx` — 管理后台证书页面（107行，有占位数据需修复）
- `src/app/learn/page.tsx` — 学员中心首页（已有证书展示区域）

### API 客户端
- `src/lib/api.ts` — 已有 `certApi.list()` 和 `certApi.stats()`

## 任务列表（按优先级）

### 🅰️ 任务1：修复管理后台发证 API（POST /api/certificates）

修改 `src/app/api/certificates/route.ts`，添加 POST 方法：

```typescript
export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const body = await request.json();
  // 验证必填字段
  if (!body.member_id || !body.series_id) {
    return Response.json({ success: false, error: '学员和课程不能为空' }, { status: 400 });
  }
  // 生成证书编号: EVA-{时间戳}-{member_id}-{series_id}
  const certNo = `EVA-${Date.now()}-${body.member_id}-${body.series_id}`;
  
  const db = openAdminDb();
  try {
    ensureCertificateTables(db);
    // 检查是否已颁发过
    const existing = db.prepare('SELECT id FROM Certificate WHERE member_id=? AND series_id=? AND status=\'active\'')
      .get(body.member_id, body.series_id);
    if (existing) {
      return Response.json({ success: false, error: '该学员已获得此课程证书' }, { status: 409 });
    }
    const result = db.prepare(
      'INSERT INTO Certificate (certificate_no, series_id, member_id, issue_date, status) VALUES (?, ?, ?, datetime(\'now\',\'localtime\'), \'active\')'
    ).run(certNo, body.series_id, body.member_id);
    return Response.json({ success: true, data: { id: result.lastInsertRowid, certificate_no: certNo } });
  } finally {
    db.close();
  }
}
```

也要添加 DELETE 方法（撤销证书）：
```typescript
export async function DELETE(request: Request) {
  if (!hasAuth(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ success: false, error: '缺少证书ID' }, { status: 400 });
  const db = openAdminDb();
  try {
    ensureCertificateTables(db);
    db.prepare("UPDATE Certificate SET status='revoked' WHERE id=?").run(id);
    return Response.json({ success: true });
  } finally {
    db.close();
  }
}
```

### 🅱️ 任务2：修复管理后台证书页面表单

修改 `src/app/(admin)/certificates/page.tsx`：

核心改动：
1. **加载真实学员数据** — 调用 fetch('/api/members') 或数据库查询获取学员列表
2. **加载真实课程数据** — 从 CourseSeries 表获取课程列表
3. **修复"颁发证书"Modal** — 用真实下拉菜单替换占位数据
4. **发证后自动刷新列表**
5. **撤销功能真正调用 DELETE API**

```typescript
// 需要添加的 state
const [members, setMembers] = useState<any[]>([]);
const [seriesList, setSeriesList] = useState<any[]>([]);
const [selectedMember, setSelectedMember] = useState<number | null>(null);
const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
const [submitting, setSubmitting] = useState(false);

// 页面加载时获取学员和课程数据
useEffect(() => {
  loadCertificates();
  fetchMembers();
  fetchSeries();
}, []);

// 需要编写的函数
const fetchMembers = async () => {
  const res = await fetch('/api/members', { headers: authHeader });
  const data = await res.json();
  setMembers(data || []);
};

const fetchSeries = async () => {
  const db = ... 或者使用已有的API
  实际上可以用 fetch('/api/course/series')
  但简单起见可以直接加载所有 CourseSeries
  建议使用现有的 seriesList API
  先检查 existing API routes
};

const handleIssue = async () => {
  if (!selectedMember || !selectedSeries) return;
  setSubmitting(true);
  try {
    const res = await fetch('/api/certificates', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: selectedMember, series_id: selectedSeries }),
    });
    const data = await res.json();
    if (data.success) {
      message.success('证书颁发成功');
      setModalVisible(false);
      loadCertificates();
    } else {
      message.error(data.error || '颁发失败');
    }
  } catch (err: any) {
    message.error(err.message || '颁发失败');
  } finally {
    setSubmitting(false);
  }
};

// 撤销函数
const handleRevoke = async (id: number) => {
  Modal.confirm({
    title: '确认撤销此证书？',
    content: '撤销后该证书将标记为无效',
    onOk: async () => {
      const res = await fetch(`/api/certificates?id=${id}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      const data = await res.json();
      if (data.success) {
        message.success('已撤销');
        loadCertificates();
      }
    }
  });
};
```

authHeader 的获取方式参考该文件已有的模式（当前页面使用 certApi，需要改造为 fetch + authHeader 或扩展 certApi）。

### 🅲 任务3：自动发证 API

新建文件 `src/app/api/certificates/auto-issue/route.ts`：

该 API 检查所有已完成的视频进度（VideoProgress WHERE completed=1），
对每个学完某个系列所有视频的学员自动颁发证书。

逻辑：
1. 查询所有 series_id 和每个 series 的视频总数
2. 查询 VideoProgress 中每个 member 在每个 series 完成的视频数
3. 如果完成数=总数且还没有 Certificate 记录，则自动插入

```typescript
import { openAdminDb } from '@/lib/server/admin-db';

export async function POST(request: Request) {
  const db = openAdminDb();
  try {
    // 1. 获取每个系列的视频总数
    const seriesVideoCount = db.prepare(`
      SELECT oc.series_id, COUNT(cv.id) as video_count
      FROM OnlineCourse oc
      JOIN CourseVideo cv ON cv.course_id = oc.id
      WHERE oc.status = 'published' AND cv.status = 'published'
      GROUP BY oc.series_id
    `).all() as any[];

    // 2. 获取每个学员在每个系列完成的视频数
    const completedProgress = db.prepare(`
      SELECT vp.member_id, oc.series_id, COUNT(*) as completed_count
      FROM VideoProgress vp
      JOIN CourseVideo cv ON vp.video_id = cv.id
      JOIN OnlineCourse oc ON cv.course_id = oc.id
      WHERE vp.completed = 1
      GROUP BY vp.member_id, oc.series_id
    `).all() as any[];

    // 3. 对比，生成证书
    let issued = 0;
    for (const series of seriesVideoCount) {
      for (const progress of completedProgress) {
        if (progress.series_id === series.series_id && progress.completed_count >= series.video_count) {
          // 检查是否已发证
          const existing = db.prepare(
            'SELECT id FROM Certificate WHERE member_id=? AND series_id=? AND status=\'active\''
          ).get(progress.member_id, series.series_id);
          if (!existing) {
            const certNo = `EVA-${Date.now()}-${progress.member_id}-${series.series_id}`;
            db.prepare(
              'INSERT INTO Certificate (certificate_no, series_id, member_id, issue_date, status) VALUES (?, ?, ?, datetime(\'now\',\'localtime\'), \'active\')'
            ).run(certNo, progress.member_id, series.series_id);
            issued++;
          }
        }
      }
    }
    return Response.json({ success: true, data: { issued } });
  } finally {
    db.close();
  }
}
```

### 🅳 任务4：扩展 certApi 客户端

在 `src/lib/api.ts` 中，扩展现有 certApi：

```typescript
export const certApi = {
  list: async (): Promise<any[]> => {
    const res = await api.get('/certificates');
    return res.data;
  },
  stats: async (): Promise<any> => {
    const res = await api.get('/certificates/stats');
    return res.data;
  },
  issue: async (memberId: number, seriesId: number): Promise<any> => {
    const res = await api.post('/certificates', { member_id: memberId, series_id: seriesId });
    return res.data;
  },
  revoke: async (id: number): Promise<any> => {
    const res = await api.delete(`/certificates?id=${id}`);
    return res.data;
  },
  autoIssue: async (): Promise<any> => {
    const res = await api.post('/certificates/auto-issue');
    return res.data;
  },
};
```

### 🅴 任务5：管理后台证书页面增强（完整改造）

重构 `src/app/(admin)/certificates/page.tsx`：

涉及的改动：
1. 用真实 API 加载所有学员（用于发证表单）
2. 用真实 API 加载所有课程系列（用于发证表单）
3. 发证 Modal 用真实的下拉选择
4. 添加"自动颁发"按钮（调用 auto-issue API）
5. 撤销功能真的调用后端 API
6. 证书列表增加"学员"和"课程"的搜索过滤
7. 证书详情/查看功能（如果有 pdf_url）

### 🅵 任务6：学员中心证书展示优化（已有但增强）

`src/app/learn/page.tsx` 已展示证书。如果需要，增加：
- 证书详情弹窗
- 证书编号完整显示
- 空状态优化

### 🅶 任务7：赛事证书合并查看（可选）

在管理后台证书页面增加标签页或筛选，可以查看 event_certificates 的证书。

## 认证方式

管理后台API使用 `Authorization` header 认证。获取方式：
```typescript
const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
```

## 重要约束
1. 不要修改数据库结构（表已存在）
2. 不要上传任何数据库文件到服务器
3. 编译通过后自动验证
4. 所有新API保持 `/api/certificates/*` 路径模式
5. 管理后台页面使用现有 Ant Design 组件风格

## 完成验证标准
1. `npm run build` 编译通过
2. POST /api/certificates 可以手动颁发证书
3. DELETE /api/certificates?id=X 可以撤销证书
4. 管理后台证书页面可以搜索学员/课程、颁发、撤销
5. POST /api/certificates/auto-issue 可以自动检测并颁发
6. 学员中心首页能看到证书
