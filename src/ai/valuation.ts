import type { ArtistId, AuctionState, GameState } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { RANK_VALUES } from '@/engine/scoring';
import { nextRandom } from '@/engine/rng';
import type { AiProfile } from './profiles';

/** 触发轮次结束的张数 */
const ROUND_END_COUNT = 5;

/* ------------------------------------------------------------------ */
/* 确定性噪声：同一个局面 + 同一个玩家 + 同一个用途 => 同一个随机数        */
/* ------------------------------------------------------------------ */

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function rand01(state: GameState, playerId: string, tag: string): number {
  const key = `${state.settings.seed}:${state.currentRound}:${state.logCounter}:${playerId}:${tag}`;
  return nextRandom(hashString(key)).value;
}

/** 以 0 为中心的对称噪声，幅度为 amount */
function jitter(state: GameState, playerId: string, tag: string, amount: number): number {
  if (amount <= 0) return 1;
  return 1 + (rand01(state, playerId, tag) * 2 - 1) * amount;
}

/* ------------------------------------------------------------------ */
/* 艺术家估值                                                           */
/* ------------------------------------------------------------------ */

export interface ArtistForecast {
  artistId: ArtistId;
  count: number;
  /** 若本轮此刻结束，处在第几名（0 起） */
  rankIndex: number;
  /** 本轮进入前三的主观概率 */
  pTop3: number;
  /** 预期本轮结算价（已乘以概率） */
  expectedPayout: number;
}

/** 按「张数降序 + A>B>C>D>E」给艺术家排序，返回 artistId 顺序 */
export function rankOrder(counts: Record<ArtistId, number>): ArtistId[] {
  return [...ARTIST_ORDER].sort((a, b) => {
    if (counts[a] !== counts[b]) return counts[b] - counts[a];
    return ARTIST_ORDER.indexOf(a) - ARTIST_ORDER.indexOf(b);
  });
}

/** 本轮推进程度 0..1：最高张数越接近 5，结算越临近，预测越可信 */
function roundProgress(counts: Record<ArtistId, number>): number {
  const max = Math.max(...ARTIST_ORDER.map((a) => counts[a]));
  return Math.min(1, max / ROUND_END_COUNT);
}

/**
 * 预测某位艺术家本轮的结算价。
 *
 * 关键点：只有本轮进入前三的艺术家才会有结算价，否则一分钱都拿不到。
 * 因此估值 = P(进前三) × (历史累计价值 + 本轮预计新增)。
 */
export function forecastArtist(
  state: GameState,
  artistId: ArtistId,
  profile: AiProfile,
  countsOverride?: Record<ArtistId, number>,
): ArtistForecast {
  const counts = countsOverride ?? state.roundArtworkCounts;
  const artist = state.artists[artistId];
  const count = counts[artistId];

  if (!profile.forecast) {
    // 新手只会看「这位艺术家以前值多少钱」，对本轮排名几乎没有概念
    const naive = artist.cumulativeValue + (count > 0 ? 14 : 4);
    return { artistId, count, rankIndex: 99, pTop3: count > 0 ? 0.6 : 0.2, expectedPayout: naive * 0.7 };
  }

  const order = rankOrder(counts);
  const rankIndex = order.indexOf(artistId);
  const progress = roundProgress(counts);

  let pTop3: number;
  if (count === 0) {
    // 一幅都没出现，本轮基本无望；越接近结算越无望
    pTop3 = 0.16 * (1 - progress);
  } else if (rankIndex === 0) {
    pTop3 = 0.74 + 0.26 * progress;
  } else if (rankIndex === 1) {
    pTop3 = 0.66 + 0.32 * progress;
  } else if (rankIndex === 2) {
    pTop3 = 0.5 + 0.42 * progress;
  } else {
    const gap = counts[order[2]] - count; // 距离第三名还差几幅
    pTop3 = Math.max(0.05, 0.42 - gap * 0.13) * (1 - progress * 0.65);
  }
  pTop3 = Math.max(0, Math.min(1, pTop3));

  const gained = rankIndex < RANK_VALUES.length ? RANK_VALUES[rankIndex] : RANK_VALUES[2];
  const expectedPayout = pTop3 * (artist.cumulativeValue + gained);

  return { artistId, count, rankIndex, pTop3, expectedPayout };
}

/** 玩家在某位艺术家上的持仓（已买入 + 手牌） */
export function holdingOf(state: GameState, playerId: string, artistId: ArtistId): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  const owned = p.purchased.filter((id) => state.artworks[id].artistId === artistId).length;
  const inHand = p.hand.filter((id) => state.artworks[id].artistId === artistId).length;
  return owned + inHand * 0.5;
}

/* ------------------------------------------------------------------ */
/* 出价上限                                                             */
/* ------------------------------------------------------------------ */

/**
 * 拍卖师的出价上限必须打折。
 *
 * 拍卖师赢下自己的拍卖时，钱进银行；如果让别人赢，这笔钱会进自己口袋。
 * 所以「自己买」的机会成本是成交价的两倍 —— 理论上限只有价值的一半。
 * 共同拍卖师同理，但他只损失一半收入，上限约为价值的三分之二。
 */
export function roleFactor(auction: AuctionState, playerId: string): number {
  if (auction.coAuctioneerId) {
    if (playerId === auction.auctioneerId || playerId === auction.coAuctioneerId) return 0.66;
    return 1;
  }
  if (playerId === auction.auctioneerId) return 0.55;
  return 1;
}

export interface BidPlan {
  /** 这批作品对该玩家的理论价值 */
  value: number;
  /** 愿意付出的最高价（已考虑身份、现金与储备） */
  maxBid: number;
}

/** 计算某玩家对当前这场拍卖的出价上限 */
export function planBid(
  state: GameState,
  auction: AuctionState,
  playerId: string,
  profile: AiProfile,
): BidPlan {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { value: 0, maxBid: 0 };

  const artistId = state.artworks[auction.artworkIds[0]].artistId;
  const forecast = forecastArtist(state, artistId, profile, countsWithAuction(state, auction));

  const perCard = forecast.expectedPayout;
  const hold = holdingOf(state, playerId, artistId);
  // 已经押注在这位艺术家身上的人，会更希望把他的行情继续做上去
  const synergy = profile.forecast ? Math.min(0.22, hold * 0.055) : 0;

  let value = perCard * auction.artworkIds.length * (1 + synergy);
  value *= jitter(state, playerId, `bid-${auction.id}`, profile.noise);
  value *= roleFactor(auction, playerId);

  const reserve = Math.floor(player.cash * profile.reserve);
  const affordable = Math.max(0, player.cash - reserve);
  const maxBid = Math.max(0, Math.min(Math.floor(value * profile.aggression), affordable));

  return { value, maxBid };
}

/** 拍卖台上的作品已经计入本轮张数，估值时要用这份更新后的计数 */
function countsWithAuction(state: GameState, _auction: AuctionState): Record<ArtistId, number> {
  return state.roundArtworkCounts;
}

/* ------------------------------------------------------------------ */
/* 回合结束模拟：判断「现在结算对我是好是坏」                             */
/* ------------------------------------------------------------------ */

export interface EndRoundOutlook {
  /** 立刻结算时我的收入 */
  mine: number;
  /** 立刻结算时对手中的最高收入 */
  bestOpponent: number;
  /** 我相对最强对手的优势 */
  edge: number;
}

/**
 * 如果本轮此刻结束（可指定某位艺术家再 +1 幅），各家能卖多少钱。
 * 用来判断「要不要打出第 5 幅」以及「要不要追加会触发结束的第二幅」。
 */
export function outlookIfRoundEnds(
  state: GameState,
  playerId: string,
  extraArtist?: ArtistId,
): EndRoundOutlook {
  const counts = { ...state.roundArtworkCounts };
  if (extraArtist) counts[extraArtist] += 1;

  const order = rankOrder(counts);
  const payout: Record<ArtistId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  let slot = 0;
  for (const id of order) {
    if (counts[id] > 0 && slot < RANK_VALUES.length) {
      payout[id] = state.artists[id].cumulativeValue + RANK_VALUES[slot];
      slot += 1;
    }
  }

  let mine = 0;
  let bestOpponent = 0;
  for (const p of state.players) {
    const income = p.purchased.reduce((sum, id) => sum + payout[state.artworks[id].artistId], 0);
    if (p.id === playerId) mine = income;
    else bestOpponent = Math.max(bestOpponent, income);
  }

  return { mine, bestOpponent, edge: mine - bestOpponent };
}

export { ROUND_END_COUNT, jitter };
