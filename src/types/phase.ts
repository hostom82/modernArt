/**
 * 游戏状态机的全部阶段。
 * 引擎在任意时刻只处于其中一个阶段，所有 UI 交互都由当前阶段决定。
 */
export const GAME_PHASES = [
  'SETUP',
  'ROUND_START',
  'PLAYER_TURN',
  'SELECT_ARTWORK',
  'AUCTION_OPEN',
  'AUCTION_ONE_OFFER',
  'AUCTION_HIDDEN',
  'AUCTION_FIXED',
  'AUCTION_DOUBLE_WAIT',
  'AUCTION_DOUBLE_SELECT',
  'AUCTION_DOUBLE_RUNNING',
  'AUCTION_RESULT',
  'CHECK_ROUND_END',
  'ROUND_SCORING',
  'SELL_ARTWORK',
  'DEAL_NEXT_ROUND',
  'GAME_END',
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

/** 处于「某种拍卖进行中」的阶段集合 */
export const AUCTION_PHASES: readonly GamePhase[] = [
  'AUCTION_OPEN',
  'AUCTION_ONE_OFFER',
  'AUCTION_HIDDEN',
  'AUCTION_FIXED',
  'AUCTION_DOUBLE_RUNNING',
];

export function isAuctionPhase(phase: GamePhase): boolean {
  return AUCTION_PHASES.includes(phase);
}
