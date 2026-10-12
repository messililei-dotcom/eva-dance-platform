import {
  cleanText,
  competitionSelectSql,
  hasAuth,
  readEventBody,
  jsonError,
  mapCompetition,
  nowIso,
  toNumber,
  unauthorized,
  withRequestEventDb,
} from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const row = db.prepare(`
      ${competitionSelectSql()}
      WHERE c.id = ?
      GROUP BY c.id
    `).get(routeParams.id);
    if (!row) return jsonError('赛事不存在', 404);
    return Response.json({ success: true, data: mapCompetition(row) });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const name = cleanText(body.name);
  if (!name) return jsonError('赛事名称不能为空');

  return withRequestEventDb(request, (db) => {
    const existing = db.prepare('SELECT id, registration_status, registration_public, judge_scores_public FROM event_competitions WHERE id = ?').get(routeParams.id);
    if (!existing) return jsonError('赛事不存在', 404);

    db.prepare(`
      UPDATE event_competitions
      SET name = ?, code = ?, status = ?, registration_status = ?, registration_public = ?, judge_scores_public = ?, start_date = ?,
          end_date = ?, location = ?,
          organizer = ?, description = ?, cover_url = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      name,
      cleanText(body.code),
      'published',
      cleanText(body.registrationStatus ?? body.registration_status, existing.registration_status),
      body.registrationPublic === undefined ? Number(existing.registration_public) : body.registrationPublic === true ? 1 : 0,
      body.judgeScoresPublic === undefined ? Number(existing.judge_scores_public) : body.judgeScoresPublic === true ? 1 : 0,
      cleanText(body.startDate ?? body.start_date),
      cleanText(body.endDate ?? body.end_date),
      cleanText(body.location),
      cleanText(body.organizer, '伊娃东方舞'),
      cleanText(body.description),
      cleanText(body.coverUrl ?? body.cover_url),
      nowIso(),
      routeParams.id,
    );

    return Response.json({ success: true });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const action = cleanText(body.action);
  const statusMap: Record<string, { status?: string; registration_status?: string; registration_public?: number; judge_scores_public?: number }> = {
    showJudgeScores: { judge_scores_public: 1 },
    hideJudgeScores: { judge_scores_public: 0 },
    showRegistration: { registration_public: 1 },
    hideRegistration: { registration_public: 0 },
    closeRegistration: { registration_status: 'closed' },
    openRegistration: { registration_status: 'open' },
  };
  const patch = statusMap[action];
  if (!patch) return jsonError('不支持的赛事操作');

  return withRequestEventDb(request, (db) => {
    const existing = db.prepare('SELECT id FROM event_competitions WHERE id = ?').get(routeParams.id);
    if (!existing) return jsonError('赛事不存在', 404);
    const sets = ['updated_at = ?'];
    const values: any[] = [nowIso()];
    if (patch.status) {
      sets.push('status = ?');
      values.push(patch.status);
    }
    if (patch.registration_status) {
      sets.push('registration_status = ?');
      values.push(patch.registration_status);
    }
    if (patch.registration_public !== undefined) {
      sets.push('registration_public = ?');
      values.push(patch.registration_public);
    }
    if (patch.judge_scores_public !== undefined) {
      sets.push('judge_scores_public = ?');
      values.push(patch.judge_scores_public);
    }
    values.push(routeParams.id);
    db.prepare(`UPDATE event_competitions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return Response.json({ success: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withRequestEventDb(request, (db) => {
    const competition = db.prepare('SELECT id, name FROM event_competitions WHERE id = ?').get(routeParams.id);
    if (!competition) return jsonError('赛事不存在', 404);

    const counts = {
      groups: Number(db.prepare('SELECT COUNT(*) AS value FROM event_groups WHERE competition_id = ?').get(routeParams.id)?.value || 0),
      players: Number(db.prepare('SELECT COUNT(*) AS value FROM event_players WHERE competition_id = ?').get(routeParams.id)?.value || 0),
      scores: Number(db.prepare('SELECT COUNT(*) AS value FROM event_scores WHERE competition_id = ?').get(routeParams.id)?.value || 0),
    };
    db.transaction(() => {
      db.prepare('DELETE FROM event_competitions WHERE id = ?').run(routeParams.id);
    })();

    return Response.json({ success: true, data: { deleted: competition, counts } });
  });
}
