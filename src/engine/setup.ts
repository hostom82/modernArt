import type { AiLevel, GameState, Player, RoundNumber } from '@/types/game';
import { createArtists } from '@/data/artists';
import { createArtworks } from '@/data/artworks';
import { shuffle } from './rng';
import { emptyRoundCounts } from './helpers';
import { pushLog } from './log';

export const INITIAL_CASH = 100;

/** 第 1 轮起手张数 */
const FIRST_DEAL: Record<number, number> = { 3: 10, 4: 9, 5: 8 };
/** 第 2、3 轮补牌张数 */
const REFILL: Record<number, number> = { 3: 6, 4: 4, 5: 3 };

export function dealCountFor(playerCount: number, round: RoundNumber): number {
  if (round === 1) return FIRST_DEAL[playerCount] ?? 0;
  if (round === 2 || round === 3) return REFILL[playerCount] ?? 0;
  return 0; // 第 4 轮不补牌
}

const AVATAR_COLORS = ['#C9A227', '#3B82C4', '#E07B39', '#16A0A0', '#B0457A'];
const DEFAULT_NAMES = ['玩家一', '玩家二', '玩家三', '玩家四', '玩家五'];
const AI_NAMES = ['策展人 K', '收藏家 V', '经纪人 R', '评论家 S', '掮客 M'];

export interface StartGameOptions {
  playerCount: number;
  humanCount: number;
  aiLevel: AiLevel;
  seed?: number;
  names?: string[];
  openAuctionSeconds?: number;
}

export function createInitialState(opts: StartGameOptions): GameState {
  const playerCount = Math.max(3, Math.min(5, Math.round(opts.playerCount)));
  const humanCount = Math.max(0, Math.min(playerCount, Math.round(opts.humanCount)));
  const seed = opts.seed ?? 1;

  const players: Player[] = [];
  let aiIdx = 0;
  for (let i = 0; i < playerCount; i++) {
    const isHuman = i < humanCount;
    const fallback = isHuman ? DEFAULT_NAMES[i] : AI_NAMES[aiIdx];
    if (!isHuman) aiIdx += 1;
    players.push({
      id: `p${i}`,
      name: opts.names?.[i]?.trim() || fallback,
      type: isHuman ? 'HUMAN' : 'AI',
      aiLevel: isHuman ? undefined : opts.aiLevel,
      cash: INITIAL_CASH,
      hand: [],
      purchased: [],
      seatIndex: i,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    });
  }

  const artworks = createArtworks();
  const deckIds = Object.keys(artworks);
  const shuffled = shuffle(deckIds, seed);

  const state: GameState = {
    settings: {
      playerCount,
      humanCount,
      aiLevel: opts.aiLevel,
      seed,
      openAuctionSeconds: opts.openAuctionSeconds ?? 8,
    },
    players,
    artists: createArtists(),
    artworks,
    deck: shuffled.items,
    discardPile: [],
    bank: 0,
    currentRound: 1,
    currentPlayerIndex: 0,
    startingPlayerIndex: 0,
    roundArtworkCounts: emptyRoundCounts(),
    cashSnapshots: [players.map((p) => p.cash)],
    roundHistory: [],
    log: [],
    logCounter: 0,
    phase: 'SETUP',
    rngState: shuffled.state,
  };

  pushLog(state, 'system', `牌局开始 · ${playerCount} 位经销商，每人 €${INITIAL_CASH}k 启动资金`);
  return state;
}

/** 给所有玩家补牌（就地修改） */
export function dealToPlayers(state: GameState, count: number): void {
  if (count <= 0) return;
  for (let k = 0; k < count; k++) {
    for (const p of state.players) {
      const card = state.deck.shift();
      if (!card) return;
      p.hand.push(card);
    }
  }
}

/** 按艺术家 + 拍卖类型排序手牌，方便玩家阅读 */
export function sortHand(state: GameState, player: Player): void {
  const orderType: Record<string, number> = { OPEN: 0, ONE_OFFER: 1, HIDDEN: 2, FIXED: 3, DOUBLE: 4 };
  player.hand.sort((a, b) => {
    const A = state.artworks[a];
    const B = state.artworks[b];
    if (A.artistId !== B.artistId) return A.artistId < B.artistId ? -1 : 1;
    const ta = orderType[A.auctionType] ?? 9;
    const tb = orderType[B.auctionType] ?? 9;
    if (ta !== tb) return ta - tb;
    return A.id < B.id ? -1 : 1;
  });
}
