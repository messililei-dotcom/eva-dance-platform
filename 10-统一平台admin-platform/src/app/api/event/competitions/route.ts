import {
  cleanText,
  competitionSelectSql,
  generateCode,
  hasAuth,
  readEventBody,
  jsonError,
  mapCompetition,
  nowIso,
  toNumber,
  unauthorized,
  withRequestEventDb,
} from '../_db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const url = new URL(request.url);
  const keyword = cleanText(url.searchParams.get('keyword'));
  const status = cleanText(url.searchParams.get('status'));

  return withRequestEventDb(request, (db) => {
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (keyword) {
      where += ' AND (c.name LIKE ? OR c.code LIKE ? OR c.location LIKE ?)';
      const like = `%${keyword}%`;
      params.push(like, like, like);
    }
    if (status) {
      where += ' AND c.status = ?';
      params.push(status);
    }

    const rows = db.prepare(`
      ${competitionSelectSql()}
      ${where}
      GROUP BY c.id
      ORDER BY datetime(c.start_date) DESC, c.id DESC
    `).all(...params);

    return Response.json({ success: true, data: rows.map(mapCompetition) });
  });
}

export async function POST(request: Request) {
  if (!hasAuth(request)) return unauthorized();

  const body = await readEventBody(request);
  const name = cleanText(body.name);
  if (!name) return jsonError('赛事名称不能为空');

  return withRequestEventDb(request, (db) => {
    const code = cleanText(body.code, generateCode('SWOD'));
    const result = db.prepare(`
      INSERT INTO event_competitions (
        name, code, status, registration_status, registration_public, judge_scores_public, start_date, end_date,
        registration_start, registration_end, location, organizer, description,
        cover_url, max_players, registration_fee, created_by, owner_user_id, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      code,
      'published',
      cleanText(body.registrationStatus ?? body.registration_status, 'closed'),
      body.registrationPublic === true ? 1 : 0,
      body.judgeScoresPublic === true ? 1 : 0,
      cleanText(body.startDate ?? body.start_date),
      cleanText(body.endDate ?? body.end_date),
      '',
      '',
      cleanText(body.location),
      cleanText(body.organizer, '伊娃东方舞'),
      cleanText(body.description),
      cleanText(body.coverUrl ?? body.cover_url),
      0,
      0,
      String(db.eventActorId || ''),
      db.eventActorId || 0,
      nowIso(),
    );

    return Response.json({ success: true, data: { id: result.lastInsertRowid } });
  });
}
