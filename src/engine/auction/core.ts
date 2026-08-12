import type { AuctionState, AuctionType, GameState } from '@/types/game';
import type { GamePhase } from '@/types/phase';
import { clockwiseFrom, getArtwork, getPlayer, oneOfferQueue } from '../helpers';
import { pushLog } from '../log';
import { AUCTION_TYPE_LABEL } from '@/data/artists';

export function auctionPhaseFor(type: AuctionType, isDouble: boolean): GamePhase {
  if (isDouble) return 'AUCTION_DOUBLE_RUNNING';
  switch (type) {
    case 'OPEN':
      return 'AUCTION_OPEN';
    case 'ONE_OFFER':
      return 'AUCTION_ONE_OFFER';
    case 'HIDDEN':
      return 'AUCTION_HIDDEN';
    case 'FIXED':
      return 'AUCTION_FIXED';
    default:
      return 'AUCTION_OPEN';
  }
}

/**
 * 建立一场拍卖并把游戏推进到对应阶段。
 * @param type 实际执行的拍卖方式（双重拍卖时是第二幅牌的类型）
 * @param coAuctioneerId 共同拍卖师；若第二幅牌由拍卖师本人追加，则不存在共同拍卖师
 */
export function beginAuction(
  state: GameState,
  type: AuctionType,
  auctioneerId: string,
  artworkIds: string[],
  coAuctioneerId?: string,
): void {
  const isDouble = artworkIds.length > 1;

  const auction: AuctionState = {
    // id 必须只由状态推导，不能用模块级自增计数器 —— 否则同一个种子重开会得到不同的 id，
    // 依赖 id 做确定性随机的 AI 就不可复现了。
    id: `auction-r${state.currentRound}-${state.logCounter}`,
    type,
    auctioneerId,
    coAuctioneerId,
    artworkIds: artworkIds.slice(),
    bids: {},
    currentHighestBid: 0,
    turnQueue: [],
    turnIndex: 0,
    submitted: [],
    revealed: false,
    status: 'running',
  };

  if (type === 'ONE_OFFER') {
    auction.turnQueue = oneOfferQueue(state, auctioneerId);
  } else if (type === 'FIXED') {
    // 定价还没确定，先留空；SET_FIXED_PRICE 之后再建立询问队列
    auction.turnQueue = [];
  }

  state.currentAuction = auction;
  state.phase = auctionPhaseFor(type, isDouble);

  const auctioneer = getPlayer(state, auctioneerId);
  const titles = artworkIds.map((id) => `《${getArtwork(state, id).name}》`).join(' + ');
  pushLog(
    state,
    'play',
    `${auctioneer.name} 提出 ${titles} · ${AUCTION_TYPE_LABEL[type]}`,
    { playerId: auctioneerId, artistId: getArtwork(state, artworkIds[0]).artistId },
  );
}

/** 定价拍卖：拍卖师报价后建立询问队列（不含拍卖师本人） */
export function buildFixedQueue(state: GameState, auction: AuctionState): void {
  auction.turnQueue = clockwiseFrom(state, auction.auctioneerId, false);
  auction.turnIndex = 0;
}

/** 当前轮到谁操作（一轮报价 / 定价拍卖） */
export function currentAsker(auction: AuctionState): string | undefined {
  return auction.turnQueue[auction.turnIndex];
}
