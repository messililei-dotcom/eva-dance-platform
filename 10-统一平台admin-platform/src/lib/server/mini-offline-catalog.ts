type Row = Record<string, any>;

export function miniOfflineCatalog(courses: Row[], websiteCourses: Row[], payments: Row[]) {
  const local = new Map(courses.map(row => [String(row.id), row]));
  const students = new Map<string, Set<number>>();
  for (const payment of payments) {
    const memberId = Number(payment.memberId || 0);
    if (!memberId || !['paid', 'completed'].includes(String(payment.paymentStatus || ''))) continue;
    const key = String(payment.courseId);
    if (!students.has(key)) students.set(key, new Set());
    students.get(key)!.add(memberId);
  }
  const groupStudents = new Map<string, Set<number>>();
  const keyOf = (item: Row) => String(item.officialMatchKey || item.title || '').trim().toLowerCase();
  for (const item of websiteCourses) {
    if (!local.has(String(item.platformCourseId || item.id))) continue;
    const key = keyOf(item);
    if (!groupStudents.has(key)) groupStudents.set(key, new Set());
    for (const id of students.get(String(item.platformCourseId || item.id)) || []) groupStudents.get(key)!.add(id);
  }
  const anonymous = (count: number) => Array.from({ length: Math.min(count, 30) }, (_, index) => ({ label: `匿名学员 ${index + 1}` }));
  return websiteCourses.flatMap(item => {
    const sourceId = String(item.platformCourseId || item.id);
    const row = local.get(sourceId);
    if (!row) return [];
    const rawImage = String(row.coverImage || row.cover_image || row.image || '').trim();
    let image = rawImage || String(item.image || '').trim();
    const marker = '/uploads/training-courses/';
    if (image.includes(marker)) {
      const filename = image.split(marker)[1].split(/[?#]/)[0].split('/').pop() || '';
      image = `https://www.swod.com.cn/api/platform-offline-courses/cover/${encodeURIComponent(decodeURIComponent(filename))}`;
    } else if (rawImage.startsWith('/uploads/') || rawImage.startsWith('/api/')) {
      image = `https://admin.swod.com.cn${rawImage}`;
    }
    let outline = Array.isArray(item.outline) ? item.outline : [];
    const rawOutline = row.outline || row.highlights;
    if (rawOutline) {
      try { const parsed = JSON.parse(String(rawOutline)); if (Array.isArray(parsed)) outline = parsed.map(String).filter(Boolean); }
      catch { outline = String(rawOutline).split(/\n|,|，/).map(text => text.trim()).filter(Boolean); }
    }
    const price = Number(row.price ?? item.price ?? 0);
    return [{
      id: 900000 + Number(sourceId), source_id: sourceId,
      name: row.name || item.title, group_key: keyOf(item),
      subtitle: row.subType || row.dateRange || row.validDays || item.sessionName || item.scheduleLabel || '',
      category: row.type || item.type || '线下课程', teacher: row.teacher || row.instructor || item.instructor || '',
      price, promo_price: price, is_free: price > 0 ? 0 : 1,
      cover_image: image.startsWith('/') ? `https://www.swod.com.cn${image}` : image,
      period_status: row.status || item.platformStatus || 'active',
      capacity: Number(row.capacity ?? item.capacity ?? 0),
      remaining: Number(row.remaining ?? item.remaining ?? 0),
      status: 'published', description: row.fullDescription || row.description || row.content || item.fullDescription || item.description || '',
      outline, location: row.location || item.location || '',
      source_type: 'platform_offline_course', source_name: '统一平台线下课程',
      start_date: row.startDate ?? item.startDate ?? '', end_date: row.endDate ?? item.endDate ?? '',
      valid_days: row.validDays || '', total_courses: Number(row.sessions) || 0,
      total_students: students.get(sourceId)?.size || 0,
      anonymous_students: anonymous(students.get(sourceId)?.size || 0),
      group_anonymous_students: anonymous(groupStudents.get(keyOf(item))?.size || 0),
      group_total_students: groupStudents.get(keyOf(item))?.size || 0,
      created_at: row.created_at || ''
    }];
  });
}
