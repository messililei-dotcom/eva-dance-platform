import { Bot, Check, Ellipsis, Laptop, Monitor, MoreVertical, Share, Smartphone } from 'lucide-react';

const platforms = [
  {
    id: 'iphone',
    eyebrow: 'iPhone / iPad · Safari',
    title: '添加到主屏幕',
    icon: Smartphone,
    iconLabel: 'iOS',
    iconClassName: 'bg-gradient-to-br from-[#67B8FF] via-[#1677FF] to-[#0757C8] text-white ring-[#DCEEFF]',
    steps: [
      '如果现在是在微信里：点击右上角“…”（三个点），再点击“在默认浏览器中打开”或“在 Safari 中打开”。如果已经在 Safari，可以跳过这一步。',
      '确认已经进入 Safari：屏幕上能看到蓝色指南针形状的 Safari 图标，并且仍然显示本安装页面。',
      '点击 Safari 底部的“分享”按钮。它的样子是一个方框，上面有一支向上的箭头；如果底部没有，请点击右下角“…”后选择“共享”。',
      '在弹出的白色菜单中向上滑动，找到并点击“添加到主屏幕”。如果没有这一项，请滑到最下面，点击“编辑操作”，再把“添加到主屏幕”加进来。',
      '进入确认页面后，保持“作为网页 App 打开”处于开启状态，然后点击右上角蓝色的“添加”。',
      '回到手机主屏幕，找到“伊娃东方舞”图标。以后直接点击这个图标，就能打开网课系统。',
    ],
    note: '请一定先用 Safari 打开。只在微信里收藏网页，不等于已经安装到手机桌面。',
  },
  {
    id: 'android',
    eyebrow: '安卓 · Chrome / Edge',
    title: '安装到手机桌面',
    icon: Bot,
    iconLabel: '安卓',
    iconClassName: 'bg-gradient-to-br from-[#A4E85D] via-[#3DDC84] to-[#12A85A] text-[#073C25] ring-[#DDF8E8]',
    steps: [
      '如果现在是在微信里：点击右上角“…”（三个点），选择“在浏览器打开”或“在默认浏览器中打开”，再选择 Chrome 或 Edge。',
      '等待页面完全打开。确认顶部地址栏里仍然是“www.swod.com.cn”，不要关闭这个页面。',
      '点击浏览器右上角的“⋮”（竖着排列的三个点），打开浏览器菜单。',
      '使用 Chrome：点击“添加到主屏幕”，再点击“安装”。有些手机会直接显示“安装应用”，直接点击即可。',
      '使用 Edge：点击“应用”，再点击“将此站点安装为应用”；如果看到“添加到手机”，也可以直接点击。',
      '弹出确认窗口后，点击“安装”或“添加”，等待几秒钟，不要连续重复点击。',
      '回到手机桌面，找到“伊娃东方舞”图标。如果桌面没有，请向上滑动打开全部应用，再搜索“伊娃东方舞”。',
    ],
    note: '不同品牌手机的文字可能略有不同，认准“安装应用”或“添加到主屏幕”即可。',
  },
  {
    id: 'windows',
    eyebrow: 'Windows · Chrome / Edge',
    title: '安装网课系统App到桌面',
    icon: Monitor,
    iconLabel: 'Win',
    iconClassName: 'bg-gradient-to-br from-[#45B9FF] via-[#168DE2] to-[#0067C5] text-white ring-[#DDF2FF]',
    steps: [
      '打开电脑上的 Chrome 或 Edge 浏览器，在最上方地址栏输入“www.swod.com.cn/install”，然后按键盘上的 Enter（回车键）。',
      '页面打开后，查看地址栏最右边。如果看到“小电脑加向下箭头”或“安装”图标，点击它，再点击“安装”。',
      '如果地址栏没有安装图标，请点击浏览器右上角的“⋮”或“…”（三个点）打开菜单。',
      '使用 Chrome：依次点击“投放、保存和分享”→“将网页安装为应用”。',
      '使用 Edge：依次点击“应用”→“将此站点安装为应用”。部分版本需要先点击“更多工具”，再点击“应用”。',
      '看到确认窗口后，不需要修改名称，直接点击蓝色的“安装”按钮。',
      '安装完成后会自动打开独立窗口。以后可以从电脑桌面、底部任务栏或“开始”菜单找到“伊娃东方舞”。',
    ],
    note: '若电脑询问是否创建桌面快捷方式或固定到任务栏，建议勾选，今后打开会更方便。',
  },
  {
    id: 'mac',
    eyebrow: 'macOS · Safari / Chrome',
    title: '添加到 Dock',
    icon: Laptop,
    iconLabel: 'Mac',
    iconClassName: 'bg-gradient-to-br from-[#FF625A] via-[#AF52DE] to-[#0A84FF] text-white ring-[#F3E5FF]',
    steps: [
      '使用 Safari：先在 Safari 中打开“www.swod.com.cn/install”，确认页面已经完全显示。',
      '看向电脑屏幕最上方的菜单栏，点击“文件”，再点击“添加到程序坞”。',
      '弹出确认窗口后，不需要修改名称，点击右下角的“添加”。',
      '添加完成后，到屏幕底部的程序坞中找到“伊娃东方舞”图标；以后点击这个图标即可打开。',
      '如果 Safari 的“文件”菜单里没有“添加到程序坞”，请改用 Chrome 打开本页面。',
      '使用 Chrome：点击地址栏右侧的“安装”图标；如果没看到，请点击右上角“⋮”→“投放、保存和分享”→“将网页安装为应用”。',
      '点击“安装”完成确认，然后可从屏幕底部的程序坞或“启动台”找到“伊娃东方舞”。',
    ],
    note: 'Safari 需要 macOS Sonoma 14 或更新版本。旧版 Mac 请使用 Chrome 的安装方法。',
  },
];

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-[#F8F3EA] pb-20 pt-28 text-[#281516]">
      <section className="mx-auto max-w-6xl px-5">
        <div className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_20%_0%,#5B1B1E,#170405_68%)] px-6 py-12 text-center text-white shadow-2xl md:px-12 md:py-16">
          <img className="mx-auto h-24 w-24 rounded-[1.4rem] shadow-[0_18px_55px_rgba(0,0,0,.45)]" src="/icons/pwa/icon-192-20261006.png" alt="伊娃东方舞应用图标" />
          <p className="mt-7 text-sm font-semibold tracking-[.28em] text-[#DCBD7D]">网课系统App安装教程</p>
          <h1 className="mt-3 text-3xl font-bold md:text-5xl">把网课系统App装进手机和电脑</h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#E8D9CC] md:text-base">不需要应用商店。安装后可从桌面直接打开，使用独立全屏窗口，原有账号、课程和学习记录保持不变。</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            return (
              <article key={platform.id} id={platform.id} className="rounded-[1.6rem] border border-[#E6D8C4] bg-white p-6 shadow-[0_14px_45px_rgba(60,28,12,.07)] md:p-8">
                <div className="flex items-center gap-4">
                  <div aria-label={`${platform.iconLabel} 系统`} className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(20,30,60,.18)] ring-4 ${platform.iconClassName}`}>
                    <Icon size={24} strokeWidth={2.2} />
                    <span className="mt-0.5 text-[9px] font-black leading-none tracking-wide">{platform.iconLabel}</span>
                  </div>
                  <div><p className="text-xs font-bold tracking-wider text-[#A27B41]">{platform.eyebrow}</p><h2 className="mt-1 text-xl font-bold">{platform.title}</h2></div>
                </div>
                <ol className="mt-7 space-y-5">
                  {platform.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-[15px] leading-7 text-[#493738] md:text-base"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0E4CF] text-sm font-bold text-[#6E4814]">{index + 1}</span><span>{step}</span></li>
                  ))}
                </ol>
                <div className="mt-7 flex items-start gap-3 rounded-2xl bg-[#FBF7F0] p-4 text-sm font-medium leading-7 text-[#674F40]">
                  {platform.id === 'iphone' ? <Share className="mt-1 shrink-0 text-[#9A6E2D]" size={19} /> : platform.id === 'android' ? <MoreVertical className="mt-1 shrink-0 text-[#9A6E2D]" size={19} /> : <Ellipsis className="mt-1 shrink-0 text-[#9A6E2D]" size={19} />}
                  <span>{platform.note}</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-3 rounded-3xl border border-[#DCCBAE] bg-[#FFFDF8] p-6 sm:grid-cols-3">
          {['独立全屏启动', '自动保留登录', '断网记录自动补传'].map(item => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#543B31]"><Check size={17} className="text-[#A77B34]" />{item}</div>)}
        </div>
      </section>
    </div>
  );
}
