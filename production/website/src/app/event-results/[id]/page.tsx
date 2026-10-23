import { notFound } from 'next/navigation';
import { openAdminDb } from '@/lib/server/admin-db';
import PlayerAvatar from '@/components/events/PlayerAvatar';
import legacyAvatars from '@/data/event-avatars.json';
import RefreshResults from './refresh';
import styles from './results.module.css';

export const dynamic = 'force-dynamic';
type Result = { player_id: number; group_id: number; group_name: string; name: string; rank_no: number; published_total: number; avatar_url: string };
const medals = { 1: { label: '冠军', color: '#b48a35' }, 2: { label: '亚军', color: '#8996a5' }, 3: { label: '季军', color: '#b67f59' } } as const;
function Trophy({ rank }: { rank: number }) {
  const medal = medals[rank as keyof typeof medals];
  return <svg viewBox="0 0 48 48" role="img" aria-label={`${medal.label}奖杯`} className={styles.trophy} fill="none">
    <path d="M14 8H7v8c0 7 5 11 12 11M34 8h7v8c0 7-5 11-12 11" stroke={medal.color} strokeWidth="2.5" />
    <path d="M14 5h20v12c0 8-4 13-10 13s-10-5-10-13V5Z" fill={medal.color}/>
    <path d="M18 8h4v13c0 3 1 5 2 6-4-1-6-5-6-10V8Z" fill="#fff" opacity=".32"/>
    <path d="M24 29v10M17 40h14M14 44h20" stroke={medal.color} strokeWidth="3" strokeLinecap="round"/>
    <path d="m24 11 1.8 3.5 3.9.6-2.8 2.7.7 3.8-3.6-1.8-3.6 1.8.7-3.8-2.8-2.7 3.9-.6L24 11Z" fill="#fff" opacity=".78"/>
  </svg>;
}
function score(row: Result, peers: Result[]) {
  const value = Number(row.published_total);
  return value.toFixed(peers.filter(r => Number(r.published_total).toFixed(2) === value.toFixed(2)).length > 1 ? 3 : 2);
}
export default async function EventResults({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const query = String((await searchParams).q || '').trim().slice(0,100);
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = openAdminDb({ readonly: true });
  try {
    const event = db.prepare("SELECT name FROM event_competitions WHERE id=? AND status IN ('published','finished')").get<{name:string}>(Number(id));
    if (!event) notFound();
    const data = db.prepare(`SELECT p.id player_id,g.id group_id,g.name group_name,p.name,r.rank_no,r.published_total,
      COALESCE(NULLIF(m.wx_avatar_url,''),NULLIF(m.avatar,''),'') avatar_url
      FROM event_rankings r JOIN event_groups g ON g.id=r.group_id JOIN event_players p ON p.id=r.player_id
      LEFT JOIN Member m ON m.id=p.member_id
      WHERE r.competition_id=? AND r.status='published' AND g.status='active'
        AND p.audit_status!='rejected' AND p.status NOT IN ('withdrawn','cancelled')
      ORDER BY g.sort_order,g.id,r.rank_no,p.id`).all<Result>(Number(id));
    const rows = data.map(r => ({ ...r, avatar_url: r.avatar_url || (legacyAvatars.players as Record<string,string>)[String(r.player_id)] || '' }));
    const groups = Array.from(new Set(rows.map(r => r.group_id)));
    const visibleGroups = groups.filter(groupId => rows.some(row => row.group_id === groupId && [row.group_name,row.name].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())));
    return <main className={styles.page}>
      <RefreshResults />
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}><span>✦</span> 荣耀时刻 <span>✦</span></div>
          <h1>{event.name}</h1>
          <div className={styles.headingRule}><span /> <p>赛事成绩公示</p> <span /></div>
          <div className={styles.summary}><span>{groups.length} 个公示组别</span><i /><span>{rows.length} 项公示成绩</span><i /><span>每30秒自动更新</span></div>
        </header>
        <form role="search" style={{display:'flex',gap:8,marginBottom:24}}><input name="q" aria-label="搜索公示组别或选手" defaultValue={query} placeholder="搜索组别名称或选手姓名" style={{flex:1,minWidth:0,border:'1px solid #ddd0b6',borderRadius:8,padding:'12px 16px',background:'#fff'}}/><button style={{borderRadius:8,border:'1px solid #b48a35',background:'#fff',padding:'0 24px',color:'#8b6828'}}>搜索</button></form>
        {!visibleGroups.length ? <section className={styles.empty}><h2>{query ? '未找到相关组别或选手' : '静候荣耀揭晓'}</h2>{!query && <p>成绩尚未公示，请稍后查看。</p>}</section> : <div className={styles.grid}>
          {visibleGroups.map(groupId => {
            const entries = rows.filter(r => r.group_id === groupId);
            const winners = entries.filter(r => r.rank_no >= 1 && r.rank_no <= 3);
            const remaining = entries.filter(r => r.rank_no < 1 || r.rank_no > 3);
            return <section key={groupId} className={styles.card} aria-label={entries[0].group_name}>
              <div className={styles.cardHeading}><div className={styles.cardMark}>✦</div><h2>{entries[0].group_name}</h2><span>{entries.length} 位选手</span></div>
              <div className={styles.podium}>
                {[2,1,3].map(rank => {
                  const champions = winners.filter(r => r.rank_no === rank);
                  const medal = medals[rank as keyof typeof medals];
                  return <div key={rank} className={`${styles.place} ${styles[`place${rank}`]}`}>
                    {champions.length > 0 && <>
                      {champions.map(r => <div key={r.player_id} className={styles.winner}>
                        <div className={styles.portrait}><PlayerAvatar name={r.name} src={r.avatar_url} size="medium" /><span className={styles.rankBadge} style={{background:medal.color}}>{rank}</span></div>
                        <h3>{r.name}</h3><strong className={styles.score}>{score(r,entries)}<small>分</small></strong>
                      </div>)}
                      <div className={styles.step}><Trophy rank={rank} /><span>{medal.label}</span><small>第 {rank} 名</small></div>
                    </>}
                  </div>;
                })}
              </div>
              {remaining.length > 0 && <ol className={styles.rankList} aria-label="其他选手成绩">{remaining.map(r => <li key={r.player_id}><span className={styles.listRank}>{r.rank_no || '—'}</span><PlayerAvatar name={r.name} src={r.avatar_url}/><span className={styles.listName}>{r.name}</span><strong>{score(r,entries)}<small>分</small></strong></li>)}</ol>}
              <div className={styles.cardFooter}><span /> 已公示成绩 <span /></div>
            </section>;
          })}
        </div>}
        <footer className={styles.footer}>以热爱登场，以实力绽放 <span>✦</span> 伊娃东方舞</footer>
      </div>
    </main>;
  } finally { db.close(); }
}
