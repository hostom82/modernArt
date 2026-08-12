import type { AuctionState, GameState } from '@/types/game';
import { getPlayer } from '../helpers';
import { money, pushLog } from '../log';
import { buildFixedQueue } from './core';

/** 拍卖师宣布定价。定价不得超过自己现有现金（否则全员 PASS 时他付不起）。 */
export function applyFixedPrice(state: GameState, auction: AuctionState, price: number): void {
  auction.fixedPrice = price;
  buildFixedQueue(state, auction);
  pushLog(state, 'bid', `${getPlayer(state, auction.auctioneerId).name} 定价 ${money(price)}`, {
    playerId: auction.auctioneerId,
  });
}

export function applyFixedPass(state: GameState, auction: AuctionState, playerId: string): void {
  auction.bids[playerId] = null;
  auction.turnIndex += 1;
  pushLog(state, 'pass', `${getPlayer(state, playerId).name} 放弃购买`, { playerId });
}

export function fixedExhausted(auction: AuctionState): boolean {
  return auction.turnIndex >= auction.turnQueue.length;
}
