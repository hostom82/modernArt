import { describe, expect, it } from 'vitest';
import { reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario, setCash } from './helpers';

describe('公开竞价 Open Auction', () => {
  it('1. 正常成交：最高出价者获得作品，款项付给拍卖师', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(s.phase).toBe('AUCTION_OPEN');

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p2', amount: 25 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    expect(s.phase).toBe('AUCTION_OPEN');

    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.winnerId).toBe('p2');
    expect(s.lastOutcome?.price).toBe(25);
    expect(cashOf(s, 2)).toBe(75);
    expect(cashOf(s, 0)).toBe(125);
    expect(cashOf(s, 1)).toBe(100);
    expect(s.bank).toBe(0);
    expect(s.players[2].purchased).toContain(card);
  });

  it('倒计时落槌也能成交', () => {
    const s0 = scenario(4);
    const card = pick(s0, 'B', 'OPEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p3', amount: 12 });
    s = reduce(s, { type: 'RESOLVE_OPEN_AUCTION' });

    expect(s.lastOutcome?.winnerId).toBe('p3');
    expect(cashOf(s, 3)).toBe(88);
    expect(cashOf(s, 0)).toBe(112);
  });

  it('无人出价 → 拍卖师免费获得，资金不变', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'C', 'OPEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.free).toBe(true);
    expect(s.players[0].purchased).toContain(card);
    expect(cashOf(s, 0)).toBe(100);
    expect(s.bank).toBe(0);
  });

  it('拍卖师自己拍下 → 款项进入银行而不是回到自己口袋', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'OPEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 10 });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p0', amount: 30 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(70);
    expect(s.bank).toBe(30);
  });

  it('非法出价全部被拦截', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'E', 'OPEN');
    giveHand(s0, 0, [card]);
    setCash(s0, 1, 15);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p2', amount: 10 });

    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 }).ok).toBe(false); // 超过现金
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 10 }).ok).toBe(false); // 未高于最高价
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 5.5 }).ok).toBe(false); // 非整数
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p2', amount: 12 }).ok).toBe(false); // 已是最高价
    expect(validateAction(s, { type: 'PASS_BID', playerId: 'p2' }).ok).toBe(false); // 最高价不能放弃
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 12 }).ok).toBe(true);

    // 被拦截的动作不应改变状态
    const before = cashOf(s, 1);
    const after = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 999 });
    expect(cashOf(after, 1)).toBe(before);
    expect(after.currentAuction?.currentHighestBid).toBe(10);
  });
});
