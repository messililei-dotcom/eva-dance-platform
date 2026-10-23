import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/render-install-video-slides.mjs <workdir>');

const assets = path.join(root, 'assets');
const htmlDir = path.join(root, 'html');
const narrationDir = path.join(root, 'narration');
fs.mkdirSync(htmlDir, { recursive: true });
fs.mkdirSync(narrationDir, { recursive: true });

const fileUrl = file => `file://${path.join(assets, file).replaceAll(' ', '%20')}`;

const chapters = [
  {
    id: '01-iphone',
    label: '第一章',
    platform: 'iPhone · Safari',
    slides: [
      {
        title: '用 Safari 打开安装教程',
        subtitle: '手机端教程从这里开始',
        image: 'mobile-iphone-good.png',
        device: 'phone',
        bullets: ['打开 Safari', '输入 www.swod.com.cn/install', '确认页面标题为“网课系统App安装教程”'],
        narration: '第一章，iPhone 安装。请使用 Safari 浏览器打开 www.swod.com.cn/install。如果链接是从微信打开的，请先点击右上角菜单，选择在 Safari 中打开。',
      },
      {
        title: '点击 Safari 底部“分享”',
        subtitle: '认准方框向上的箭头图标',
        image: 'mobile-top.png',
        device: 'iphone-share',
        bullets: ['点击屏幕底部分享图标', '如果工具栏被隐藏，轻点页面后再操作'],
        narration: '进入页面以后，点击 Safari 底部的分享图标，也就是方框向上的箭头。如果底部工具栏没有显示，先轻点一下页面。',
      },
      {
        title: '选择“添加到主屏幕”',
        subtitle: '向上滑动分享菜单即可找到',
        image: 'mobile-iphone-good.png',
        device: 'iphone-sheet',
        bullets: ['分享菜单向上滑动', '点击“添加到主屏幕”', '右上角点击“添加”'],
        narration: '在分享菜单中向上滑动，找到并点击添加到主屏幕。确认名称为伊娃东方舞，然后点击右上角的添加。',
      },
      {
        title: '安装完成，进入线上课程',
        subtitle: '以后直接从手机桌面打开',
        image: 'courses-mobile.png',
        device: 'phone-complete',
        bullets: ['桌面出现伊娃东方舞图标', '点击图标全屏打开', '登录后直接进入线上课程'],
        narration: '安装完成后，手机桌面会出现伊娃东方舞图标。点击图标即可全屏打开网课系统 App，登录后直接进入线上课程页面。',
      },
    ],
  },
  {
    id: '02-android',
    label: '第二章',
    platform: '安卓 · Chrome / Edge',
    slides: [
      {
        title: '用 Chrome 或 Edge 打开教程',
        subtitle: '不要在微信内置浏览器安装',
        image: 'mobile-android-best.png',
        device: 'phone',
        bullets: ['打开 Chrome 或 Edge', '访问 www.swod.com.cn/install', '找到安卓安装步骤'],
        narration: '第二章，安卓手机安装。请使用 Chrome 或 Edge 打开 www.swod.com.cn/install，不要直接在微信内置浏览器中安装。',
      },
      {
        title: '打开浏览器右上角菜单',
        subtitle: '点击三个点',
        image: 'mobile-top.png',
        device: 'android-menu',
        bullets: ['点击右上角三个点', '寻找“安装应用”或“添加到主屏幕”'],
        narration: '打开页面后，点击浏览器右上角的三个点。在菜单中找到安装应用；部分手机显示为添加到主屏幕。',
      },
      {
        title: '确认安装网课系统App',
        subtitle: '系统会弹出安装确认窗口',
        image: 'mobile-android-best.png',
        device: 'android-confirm',
        bullets: ['点击“安装”', '等待几秒完成安装', '无需进入应用商店'],
        narration: '点击安装应用以后，在确认窗口中选择安装。等待几秒即可完成，不需要进入任何应用商店。',
      },
      {
        title: '从安卓桌面打开',
        subtitle: '登录和学习记录会自动保留',
        image: 'courses-mobile.png',
        device: 'phone-complete',
        bullets: ['桌面点击伊娃东方舞图标', '登录后进入线上课程', '学习记录自动同步'],
        narration: '安装后，从安卓桌面点击伊娃东方舞图标。登录成功会进入线上课程，账号和学习记录会自动同步。',
      },
    ],
  },
  {
    id: '03-windows',
    label: '第三章',
    platform: 'Windows · Chrome / Edge',
    slides: [
      {
        title: '电脑浏览器打开安装教程',
        subtitle: 'Chrome 与 Edge 操作相同',
        image: 'desktop-top.png',
        device: 'desktop',
        bullets: ['打开 Chrome 或 Edge', '访问 www.swod.com.cn/install', '确认安装教程页面正常显示'],
        narration: '第三章，Windows 电脑安装。使用 Chrome 或 Edge 打开 www.swod.com.cn/install，两个浏览器的安装流程基本相同。',
      },
      {
        title: '点击地址栏右侧安装图标',
        subtitle: '也可以从右上角菜单进入',
        image: 'desktop-cards.png',
        device: 'windows-install',
        bullets: ['点击地址栏右侧安装图标', '没有图标时打开右上角菜单', '选择“安装伊娃东方舞”'],
        narration: '点击地址栏右侧的安装图标。如果没有看到图标，打开右上角菜单，选择安装伊娃东方舞。',
      },
      {
        title: '确认安装到 Windows',
        subtitle: '点击“安装”完成',
        image: 'desktop-cards.png',
        device: 'windows-confirm',
        bullets: ['确认应用名称', '点击“安装”', '可固定到任务栏或开始菜单'],
        narration: '在确认窗口检查应用名称，然后点击安装。安装完成以后，可以将网课系统固定到任务栏或开始菜单。',
      },
      {
        title: '独立窗口打开线上课程',
        subtitle: '没有普通浏览器地址栏',
        image: 'courses-desktop.png',
        device: 'desktop-complete',
        bullets: ['从桌面或开始菜单启动', '使用独立应用窗口', '登录后进入线上课程'],
        narration: '以后可以从桌面或开始菜单直接启动。网课系统会使用独立窗口打开，登录后直接进入线上课程。',
      },
    ],
  },
  {
    id: '04-macos',
    label: '第四章',
    platform: 'macOS · Safari / Chrome',
    slides: [
      {
        title: 'Mac 打开安装教程',
        subtitle: 'Safari 与 Chrome 都支持',
        image: 'desktop-top.png',
        device: 'desktop',
        bullets: ['打开 Safari 或 Chrome', '访问 www.swod.com.cn/install', 'Safari 建议使用 17 或更新版本'],
        narration: '第四章，Mac 电脑安装。使用 Safari 或 Chrome 打开 www.swod.com.cn/install。Safari 建议使用十七或更新版本。',
      },
      {
        title: 'Safari：文件 → 添加到 Dock',
        subtitle: 'Chrome 可点击地址栏安装图标',
        image: 'desktop-cards.png',
        device: 'mac-menu',
        bullets: ['Safari 打开顶部“文件”菜单', '选择“添加到 Dock”', 'Chrome 点击地址栏右侧安装图标'],
        narration: '如果使用 Safari，打开屏幕顶部的文件菜单，选择添加到 Dock。如果使用 Chrome，则点击地址栏右侧的安装图标。',
      },
      {
        title: '确认名称并添加',
        subtitle: '网课系统会出现在 Dock 或启动台',
        image: 'desktop-cards.png',
        device: 'mac-confirm',
        bullets: ['确认名称为伊娃东方舞', '点击“添加”', '从 Dock 或启动台启动'],
        narration: '确认名称为伊娃东方舞，然后点击添加。完成后，可以从 Dock 或启动台打开网课系统。',
      },
      {
        title: 'Mac 安装完成',
        subtitle: '一套账号，多端同步学习记录',
        image: 'courses-desktop.png',
        device: 'desktop-complete',
        bullets: ['独立窗口启动', '登录后进入线上课程', '手机与电脑学习记录同步'],
        narration: 'Mac 安装完成后会以独立窗口启动。登录后进入线上课程，同一个账号在手机和电脑之间同步学习记录。',
      },
    ],
  },
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function overlayFor(device) {
  if (device === 'iphone-share') return '<div class="safari-bar"><span>‹</span><span>›</span><b class="tap">⇧</b><span>▢</span><span>≡</span></div>';
  if (device === 'iphone-sheet') return '<div class="native-sheet ios"><div class="grab"></div><div class="sheet-title">Safari 分享菜单</div><div class="sheet-row">▣ <b>添加到主屏幕</b><span>›</span></div><div class="sheet-row">☆ 添加到个人收藏<span>›</span></div><button>添加</button></div>';
  if (device === 'android-menu') return '<div class="chrome-menu"><div>新标签页</div><div>分享…</div><div class="selected">▣ 安装应用</div><div>添加到主屏幕</div><div>设置</div></div><div class="menu-dot tap">⋮</div>';
  if (device === 'android-confirm') return '<div class="native-sheet android"><img src="' + fileUrl('mobile-top.png') + '"><div><b>安装“伊娃东方舞”?</b><p>安装后可从桌面快速打开</p><div class="actions"><span>取消</span><strong>安装</strong></div></div></div>';
  if (device === 'phone-complete') return '<div class="success-pill">✓ 已安装 · 正在打开线上课程</div>';
  if (device === 'windows-install') return '<div class="address-install tap">⬇</div><div class="browser-menu"><div>新建标签页</div><div class="selected">安装“伊娃东方舞”…</div><div>更多工具</div></div>';
  if (device === 'windows-confirm') return '<div class="desktop-dialog"><h3>安装应用</h3><p>是否安装“伊娃东方舞”？</p><div class="dialog-actions"><span>取消</span><b>安装</b></div></div>';
  if (device === 'mac-menu') return '<div class="mac-menubar">　Safari　<b>文件</b>　编辑　显示　历史记录</div><div class="mac-file-menu"><div>新建窗口</div><div>打开位置…</div><div class="selected">添加到 Dock…</div><div>打印…</div></div>';
  if (device === 'mac-confirm') return '<div class="desktop-dialog mac"><h3>添加到 Dock</h3><p>名称：伊娃东方舞</p><div class="dialog-actions"><span>取消</span><b>添加</b></div></div>';
  if (device === 'desktop-complete') return '<div class="success-pill desktop-success">✓ 安装完成 · 独立窗口已启动</div>';
  return '';
}

function renderSlide(chapter, slide, step) {
  const phone = slide.device.startsWith('phone') || slide.device.startsWith('iphone') || slide.device.startsWith('android');
  const image = fileUrl(slide.image);
  const bullets = slide.bullets.map((item, index) => `<li><span>${index + 1}</span>${escapeHtml(item)}</li>`).join('');
  const device = phone
    ? `<div class="phone"><div class="notch"></div><img src="${image}">${overlayFor(slide.device)}</div>`
    : `<div class="desktop"><div class="browser-top"><i></i><i></i><i></i><div class="address">🔒 www.swod.com.cn/install</div><b>⋮</b></div><img src="${image}">${overlayFor(slide.device)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
    <div class="brand"><img src="${fileUrl('icon.png')}"><span>伊娃东方舞</span><em>网课系统App安装视频教程</em></div>
    <div class="chapter">${escapeHtml(chapter.label)} · ${escapeHtml(chapter.platform)}</div>
    <main>${device}<section class="copy"><small>步骤 ${step} / 4</small><h1>${escapeHtml(slide.title)}</h1><h2>${escapeHtml(slide.subtitle)}</h2><ol>${bullets}</ol><footer>界面可能因系统版本略有差异</footer></section></main>
  </body></html>`;
}

const css = `
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB",sans-serif;color:#2a1112}body{background:radial-gradient(circle at 16% 12%,#fffdf7 0,#f6eddf 38%,#ead8bf 100%)}
.brand{position:absolute;left:70px;top:44px;height:70px;display:flex;align-items:center;gap:16px;font-family:"Songti SC",serif;font-size:28px;font-weight:700}.brand img{width:64px;height:64px;border-radius:16px}.brand em{font-family:-apple-system,sans-serif;font-size:18px;font-style:normal;font-weight:600;color:#936d3d;margin-left:18px}.chapter{position:absolute;right:70px;top:54px;padding:14px 24px;border:1px solid #c7a66c;border-radius:999px;color:#6a151b;font-size:20px;font-weight:700;background:#fff9ef}
main{position:absolute;inset:142px 70px 52px;display:flex;align-items:center;gap:74px}.copy{flex:1;max-width:740px}.copy small{color:#9b733e;font-size:22px;font-weight:800;letter-spacing:.18em}.copy h1{font-family:"Songti SC",serif;font-size:58px;line-height:1.18;margin:24px 0 12px}.copy h2{font-size:25px;font-weight:500;color:#796568;margin:0 0 42px}.copy ol{list-style:none;margin:0;padding:0;display:grid;gap:22px}.copy li{display:flex;align-items:center;gap:18px;font-size:25px;line-height:1.4}.copy li span{width:42px;height:42px;border-radius:50%;background:#6e171c;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800}.copy footer{margin-top:42px;color:#9a8781;font-size:18px}
.phone{position:relative;width:440px;height:908px;border:13px solid #181516;border-radius:66px;background:#fff;overflow:hidden;box-shadow:0 35px 85px rgba(63,25,18,.28)}.phone>.notch{position:absolute;z-index:8;top:9px;left:50%;transform:translateX(-50%);width:150px;height:34px;border-radius:20px;background:#121011}.phone>img{width:100%;height:100%;object-fit:cover}.safari-bar{position:absolute;left:14px;right:14px;bottom:14px;height:76px;border-radius:28px;background:rgba(245,245,245,.96);display:flex;align-items:center;justify-content:space-around;font-size:34px;color:#2363ae;box-shadow:0 8px 30px #0003}.tap{position:relative;color:#7e171d!important;background:#f1d59c!important;border-radius:50%;width:56px;height:56px;display:grid!important;place-items:center;box-shadow:0 0 0 0 rgba(135,27,34,.6);animation:pulse 1.3s infinite}.native-sheet{position:absolute;left:14px;right:14px;bottom:14px;background:#f4f4f6;border-radius:30px;padding:18px;box-shadow:0 -14px 46px #0004}.native-sheet .grab{width:48px;height:6px;background:#aaa;border-radius:9px;margin:0 auto 15px}.sheet-title{text-align:center;font-size:20px;font-weight:700;margin-bottom:10px}.sheet-row{height:62px;background:#fff;border-bottom:1px solid #eee;padding:18px;font-size:18px;display:flex;gap:12px}.sheet-row span{margin-left:auto}.native-sheet button{position:absolute;right:22px;top:22px;border:0;background:none;color:#1677ff;font-size:19px;font-weight:800}.chrome-menu{position:absolute;right:15px;top:62px;width:285px;background:#fff;border-radius:12px;padding:10px;box-shadow:0 18px 50px #0005;font-size:18px}.chrome-menu div{padding:17px 18px}.selected{background:#f3e2bd!important;color:#6c1218!important;font-weight:800;border-radius:9px}.menu-dot{position:absolute;right:20px;top:18px;font-size:30px}.native-sheet.android{display:flex;align-items:center;gap:18px;padding:24px}.native-sheet.android img{width:76px;height:76px;border-radius:17px;object-fit:cover}.native-sheet.android b{font-size:20px}.native-sheet.android p{margin:8px 0;color:#777}.actions{display:flex;gap:34px;justify-content:flex-end;color:#1677ff;font-size:18px}.success-pill{position:absolute;left:34px;right:34px;bottom:34px;background:rgba(31,113,54,.94);color:#fff;padding:20px;border-radius:20px;text-align:center;font-size:19px;font-weight:800}
.desktop{position:relative;width:1260px;height:790px;border-radius:25px;background:#fff;overflow:hidden;box-shadow:0 34px 85px #3b1b133d;border:1px solid #bea98f}.desktop+.copy{max-width:430px}.desktop+.copy h1{font-size:47px}.desktop+.copy li{font-size:21px}.desktop>.browser-top{height:70px;background:#eee9e3;display:flex;align-items:center;gap:12px;padding:0 20px}.browser-top i{width:16px;height:16px;border-radius:50%;background:#e76758}.browser-top i:nth-child(2){background:#e9b64f}.browser-top i:nth-child(3){background:#61b95a}.address{height:42px;border-radius:22px;background:#fff;flex:1;margin-left:14px;padding:10px 24px;color:#655}.browser-top>b{font-size:28px}.desktop>img{width:100%;height:720px;object-fit:cover;object-position:top}.address-install{position:absolute;z-index:6;right:87px;top:8px;font-size:24px}.browser-menu{position:absolute;z-index:5;right:18px;top:66px;width:310px;background:#fff;padding:12px;border-radius:12px;box-shadow:0 18px 50px #0004;font-size:19px}.browser-menu div{padding:15px}.desktop-dialog{position:absolute;z-index:7;left:50%;top:48%;transform:translate(-50%,-50%);width:460px;background:#fff;border-radius:20px;padding:30px;box-shadow:0 24px 90px #0006}.desktop-dialog h3{font-size:28px;margin:0 0 16px}.desktop-dialog p{font-size:21px}.dialog-actions{display:flex;justify-content:flex-end;gap:28px;margin-top:28px;font-size:20px}.dialog-actions b{background:#74171d;color:#fff;padding:10px 28px;border-radius:9px}.mac-menubar{position:absolute;z-index:8;left:0;right:0;top:0;height:34px;background:#f4f4f4;padding:7px 18px;font-size:15px}.mac-file-menu{position:absolute;z-index:9;left:116px;top:34px;width:270px;background:rgba(255,255,255,.96);padding:10px;border-radius:0 0 12px 12px;box-shadow:0 12px 35px #0003;font-size:17px}.mac-file-menu div{padding:10px 14px}.desktop-success{left:330px;right:330px;bottom:40px;font-size:22px}
@keyframes pulse{0%{box-shadow:0 0 0 0 #a3293566}70%{box-shadow:0 0 0 22px #a3293500}100%{box-shadow:0 0 0 0 #a3293500}}
`;

for (const chapter of chapters) {
  chapter.slides.forEach((slide, index) => {
    const base = `${chapter.id}-${index + 1}`;
    fs.writeFileSync(path.join(htmlDir, `${base}.html`), renderSlide(chapter, slide, index + 1));
    fs.writeFileSync(path.join(narrationDir, `${base}.txt`), slide.narration);
  });
}

fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(chapters.map(chapter => ({
  id: chapter.id,
  label: chapter.label,
  platform: chapter.platform,
  slides: chapter.slides.map((_, index) => `${chapter.id}-${index + 1}`),
})), null, 2));

console.log(`Generated ${chapters.length * 4} tutorial slides in ${root}`);
