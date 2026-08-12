import type { GameAction, ValidationResult } from '@/types/actions';
import type { AuctionType, GameState } from '@/types/game';
import { doubleCandidates, tryGetPlayer } from './helpers';
import { currentAsker } from './auction/core';
import { currentDoubleAsked } from './auction/double';

const OK: ValidationResult = { ok: true };
const no = (reason: string): ValidationResult => ({ ok: false, reason });

/** 当前正在进行的拍卖方式（双重拍卖时取第二幅牌决定的方式） */
export function activeAuctionType(state: GameState): AuctionType | undefined {
  if (!state.currentAuction || state.currentAuction.status !== 'running') return undefined;
  const p = state.phase;
  if (
    p === 'AUCTION_OPEN' ||
    p === 'AUCTION_ONE_OFFER' ||
    p === 'AUCTION_HIDDEN' ||
    p === 'AUCTION_FIXED' ||
    p === 'AUCTION_DOUBLE_RUNNING'
  ) {
    return state.currentAuction.type;
  }
  return undefined;
}

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n >= 1;
}

/**
 * 所有非法操作的唯一拦截点。
 * UI 只负责显示 reason，不做规则判断。
 */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  if (action.type === 'START_GAME' || action.type === 'RESTART') return OK;

  if (state.phase === 'GAME_END') return no('牌局已经结束');

  const auction = state.currentAuction;
  const type = activeAuctionType(state);

  switch (action.type) {
    case 'PLAY_ARTWORK': {
      if (state.phase !== 'PLAYER_TURN') return no('现在不是出牌阶段');
      const cur = state.players[state.currentPlayerIndex];
      if (cur.id !== action.playerId) return no(`现在轮到 ${cur.name} 出牌`);
      const p = tryGetPlayer(state, action.playerId);
      if (!p) return no('玩家不存在');
      if (!p.hand.includes(action.artworkId)) return no('这张作品不在你的手牌里');
      return OK;
    }

    case 'PLACE_BID': {
      const p = tryGetPlayer(state, action.playerId);
      if (!p || !auction) return no('当前没有进行中的拍卖');
      if (!isPositiveInt(action.amount)) return no('出价必须是不小于 1 的整数');
      if (action.amount > p.cash) return no(`资金不足，你只有 €${p.cash}k`);
      if (action.amount <= auction.currentHighestBid) {
        return no(`出价必须高于当前最高价 €${auction.currentHighestBid}k`);
      }
      if (type === 'OPEN') {
        if (auction.bids[action.playerId] === null) return no('你已经放弃了这场拍卖');
        if (auction.highestBidder === action.playerId) return no('你已经是最高出价者');
        return OK;
      }
      if (type === 'ONE_OFFER') {
        if (currentAsker(auction) !== action.playerId) return no('还没轮到你报价');
        return OK;
      }
      return no('当前拍卖方式不接受这种出价');
    }

    case 'PASS_BID': {
      const p = tryGetPlayer(state, action.playerId);
      if (!p || !auction) return no('当前没有进行中的拍卖');
      if (type === 'OPEN') {
        if (auction.bids[action.playerId] === null) return no('你已经放弃了');
        if (auction.highestBidder === action.playerId) return no('你正处于最高价，无法放弃');
        return OK;
      }
      if (type === 'ONE_OFFER') {
        if (currentAsker(auction) !== action.playerId) return no('还没轮到你');
        return OK;
      }
      if (type === 'FIXED') {
        if (auction.fixedPrice === undefined) return no('拍卖师还没有定价');
        if (currentAsker(auction) !== action.playerId) return no('还没轮到你');
        return OK;
      }
      return no('当前拍卖方式不接受放弃操作');
    }

    case 'SUBMIT_HIDDEN_BID': {
      const p = tryGetPlayer(state, action.playerId);
      if (!p || !auction) return no('当前没有进行中的拍卖');
      if (type !== 'HIDDEN') return no('当前不是暗标拍卖');
      if (auction.submitted.includes(action.playerId)) return no('你已经提交过报价');
      if (!Number.isInteger(action.amount) || action.amount < 0) return no('报价必须是非负整数');
      if (action.amount > p.cash) return no(`资金不足，你只有 €${p.cash}k`);
      return OK;
    }

    case 'SET_FIXED_PRICE': {
      const p = tryGetPlayer(state, action.playerId);
      if (!p || !auction) return no('当前没有进行中的拍卖');
      if (type !== 'FIXED') return no('当前不是定价拍卖');
      if (auction.auctioneerId !== action.playerId) return no('只有拍卖师可以定价');
      if (auction.fixedPrice !== undefined) return no('已经定过价了');
      // 拍卖师现金为 0 时只能定 0 —— 否则他既定不出价也无法推进，牌局会卡死
      const minPrice = p.cash > 0 ? 1 : 0;
      if (!Number.isInteger(action.price) || action.price < minPrice) {
        return no(`定价必须是不小于 ${minPrice} 的整数`);
      }
      if (action.price > p.cash) return no(`定价不能超过你的现金 €${p.cash}k —— 无人接手时你必须自己买下`);
      return OK;
    }

    case 'BUY_FIXED': {
      const p = tryGetPlayer(state, action.playerId);
      if (!p || !auction) return no('当前没有进行中的拍卖');
      if (type !== 'FIXED') return no('当前不是定价拍卖');
      if (auction.fixedPrice === undefined) return no('拍卖师还没有定价');
      if (currentAsker(auction) !== action.playerId) return no('还没轮到你');
      if (p.cash < auction.fixedPrice) return no(`资金不足，你只有 €${p.cash}k`);
      return OK;
    }

    case 'DOUBLE_ADD': {
      const pd = state.pendingDouble;
      if (!pd) return no('当前没有等待追加的联合拍卖');
      if (currentDoubleAsked(state) !== action.playerId) return no('还没轮到你决定');
      const p = tryGetPlayer(state, action.playerId);
      if (!p) return no('玩家不存在');
      if (!p.hand.includes(action.artworkId)) return no('这张作品不在你的手牌里');
      const art = state.artworks[action.artworkId];
      if (!art) return no('作品不存在');
      if (art.artistId !== pd.artistId) {
        return no(`必须追加 ${state.artists[pd.artistId].name} 的作品`);
      }
      if (art.auctionType === 'DOUBLE') return no('第二幅作品不能也是联合拍卖');
      if (doubleCandidates(state, action.playerId, pd.artistId).length === 0) {
        return no('你没有可追加的作品');
      }
      return OK;
    }

    case 'DOUBLE_DECLINE': {
      if (!state.pendingDouble) return no('当前没有等待追加的联合拍卖');
      if (currentDoubleAsked(state) !== action.playerId) return no('还没轮到你决定');
      return OK;
    }

    case 'RESOLVE_OPEN_AUCTION': {
      if (type !== 'OPEN') return no('当前不是公开竞价');
      return OK;
    }

    case 'ACKNOWLEDGE_RESULT': {
      if (state.phase !== 'AUCTION_RESULT') return no('当前没有待确认的拍卖结果');
      return OK;
    }

    case 'CONTINUE': {
      if (state.phase !== 'ROUND_SCORING' && state.phase !== 'SELL_ARTWORK') {
        return no('当前没有待确认的结算');
      }
      return OK;
    }

    default:
      return no('未知操作');
  }
}
