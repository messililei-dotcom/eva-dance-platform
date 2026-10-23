import evaPortrait2026 from './dance-circle-imported/eva-portrait-2026.json';
import swodTechniqueBootcampGraduation from './dance-circle-imported/2026-swod-technique-bootcamp-graduation.json';
import globalBulletin202601 from './dance-circle-imported/global-bulletin-2026-01.json';
import professionalCourseGuide2026 from './dance-circle-imported/2026-professional-course-guide.json';

export const danceCircleCategories = ['全部', '全球舞讯', '赛事报道', '课程纪实', '品牌动态', '人物故事', '东方舞人物志'] as const;

export type DanceCircleCategory = Exclude<(typeof danceCircleCategories)[number], '全部'>;

export type DanceCircleArticle = {
  slug: string;
  title: string;
  summary: string;
  canonicalPath?: string;
  keywords?: string[];
  category: DanceCircleCategory;
  date: string;
  location?: string;
  image: string;
  featured?: boolean;
  sourceNote?: string;
  sourceHref?: string;
  contentHtml?: string;
  relatedHref?: string;
  relatedLabel?: string;
  sections: Array<{ heading?: string; paragraphs: string[] }>;
};

export const danceCircleArticles: DanceCircleArticle[] = [
  evaPortrait2026 as DanceCircleArticle,
  professionalCourseGuide2026 as DanceCircleArticle,
  {
    slug: 'install-aiwa-dance-course-app',
    title: '伊娃东方舞网课系统App安装教程：手机和电脑都能一键打开',
    summary: '无需应用商店，iPhone、安卓、Windows和Mac都可以将伊娃东方舞网课系统安装到桌面，课程、账号和学习记录保持不变。',
    category: '品牌动态',
    date: '2026-08-09',
    location: '伊娃东方舞线上学院',
    image: '/icons/pwa/icon-512-20261005.png',
    sourceNote: '伊娃东方舞官方网站',
    relatedHref: '/install',
    relatedLabel: '打开完整安装教程',
    sections: [
      {
        paragraphs: [
          '为了让学员更快进入网课系统，伊娃东方舞官网现已支持将课程平台安装为桌面App。安装不需要访问应用商店，也不会改变原有账号、课程权限和学习记录。',
          '安装完成后，可以像打开普通App一样，直接从手机主屏幕、电脑桌面、任务栏或程序坞进入伊娃东方舞线上学院。',
        ],
      },
      {
        heading: 'iPhone或iPad：先用Safari打开',
        paragraphs: [
          '如果当前在微信中，请点击右上角“…”，选择“在默认浏览器中打开”或“在Safari中打开”。在Safari底部点击方框向上箭头形状的“分享”按钮，向上滑动菜单并选择“添加到主屏幕”。',
          '确认“作为网页App打开”保持开启，点击右上角“添加”。回到主屏幕后，即可看到“伊娃东方舞”图标。只在微信里收藏页面不等于完成安装。',
        ],
      },
      {
        heading: '安卓手机：使用Chrome或Edge',
        paragraphs: [
          '在微信右上角菜单中选择“在浏览器打开”，再选择Chrome或Edge。等待页面完全打开后，点击浏览器右上角竖向排列的三个点。',
          'Chrome中选择“添加到主屏幕”或“安装应用”；Edge中选择“应用”后再选择“将此站点安装为应用”。点击“安装”或“添加”后，回到桌面寻找“伊娃东方舞”图标即可。',
        ],
      },
      {
        heading: 'Windows电脑：安装到桌面',
        paragraphs: [
          '使用Chrome或Edge打开安装教程，先查看地址栏右侧是否有安装图标。如果有，点击图标后再点击“安装”。',
          '如果没有安装图标，Chrome可从右上角菜单依次选择“投放、保存和分享”、“将网页安装为应用”；Edge可依次选择“应用”、“将此站点安装为应用”。完成后可从桌面、任务栏或“开始”菜单进入。',
        ],
      },
      {
        heading: 'Mac电脑：添加到程序坞',
        paragraphs: [
          '使用Safari打开安装教程，在屏幕顶部菜单栏选择“文件”、“添加到程序坞”，然后点击“添加”。此方法需要macOS Sonoma 14或更新版本。',
          '旧版Mac可使用Chrome：点击地址栏右侧安装图标，或从右上角菜单选择“投放、保存和分享”、“将网页安装为应用”。',
        ],
      },
      {
        heading: '安装后会改变什么',
        paragraphs: [
          '新App使用独立全屏窗口，会保留登录状态，网络短暂中断时的部分学习记录也会在恢复联网后自动补传。安装只是增加一个更便捷的打开方式，不会重复购买课程，也不会清除原有数据。',
        ],
      },
    ],
  },
  globalBulletin202601 as DanceCircleArticle,
  swodTechniqueBootcampGraduation as DanceCircleArticle,
  {
    slug: 'dance-circle-launch',
    title: '“东方舞圈”正式上线：在这里看见全球东方舞',
    summary: '伊娃东方舞官网新增统一资讯与报道中心，持续整理全球舞圈动态、赛事资讯、课程纪实与舞者故事。',
    category: '品牌动态',
    date: '2026-07-22',
    location: '中国·长沙',
    image: '/images/school/classroom-1.jpg',
    featured: true,
    sections: [
      {
        paragraphs: [
          '东方舞从来不只是一门课程。它连接着音乐、舞台、教育、文化与一群持续成长的舞者。“东方舞圈”因此诞生，并成为伊娃东方舞官网所有新闻、资讯和专题报道的统一入口。',
          '栏目将聚合来自全球东方舞领域的公开信息，经核验、梳理和编辑后形成中文新闻稿、背景解读与趋势摘要。',
        ],
      },
      {
        heading: '我们关注什么',
        paragraphs: [
          '全球舞讯关注国际节展、行业趋势与教学观察；赛事报道记录赛场、选手与专业评审；课程纪实保留学习现场与结业成果；人物故事讲述舞者、教师与传承弟子的成长路径。',
          '每篇汇编内容都将标注来源与编辑说明，明确区分事实、引述和编辑观察。',
        ],
      },
    ],
  },
  {
    slug: 'alida-2026-graduation',
    title: 'AlidaLin林亦洛大师班学员结业汇报',
    summary: '记录 AlidaLin 林亦洛大师班 2026 年课程学员的结业展示与学习成果。',
    category: '课程纪实',
    date: '2026-05-24',
    location: '中国·长沙',
    image: '/images/reports/alida-2026-graduation/hero.png',
    sections: [
      {
        paragraphs: [
          '本次结业汇报集中展示学员在课程期间完成的训练与舞台实践，并完整记录七天课堂、交流与结业时刻。',
        ],
      },
    ],
  },
  {
    slug: 'eastern-dance-techniques-published',
    title: '《东方舞技巧大全》正式出版发行',
    summary: '从身体方法到教学语言，系统整理东方舞技巧学习路径。',
    category: '品牌动态',
    date: '2026-04-15',
    location: '中国',
    image: '/images/books/eastern-dance-techniques-cover.jpg',
    sections: [
      {
        paragraphs: [
          '《东方舞技巧大全》对东方舞学习中常见的技巧、身体认知和练习思路进行系统整理，为学习者和一线教师提供可查阅、可复盘的纸质参考。',
        ],
      },
      {
        heading: '从练习到教学',
        paragraphs: [
          '书籍与 SWOD 教学系统相互补充，帮助读者理解动作目标、训练逻辑与表达方法，并把个人练习经验转化为更清晰的教学语言。',
        ],
      },
    ],
  },
];

export function getDanceCircleArticle(slug: string) {
  return danceCircleArticles.find((article) => article.slug === slug);
}
