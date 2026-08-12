import type { AuctionState, GameState } from '@/types/game';
import { clockwiseFrom, doubleCandidates, getArtwork, getPlayer } from '../helpers';
import { pushLog } from '../log';
import { isFifthCard, markFifthCardEnd, registerPlayedCard } from '../roundFlow';
import { beginAuction } from './core';
import { finishAuction } from './resolve';

/**
 * 双重（联合）拍卖的追加询问流程。
 *
 * 询问顺序：拍卖师本人 → 拍卖师左手 → 顺时针一圈。
 * 只能追加「同一位艺术家、且拍卖类型不是联合拍卖」的作品。
 * 手里没有合法候选的玩家会被自动跳过。
 * 全员都不追加 → 官方规则：拍卖师免费获得这张联合拍卖牌，不进行拍卖。
 */
export function startPendingDouble(state: GameState, firstArtworkId: string, auctioneerId: string): void {
  const art = getArtwork(state, firstArtworkId);
  state.pendingDouble = {
    firstArtworkId,
    artistId: art.artistId,
    askQueue: [auctioneerId, ...clockwiseFrom(state, auctioneerId, false)],
    askIndex: 0,
  };
  advanceDoubleAsk(state, false);
}

/** 当前被询问的玩家（已跳过无候选者） */
export function currentDoubleAsked(state: GameState): string | undefined {
  const pd = state.pendingDouble;
  if (!pd) return undefined;
  return pd.askQueue[pd.askIndex];
}

/**
 * 推进询问指针，跳过没有合法候选牌的玩家。
 * @param step 是否先把指针前进一位（拒绝后调用时为 true）
 */
export function advanceDoubleAsk(state: GameState, step: boolean): void {
  const pd = state.pendingDouble;
  if (!pd) return;
  if (step) pd.askIndex += 1;

  while (pd.askIndex < pd.askQueue.length) {
    const pid = pd.askQueue[pd.askIndex];
    if (doubleCandidates(state, pid, pd.artistId).length > 0) {
      state.phase = pd.askIndex === 0 ? 'AUCTION_DOUBLE_WAIT' : 'AUCTION_DOUBLE_SELECT';
      return;
    }
    pd.askIndex += 1;
  }

  // 没有人能够（或愿意）追加 → 拍卖师免费获得
  noOneAddedSecond(state);
}

function noOneAddedSecond(state: GameState): void {
  const pd = state.pendingDouble;
  if (!pd) return;
  const auctioneerId = pd.askQueue[0];
  const auction: AuctionState = {
    id: `double-solo-${pd.firstArtworkId}`,
    type: 'DOUBLE',
    auctioneerId,
    artworkIds: [pd.firstArtworkId],
    bids: {},
    currentHighestBid: 0,
    turnQueue: [],
    turnIndex: 0,
    submitted: [],
    revealed: false,
    status: 'running',
  };
  state.currentAuction = auction;
  state.pendingDouble = undefined;
  pushLog(state, 'double', '无人追加第二幅作品');
  finishAuction(state, undefined, 0, false);
}

/** 某位玩家追加了第二幅作品 */
export function applyDoubleAdd(state: GameState, playerId: string, artworkId: string): void {
  const pd = state.pendingDouble;
  if (!pd) return;

  const auctioneerId = pd.askQueue[0];
  const firstId = pd.firstArtworkId;
  const player = getPlayer(state, playerId);
  const second = getArtwork(state, artworkId);

  player.hand = player.hand.filter((id) => id !== artworkId);
  const isCo = playerId !== auctioneerId;

  pushLog(
    state,
    'double',
    `${player.name} 追加《${second.name}》${isCo ? '，成为共同拍卖师' : ''}`,
    { playerId, artistId: second.artistId },
  );

  const count = registerPlayedCard(state, artworkId, playerId);
  state.pendingDouble = undefined;

  if (isFifthCard(count)) {
    // 第二幅正好是该艺术家的第 5 幅 → 两幅作品都不能被获得
    markFifthCardEnd(state, second.artistId);
    const auction: AuctionState = {
      id: `double-void-${firstId}`,
      type: second.auctionType,
      auctioneerId,
      coAuctioneerId: isCo ? playerId : undefined,
      artworkIds: [firstId, artworkId],
      bids: {},
      currentHighestBid: 0,
      turnQueue: [],
      turnIndex: 0,
      submitted: [],
      revealed: false,
      status: 'running',
    };
    state.currentAuction = auction;
    pushLog(state, 'round', '两幅作品均不进行拍卖，直接进入市场结算');
    finishAuction(state, undefined, 0, true);
    return;
  }

  beginAuction(state, second.auctionType, auctioneerId, [firstId, artworkId], isCo ? playerId : undefined);
}

/** 某位玩家拒绝追加 */
export function applyDoubleDecline(state: GameState, playerId: string): void {
  const pd = state.pendingDouble;
  if (!pd) return;
  pushLog(state, 'double', `${getPlayer(state, playerId).name} 不追加`, { playerId });
  advanceDoubleAsk(state, true);
}
