import type { AiLevel } from './game';

/**
 * 引擎接受的全部动作。
 * 任何改变游戏状态的操作都必须通过这里，UI 不允许直接改 state。
 */
export type GameAction =
  | {
      type: 'START_GAME';
      playerCount: number;
      humanCount: number;
      aiLevel: AiLevel;
      seed?: number;
      names?: string[];
    }
  /** 出牌：把一张手牌放上拍卖台 */
  | { type: 'PLAY_ARTWORK'; playerId: string; artworkId: string }
  /** 开放拍卖 / 一轮报价：出价 */
  | { type: 'PLACE_BID'; playerId: string; amount: number }
  /** 放弃 / PASS */
  | { type: 'PASS_BID'; playerId: string }
  /** 暗标：提交秘密报价 */
  | { type: 'SUBMIT_HIDDEN_BID'; playerId: string; amount: number }
  /** 固定价格：拍卖师定价 */
  | { type: 'SET_FIXED_PRICE'; playerId: string; price: number }
  /** 固定价格：买下 */
  | { type: 'BUY_FIXED'; playerId: string }
  /** 双重拍卖：追加第二幅作品 */
  | { type: 'DOUBLE_ADD'; playerId: string; artworkId: string }
  /** 双重拍卖：不追加 */
  | { type: 'DOUBLE_DECLINE'; playerId: string }
  /** 开放拍卖倒计时结束，落槌 */
  | { type: 'RESOLVE_OPEN_AUCTION' }
  /** 拍卖结果页 → 继续 */
  | { type: 'ACKNOWLEDGE_RESULT' }
  /** 结算页 → 继续（排名 → 卖画 → 下一轮） */
  | { type: 'CONTINUE' }
  /** 重开一局 */
  | { type: 'RESTART' };

export type ActionType = GameAction['type'];

/** 校验结果 */
export interface ValidationResult {
  ok: boolean;
  reason?: string;
}
