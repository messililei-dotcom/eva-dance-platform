import { NextRequest, NextResponse } from 'next/server';
import { proxyMiniApi } from '../../_mini-proxy';

type UpstreamVideo = {
  id?: string | number;
  material_id?: string | number;
  name?: string;
  duration?: string | number;
};

type UpstreamChapter = {
  id?: string | number;
  name?: string;
  description?: string;
  sort_order?: number;
  videos?: UpstreamVideo[];
};

function compactChapter(chapter: UpstreamChapter) {
  return {
    id: chapter.id,
    name: chapter.name || '',
    description: chapter.description || '',
    sort_order: Number(chapter.sort_order || 0),
    videos: (Array.isArray(chapter.videos) ? chapter.videos : []).map(video => ({
      id: video.id,
      material_id: video.material_id,
      name: video.name || '',
      duration: Number(video.duration || 0),
    })),
  };
}

export async function publicCourseCatalog(request: NextRequest, seriesId: string) {
  const upstream = await proxyMiniApi(
    request,
    `/mini/public/series/${encodeURIComponent(seriesId)}/courses`,
    { forwardCredentials: false },
  );
  if (!upstream.ok) return upstream;

  const payload = await upstream.json().catch(() => null);
  if (!payload) return upstream;
  const rows = Array.isArray(payload) ? payload : payload.data;
  const compact = (Array.isArray(rows) ? rows : []).map(compactChapter);
  const responsePayload = Array.isArray(payload) ? compact : { ...payload, data: compact };

  return NextResponse.json(responsePayload, {
    status: upstream.status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
    },
  });
}
