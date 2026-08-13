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
  // 结算与终局属于「公开计分」阶段，放开战争迷雾（含他人资金），
  // 以便评分屏/终局榜展示真实资金；对局进行中则对其他人隐藏手牌与资金。
  const reveal =
    state.phase === 'GAME_END' ||
    state.phase === 'ROUND_SCORING' ||
    state.phase === 'SELL_ARTWORK';

  const players: ClientPlayer[] = state.players.map((p) => {
    const isMe = p.seatIndex === mySeat;
    const handCount = p.hand.length;
    if (isMe || reveal) return { ...p, handCount };
    // 非本人 + 对局进行中：清空手牌、置零并标记资金（真实余额根本不下发）
    return { ...p, hand: [], handCount, cash: 0, cashHidden: true };
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
