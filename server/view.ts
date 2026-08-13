import type { GameState, AuctionState } from '@/types/game';
import type { ClientPlayer, ClientView } from '@/shared/protocol';

/**
 * 把权威局面投影成「某位玩家看到的版本」（战争迷雾）：
 *  - 他人的手牌清空，仅保留 handCount（座次栏显示张数）
 *  - 他人的现金隐藏，不向该连接者下发真实余额（仅留 cashHidden 占位）
 *  - 暗标未揭示时，除本人外的报价一律抹掉（只显示「已提交」状态）
 * 服务端据此为每位连接者发送各自独立的 sync。
 */
export function projectView(state: GameState, mySeat: number): ClientView {
  const players: ClientPlayer[] = state.players.map((p) => {
    const isMe = p.seatIndex === mySeat;
    const handCount = p.hand.length;
    if (isMe) return { ...p, handCount };
    // 对手：清空手牌、抹掉现金，避免信息泄露
    return { ...p, hand: [], handCount, cashHidden: true, cash: 0 };
  });

  let next: GameState & { players: ClientPlayer[] } = { ...state, players };

  const auction = next.currentAuction;
  if (auction && auction.type === 'HIDDEN' && !auction.revealed) {
    const masked: Record<string, number | null | undefined> = {};
    for (const [pid, v] of Object.entries(auction.bids)) {
      masked[pid] = pid === `p${mySeat}` ? v : undefined;
    }
    next = {
      ...next,
      currentAuction: { ...auction, bids: masked as AuctionState['bids'] },
    };
  }

  return next as unknown as ClientView;
}
