import { produce } from 'immer';
import type { GameAction, ValidationResult } from '@/types/actions';
import type { AuctionState, GameState } from '@/types/game';
import { getArtwork, getPlayer } from './helpers';
import { pushLog } from './log';
import { createInitialState, dealCountFor, dealToPlayers, sortHand, type StartGameOptions } from './setup';
import {
  advanceTurnFrom,
  dealNextRound,
  endGame,
  enterScoring,
  isFifthCard,
  markFifthCardEnd,
  registerPlayedCard,
} from './roundFlow';
import { beginAuction, currentAsker } from './auction/core';
import { finishAuction } from './auction/resolve';
import { applyOpenBid, applyOpenPass, shouldResolveOpen } from './auction/open';
import { applyOneOfferBid, applyOneOfferPass, oneOfferFinished } from './auction/oneOffer';
import { applyHiddenBid, hiddenAllSubmitted, resolveHidden } from './auction/hidden';
import { applyFixedPass, applyFixedPrice, fixedExhausted } from './auction/fixed';
import { applyDoubleAdd, applyDoubleDecline, startPendingDouble } from './auction/double';
import { sellRoundArtworks } from './scoring';
import { activeAuctionType, validateAction } from './validate';

export { validateAction } from './validate';
export { activeAuctionType } from './validate';

/** 开新局：建初始状态 + 发第 1 轮手牌 */
export function startGame(opts: StartGameOptions): GameState {
  const state = createInitialState(opts);
  const count = dealCountFor(state.players.length, 1);
  dealToPlayers(state, count);
  state.players.forEach((p) => sortHand(state, p));
  pushLog(state, 'round', `第 1 轮开始 · 每人 ${count} 张手牌`);
  state.startingPlayerIndex = 0;
  state.currentPlayerIndex = 0;
  state.phase = 'PLAYER_TURN';
  return state;
}

function syntheticAuction(
  id: string,
  type: AuctionState['type'],
  auctioneerId: string,
  artworkIds: string[],
): AuctionState {
  return {
    id,
    type,
    auctioneerId,
    artworkIds,
    bids: {},
    currentHighestBid: 0,
    turnQueue: [],
    turnIndex: 0,
    submitted: [],
    revealed: false,
    status: 'running',
  };
}

/** 出牌 */
function playArtwork(state: GameState, playerId: string, artworkId: string): void {
  const player = getPlayer(state, playerId);
  const art = getArtwork(state, artworkId);

  player.hand = player.hand.filter((id) => id !== artworkId);
  state.lastAuctioneerId = playerId;
  state.lastOutcome = undefined;

  const count = registerPlayedCard(state, artworkId, playerId);

  pushLog(state, 'play', `${player.name} 提出《${art.name}》· ${state.artists[art.artistId].name}`, {
    playerId,
    artistId: art.artistId,
  });

  if (isFifthCard(count)) {
    // 第 5 幅：不拍卖、不归属，但计入排名
    markFifthCardEnd(state, art.artistId);
    state.currentAuction = syntheticAuction(`fifth-${artworkId}`, art.auctionType, playerId, [artworkId]);
    finishAuction(state, undefined, 0, true);
    return;
  }

  if (art.auctionType === 'DOUBLE') {
    pushLog(state, 'double', '联合拍卖 · 正在寻找同一位艺术家的第二幅作品');
    startPendingDouble(state, artworkId, playerId);
    return;
  }

  beginAuction(state, art.auctionType, playerId, [artworkId]);
}

function handlePlaceBid(state: GameState, playerId: string, amount: number): void {
  const auction = state.currentAuction!;
  const type = activeAuctionType(state);
  if (type === 'OPEN') {
    applyOpenBid(state, auction, playerId, amount);
    if (shouldResolveOpen(state, auction)) {
      finishAuction(state, auction.highestBidder, auction.currentHighestBid);
    }
  } else if (type === 'ONE_OFFER') {
    applyOneOfferBid(state, auction, playerId, amount);
    if (oneOfferFinished(auction)) {
      finishAuction(state, auction.highestBidder, auction.currentHighestBid);
    }
  }
}

function handlePassBid(state: GameState, playerId: string): void {
  const auction = state.currentAuction!;
  const type = activeAuctionType(state);
  if (type === 'OPEN') {
    applyOpenPass(state, auction, playerId);
    if (shouldResolveOpen(state, auction)) {
      finishAuction(state, auction.highestBidder, auction.currentHighestBid);
    }
  } else if (type === 'ONE_OFFER') {
    applyOneOfferPass(state, auction, playerId);
    if (oneOfferFinished(auction)) {
      finishAuction(state, auction.highestBidder, auction.currentHighestBid);
    }
  } else if (type === 'FIXED') {
    applyFixedPass(state, auction, playerId);
    if (fixedExhausted(auction)) {
      // 全员放弃 → 拍卖师必须按自己宣布的价格买下
      pushLog(state, 'result', '无人接手，拍卖师必须自行买下');
      finishAuction(state, auction.auctioneerId, auction.fixedPrice ?? 0);
    }
  }
}

function handleAcknowledgeResult(state: GameState): void {
  const auction = state.currentAuction;
  const anchor =
    auction?.coAuctioneerId ?? auction?.auctioneerId ?? state.lastAuctioneerId ?? state.players[0].id;
  state.currentAuction = undefined;
  advanceTurnFrom(state, anchor);
}

function handleContinue(state: GameState): void {
  if (state.phase === 'ROUND_SCORING') {
    const result = state.roundResult;
    if (!result) return;
    const incomes = sellRoundArtworks(state, result.artists);
    result.incomes = incomes;
    result.sold = true;
    state.cashSnapshots.push(state.players.map((p) => p.cash));
    state.phase = 'SELL_ARTWORK';
    return;
  }

  if (state.phase === 'SELL_ARTWORK') {
    if (state.roundResult) state.roundHistory.push(state.roundResult);
    if (state.currentRound >= 4) {
      endGame(state);
    } else {
      dealNextRound(state);
    }
  }
}

/**
 * 规则引擎唯一入口。
 * 纯函数：(state, action) => newState。不含任何 UI、计时器或副作用。
 */
export function reduce(state: GameState, action: GameAction): GameState {
  if (action.type === 'START_GAME') {
    return startGame({
      playerCount: action.playerCount,
      humanCount: action.humanCount,
      aiLevel: action.aiLevel,
      seed: action.seed,
      names: action.names,
    });
  }

  if (action.type === 'RESTART') {
    return startGame({
      playerCount: state.settings.playerCount,
      humanCount: state.settings.humanCount,
      aiLevel: state.settings.aiLevel,
      seed: state.settings.seed + 1,
      names: state.players.map((p) => p.name),
      openAuctionSeconds: state.settings.openAuctionSeconds,
    });
  }

  const check = validateAction(state, action);
  if (!check.ok) return state;

  return produce(state, (draft) => {
    switch (action.type) {
      case 'PLAY_ARTWORK':
        playArtwork(draft, action.playerId, action.artworkId);
        break;

      case 'PLACE_BID':
        handlePlaceBid(draft, action.playerId, action.amount);
        break;

      case 'PASS_BID':
        handlePassBid(draft, action.playerId);
        break;

      case 'SUBMIT_HIDDEN_BID': {
        const auction = draft.currentAuction!;
        applyHiddenBid(auction, action.playerId, action.amount);
        if (hiddenAllSubmitted(draft, auction)) {
          const r = resolveHidden(draft, auction);
          finishAuction(draft, r.winnerId, r.price);
        }
        break;
      }

      case 'SET_FIXED_PRICE':
        applyFixedPrice(draft, draft.currentAuction!, action.price);
        break;

      case 'BUY_FIXED': {
        const auction = draft.currentAuction!;
        finishAuction(draft, action.playerId, auction.fixedPrice ?? 0);
        break;
      }

      case 'DOUBLE_ADD':
        applyDoubleAdd(draft, action.playerId, action.artworkId);
        break;

      case 'DOUBLE_DECLINE':
        applyDoubleDecline(draft, action.playerId);
        break;

      case 'RESOLVE_OPEN_AUCTION': {
        const auction = draft.currentAuction!;
        finishAuction(draft, auction.highestBidder, auction.currentHighestBid);
        break;
      }

      case 'ACKNOWLEDGE_RESULT':
        handleAcknowledgeResult(draft);
        break;

      case 'CONTINUE':
        handleContinue(draft);
        break;

      default:
        break;
    }
  });
}

/** 便于测试与 UI 查询：当前该谁操作 */
export function actingPlayerId(state: GameState): string | undefined {
  switch (state.phase) {
    case 'PLAYER_TURN':
      return state.players[state.currentPlayerIndex]?.id;
    case 'AUCTION_ONE_OFFER':
      return state.currentAuction ? currentAsker(state.currentAuction) : undefined;
    case 'AUCTION_FIXED':
      if (!state.currentAuction) return undefined;
      return state.currentAuction.fixedPrice === undefined
        ? state.currentAuction.auctioneerId
        : currentAsker(state.currentAuction);
    case 'AUCTION_DOUBLE_RUNNING': {
      const a = state.currentAuction;
      if (!a) return undefined;
      if (a.type === 'ONE_OFFER') return currentAsker(a);
      if (a.type === 'FIXED') {
        return a.fixedPrice === undefined ? a.auctioneerId : currentAsker(a);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

export type { ValidationResult };
export { enterScoring };
