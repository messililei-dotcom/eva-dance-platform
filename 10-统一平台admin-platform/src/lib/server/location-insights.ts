export type LocationConfidence = '' | '高' | '中' | '低';

export type LocationInsight = {
  label: string;
  source: string;
  confidence: LocationConfidence;
};

const EMPTY_VALUES = new Set(['-', '--', '未知', '未填写', 'null', 'undefined']);

function locationPart(value: unknown) {
  const text = String(value ?? '').trim();
  return text && !EMPTY_VALUES.has(text.toLowerCase()) ? text : '';
}

export function visitLocationInsight(ipAddress: unknown, ipRegion: unknown): LocationInsight {
  const ip = String(ipAddress ?? '').trim();
  const region = locationPart(ipRegion);
  if (!ip || !region) return { label: '', source: '', confidence: '' };
  return { label: region, source: 'IP推断', confidence: '中' };
}
