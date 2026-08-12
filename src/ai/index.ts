import type { GameAction } from '@/types/actions';
import type { ArtistId, AuctionState, GameState, Player } from '@/types/game';
import { currentAsker } from '@/engine/auction/core';
import { currentDoubleAsked } from '@/engine/auction/double';
import { doubleCandidates } from '@/engine/helpers';
import { activeAuctionType } from '@/engine/validate';
import { profileOf, type AiProfile } from './profiles';
import {
  ROUND_END_COUNT,
  forecastArtist,
  holdingOf,
  jitter,
  outlookIfRoundEnds,
  planBid,
  rand01,
} from './valuation';

export { AI_PROFILES, profileOf } from './profiles';
export type { AiProfile } from './profiles';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function countsPlus(state: GameState, artistId: ArtistId): Record<ArtistId, number> {
  const c = { ...state.roundArtworkCounts };
  c[artistId] += 1;
  return c;
}

/* ------------------------------------------------------------------ */
/* 出牌                                                                 */
/* ------------------------------------------------------------------ */

function typeBonus(state: GameState, player: Player, artworkId: string): number {
  const art = state.artworks[artworkId];
  switch (art.auctionType) {
    case 'FIXED':
      return 0.16; // 自己定价，主动权最大
    case 'HIDDEN':
      return 0.07;
    case 'ONE_OFFER':
      return 0.05;
    case 'DOUBLE':
      // 自己手里还有同一位艺术家的牌 → 可以自行追加，独吞两幅的货款
      return doubleCandidates(state, player.id, art.artistId).length > 0 ? 0.3 : 0.06;
    default:
      return 0;
  }
}

function scoreCard(state: GameState, player: Player, profile: AiProfile, artworkId: string): number {
  const art = state.artworks[artworkId];
  const artistId = art.artistId;
  const nextCount = state.roundArtworkCounts[artistId] + 1;

  // 打出去就会触发本轮结束：只在自己领先时才划算
  if (nextCount >= ROUND_END_COUNT) {
    const o = outlookIfRoundEnds(state, player.id, artistId);
    const base = o.edge * 1.15 + (o.mine > 0 ? 8 : -10);
    return base * jitter(state, player.id, `end-${artworkId}`, profile.noise * 0.4);
  }

  const f = forecastArtist(state, artistId, profile, countsPlus(state, artistId));
  const perCard = f.expectedPayout;
  const hold = holdingOf(state, player.id, artistId);

  let score = perCard * 0.75; // 作为拍卖师能收到的货款
  score += perCard * Math.min(0.6, hold * 0.18); // 拉抬自己重仓的艺术家
  score += perCard * typeBonus(state, player, artworkId);

  return score * jitter(state, player.id, `play-${artworkId}`, profile.noise * 0.6);
}

function chooseCard(state: GameState, player: Player, profile: AiProfile): string {
  let best = player.hand[0];
  let bestScore = -Infinity;
  for (const id of player.hand) {
    const s = scoreCard(state, player, profile, id);
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 各类拍卖的出价                                                        */
/* ------------------------------------------------------------------ */

function openAction(
  state: GameState,
  auction: AuctionState,
  player: Player,
  profile: AiProfile,
): GameAction | undefined {
  if (auction.bids[player.id] === null) return undefined; // 已放弃
  if (auction.highestBidder === player.id) return undefined; // 已经领先，静观其变

  const { value, maxBid } = planBid(state, auction, player.id, profile);
  const cur = auction.currentHighestBid;
  const step = Math.max(1, Math.round(value * 0.05));

  let amount = Math.min(cur + step, maxBid);
  if (amount <= cur) {
    const impulsive = rand01(state, player.id, `open-${auction.id}-${cur}`) < profile.blunder;
    if (impulsive && cur + 1 <= player.cash) amount = cur + 1;
    else return { type: 'PASS_BID', playerId: player.id };
  }
  if (amount > player.cash) return { type: 'PASS_BID', playerId: player.id };
  return { type: 'PLACE_BID', playerId: player.id, amount };
}

function oneOfferAction(
  state: GameState,
  auction: AuctionState,
  player: Player,
  profile: AiProfile,
): GameAction | undefined {
  if (currentAsker(auction) !== player.id) return undefined;

  const { maxBid } = planBid(state, auction, player.id, profile);
  const cur = auction.currentHighestBid;
  const ceiling = Math.min(maxBid, player.cash);
  if (ceiling <= cur) return { type: 'PASS_BID', playerId: player.id };

  // 后面还有几个人要报价：人越多，越要一次报到位
  const remaining = auction.turnQueue.length - auction.turnIndex - 1;
  const ratio = remaining === 0 ? 0 : Math.min(0.95, 0.58 + 0.12 * remaining);
  const raw = remaining === 0 ? cur + 1 : Math.round(ceiling * ratio);
  const amount = clamp(raw, cur + 1, ceiling);
  if (amount <= cur) return { type: 'PASS_BID', playerId: player.id };
  return { type: 'PLACE_BID', playerId: player.id, amount };
}

function hiddenAction(
  state: GameState,
  auction: AuctionState,
  player: Player,
  profile: AiProfile,
): GameAction | undefined {
  if (auction.submitted.includes(player.id)) return undefined;

  const { maxBid } = planBid(state, auction, player.id, profile);
  const tail = Math.floor(rand01(state, player.id, `hidden-${auction.id}`) * 3);
  let amount = Math.round(maxBid * profile.hiddenFactor) + tail;
  amount = clamp(amount, 0, Math.min(player.cash, maxBid + 2));
  if (amount < 1) amount = 0;
  return { type: 'SUBMIT_HIDDEN_BID', playerId: player.id, amount };
}

function fixedAction(
  state: GameState,
  auction: AuctionState,
  player: Player,
  profile: AiProfile,
): GameAction | undefined {
  if (auction.fixedPrice === undefined) {
    if (auction.auctioneerId !== player.id) return undefined;

    const artistId = state.artworks[auction.artworkIds[0]].artistId;
    const f = forecastArtist(state, artistId, profile);
    const value = f.expectedPayout * auction.artworkIds.length;
    const raw = Math.round(
      value * profile.fixedFactor * jitter(state, player.id, `fixed-${auction.id}`, profile.noise),
    );
    const minPrice = player.cash > 0 ? 1 : 0;
    const price = clamp(raw, minPrice, player.cash);
    return { type: 'SET_FIXED_PRICE', playerId: player.id, price };
  }

  if (currentAsker(auction) !== player.id) return undefined;

  const { maxBid } = planBid(state, auction, player.id, profile);
  const price = auction.fixedPrice;
  if (price <= maxBid && price <= player.cash) return { type: 'BUY_FIXED', playerId: player.id };
  return { type: 'PASS_BID', playerId: player.id };
}

/* ------------------------------------------------------------------ */
/* 联合拍卖：要不要追加第二幅                                            */
/* ------------------------------------------------------------------ */

const ADD_PREF_AUCTIONEER = ['FIXED', 'HIDDEN', 'ONE_OFFER', 'OPEN'];
const ADD_PREF_CO = ['OPEN', 'ONE_OFFER', 'HIDDEN', 'FIXED'];

function pickSecondCard(state: GameState, candidates: string[], isAuctioneer: boolean): string {
  const pref = isAuctioneer ? ADD_PREF_AUCTIONEER : ADD_PREF_CO;
  return [...candidates].sort((a, b) => {
    const ia = pref.indexOf(state.artworks[a].auctionType);
    const ib = pref.indexOf(state.artworks[b].auctionType);
    if (ia !== ib) return ia - ib;
    return a < b ? -1 : 1;
  })[0];
}

function doubleAction(state: GameState, player: Player, profile: AiProfile): GameAction | undefined {
  const pd = state.pendingDouble;
  if (!pd || currentDoubleAsked(state) !== player.id) return undefined;

  const candidates = doubleCandidates(state, player.id, pd.artistId);
  if (candidates.length === 0) return { type: 'DOUBLE_DECLINE', playerId: player.id };

  const isAuctioneer = pd.askQueue[0] === player.id;
  const nextCount = state.roundArtworkCounts[pd.artistId] + 1;

  // 追加会让两幅作品一起作废并立刻结算 —— 只有当前局面对自己有利时才干
  if (nextCount >= ROUND_END_COUNT) {
    const o = outlookIfRoundEnds(state, player.id, pd.artistId);
    if (o.edge <= 0) return { type: 'DOUBLE_DECLINE', playerId: player.id };
    return {
      type: 'DOUBLE_ADD',
      playerId: player.id,
      artworkId: pickSecondCard(state, candidates, isAuctioneer),
    };
  }

  const f = forecastArtist(state, pd.artistId, profile, countsPlus(state, pd.artistId));
  const hold = holdingOf(state, player.id, pd.artistId);
  const appetite =
    (f.expectedPayout * (isAuctioneer ? 1.4 : 1.05) + hold * 6) *
    jitter(state, player.id, `double-${pd.firstArtworkId}`, profile.noise);

  if (appetite < profile.doubleThreshold) return { type: 'DOUBLE_DECLINE', playerId: player.id };
  return {
    type: 'DOUBLE_ADD',
    playerId: player.id,
    artworkId: pickSecondCard(state, candidates, isAuctioneer),
  };
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 给出某个 AI 玩家此刻应该执行的动作。
 * 返回 undefined 表示「现在没他的事」。
 *
 * 纯函数：不改状态、不碰计时器、不依赖 React。
 */
export function decide(state: GameState, playerId: string): GameAction | undefined {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.type !== 'AI') return undefined;
  const profile = profileOf(player.aiLevel);

  if (state.phase === 'PLAYER_TURN') {
    if (state.players[state.currentPlayerIndex]?.id !== playerId) return undefined;
    if (player.hand.length === 0) return undefined;
    return { type: 'PLAY_ARTWORK', playerId, artworkId: chooseCard(state, player, profile) };
  }

  if (state.phase === 'AUCTION_DOUBLE_WAIT' || state.phase === 'AUCTION_DOUBLE_SELECT') {
    return doubleAction(state, player, profile);
  }

  const auction = state.currentAuction;
  const type = activeAuctionType(state);
  if (!auction || !type) return undefined;

  switch (type) {
    case 'OPEN':
      return openAction(state, auction, player, profile);
    case 'ONE_OFFER':
      return oneOfferAction(state, auction, player, profile);
    case 'HIDDEN':
      return hiddenAction(state, auction, player, profile);
    case 'FIXED':
      return fixedAction(state, auction, player, profile);
    default:
      return undefined;
  }
}

/** AI 的轮询顺序：公开竞价从拍卖师左手开始，其余按座位 */
function pollOrder(state: GameState): Player[] {
  const n = state.players.length;
  const anchor = state.currentAuction?.auctioneerId;
  const start = anchor ? (state.players.find((p) => p.id === anchor)?.seatIndex ?? 0) + 1 : 0;
  const out: Player[] = [];
  for (let k = 0; k < n; k++) out.push(state.players[(start + k) % n]);
  return out;
}

/** 找出此刻第一个有事可做的 AI */
export function nextAiAction(state: GameState): { playerId: string; action: GameAction } | undefined {
  for (const p of pollOrder(state)) {
    if (p.type !== 'AI') continue;
    const action = decide(state, p.id);
    if (action) return { playerId: p.id, action };
  }
  return undefined;
}

/** AI「思考」时长，纯粹是让节奏更像真人 */
export function thinkDelay(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  const [lo, hi] = profileOf(player?.aiLevel).thinkMs;
  return Math.round(lo + rand01(state, playerId, 'think') * (hi - lo));
}
