import type { AuctionState, GameState } from '@/types/game';
import { getPlayer } from '../helpers';
import { money, pushLog } from '../log';

/**
 * 一轮报价：从拍卖师左手起顺时针，每人只有一次机会，拍卖师最后决定。
 * 出价必须严格高于当前最高价。
 */
export function applyOneOfferBid(
  state: GameState,
  auction: AuctionState,
  playerId: string,
  amount: number,
): void {
  auction.bids[playerId] = amount;
  auction.currentHighestBid = amount;
  auction.highestBidder = playerId;
  auction.turnIndex += 1;
  pushLog(state, 'bid', `${getPlayer(state, playerId).name} 报价 ${money(amount)}`, { playerId });
}

export function applyOneOfferPass(state: GameState, auction: AuctionState, playerId: string): void {
  auction.bids[playerId] = null;
  auction.turnIndex += 1;
  pushLog(state, 'pass', `${getPlayer(state, playerId).name} PASS`, { playerId });
}

export function oneOfferFinished(auction: AuctionState): boolean {
  return auction.turnIndex >= auction.turnQueue.length;
}
