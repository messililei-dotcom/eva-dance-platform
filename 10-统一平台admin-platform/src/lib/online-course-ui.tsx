import { AudioOutlined, FileOutlined, FilePdfOutlined, PictureOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import { apiErrorMessage, pickArray } from '@/lib/data-shape';
import { formatPaymentAmount } from '@/lib/money-format';

export type MaterialLike = {
  id?: number | string;
  type?: string;
  thumbnail?: string;
  file_url?: string;
  file_path?: string;
};

export function apiError(err: unknown) {
  return apiErrorMessage(err);
}

export { pickArray };

export function money(value?: number) {
  return formatPaymentAmount(value);
}

export function fileSize(value?: number) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${size}B`;
}

export function durationText(value?: number) {
  const seconds = Number(value || 0);
  if (!seconds) return '-';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}分${rest}秒`;
}

export function materialIcon(type?: string) {
  const map: Record<string, string> = { video: '视频', image: '图片', audio: '音频', pdf: 'PDF' };
  return map[type || ''] || (type || '-');
}

function materialTypeIcon(type?: string, fontSize = 22) {
  if (type === 'video') return <PlayCircleOutlined style={{ fontSize }} />;
  if (type === 'image') return <PictureOutlined style={{ fontSize }} />;
  if (type === 'audio') return <AudioOutlined style={{ fontSize }} />;
  if (type === 'pdf') return <FilePdfOutlined style={{ fontSize }} />;
  return <FileOutlined style={{ fontSize }} />;
}

function materialTypeTone(type?: string) {
  if (type === 'video') return { background: '#f3e8ff', color: '#7c3aed', border: '#e9d5ff' };
  if (type === 'image') return { background: '#fdf2f8', color: '#db2777', border: '#fbcfe8' };
  if (type === 'audio') return { background: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
  if (type === 'pdf') return { background: '#fff1f2', color: '#e11d48', border: '#fecdd3' };
  return { background: '#f8fafc', color: '#475569', border: '#e2e8f0' };
}

function uploadSourceFromLocalPath(source: string) {
  const normalized = source.replace(/\\/g, '/');
  const marker = '/public/uploads/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) return `/uploads/${normalized.slice(markerIndex + marker.length)}`;
  const uploadsIndex = normalized.indexOf('/uploads/');
  if (uploadsIndex >= 0) return normalized.slice(uploadsIndex);
  return '';
}

function normalizeImageUrl(source: string) {
  try {
    return encodeURI(decodeURI(source));
  } catch {
    return encodeURI(source);
  }
}

export function imageDisplaySource(value?: string) {
  const source = String(value || '').trim();
  if (!source) return '';
  const adminSource = source;
  const localSource = adminSource.replace(/^https?:\/\/admin\.dongfangwuquan\.com/i, '');
  if (source.startsWith('/api/')) return source;
  if (localSource.startsWith('/uploads/online-course/series-covers/')) {
    return `/api/course/series/cover/${encodeURIComponent(decodeURIComponent(localSource.split('/').pop() || ''))}`;
  }
  if (localSource.startsWith('/uploads/')) {
    return `/api/course/cover-image?src=${encodeURIComponent(normalizeImageUrl(localSource))}`;
  }
  if (/^(https?:|data:|blob:)/i.test(adminSource)) return adminSource;

  const uploadSource = localSource.startsWith('/uploads/') ? localSource : uploadSourceFromLocalPath(localSource);
  if (uploadSource.startsWith('/uploads/online-course/series-covers/')) {
    return `/api/course/series/cover/${encodeURIComponent(decodeURIComponent(uploadSource.split('/').pop() || ''))}`;
  }
  if (uploadSource) return `/api/course/cover-image?src=${encodeURIComponent(normalizeImageUrl(uploadSource))}`;

  return `/api/course/cover-image?src=${encodeURIComponent(source)}`;
}

export function materialSource(record?: MaterialLike | null) {
  if (record?.id && record.type === 'image') {
    return `/api/course/materials/${record.id}/file`;
  }
  return imageDisplaySource(record?.thumbnail || record?.file_url || record?.file_path || '');
}

export function materialPreview(record: MaterialLike, size = 42) {
  const source = materialSource(record);
  const tone = materialTypeTone(record.type);
  if ((record.type === 'image' || record.thumbnail) && source) {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', background: tone.background, color: tone.color, border: `1px solid ${tone.border}`, position: 'relative', flex: '0 0 auto' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {materialTypeIcon(record.type, Math.max(18, Math.round(size * 0.58)))}
        </div>
        <img src={source} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => {
          const target = e.currentTarget;
          target.style.display = 'none';
        }} />
      </div>
    );
  }
  if (record.type === 'video') {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: tone.background, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: `1px solid ${tone.border}`, flex: '0 0 auto' }}>
        {materialTypeIcon(record.type, 22)}
      </div>
    );
  }
  if (record.type === 'audio') {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: tone.background, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: `1px solid ${tone.border}`, flex: '0 0 auto' }}>
        {materialTypeIcon(record.type, 22)}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: tone.background, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: `1px solid ${tone.border}`, flex: '0 0 auto' }}>
      {materialTypeIcon(record.type, 22)}
    </div>
  );
}

export function materialCover(record: MaterialLike) {
  const source = materialSource(record);
  const tone = materialTypeTone(record.type);
  if ((record.type === 'image' || record.thumbnail) && source) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: tone.background, color: tone.color }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {materialTypeIcon(record.type, 32)}
        </div>
        <img src={source} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => {
          const target = e.currentTarget as HTMLElement;
          target.style.display = 'none';
          (target.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'none');
        }} />
        {record.type === 'video' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}><PlayCircleOutlined style={{ fontSize: 32, color: '#fff' }} /></div>}
      </div>
    );
  }
  if (record.type === 'video') {
    return (
      <div style={{ width: '100%', height: '100%', background: tone.background, color: tone.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
        {materialTypeIcon(record.type, 28)}
        <span style={{ fontSize: 10, opacity: 0.6 }}>视频</span>
      </div>
    );
  }
  if (record.type === 'audio') {
    return (
      <div style={{ width: '100%', height: '100%', background: tone.background, color: tone.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
        {materialTypeIcon(record.type, 28)}
        <span style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>音频</span>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', background: tone.background, color: tone.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
      {materialTypeIcon(record.type, 28)}
      <span style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>{materialIcon(record.type)}</span>
    </div>
  );
}

export function statusTag(status?: string) {
  const map: Record<string, { color: string; label: string }> = {
    published: { color: 'green', label: '已上架' },
    active: { color: 'green', label: '已上架' },
    draft: { color: 'default', label: '草稿' },
    archived: { color: 'orange', label: '已归档' },
    offline: { color: 'orange', label: '已下架' },
    paid: { color: 'green', label: '已支付' },
    pending: { color: 'orange', label: '待支付' },
    cancelled: { color: 'default', label: '已取消' },
  };
  const item = map[status || ''] || { color: 'purple', label: status || '-' };
  return <Tag color={item.color}>{item.label}</Tag>;
}
