import { describe, expect, it } from 'vitest';
import { actingPlayerId, reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario } from './helpers';

describe('一轮报价 One Offer', () => {
  it('2. 正常成交：从拍卖师左手起顺时针，拍卖师最后决定', () => {
    const s0 = scenario(4);
    const card = pick(s0, 'A', 'ONE_OFFER');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(s.phase).toBe('AUCTION_ONE_OFFER');
    expect(s.currentAuction?.turnQueue).toEqual(['p1', 'p2', 'p3', 'p0']);
    expect(actingPlayerId(s)).toBe('p1');

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 15 });
    expect(actingPlayerId(s)).toBe('p2');
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p3', amount: 22 });
    expect(s.phase).toBe('AUCTION_ONE_OFFER');

    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.winnerId).toBe('p3');
    expect(s.lastOutcome?.price).toBe(22);
    expect(cashOf(s, 3)).toBe(78);
    expect(cashOf(s, 0)).toBe(122);
  });

  it('报价必须高于当前最高价，且不能插队', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'B', 'ONE_OFFER');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });

    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p0', amount: 30 }).ok).toBe(false); // 没轮到
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p2', amount: 20 }).ok).toBe(false); // 不够高
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p2', amount: 21 }).ok).toBe(true);
  });

  it('全员 PASS → 拍卖师免费获得', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'C', 'ONE_OFFER');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.lastOutcome?.free).toBe(true);
    expect(s.players[0].purchased).toContain(card);
    expect(cashOf(s, 0)).toBe(100);
  });

  it('拍卖师最后自己截胡 → 款项进银行', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'ONE_OFFER');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p0', amount: 21 });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(79);
    expect(s.bank).toBe(21);
  });
});
