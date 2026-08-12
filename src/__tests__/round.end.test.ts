import { describe, expect, it } from 'vitest';
import { reduce } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario, setRoundCount } from './helpers';

describe('回合结束边界 Round End', () => {
  it('7. 某艺术家第 5 幅作品登场 → 本轮立即结束，该作品不拍卖、不归属，但计入排名', () => {
    const s0 = scenario(3);
    setRoundCount(s0, 'A', 4);
    const fifth = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [fifth, pick(s0, 'B', 'OPEN')]);
    giveHand(s0, 1, [pick(s0, 'C', 'OPEN')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: fifth });

    // 不进入任何拍卖阶段，直接给出「作废」结果
    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.voided).toBe(true);
    expect(s.lastOutcome?.winnerId).toBeUndefined();
    expect(s.roundEndReason).toBe('fifth-card');
    expect(s.roundEndArtistId).toBe('A');

    // 作品进弃牌堆，没有人拿到，也没有资金流动
    expect(s.discardPile).toContain(fifth);
    expect(s.players.every((p) => p.purchased.length === 0)).toBe(true);
    expect(cashOf(s, 0)).toBe(100);
    expect(s.bank).toBe(0);

    // 但它计入本轮张数
    expect(s.roundArtworkCounts.A).toBe(5);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.phase).toBe('ROUND_SCORING');

    const artistA = s.roundResult?.artists.find((r) => r.artistId === 'A');
    expect(artistA?.count).toBe(5);
    expect(artistA?.rank).toBe(1);
    expect(artistA?.gained).toBe(30);
  });

  it('7b. 第 4 幅不会结束回合，拍卖照常进行', () => {
    const s0 = scenario(3);
    setRoundCount(s0, 'A', 3);
    const fourth = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [fourth]);
    giveHand(s0, 1, [pick(s0, 'B', 'OPEN')]);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: fourth });

    expect(s.phase).toBe('AUCTION_OPEN');
    expect(s.roundEndReason).toBeUndefined();
    expect(s.roundArtworkCounts.A).toBe(4);
  });

  it('8. 联合拍卖的第二幅正好是第 5 幅 → 两幅作品都不归属任何人', () => {
    const s0 = scenario(3);
    setRoundCount(s0, 'A', 3);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [second]);
    giveHand(s0, 2, [pick(s0, 'B', 'OPEN')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    expect(s.roundArtworkCounts.A).toBe(4);
    expect(s.phase).toBe('AUCTION_DOUBLE_SELECT');

    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: second });

    expect(s.roundArtworkCounts.A).toBe(5);
    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.voided).toBe(true);
    expect(s.lastOutcome?.artworkIds).toEqual([dbl, second]);
    expect(s.discardPile).toEqual(expect.arrayContaining([dbl, second]));
    expect(s.players.every((p) => p.purchased.length === 0)).toBe(true);
    expect(s.players.every((p) => p.cash === 100)).toBe(true);
    expect(s.bank).toBe(0);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.phase).toBe('ROUND_SCORING');
    expect(s.roundResult?.artists.find((r) => r.artistId === 'A')?.count).toBe(5);
  });

  it('8b. 联合拍卖的第一幅就是第 5 幅 → 立即结束，不询问追加', () => {
    const s0 = scenario(3);
    setRoundCount(s0, 'A', 4);
    const dbl = pick(s0, 'A', 'DOUBLE');
    giveHand(s0, 0, [dbl, pick(s0, 'A', 'OPEN')]);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });

    expect(s.pendingDouble).toBeUndefined();
    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.voided).toBe(true);
    expect(s.lastOutcome?.artworkIds).toEqual([dbl]);
    expect(s.roundEndReason).toBe('fifth-card');
  });

  it('全员手牌用尽 → 本轮结束（第 4 轮不补牌时避免死循环的关键）', () => {
    const s0 = scenario(3);
    const only = pick(s0, 'B', 'OPEN');
    giveHand(s0, 0, [only]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: only });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.free).toBe(true);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.roundEndReason).toBe('hands-empty');
    expect(s.phase).toBe('ROUND_SCORING');
  });

  it('手牌为空的玩家会被跳过，但仍然可以参与竞价', () => {
    const s0 = scenario(4);
    const first = pick(s0, 'B', 'OPEN');
    giveHand(s0, 0, [first]);
    giveHand(s0, 1, []); // p1 空手 → 出牌时被跳过
    giveHand(s0, 2, [pick(s0, 'C', 'OPEN')]);
    giveHand(s0, 3, [pick(s0, 'D', 'OPEN')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: first });
    // 空手的 p1 依然能出价并拍下
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 12 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p3' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.lastOutcome?.winnerId).toBe('p1');
    expect(cashOf(s, 1)).toBe(88);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.phase).toBe('PLAYER_TURN');
    expect(s.players[s.currentPlayerIndex].id).toBe('p2'); // 跳过空手的 p1
  });
});
