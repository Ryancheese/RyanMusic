export const AUTO_AUDIO_QUALITY = 'auto';

export const AUDIO_QUALITY_LADDER = [
  'standard',
  'higher',
  'exhigh',
  'lossless',
  'hires',
  'jyeffect',
  'sky',
  'jymaster',
] as const;

export type AudioQualityLevel = (typeof AUDIO_QUALITY_LADDER)[number];
export type AudioQualityPreference = typeof AUTO_AUDIO_QUALITY | AudioQualityLevel;

export const AUDIO_QUALITY_OPTIONS: Array<{ id: AudioQualityPreference; label: string; hint: string }> = [
  { id: 'auto', label: '自动', hint: '按网速和设备环境选择合适档位' },
  { id: 'standard', label: '标准', hint: '约 128k，最省流量' },
  { id: 'higher', label: '较高', hint: '约 192k' },
  { id: 'exhigh', label: '极高', hint: '约 320k' },
  { id: 'lossless', label: '无损', hint: 'FLAC' },
  { id: 'hires', label: 'Hi-Res', hint: '高解析度' },
  { id: 'jyeffect', label: '高清环绕声', hint: '空间音频' },
  { id: 'sky', label: '沉浸环绕', hint: '空间音频' },
  { id: 'jymaster', label: '超清母带', hint: '最高档，最吃带宽' },
];

const LEVEL_SET = new Set<string>(AUDIO_QUALITY_LADDER);

export function isAudioQualityPreference(value: unknown): value is AudioQualityPreference {
  return value === AUTO_AUDIO_QUALITY || (typeof value === 'string' && LEVEL_SET.has(value));
}

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

/** 根据网速 / 省流 / 在线状态给出音质上限 */
export function estimateNetworkQualityCeiling(): AudioQualityLevel {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'standard';
  }

  const conn = getConnection();
  if (!conn) {
    // 桌面 WebView 通常测不到网速：先出 320k，避免无损/母带把首包拖到十几秒
    return 'exhigh';
  }

  if (conn.saveData) return 'standard';

  const downlink = Number(conn.downlink) || 0;
  const rtt = Number(conn.rtt) || 0;
  const effective = String(conn.effectiveType || '').toLowerCase();
  const type = String(conn.type || '').toLowerCase();

  if (effective === 'slow-2g' || effective === '2g') return 'standard';
  if (type === 'cellular' && downlink > 0 && downlink < 2) return 'higher';
  if (effective === '3g' || (downlink > 0 && downlink < 1.5)) return 'higher';
  if (rtt >= 280) return 'higher';
  if (effective === '4g' && downlink > 0 && downlink < 5) return 'exhigh';
  if (downlink > 0 && downlink < 8) return 'exhigh';
  if (rtt >= 160) return 'exhigh';
  if (downlink > 0 && downlink < 20) return 'lossless';
  if (downlink > 0 && downlink < 40) return 'hires';
  if (downlink >= 40) return 'jymaster';
  if (effective === '4g' || type === 'wifi' || type === 'ethernet') return 'exhigh';
  return 'exhigh';
}

export function pickLevelAtOrBelow(available: string[], ceiling: string): string {
  const avail = new Set(available);
  const capIndex = AUDIO_QUALITY_LADDER.indexOf(ceiling as AudioQualityLevel);
  const max = capIndex >= 0 ? capIndex : AUDIO_QUALITY_LADDER.indexOf('exhigh');
  for (let i = max; i >= 0; i -= 1) {
    const level = AUDIO_QUALITY_LADDER[i];
    if (avail.has(level)) return level;
  }
  for (const level of AUDIO_QUALITY_LADDER) {
    if (avail.has(level)) return level;
  }
  return available[0] || '';
}

export function pickPreferredLevel(
  available: Array<{ level: string }>,
  preference: string,
): string {
  const ids = available.map((item) => item.level).filter(Boolean);
  if (!ids.length) return '';
  if (preference === AUTO_AUDIO_QUALITY) {
    return pickLevelAtOrBelow(ids, estimateNetworkQualityCeiling());
  }
  if (ids.includes(preference)) return preference;
  return pickLevelAtOrBelow(ids, preference);
}

export function audioQualityLabel(level: string): string {
  return AUDIO_QUALITY_OPTIONS.find((item) => item.id === level)?.label || level;
}
