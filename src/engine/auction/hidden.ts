import type { AuctionState, GameState } from '@/types/game';
import { getPlayer, tiePriority } from '../helpers';
import { money, pushLog } from '../log';

export function applyHiddenBid(
  auction: AuctionState,
  playerId: string,
  amount: number,
): void {
  auction.bids[playerId] = amount;
  if (!auction.submitted.includes(playerId)) auction.submitted.push(playerId);
}

export function hiddenAllSubmitted(state: GameState, auction: AuctionState): boolean {
  return auction.submitted.length >= state.players.length;
}

/**
 * 揭示暗标并决出赢家。
 * 平局优先级：拍卖师本人最高，其后从拍卖师左手起顺时针。
 * 全员出价 0 → 无赢家，拍卖师免费获得。
 */
export function resolveHidden(
  state: GameState,
  auction: AuctionState,
): { winnerId?: string; price: number } {
  auction.revealed = true;

  const lines = state.players.map((p) => {
    const v = auction.bids[p.id];
    return `${p.name} ${v && v > 0 ? money(v) : '—'}`;
  });
  pushLog(state, 'result', `暗标揭晓：${lines.join('　')}`);

  let best = 0;
  for (const p of state.players) {
    const v = auction.bids[p.id];
    if (typeof v === 'number' && v > best) best = v;
  }
  if (best <= 0) return { winnerId: undefined, price: 0 };

  const priority = tiePriority(state, auction.auctioneerId);
  const winners = priority.filter((id) => auction.bids[id] === best);
  const winnerId = winners[0];

  if (winners.length > 1) {
    pushLog(
      state,
      'result',
      `${money(best)} 出现平局，按拍卖师优先顺序由 ${getPlayer(state, winnerId).name} 胜出`,
      { playerId: winnerId },
    );
  }
  return { winnerId, price: best };
}
