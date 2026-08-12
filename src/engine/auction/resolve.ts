import type { GameState } from '@/types/game';
import { settleAuction } from './settle';

/**
 * 落槌：结算资金与作品归属，进入结果展示阶段。
 * @param voided true 表示因第 5 幅作品触发轮次结束，作品不归属任何人
 */
export function finishAuction(
  state: GameState,
  winnerId: string | undefined,
  price: number,
  voided = false,
): void {
  const auction = state.currentAuction;
  if (!auction) return;
  auction.status = 'resolved';
  state.lastOutcome = settleAuction(state, auction, winnerId, price, voided);
  state.phase = 'AUCTION_RESULT';
}
