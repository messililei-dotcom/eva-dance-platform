'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle, Clock, Play, User } from 'lucide-react';
import PlaceholderImage from '@/components/PlaceholderImage';
import { courses } from '@/config/courses';
import { getStudentSession } from '@/lib/student-auth';

export default function CourseWatchPage() {
  const params = useParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const course = useMemo(
    () => courses.find((item) => item.id === params.id && item.category === 'online'),
    [params.id]
  );

  useEffect(() => {
    const session = getStudentSession();

    if (!session) {
      const next = `/dashboard/courses/${params.id}/watch`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setReady(true);
  }, [params.id, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white text-text-secondary">
        正在进入课程学习...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-warm-white px-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-text">课程不存在或暂不支持试看</h1>
          <Link href="/courses" className="mt-4 inline-flex text-gold-dark hover:text-crimson">
            返回线上学院
          </Link>
        </div>
      </div>
    );
  }

  const previewLessons = course.outline.slice(0, 5);

  return (
    <div className="min-h-screen bg-warm-white">
      <header className="border-b border-sand/40 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold-dark">
              <ArrowLeft className="h-4 w-4" />
              返回课程详情
            </Link>
            <h1 className="mt-3 font-serif text-2xl font-bold text-text md:text-3xl">
              {course.title}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">课程学习 · 免费试看</p>
          </div>
          <Link
            href="/dashboard/courses"
            className="inline-flex w-fit rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white transition hover:bg-gold-dark"
          >
            我的课程
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <section className="overflow-hidden rounded-2xl bg-[#111111] shadow-xl">
          <div className="relative aspect-video">
            <PlaceholderImage
              src={course.image}
              alt={`${course.title} 试看视频`}
              className="h-full w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white/92 text-gold-dark shadow-2xl transition hover:scale-105"
                aria-label="播放试看视频"
              >
                <Play className="ml-1 h-9 w-9 fill-current" />
              </button>
            </div>
            <div className="absolute bottom-5 left-5 right-5">
              <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                免费试看
              </span>
              <h2 className="mt-3 font-serif text-2xl font-bold text-white">
                第 1 节：课程试看
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/72">
                登录后可继续观看试看内容；正式课程权限以学员课程记录为准。
              </p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-sand/40 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-lg font-bold text-text">课程信息</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gold-dark" />
                <span className="text-text-secondary">讲师：{course.instructor}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gold-dark" />
                <span className="text-text-secondary">时长：{course.duration}</span>
              </div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-gold-dark" />
                <span className="text-text-secondary">适合：{course.level}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sand/40 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-lg font-bold text-text">试看目录</h2>
            <div className="mt-4 space-y-2">
              {previewLessons.map((lesson, index) => (
                <div key={`${lesson}-${index}`} className="flex items-start gap-3 rounded-xl bg-warm-gray/60 p-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
                  <div>
                    <div className="text-sm font-medium text-text">第 {index + 1} 节</div>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">{lesson}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
