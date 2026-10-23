import legacyAvatars from '@/data/event-avatars.json';
import { openAdminDb } from '@/lib/server/admin-db';

export type PublicEventGroup = {
  id: number;
  competition_id: number;
  name: string;
  code: string;
  age_range: string;
  dance_type: string;
  entry_type: string;
  scoring_status: string;
  player_count: number | null;
  registration_public: number;
  ranked_count: number;
};

export type PublicGroupPlayer = {
  id: number;
  player_no: string;
  name: string;
  avatar_url: string;
  organization: string;
  teacher: string;
  rank_no: number | null;
  published_total: number | null;
  score_count: number;
};

export type PublicPlayerDetail = PublicGroupPlayer & {
  competition_id: number;
  group_id: number;
  group_name: string;
  performance_title: string;
  registered_at: string;
};

export type PublicJudgeScore = {
  id: number;
  judge_name: string;
  judge_title: string;
  avatar_url: string;
  score: number | null;
};

export type PublicEventPlayerSearchResult = {
  id: number;
  competition_id: number;
  group_id: number;
  name: string;
  player_no: string;
  organization: string;
  group_name: string;
  event_name: string;
};

export function searchPublicEventPlayers(query: string, limit = 12) {
  const keyword = `%${query.trim()}%`;
  const db = openAdminDb({ readonly: true });
  try {
    return db.prepare(`
      SELECT
        p.id, p.competition_id, p.group_id, p.name,
        COALESCE(p.player_no, '') AS player_no,
        COALESCE(p.organization, '') AS organization,
        g.name AS group_name,
        c.name AS event_name
      FROM event_players p
      JOIN event_groups g ON g.id = p.group_id AND g.status = 'active'
      JOIN event_competitions c ON c.id = p.competition_id AND c.status = 'published'
      WHERE p.audit_status != 'rejected'
        AND p.status NOT IN ('withdrawn', 'cancelled')
        AND (c.registration_public = 1 OR EXISTS (SELECT 1 FROM event_rankings visible WHERE visible.player_id=p.id AND visible.group_id=p.group_id AND visible.status='published'))
        AND (p.name LIKE ? OR p.player_no LIKE ? OR p.organization LIKE ?)
      ORDER BY date(c.start_date) DESC, p.id DESC
      LIMIT ?
    `).all<PublicEventPlayerSearchResult>(keyword, keyword, keyword, Math.min(Math.max(limit, 1), 20));
  } finally {
    db.close();
  }
}

export function loadPublicEventGroups(competitionId: number) {
  const db = openAdminDb({ readonly: true });
  try {
    return db.prepare(`
      SELECT
        g.id, g.competition_id, g.name, COALESCE(g.code, '') AS code,
        COALESCE(g.age_range, '') AS age_range,
        COALESCE(g.dance_type, '') AS dance_type,
        COALESCE(g.entry_type, '') AS entry_type,
        COALESCE(g.scoring_status, '') AS scoring_status,
        c.registration_public,
        CASE WHEN c.registration_public = 1 THEN COUNT(DISTINCT CASE
          WHEN p.audit_status != 'rejected' AND p.status NOT IN ('withdrawn', 'cancelled') THEN p.id
        END) ELSE NULL END AS player_count,
        COUNT(DISTINCT CASE WHEN r.status = 'published' THEN r.player_id END) AS ranked_count
      FROM event_groups g
      JOIN event_competitions c ON c.id=g.competition_id
      LEFT JOIN event_players p ON p.group_id = g.id
      LEFT JOIN event_rankings r ON r.group_id = g.id
      WHERE g.competition_id = ? AND g.status = 'active'
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.id ASC
    `).all<PublicEventGroup>(competitionId);
  } finally {
    db.close();
  }
}

export function loadPublicEventGroup(competitionId: number, groupId: number) {
  return loadPublicEventGroups(competitionId).find((group) => group.id === groupId) || null;
}

export function loadPublicGroupPlayers(competitionId: number, groupId: number) {
  const db = openAdminDb({ readonly: true });
  try {
    const players = db.prepare(`
      SELECT
        p.id,
        COALESCE(p.player_no, '') AS player_no,
        p.name,
        COALESCE(NULLIF(m.wx_avatar_url, ''), NULLIF(m.avatar, ''), '') AS avatar_url,
        COALESCE(p.organization, '') AS organization,
        COALESCE(p.teacher, '') AS teacher,
        r.rank_no,
        r.published_total,
        COUNT(DISTINCT CASE WHEN s.score_status = 'published' AND EXISTS (SELECT 1 FROM event_rankings visible WHERE visible.group_id=s.group_id AND visible.player_id=s.player_id AND visible.status='published') THEN s.judge_id END) AS score_count
      FROM event_players p
      JOIN event_competitions c ON c.id=p.competition_id
      LEFT JOIN Member m ON m.id = p.member_id
      LEFT JOIN event_rankings r
        ON r.group_id = p.group_id AND r.player_id = p.id AND r.status = 'published'
      LEFT JOIN event_scores s
        ON s.group_id = p.group_id AND s.player_id = p.id AND s.score_status = 'published' AND EXISTS (SELECT 1 FROM event_rankings visible WHERE visible.group_id=s.group_id AND visible.player_id=s.player_id AND visible.status='published')
        AND NOT EXISTS (
          SELECT 1 FROM event_scores newer
          WHERE newer.group_id = s.group_id
            AND newer.player_id = s.player_id
            AND newer.judge_id = s.judge_id
            AND newer.version > s.version
            AND newer.score_status = 'published'
        )
      WHERE p.competition_id = ? AND p.group_id = ?
        AND p.audit_status != 'rejected'
        AND p.status NOT IN ('withdrawn', 'cancelled')
        AND (c.registration_public = 1 OR r.status = 'published')
      GROUP BY p.id
      ORDER BY
        CASE WHEN r.rank_no IS NULL OR r.rank_no = 0 THEN 1 ELSE 0 END,
        r.rank_no ASC,
        p.player_no ASC,
        p.id ASC
    `).all<PublicGroupPlayer>(competitionId, groupId);
    return players.map(player => ({ ...player, avatar_url: player.avatar_url || (legacyAvatars.players as Record<string, string>)[String(player.id)] || '' }));
  } finally {
    db.close();
  }
}

export function loadPublicPlayerDetail(competitionId: number, groupId: number, playerId: number) {
  const db = openAdminDb({ readonly: true });
  try {
    const player = db.prepare(`
      SELECT
        p.id, p.competition_id, p.group_id,
        COALESCE(p.player_no, '') AS player_no,
        p.name,
        COALESCE(NULLIF(m.wx_avatar_url, ''), NULLIF(m.avatar, ''), '') AS avatar_url,
        COALESCE(p.organization, '') AS organization,
        COALESCE(p.teacher, '') AS teacher,
        COALESCE(p.registered_at, '') AS registered_at,
        g.name AS group_name,
        COALESCE((
          SELECT ep.title FROM event_performances ep
          WHERE ep.player_id = p.id
          ORDER BY ep.id ASC LIMIT 1
        ), '') AS performance_title,
        r.rank_no,
        r.published_total,
        (SELECT COUNT(DISTINCT s.judge_id) FROM event_scores s
          WHERE s.group_id = p.group_id AND s.player_id = p.id AND s.score_status = 'published' AND EXISTS (SELECT 1 FROM event_rankings visible WHERE visible.group_id=s.group_id AND visible.player_id=s.player_id AND visible.status='published')
        ) AS score_count
      FROM event_players p
      JOIN event_groups g ON g.id = p.group_id
      JOIN event_competitions c ON c.id=p.competition_id
      LEFT JOIN Member m ON m.id = p.member_id
      LEFT JOIN event_rankings r
        ON r.group_id = p.group_id AND r.player_id = p.id AND r.status = 'published'
      WHERE p.id = ? AND p.competition_id = ? AND p.group_id = ?
        AND p.audit_status != 'rejected'
        AND p.status NOT IN ('withdrawn', 'cancelled')
        AND (c.registration_public = 1 OR r.status = 'published')
      LIMIT 1
    `).get<PublicPlayerDetail>(playerId, competitionId, groupId);

    if (!player) return null;

    const scores = db.prepare(`
      SELECT
        s.judge_id AS id,
        COALESCE(j.name, '评委') AS judge_name,
        COALESCE(j.title, '') AS judge_title,
        COALESCE(NULLIF(jm.wx_avatar_url, ''), NULLIF(jm.avatar, ''), '') AS avatar_url,
        CASE WHEN c.judge_scores_public = 1 THEN SUM(COALESCE(s.published_score, s.calculated_score, 0)) ELSE NULL END AS score
      FROM event_scores s
      JOIN event_competitions c ON c.id=s.competition_id
      LEFT JOIN event_judges j ON j.id = s.judge_id
      LEFT JOIN Member jm ON jm.id = j.member_id
      WHERE s.competition_id = ? AND s.group_id = ? AND s.player_id = ?
        AND s.score_status = 'published' AND EXISTS (SELECT 1 FROM event_rankings visible WHERE visible.group_id=s.group_id AND visible.player_id=s.player_id AND visible.status='published')
        AND NOT EXISTS (
          SELECT 1 FROM event_scores newer
          WHERE newer.group_id = s.group_id
            AND newer.player_id = s.player_id
            AND newer.judge_id = s.judge_id
            AND newer.rule_id IS s.rule_id
            AND newer.version > s.version
            AND newer.score_status = 'published'
        )
      GROUP BY s.judge_id, j.name, j.title
      ORDER BY j.id ASC
    `).all<PublicJudgeScore>(competitionId, groupId, playerId);

    player.avatar_url ||= (legacyAvatars.players as Record<string, string>)[String(player.id)] || '';
    scores.forEach(score => { score.avatar_url ||= (legacyAvatars.judges as Record<string, string>)[String(score.id)] || ''; });
    return { player, scores };
  } finally {
    db.close();
  }
}

export function formatPublicEntryType(value: string) {
  return ({ solo: '个人', duo: '双人', group: '群舞', team: '团队' } as Record<string, string>)[value] || value;
}

export function formatPublicScore(value: number | null) {
  if (value == null) return '待公布';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
