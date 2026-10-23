'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import MessageCenter from '@/components/MessageCenter';

export default function MessagesPage() {
  return (
    <main className="min-h-screen bg-[#F8F3EA] px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+4rem)] text-[#2C1810] md:px-4 md:pb-10 md:pt-20">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profile" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E8DDCB] bg-white text-[#8A6A32]" aria-label="返回个人中心">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">我的通知</h1>
            <p className="text-sm text-[#8A7A68]">课程、成长、核销、证书与系统通知</p>
          </div>
        </div>
        <MessageCenter />
      </div>
    </main>
  );
}
