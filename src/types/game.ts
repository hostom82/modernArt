import type { GamePhase } from './phase';

/** 五位艺术家的固定编号，同时也是平名次时的决胜顺序 A > B > C > D > E */
export type ArtistId = 'A' | 'B' | 'C' | 'D' | 'E';

export const ARTIST_ORDER: readonly ArtistId[] = ['A', 'B', 'C', 'D', 'E'];

/** 五种拍卖方式 */
export type AuctionType = 'OPEN' | 'ONE_OFFER' | 'HIDDEN' | 'FIXED' | 'DOUBLE';

export type PlayerType = 'HUMAN' | 'AI';

export type AiLevel = 'easy' | 'normal' | 'hard';

export type RoundNumber = 1 | 2 | 3 | 4;

export interface Artist {
  id: ArtistId;
  /** 展示用名字 */
  name: string;
  /** 英文别名，用于卡面排版 */
  latinName: string;
  /** 主色 */
  color: string;
  /** 程序化卡面的风格族 */
  styleFamily: 'hardEdge' | 'lineGrid' | 'organic' | 'collage' | 'pointillism';
  /** 一句话风格描述 */
  tagline: string;
  /** 该艺术家在整副牌中的总张数 */
  totalCards: number;
  /** 每轮该艺术家被打出的张数，索引 0..3 对应第 1..4 轮 */
  roundCounts: number[];
  /** 每轮排名获得的价值（30/20/10/0），索引 0..3 */
  valueHistory: number[];
  /** 历史累计价值 = valueHistory 之和 */
  cumulativeValue: number;
}

export interface Artwork {
  id: string;
  artistId: ArtistId;
  /** 作品名（原创） */
  name: string;
  /** 卡面生成种子 */
  seed: number;
  auctionType: AuctionType;
  /** 稀有度，仅作视觉点缀，不影响规则 */
  rarity: 'common' | 'uncommon' | 'rare';
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  aiLevel?: AiLevel;
  /** 现金，单位 k€，恒为整数 */
  cash: number;
  /**
   * 联机模式下，服务端投影会给「非本人」玩家打此标记（true），
   * 其 cash 同时被置 0，客户端应显示锁定占位而非真实资金。
   * 单机/结算/终局阶段此字段为 undefined，表示资金可见。
   */
  cashHidden?: boolean;
  /** 手牌（artworkId 列表） */
  hand: string[];
  /** 本轮已买到、尚未卖出的作品 */
  purchased: string[];
  seatIndex: number;
  /** 头像色 */
  avatarColor: string;
}

export type BidValue = number | null; // null 表示 PASS / 放弃

export interface AuctionState {
  id: string;
  /** 实际执行的拍卖方式。双重拍卖时为第二幅牌的类型；无人追加时为 'DOUBLE'（直接流拍） */
  type: AuctionType;
  /** 原始拍卖师（打出第一幅牌的人） */
  auctioneerId: string;
  /** 共同拍卖师（追加第二幅牌的人），仅双重拍卖 */
  coAuctioneerId?: string;
  /** 参与拍卖的作品，1 张或 2 张 */
  artworkIds: string[];
  /** 每位玩家的出价记录：数字 = 出价，null = 已放弃 */
  bids: Record<string, BidValue>;
  currentHighestBid: number;
  highestBidder?: string;
  /** 一轮报价 / 固定价格的询问队列 */
  turnQueue: string[];
  turnIndex: number;
  /** 固定价格的定价 */
  fixedPrice?: number;
  /** 暗标：已提交的玩家 id */
  submitted: string[];
  /** 暗标揭示后是否已公开 */
  revealed: boolean;
  status: 'running' | 'resolved';
}

export interface AuctionOutcome {
  auctionId: string;
  artworkIds: string[];
  auctioneerId: string;
  coAuctioneerId?: string;
  type: AuctionType;
  winnerId?: string;
  price: number;
  /** true 表示无人出价，拍卖师免费获得 */
  free: boolean;
  /** true 表示因第 5 幅作品触发轮次结束，两幅作品都不归属任何人 */
  voided: boolean;
  /** 资金流向明细，用于日志与动画 */
  transfers: { from?: string; to?: string; amount: number; toBank?: boolean }[];
}

export interface LogEntry {
  id: number;
  round: number;
  kind:
    | 'system'
    | 'play'
    | 'bid'
    | 'pass'
    | 'result'
    | 'money'
    | 'scoring'
    | 'round'
    | 'double';
  text: string;
  playerId?: string;
  artistId?: ArtistId;
}

export interface ArtistRoundResult {
  artistId: ArtistId;
  count: number;
  rank: number;
  /** 本轮排名带来的新增价值 30/20/10/0 */
  gained: number;
  /** 本轮结算价（进前三 = 累计价值，否则 0） */
  payout: number;
  cumulative: number;
}

export interface PlayerRoundIncome {
  playerId: string;
  /** 按艺术家拆分的收入明细 */
  breakdown: { artistId: ArtistId; count: number; unit: number; total: number }[];
  total: number;
  cashBefore: number;
  cashAfter: number;
}

export interface RoundResult {
  round: number;
  artists: ArtistRoundResult[];
  incomes: PlayerRoundIncome[];
  sold: boolean;
}

/** 双重拍卖的追加询问中间状态 */
export interface PendingDouble {
  firstArtworkId: string;
  artistId: ArtistId;
  /** 询问顺序：[拍卖师, 拍卖师左手, ...] */
  askQueue: string[];
  askIndex: number;
}

export interface GameSettings {
  playerCount: number;
  humanCount: number;
  aiLevel: AiLevel;
  seed: number;
  /** 开放拍卖倒计时秒数（UI 用） */
  openAuctionSeconds: number;
}

export interface GameState {
  settings: GameSettings;
  players: Player[];
  artists: Record<ArtistId, Artist>;
  artworks: Record<string, Artwork>;
  deck: string[];
  discardPile: string[];
  bank: number;

  currentRound: RoundNumber;
  /** 当前该出牌的玩家座位下标 */
  currentPlayerIndex: number;
  /** 本轮起始玩家座位下标 */
  startingPlayerIndex: number;
  lastAuctioneerId?: string;
  lastPlayedPlayerId?: string;

  currentAuction?: AuctionState;
  pendingDouble?: PendingDouble;
  lastOutcome?: AuctionOutcome;

  /** 本轮各艺术家已打出的张数 */
  roundArtworkCounts: Record<ArtistId, number>;
  /** 本轮结束的原因 */
  roundEndReason?: 'fifth-card' | 'hands-empty';
  /** 触发本轮结束的艺术家 */
  roundEndArtistId?: ArtistId;

  roundResult?: RoundResult;
  /** 每轮结束时的现金快照，[0] 为初始 100，之后每轮一份 */
  cashSnapshots: number[][];
  /** 历史轮次结算记录 */
  roundHistory: RoundResult[];

  log: LogEntry[];
  logCounter: number;
  phase: GamePhase;
  rngState: number;
  winnerId?: string;
  /** 最终排名（玩家 id，由高到低） */
  finalRanking?: string[];
}
