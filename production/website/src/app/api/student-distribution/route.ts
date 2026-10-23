import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type DistributionRecord = {
  province?: string;
  provinceName?: string;
  region?: string;
  name?: string;
  count?: number;
  studentCount?: number;
  memberCount?: number;
  total?: number;
  value?: number;
};

const API_BASE =
  process.env.MANAGEMENT_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://admin.swod.com.cn/api';

const candidatePaths = [
  '/public/students/distribution',
  '/public/members/distribution',
  '/students/distribution',
  '/members/distribution',
  '/statistics/students/distribution',
];

function unwrapRecords(payload: unknown): DistributionRecord[] {
  if (Array.isArray(payload)) return payload as DistributionRecord[];
  if (!payload || typeof payload !== 'object') return [];

  const objectPayload = payload as {
    data?: unknown;
    result?: unknown;
    list?: unknown;
    records?: unknown;
    provinces?: unknown;
  };

  const candidates = [
    objectPayload.data,
    objectPayload.result,
    objectPayload.list,
    objectPayload.records,
    objectPayload.provinces,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as DistributionRecord[];
    if (candidate && typeof candidate === 'object') {
      const nested = unwrapRecords(candidate);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function recordToProvinceCount(record: DistributionRecord) {
  const province = record.province || record.provinceName || record.region || record.name;
  const count = record.count ?? record.studentCount ?? record.memberCount ?? record.total ?? record.value ?? 1;

  if (!province) return null;

  return {
    province,
    count: Number.isFinite(Number(count)) ? Number(count) : 1,
  };
}

export async function GET() {
  for (const path of candidatePaths) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      });

      if (!response.ok) continue;

      const payload = await response.json();
      const records = unwrapRecords(payload)
        .map(recordToProvinceCount)
        .filter(Boolean);

      if (records.length > 0) {
        return NextResponse.json({
          success: true,
          source: `${API_BASE}${path}`,
          data: records,
        });
      }
    } catch {
      // Try the next known endpoint shape. The UI always has simulated fallback data.
    }
  }

  return NextResponse.json({
    success: true,
    source: 'fallback',
    data: [],
  });
}
