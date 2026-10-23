import { getMemberId, jsonError, withDb } from '../../_helpers';

type RegionRow = {
  province?: string;
  city?: string;
};

function cleanRegion(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

export async function GET(request: Request) {
  try {
    return withDb((db) => {
      const url = new URL(request.url);
      const memberId = getMemberId(url.searchParams, request);
      if (!memberId) return jsonError('未登录', 401);

      const rows = db.prepare(
        `SELECT province, city
         FROM Member
         WHERE COALESCE(province, '') <> '' OR COALESCE(city, '') <> ''
         ORDER BY province, city`
      ).all<RegionRow>();

      const cityMap = new Map<string, Set<string>>();
      rows.forEach((row) => {
        const province = cleanRegion(row.province);
        const city = cleanRegion(row.city);
        if (!province && !city) return;
        if (!cityMap.has(province)) cityMap.set(province, new Set());
        if (city) cityMap.get(province)?.add(city);
      });

      const provinces = Array.from(cityMap.keys()).filter(Boolean);
      const citiesByProvince = Object.fromEntries(
        Array.from(cityMap.entries()).map(([province, cities]) => [province, Array.from(cities).filter(Boolean)])
      );

      return Response.json({
        success: true,
        data: {
          provinces,
          citiesByProvince,
        },
      });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
