import type { AuctionState, GameState } from '@/types/game';
import { getPlayer } from '../helpers';
import { money, pushLog } from '../log';

/** 已放弃的玩家 */
export function passedPlayers(auction: AuctionState): string[] {
  return Object.keys(auction.bids).filter((id) => auction.bids[id] === null);
}

/** 仍可继续加价的玩家 */
export function activePlayers(state: GameState, auction: AuctionState): string[] {
  const passed = new Set(passedPlayers(auction));
  return state.players.map((p) => p.id).filter((id) => !passed.has(id));
}

export function applyOpenBid(state: GameState, auction: AuctionState, playerId: string, amount: number): void {
  auction.bids[playerId] = amount;
  auction.currentHighestBid = amount;
  auction.highestBidder = playerId;
  const p = getPlayer(state, playerId);
  pushLog(state, 'bid', `${p.name} 出价 ${money(amount)}`, { playerId });
}

export function applyOpenPass(state: GameState, auction: AuctionState, playerId: string): void {
  auction.bids[playerId] = null;
  const p = getPlayer(state, playerId);
  pushLog(state, 'pass', `${p.name} 放弃`, { playerId });
}

/**
 * 是否应立即落槌：
 *  - 有人领先且其他人全部放弃
 *  - 无人出价且所有人都放弃（拍卖师免费获得）
 */
export function shouldResolveOpen(state: GameState, auction: AuctionState): boolean {
  const active = activePlayers(state, auction);
  if (auction.highestBidder) {
    return active.length <= 1 && active[0] === auction.highestBidder;
  }
  return active.length === 0;
}
