import type { ArtistId } from '@/types/game';

/** 金额展示：内部整数 → €35k */
export function money(n: number): string {
  return `€${n}k`;
}

/** 艺术家主题色，供图表与标签使用 */
export const ARTIST_COLORS: Record<ArtistId, string> = {
  A: '#E0B400',
  B: '#2E9E5B',
  C: '#C0392B',
  D: '#7D3CB5',
  E: '#8A5A2B',
};

export const RANK_LABEL = ['第一', '第二', '第三', '第四', '第五'];

/** 名次奖牌 */
export function medal(rank: number): string {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? '';
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
