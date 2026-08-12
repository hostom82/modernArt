import type {
  ArtistId,
  ArtistRoundResult,
  GameState,
  PlayerRoundIncome,
  RoundResult,
} from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { money, pushLog } from './log';

/** 前三名的价值加成 */
export const RANK_VALUES = [30, 20, 10];

/**
 * 计算本轮艺术家排名并把新增价值写入 valueHistory / cumulativeValue。
 *
 * 规则要点：
 *  - 按本轮张数降序；张数相同按固定顺序 A > B > C > D > E 决胜。
 *  - 只有本轮**至少卖出 1 幅**的艺术家才有资格进入前三并获得加成。
 *  - 进入前三的艺术家，本轮结算价 = 含本轮新增的累计价值；未进前三则为 0。
 */
export function calculateArtistRanking(state: GameState): ArtistRoundResult[] {
  const roundIdx = state.currentRound - 1;

  const sorted = [...ARTIST_ORDER].sort((a, b) => {
    const ca = state.roundArtworkCounts[a];
    const cb = state.roundArtworkCounts[b];
    if (ca !== cb) return cb - ca;
    return ARTIST_ORDER.indexOf(a) - ARTIST_ORDER.indexOf(b);
  });

  const results: ArtistRoundResult[] = [];
  let awardedSlots = 0;

  sorted.forEach((artistId, i) => {
    const artist = state.artists[artistId];
    const count = state.roundArtworkCounts[artistId];
    let gained = 0;
    if (count > 0 && awardedSlots < RANK_VALUES.length) {
      gained = RANK_VALUES[awardedSlots];
      awardedSlots += 1;
    }
    artist.valueHistory[roundIdx] = gained;
    artist.cumulativeValue = artist.valueHistory.reduce((s, v) => s + v, 0);

    results.push({
      artistId,
      count,
      rank: i + 1,
      gained,
      payout: gained > 0 ? artist.cumulativeValue : 0,
      cumulative: artist.cumulativeValue,
    });
  });

  pushLog(state, 'scoring', `第 ${state.currentRound} 轮市场结算`);
  results
    .filter((r) => r.gained > 0)
    .forEach((r) => {
      const artist = state.artists[r.artistId];
      pushLog(
        state,
        'scoring',
        `第 ${r.rank} 名 ${artist.name} 本轮 ${r.count} 幅 · +${r.gained}k → 结算价 ${money(r.payout)}`,
        { artistId: r.artistId },
      );
    });

  return results;
}

/** 玩家把本轮买到的作品按结算价卖回银行 */
export function sellRoundArtworks(state: GameState, artistResults: ArtistRoundResult[]): PlayerRoundIncome[] {
  const payoutOf: Record<ArtistId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  artistResults.forEach((r) => {
    payoutOf[r.artistId] = r.payout;
  });

  const incomes: PlayerRoundIncome[] = [];

  for (const player of state.players) {
    const counts: Record<string, number> = {};
    for (const id of player.purchased) {
      const art = state.artworks[id];
      counts[art.artistId] = (counts[art.artistId] ?? 0) + 1;
    }

    const breakdown = ARTIST_ORDER.filter((a) => (counts[a] ?? 0) > 0).map((a) => ({
      artistId: a,
      count: counts[a],
      unit: payoutOf[a],
      total: counts[a] * payoutOf[a],
    }));

    const total = breakdown.reduce((s, b) => s + b.total, 0);
    const cashBefore = player.cash;
    player.cash += total;

    incomes.push({
      playerId: player.id,
      breakdown,
      total,
      cashBefore,
      cashAfter: player.cash,
    });

    // 卖出的作品进入弃牌堆；手牌保留到下一轮
    player.purchased.forEach((id) => state.discardPile.push(id));
    player.purchased = [];

    if (total > 0) {
      pushLog(state, 'money', `${player.name} 售出作品收入 ${money(total)}，现金 ${money(player.cash)}`, {
        playerId: player.id,
      });
    }
  }

  return incomes;
}

export function buildRoundResult(
  state: GameState,
  artists: ArtistRoundResult[],
  incomes: PlayerRoundIncome[],
  sold: boolean,
): RoundResult {
  return { round: state.currentRound, artists, incomes, sold };
}
