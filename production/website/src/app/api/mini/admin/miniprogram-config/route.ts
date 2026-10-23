import { jsonError, withDb } from '../../_helpers';

export async function GET() {
  try {
    return withDb((db) => {
      const queryStart = performance.now();
      const series = db.prepare(`SELECT *, (SELECT COUNT(*) FROM OnlineCourse WHERE series_id=CourseSeries.id AND status='published') as course_count FROM CourseSeries WHERE status='published' ORDER BY sort_order, created_at DESC`).all();
      const courses = db.prepare('SELECT * FROM OnlineCourse ORDER BY sort_order, created_at DESC').all();
      const videos = db.prepare('SELECT * FROM CourseVideo').all();
      const activeAuthorizations = db.prepare("SELECT COUNT(*) as cnt FROM CourseAuthorization WHERE status='active'").get() as { cnt: number };
      const todayProgress = db.prepare("SELECT COUNT(*) as cnt FROM VideoProgress WHERE date(last_play_at)=date('now','localtime')").get() as { cnt: number };
      const onlineMembers = db.prepare("SELECT COUNT(DISTINCT member_id) as cnt FROM VideoProgress WHERE datetime(last_play_at) >= datetime('now','localtime','-15 minutes')").get() as { cnt: number };
      const recentEvents = db.prepare(`
        SELECT '学习' as type, '学员观看课程视频' as content, last_play_at as created_at, 'success' as status
        FROM VideoProgress
        WHERE last_play_at IS NOT NULL
        UNION ALL
        SELECT '打卡' as type, COALESCE(NULLIF(remark, ''), '学员提交练习打卡') as content, created_at, 'processing' as status
        FROM PracticeCheckin
        UNION ALL
        SELECT '问答' as type, COALESCE(NULLIF(content, ''), '学员提交课程问题') as content, created_at, 'processing' as status
        FROM Question
        UNION ALL
        SELECT '笔记' as type, COALESCE(NULLIF(content, ''), '学员新增学习笔记') as content, created_at, 'success' as status
        FROM StudyNote
      `).all();
      const queryDuration = Math.max(1, Math.round(performance.now() - queryStart));
      const stats = {
        total_series: db.prepare('SELECT COUNT(*) as cnt FROM CourseSeries').get().cnt,
        published_series: series.length,
        members: db.prepare('SELECT COUNT(*) as cnt FROM Member').get().cnt,
        authorizations: db.prepare('SELECT COUNT(*) as cnt FROM CourseAuthorization').get().cnt,
        active_authorizations: activeAuthorizations.cnt,
        courses: courses.length,
        videos: videos.length,
        today_progress: todayProgress.cnt,
        online_members: onlineMembers.cnt,
      };
      const pageDefinitions = [
        { key: 'home', name: '首页', route: '/pages/home/home', module: '核心', customizable: true, record_count: series.length },
        { key: 'courses', name: '课程列表', route: '/pages/courses/courses', module: '学习', customizable: true, record_count: courses.length },
        { key: 'detail', name: '课程详情', route: '/pages/detail/detail', module: '学习', customizable: false, record_count: series.length },
        { key: 'player', name: '视频播放', route: '/pages/player/player', module: '学习', customizable: false, record_count: videos.length },
        { key: 'practice', name: '练习打卡', route: '/pages/practice/practice', module: '互动', customizable: true, record_count: db.prepare('SELECT COUNT(*) as cnt FROM PracticeCheckin').get().cnt },
        { key: 'questions', name: '课程问答', route: '/pages/questions/questions', module: '互动', customizable: true, record_count: db.prepare('SELECT COUNT(*) as cnt FROM Question').get().cnt },
        { key: 'notes', name: '学习笔记', route: '/pages/notes/notes', module: '学习', customizable: true, record_count: db.prepare('SELECT COUNT(*) as cnt FROM StudyNote').get().cnt },
        { key: 'profile', name: '个人中心', route: '/pages/profile/profile', module: '用户', customizable: true, record_count: stats.members },
      ].map((page) => ({
        ...page,
        status: page.record_count > 0 ? '已连接' : '待配置',
        response_ms: queryDuration,
      }));
      const app = {
        key: 'learning-miniapp',
        name: '伊娃东方舞个人中心',
        description: `已连接 ${series.length} 个已发布网课专栏、${courses.length} 个课程、${stats.active_authorizations} 个有效授权`,
        status: series.length ? 'published' : 'draft',
        version: process.env.NEXT_PUBLIC_MINIAPP_VERSION || '数据库联动版',
        lastUpdate: db.prepare("SELECT COALESCE(MAX(updated_at), MAX(created_at), date('now','localtime')) as value FROM CourseSeries").get().value,
        pageCount: pageDefinitions.length,
        userCount: stats.members,
        dailyActiveUsers: stats.online_members,
        apiBase: process.env.NEXT_PUBLIC_MINI_API_BASE || '/api/mini',
        appId: process.env.NEXT_PUBLIC_WECHAT_MINIAPP_ID || '',
      };
      return Response.json({
        success: true,
        data: {
          stats,
          apps: [app],
          pages: pageDefinitions,
          realtime: {
            currentOnline: stats.online_members,
            pageVisits: stats.today_progress,
            apiLatency: queryDuration,
            syncStatus: '正常',
            pages: pageDefinitions.slice(0, 6).map((page) => ({
              key: page.key,
              page: page.name,
              visitors: page.key === 'player' ? stats.online_members : Math.min(stats.members, page.record_count),
              status: page.status,
              response: page.response_ms,
            })),
            events: recentEvents
              .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
              .slice(0, 8),
          },
          courseLink: {
            appName: app.name,
            version: app.version,
            apiBase: app.apiBase,
            linkedContent: ['课程上架', '授权同步', '学习进度', '订单支付', '打卡问答'],
            pages: pageDefinitions.filter((page) => ['学习', '互动', '用户', '核心'].includes(page.module)),
          },
          home: { online: series, recommended: series.slice(0, 4) },
          system: { all: series },
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
