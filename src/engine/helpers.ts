import type { ArtistId, Artwork, GameState, Player } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';

export function getPlayer(state: GameState, playerId: string): Player {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`找不到玩家 ${playerId}`);
  return p;
}

export function tryGetPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((x) => x.id === playerId);
}

export function getArtwork(state: GameState, artworkId: string): Artwork {
  const a = state.artworks[artworkId];
  if (!a) throw new Error(`找不到作品 ${artworkId}`);
  return a;
}

/** 座位是环形的：seatIndex + k */
export function seatAt(state: GameState, seatIndex: number): Player {
  const n = state.players.length;
  return state.players[((seatIndex % n) + n) % n];
}

/** 某玩家左手边（顺时针下一位）的玩家 */
export function leftOf(state: GameState, playerId: string): Player {
  const p = getPlayer(state, playerId);
  return seatAt(state, p.seatIndex + 1);
}

/**
 * 从某个玩家开始顺时针的完整座位顺序。
 * @param includeStart 是否包含起点玩家本人
 */
export function clockwiseFrom(state: GameState, playerId: string, includeStart: boolean): string[] {
  const start = getPlayer(state, playerId).seatIndex;
  const n = state.players.length;
  const out: string[] = [];
  for (let k = includeStart ? 0 : 1; k < n; k++) {
    out.push(seatAt(state, start + k).id);
  }
  return out;
}

/** 一轮报价的询问队列：拍卖师左手起顺时针一圈，拍卖师排最后 */
export function oneOfferQueue(state: GameState, auctioneerId: string): string[] {
  return [...clockwiseFrom(state, auctioneerId, false), auctioneerId];
}

/** 暗标平局优先级：拍卖师本人最高，其后按顺时针 */
export function tiePriority(state: GameState, auctioneerId: string): string[] {
  return clockwiseFrom(state, auctioneerId, true);
}

export function allHandsEmpty(state: GameState): boolean {
  return state.players.every((p) => p.hand.length === 0);
}

export function emptyRoundCounts(): Record<ArtistId, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

export function artistIds(): readonly ArtistId[] {
  return ARTIST_ORDER;
}

/** 玩家手里同艺术家、且不是 DOUBLE 类型的牌 —— 双重拍卖可追加的候选 */
export function doubleCandidates(state: GameState, playerId: string, artistId: ArtistId): string[] {
  const p = tryGetPlayer(state, playerId);
  if (!p) return [];
  return p.hand.filter((id) => {
    const art = state.artworks[id];
    return art && art.artistId === artistId && art.auctionType !== 'DOUBLE';
  });
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
