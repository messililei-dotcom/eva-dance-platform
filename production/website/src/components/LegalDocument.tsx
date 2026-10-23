import type { ReactNode } from 'react';

export default function LegalDocument({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-warm-white px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-sand/40 bg-white p-6 shadow-sm md:p-10">
        <h1 className="font-serif text-3xl font-bold text-text">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">更新日期：{updatedAt}</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-text-secondary [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </main>
  );
}
