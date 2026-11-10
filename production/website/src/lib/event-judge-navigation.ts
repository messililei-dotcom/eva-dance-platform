export function judgeBackLink(pathname: string): { href: string; label: string } | null {
  const match = pathname.match(/^\/(events|events-news)\/([^/]+)\/judge(?:\/groups\/([^/]+)(?:\/players\/([^/]+))?)?\/?$/);
  if (!match) return null;
  const [, prefix, slug, groupId, playerId] = match;
  const base = `/${prefix}/${slug}`;
  if (playerId) return { href: `${base}/judge/groups/${groupId}`, label: '返回选手列表' };
  if (groupId) return { href: `${base}/judge`, label: '返回评分组别' };
  return { href: base, label: '返回赛事' };
}
