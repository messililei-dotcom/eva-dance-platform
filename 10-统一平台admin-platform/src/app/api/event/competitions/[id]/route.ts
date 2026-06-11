import {
  cleanText,
  competitionSelectSql,
  hasAuth,
  jsonError,
  mapCompetition,
  nowIso,
  toNumber,
  unauthorized,
  withEventDb,
} from '../../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  return withEventDb((db) => {
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

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  if (!name) return jsonError('赛事名称不能为空');

  return withEventDb((db) => {
    const existing = db.prepare('SELECT id FROM event_competitions WHERE id = ?').get(routeParams.id);
    if (!existing) return jsonError('赛事不存在', 404);

    db.prepare(`
      UPDATE event_competitions
      SET name = ?, code = ?, status = ?, registration_status = ?, start_date = ?,
          end_date = ?, registration_start = ?, registration_end = ?, location = ?,
          organizer = ?, description = ?, cover_url = ?, max_players = ?,
          registration_fee = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name,
      cleanText(body.code),
      cleanText(body.status, 'draft'),
      cleanText(body.registrationStatus ?? body.registration_status, 'closed'),
      cleanText(body.startDate ?? body.start_date),
      cleanText(body.endDate ?? body.end_date),
      cleanText(body.registrationStart ?? body.registration_start),
      cleanText(body.registrationEnd ?? body.registration_end),
      cleanText(body.location),
      cleanText(body.organizer, '伊娃东方舞'),
      cleanText(body.description),
      cleanText(body.coverUrl ?? body.cover_url),
      toNumber(body.maxPlayers ?? body.max_players),
      toNumber(body.registrationFee ?? body.registration_fee),
      nowIso(),
      routeParams.id,
    );

    return Response.json({ success: true });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  if (!hasAuth(request)) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const action = cleanText(body.action);
  const statusMap: Record<string, { status?: string; registration_status?: string }> = {
    publish: { status: 'published', registration_status: 'open' },
    unpublish: { status: 'offline', registration_status: 'closed' },
    closeRegistration: { registration_status: 'closed' },
    openRegistration: { registration_status: 'open' },
  };
  const patch = statusMap[action];
  if (!patch) return jsonError('不支持的赛事操作');

  return withEventDb((db) => {
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
    values.push(routeParams.id);
    db.prepare(`UPDATE event_competitions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return Response.json({ success: true });
  });
}
