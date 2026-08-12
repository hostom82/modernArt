import type { ArtistId, AuctionType, GameState } from '@/types/game';
import { startGame } from '@/engine/rulesEngine';

/**
 * 构造一个「干净」的测试局面：正常开局后清空所有手牌与牌堆，
 * 由测试用例精确指定每个人拿到哪几张牌。
 */
export function scenario(playerCount = 3, seed = 42): GameState {
  const s = startGame({ playerCount, humanCount: playerCount, aiLevel: 'normal', seed });
  s.players.forEach((p) => {
    p.hand = [];
    p.purchased = [];
    p.cash = 100;
  });
  s.deck = [];
  s.discardPile = [];
  s.bank = 0;
  return s;
}

const used = new WeakMap<GameState, Set<string>>();

/** 从牌库里挑一张指定艺术家 + 指定拍卖类型的牌（同一局内不会重复挑到同一张） */
export function pick(state: GameState, artistId: ArtistId, type: AuctionType): string {
  let taken = used.get(state);
  if (!taken) {
    taken = new Set();
    used.set(state, taken);
  }
  for (const id of Object.keys(state.artworks)) {
    const a = state.artworks[id];
    if (a.artistId === artistId && a.auctionType === type && !taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
  throw new Error(`牌库里没有更多 ${artistId} / ${type} 的牌`);
}

export function giveHand(state: GameState, seatIndex: number, cards: string[]): void {
  state.players[seatIndex].hand = cards.slice();
}

export function setCash(state: GameState, seatIndex: number, cash: number): void {
  state.players[seatIndex].cash = cash;
}

export function cashOf(state: GameState, seatIndex: number): number {
  return state.players[seatIndex].cash;
}

/** 直接设定本轮某艺术家已出现的张数（用于快速逼近第 5 幅边界） */
export function setRoundCount(state: GameState, artistId: ArtistId, count: number): void {
  state.roundArtworkCounts[artistId] = count;
  state.artists[artistId].roundCounts[state.currentRound - 1] = count;
}

export function purchasedCount(state: GameState, seatIndex: number, artistId?: ArtistId): number {
  const p = state.players[seatIndex];
  if (!artistId) return p.purchased.length;
  return p.purchased.filter((id) => state.artworks[id].artistId === artistId).length;
}
