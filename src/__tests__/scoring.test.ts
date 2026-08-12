import { describe, expect, it } from 'vitest';
import type { ArtistId, ArtistRoundResult, GameState, RoundNumber } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { RANK_VALUES, calculateArtistRanking, sellRoundArtworks } from '@/engine/scoring';
import { pick, scenario, setRoundCount } from './helpers';

function setCounts(s: GameState, counts: Partial<Record<ArtistId, number>>): void {
  ARTIST_ORDER.forEach((a) => setRoundCount(s, a, counts[a] ?? 0));
}

function byId(results: ArtistRoundResult[], id: ArtistId): ArtistRoundResult {
  const r = results.find((x) => x.artistId === id);
  if (!r) throw new Error(`结果里没有艺术家 ${id}`);
  return r;
}

describe('市场结算 Scoring', () => {
  it('9. 艺术家排名按本轮张数降序，前三名分别 +30 / +20 / +10', () => {
    const s = scenario(3);
    setCounts(s, { A: 1, B: 3, C: 2, D: 0, E: 4 });

    const r = calculateArtistRanking(s);

    expect(RANK_VALUES).toEqual([30, 20, 10]);
    expect(r.map((x) => x.artistId)).toEqual(['E', 'B', 'C', 'A', 'D']);

    expect(byId(r, 'E')).toMatchObject({ rank: 1, count: 4, gained: 30, payout: 30 });
    expect(byId(r, 'B')).toMatchObject({ rank: 2, count: 3, gained: 20, payout: 20 });
    expect(byId(r, 'C')).toMatchObject({ rank: 3, count: 2, gained: 10, payout: 10 });
    expect(byId(r, 'A')).toMatchObject({ rank: 4, count: 1, gained: 0, payout: 0 });
    expect(byId(r, 'D')).toMatchObject({ rank: 5, count: 0, gained: 0, payout: 0 });
  });

  it('10. 张数相同时按固定顺序 A > B > C > D > E 决胜', () => {
    const s = scenario(3);
    setCounts(s, { A: 2, B: 2, C: 2, D: 2, E: 0 });

    const r = calculateArtistRanking(s);

    expect(r.map((x) => x.artistId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(byId(r, 'A').gained).toBe(30);
    expect(byId(r, 'B').gained).toBe(20);
    expect(byId(r, 'C').gained).toBe(10);
    expect(byId(r, 'D').gained).toBe(0);
    expect(byId(r, 'E').gained).toBe(0);
  });

  it('11. 价值逐轮累计：再次进入前三时按「累计价值」结算', () => {
    const s = scenario(3);

    setCounts(s, { E: 4, B: 3, C: 2, A: 1 });
    const r1 = calculateArtistRanking(s);
    expect(byId(r1, 'E')).toMatchObject({ gained: 30, cumulative: 30, payout: 30 });

    // 进入第 2 轮
    s.currentRound = 2 as RoundNumber;
    setCounts(s, { E: 2, A: 1 });
    const r2 = calculateArtistRanking(s);

    expect(byId(r2, 'E')).toMatchObject({ gained: 30, cumulative: 60, payout: 60 });
    expect(byId(r2, 'A')).toMatchObject({ gained: 20, cumulative: 20, payout: 20 });
    expect(s.artists.E.valueHistory).toEqual([30, 30, 0, 0]);
    expect(s.artists.E.cumulativeValue).toBe(60);

    // 本轮 0 幅的艺术家：不进前三、本轮结算价 0，但历史累计不会被清空
    expect(byId(r2, 'B')).toMatchObject({ count: 0, gained: 0, payout: 0, cumulative: 20 });
    expect(s.artists.B.valueHistory).toEqual([20, 0, 0, 0]);
  });

  it('12. 本轮没有作品的艺术家价值为 0，且不会占用前三名额', () => {
    const s = scenario(3);
    setCounts(s, { A: 2, B: 1 });

    const r = calculateArtistRanking(s);

    expect(byId(r, 'A').gained).toBe(30);
    expect(byId(r, 'B').gained).toBe(20);
    // 只有两位艺术家有作品 → 第三名的 +10 不会发给 0 幅的艺术家
    expect(byId(r, 'C')).toMatchObject({ count: 0, gained: 0, payout: 0, cumulative: 0 });
    expect(byId(r, 'D').gained).toBe(0);
    expect(byId(r, 'E').gained).toBe(0);
    expect(r.filter((x) => x.gained > 0)).toHaveLength(2);
  });

  it('玩家把本轮买到的作品按结算价卖回银行，非前三的作品收入为 0', () => {
    const s = scenario(3);
    const e1 = pick(s, 'E', 'OPEN');
    const e2 = pick(s, 'E', 'HIDDEN');
    const a1 = pick(s, 'A', 'OPEN');
    const e3 = pick(s, 'E', 'FIXED');

    s.players[0].purchased = [e1, e2, a1];
    s.players[1].purchased = [e3];

    setCounts(s, { E: 3, B: 2, C: 1, D: 1, A: 0 });
    const artists = calculateArtistRanking(s);
    expect(byId(artists, 'E').payout).toBe(30);
    expect(byId(artists, 'A').payout).toBe(0);

    const incomes = sellRoundArtworks(s, artists);

    expect(s.players[0].cash).toBe(160); // 2 × 30 + 1 × 0
    expect(s.players[1].cash).toBe(130);
    expect(s.players[2].cash).toBe(100);

    const p0 = incomes.find((i) => i.playerId === 'p0');
    expect(p0?.total).toBe(60);
    expect(p0?.cashBefore).toBe(100);
    expect(p0?.cashAfter).toBe(160);
    expect(p0?.breakdown).toEqual([
      { artistId: 'A', count: 1, unit: 0, total: 0 },
      { artistId: 'E', count: 2, unit: 30, total: 60 },
    ]);

    // 卖掉的作品进入弃牌堆，手上不再持有
    expect(s.players.every((p) => p.purchased.length === 0)).toBe(true);
    expect(s.discardPile).toHaveLength(4);
  });
});
