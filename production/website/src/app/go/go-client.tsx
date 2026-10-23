'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function GoClient() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f0f] via-[#1a1a1a] to-[#0f0f0f] flex flex-col items-center">
      <div className="w-full max-w-[420px] px-6 pt-12 pb-8 flex flex-col items-center min-h-screen">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-[20px] bg-gradient-to-br from-[#d4a853] to-[#b8860b] flex items-center justify-center shadow-lg shadow-[#d4a853]/30 mb-4 overflow-hidden">
            <Image src="/logo-transparent-20261005.png" alt="伊娃东方舞" width={80} height={80} className="h-full w-full object-cover" priority />
          </div>
          <h1 className="text-[22px] font-bold tracking-wider bg-gradient-to-r from-[#d4a853] to-[#f5e6b8] bg-clip-text text-transparent">
            伊娃东方舞
          </h1>
          <p className="text-[13px] text-white/50 mt-1 tracking-[2px]">官 方 网 站</p>
        </div>

        {/* Intro Card */}
        <div className="w-full bg-white/[0.06] backdrop-blur-[20px] border border-white/10 rounded-[20px] p-7 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-[#d4a853]">💃 专注东方舞师资培训</h2>
          <p className="text-sm leading-relaxed text-white/75 mb-2">
            十二年匠心传承 · 培养10000+专业舞蹈教师
          </p>
          <p className="text-sm leading-relaxed text-white/60">
            线上学院 · 线下集训 · 成品舞课程 · 师资认证
          </p>
        </div>

        {/* Features */}
        <div className="w-full bg-white/[0.06] backdrop-blur-[20px] border border-white/10 rounded-[20px] p-7 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-[#d4a853]">📖 学习资源</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🎬', label: '线上学院', href: '/courses' },
              { icon: '💃', label: '成品舞课程', href: '/courses' },
              { icon: '🏫', label: '线下培训', href: '/offline' },
              { icon: '🎓', label: '师资认证', href: '/certification' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="bg-white/[0.05] rounded-xl p-4 text-center border border-white/[0.06] hover:bg-white/10 transition-colors"
              >
                <span className="block text-[22px] mb-1.5">{item.icon}</span>
                <span className="text-xs text-white/60">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="w-full bg-white/[0.06] backdrop-blur-[20px] border border-white/10 rounded-[20px] p-7 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-[#d4a853]">📊 平台数据</h2>
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-xl font-bold text-[#d4a853]">63+</div>
              <div className="text-[11px] text-white/40 mt-0.5">课程 &amp; 成品舞</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#d4a853]">10000+</div>
              <div className="text-[11px] text-white/40 mt-0.5">培养学员</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-[#d4a853]">12年</div>
              <div className="text-[11px] text-white/40 mt-0.5">品牌积淀</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="w-full mt-6">
          <Link
            href="/"
            className="block w-full py-4 rounded-xl text-base font-semibold text-[#1a1a1a] bg-gradient-to-r from-[#d4a853] to-[#e8c46a] text-center shadow-lg shadow-[#d4a853]/30 transition-all active:scale-[0.97]"
          >
            🌟 浏览官网
          </Link>
          <Link
            href="/login"
            className="block w-full py-3.5 mt-3 rounded-xl text-sm text-white/80 border border-white/20 bg-white/[0.05] text-center transition-colors active:bg-white/10"
          >
            学员系统入口 →
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 pb-4 text-center">
          <p className="text-xs text-white/30">伊娃东方舞 · 专注东方舞师资培训</p>
          <p className="text-xs text-white/20 mt-1">Eva Oriental Dance · All Rights Reserved</p>
        </div>
      </div>
    </div>
  )
}
