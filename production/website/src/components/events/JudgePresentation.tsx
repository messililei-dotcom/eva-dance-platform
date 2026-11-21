import Link from 'next/link';
import { ArrowLeft, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './judging.module.css';

export function JudgePage({ title, backHref, backLabel, children }: {
  title: string; backHref: string; backLabel: string; children: ReactNode;
}) {
  return <div className={styles.canvas}>
    <div className={styles.workspace}>
      <header className={styles.top}>
        <Link href={backHref} aria-label={backLabel} prefetch={false}><ArrowLeft size={22} aria-hidden="true" /></Link>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  </div>;
}

export function JudgeIdentity({ event, name }: { event: string; name: string }) {
  return <div className={styles.eventIdentity}>
    <p>{event}</p>
    <span className={styles.judgeChip}><UserRound size={15} aria-hidden="true" /><span className={styles.judgeRole}>评委</span><span>{name}</span></span>
  </div>;
}

export function JudgeAvatar({ name, url }: { name: string; url?: string }) {
  const safe = url && /^(https:\/\/|\/(?!\/))/.test(url);
  return <span className={styles.avatar} aria-hidden="true">
    {name.slice(0, 1)}
    {safe && <img src={url} alt="" decoding="async" referrerPolicy="no-referrer" />}
  </span>;
}
