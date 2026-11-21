// These predicates use g for the group and c for its competition.
// Dates and times without an explicit offset are entered in Beijing time.
export const PUBLIC_EVENT_GROUP_WHERE_SQL = `
  g.status = 'active' AND (
    COALESCE(julianday(trim(c.start_date), CASE
      WHEN upper(trim(c.start_date)) GLOB '*Z' OR trim(c.start_date) GLOB '*[+-][0-9][0-9]:[0-9][0-9]'
      THEN '+0 hours' ELSE '-8 hours' END) > julianday('now'), 1)
    OR EXISTS (
      SELECT 1 FROM event_players entrant
      WHERE entrant.competition_id = g.competition_id AND entrant.group_id = g.id
        AND entrant.audit_status != 'rejected' AND entrant.status NOT IN ('withdrawn', 'cancelled')
    )
  )`;

export const PUBLIC_EVENT_GROUP_COUNT_SQL = `(SELECT COUNT(*) FROM event_groups g
  WHERE g.competition_id = c.id AND ${PUBLIC_EVENT_GROUP_WHERE_SQL})`;
