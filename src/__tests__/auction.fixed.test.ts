import { describe, expect, it } from 'vitest';
import { actingPlayerId, reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario, setCash } from './helpers';

describe('定价拍卖 Fixed Price', () => {
  it('5. 无人购买 → 拍卖师必须按自己宣布的价格买下，款项进银行', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'A', 'FIXED');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(s.phase).toBe('AUCTION_FIXED');
    expect(actingPlayerId(s)).toBe('p0');

    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 40 });
    expect(s.currentAuction?.turnQueue).toEqual(['p1', 'p2']);
    expect(actingPlayerId(s)).toBe('p1');

    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(s.lastOutcome?.price).toBe(40);
    expect(cashOf(s, 0)).toBe(60);
    expect(s.bank).toBe(40);
    expect(s.players[0].purchased).toContain(card);
  });

  it('有人接手 → 立即成交，款项付给拍卖师', () => {
    const s0 = scenario(4);
    const card = pick(s0, 'B', 'FIXED');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 35 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'BUY_FIXED', playerId: 'p2' });

    expect(s.lastOutcome?.winnerId).toBe('p2');
    expect(cashOf(s, 2)).toBe(65);
    expect(cashOf(s, 0)).toBe(135);
    expect(s.bank).toBe(0);
  });

  it('拍卖师不能宣布高于自己现金的价格', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'C', 'FIXED');
    giveHand(s0, 0, [card]);
    setCash(s0, 0, 30);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(validateAction(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 31 }).ok).toBe(false);
    expect(validateAction(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 30 }).ok).toBe(true);
    expect(validateAction(s, { type: 'SET_FIXED_PRICE', playerId: 'p1', price: 10 }).ok).toBe(false);
    expect(validateAction(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 0 }).ok).toBe(false);
  });

  it('买不起的玩家不能购买，也不能插队', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'FIXED');
    giveHand(s0, 0, [card]);
    setCash(s0, 1, 20);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 50 });

    expect(validateAction(s, { type: 'BUY_FIXED', playerId: 'p1' }).ok).toBe(false); // 资金不足
    expect(validateAction(s, { type: 'BUY_FIXED', playerId: 'p2' }).ok).toBe(false); // 没轮到
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    expect(validateAction(s, { type: 'BUY_FIXED', playerId: 'p2' }).ok).toBe(true);
  });
});
