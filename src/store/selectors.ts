import type { ArtistId, GameState, Player } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { RANK_VALUES } from '@/engine/scoring';
import { currentAsker } from '@/engine/auction/core';
import { currentDoubleAsked } from '@/engine/auction/double';
import { activeAuctionType } from '@/engine/validate';
import { currentHiddenHuman } from './gameStore';

/**
 * UI 侧的只读查询。
 * 这里只做「谁该操作、界面该显示什么」的推导，不含任何规则判定——
 * 规则判定一律交给 engine/validate。
 */

export function playerById(game: GameState, id?: string): Player | undefined {
  if (!id) return undefined;
  return game.players.find((p) => p.id === id);
}

/**
 * 当前需要真人操作的玩家；返回 undefined 表示此刻在等 AI 或在播动画。
 * mySeat 提供时（联机 / 多真人对局中本机玩家），只认本地这位玩家：
 * 不到他回合就返回 undefined，UI 因此不会把别人的操作控件暴露给本机。
 */
export function actingHuman(game: GameState, mySeat?: number): Player | undefined {
  const asHuman = (id?: string): Player | undefined => {
    const p = playerById(game, id);
    return p && p.type === 'HUMAN' ? p : undefined;
  };

  let candidate: Player | undefined;
  switch (game.phase) {
    case 'PLAYER_TURN':
      candidate = asHuman(game.players[game.currentPlayerIndex]?.id);
      break;

    case 'AUCTION_DOUBLE_WAIT':
    case 'AUCTION_DOUBLE_SELECT':
      candidate = asHuman(currentDoubleAsked(game));
      break;

    case 'AUCTION_HIDDEN':
      candidate = currentHiddenHuman(game, mySeat);
      break;

    case 'AUCTION_ONE_OFFER':
      candidate = asHuman(game.currentAuction ? currentAsker(game.currentAuction) : undefined);
      break;

    case 'AUCTION_FIXED':
    case 'AUCTION_DOUBLE_RUNNING': {
      const a = game.currentAuction;
      if (!a) return undefined;
      const type = activeAuctionType(game);
      if (type === 'HIDDEN') candidate = currentHiddenHuman(game, mySeat);
      else if (type === 'ONE_OFFER') candidate = asHuman(currentAsker(a));
      else if (type === 'FIXED') {
        candidate = a.fixedPrice === undefined ? asHuman(a.auctioneerId) : asHuman(currentAsker(a));
      }
      break;
    }

    default:
      candidate = undefined;
  }

  if (!candidate) return undefined;
  if (mySeat === undefined) return candidate;
  const me = game.players.find((p) => p.seatIndex === mySeat);
  return me && me.id === candidate.id ? candidate : undefined;
}

/** 某个玩家是否「本机正在操作的玩家」：联机时严格按座位，单机同屏时按是否真人 */
export function isLocalActor(game: GameState, mySeat: number | undefined, playerId: string): boolean {
  const p = playerById(game, playerId);
  if (!p) return false;
  if (mySeat === undefined) return p.type === 'HUMAN';
  return p.seatIndex === mySeat;
}

/** 公开竞价中还能出价的真人（没放弃、不是当前最高价持有者） */
export function eligibleOpenHumans(game: GameState, mySeat?: number): Player[] {
  const a = game.currentAuction;
  if (!a || activeAuctionType(game) !== 'OPEN') return [];
  return game.players.filter(
    (p) =>
      p.type === 'HUMAN' &&
      (mySeat === undefined || p.seatIndex === mySeat) &&
      a.bids[p.id] !== null &&
      a.highestBidder !== p.id,
  );
}

/** 手牌该显示给谁看：联机时固定显示本机玩家，否则优先当前操作者 / 唯一真人 */
export function handOwner(game: GameState, mySeat?: number): Player | undefined {
  if (mySeat !== undefined) return game.players.find((p) => p.seatIndex === mySeat);
  const acting = actingHuman(game);
  if (acting) return acting;
  const humans = game.players.filter((p) => p.type === 'HUMAN');
  return humans.length === 1 ? humans[0] : undefined;
}

export interface ArtistMarketRow {
  artistId: ArtistId;
  name: string;
  color: string;
  /** 本轮已打出张数 */
  count: number;
  /** 已确定的历史累计价值 */
  cumulative: number;
  /** 若本轮此刻结算，能拿到的名次（1-5），0 表示无缘前三 */
  projectedRank: number;
  /** 若本轮此刻结算，新增的加成 */
  projectedGain: number;
  /** 若本轮此刻结算，每幅的售价 */
  projectedPayout: number;
  /** 距离触发轮次结束还差几张 */
  toFifth: number;
}

/**
 * 市场行情预测：如果本轮此刻就结算，各艺术家会是什么名次、卖多少钱。
 * 与 engine/scoring 的排序逻辑保持一致（张数降序，平手按 A>B>C>D>E）。
 */
export function artistMarket(game: GameState): ArtistMarketRow[] {
  const sorted = [...ARTIST_ORDER].sort((a, b) => {
    const ca = game.roundArtworkCounts[a];
    const cb = game.roundArtworkCounts[b];
    if (ca !== cb) return cb - ca;
    return ARTIST_ORDER.indexOf(a) - ARTIST_ORDER.indexOf(b);
  });

  let slots = 0;
  const rankOf: Record<string, { rank: number; gain: number }> = {};
  sorted.forEach((id, i) => {
    const count = game.roundArtworkCounts[id];
    let gain = 0;
    if (count > 0 && slots < RANK_VALUES.length) {
      gain = RANK_VALUES[slots];
      slots += 1;
    }
    rankOf[id] = { rank: i + 1, gain };
  });

  return sorted.map((id) => {
    const artist = game.artists[id];
    const { rank, gain } = rankOf[id];
    return {
      artistId: id,
      name: artist.name,
      color: artist.color,
      count: game.roundArtworkCounts[id],
      cumulative: artist.cumulativeValue,
      projectedRank: gain > 0 ? rank : 0,
      projectedGain: gain,
      projectedPayout: gain > 0 ? artist.cumulativeValue + gain : 0,
      toFifth: Math.max(0, 5 - game.roundArtworkCounts[id]),
    };
  });
}

/** 某玩家本轮收藏按艺术家分组 */
export function purchasedByArtist(game: GameState, player: Player): { artistId: ArtistId; ids: string[] }[] {
  const map = new Map<ArtistId, string[]>();
  for (const id of player.purchased) {
    const art = game.artworks[id];
    const list = map.get(art.artistId) ?? [];
    list.push(id);
    map.set(art.artistId, list);
  }
  return ARTIST_ORDER.filter((a) => map.has(a)).map((a) => ({ artistId: a, ids: map.get(a)! }));
}

/** 玩家本轮收藏若此刻结算的估值 */
export function estimatedHoldingsValue(game: GameState, player: Player): number {
  const market = artistMarket(game);
  const payout: Record<string, number> = {};
  market.forEach((m) => {
    payout[m.artistId] = m.projectedPayout;
  });
  return player.purchased.reduce((sum, id) => sum + (payout[game.artworks[id].artistId] ?? 0), 0);
}

/** 阶段的中文短标签，显示在顶栏 */
export function phaseLabel(game: GameState): string {
  switch (game.phase) {
    case 'PLAYER_TURN': {
      const p = game.players[game.currentPlayerIndex];
      return p ? `${p.name} 出牌` : '等待出牌';
    }
    case 'AUCTION_OPEN':
      return '公开竞价进行中';
    case 'AUCTION_ONE_OFFER':
      return '一轮报价进行中';
    case 'AUCTION_HIDDEN':
      return '暗标提交中';
    case 'AUCTION_FIXED':
      return '定价拍卖进行中';
    case 'AUCTION_DOUBLE_WAIT':
    case 'AUCTION_DOUBLE_SELECT':
      return '等待追加第二幅';
    case 'AUCTION_DOUBLE_RUNNING':
      return '联合拍卖进行中';
    case 'AUCTION_RESULT':
      return '落槌';
    case 'ROUND_SCORING':
      return '市场结算';
    case 'SELL_ARTWORK':
      return '售出作品';
    case 'GAME_END':
      return '牌局结束';
    default:
      return '准备中';
  }
}
