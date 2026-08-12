import { describe, expect, it } from 'vitest';
import type { GameState } from '@/types/game';
import { reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario, setCash } from './helpers';

/** 拍卖阶段资金必须守恒：玩家现金总和 + 银行 = 起始总额 */
function totalMoney(s: GameState): number {
  return s.players.reduce((sum, p) => sum + p.cash, 0) + s.bank;
}

describe('资金流动 Money', () => {
  it('13. 三场连续拍卖后每位玩家的资金变化完全正确，且总额守恒', () => {
    const s0 = scenario(3);
    const open = pick(s0, 'A', 'OPEN');
    const oneOffer = pick(s0, 'B', 'ONE_OFFER');
    const hidden = pick(s0, 'C', 'HIDDEN');
    giveHand(s0, 0, [open]);
    giveHand(s0, 1, [oneOffer]);
    giveHand(s0, 2, [hidden]);

    expect(totalMoney(s0)).toBe(300);

    // ① 公开竞价：p0 拍卖，p1 以 20 拍得 → p1 付给 p0
    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: open });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(cashOf(s, 0)).toBe(120);
    expect(cashOf(s, 1)).toBe(80);
    expect(cashOf(s, 2)).toBe(100);
    expect(s.bank).toBe(0);
    expect(totalMoney(s)).toBe(300);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.players[s.currentPlayerIndex].id).toBe('p1');

    // ② 一轮报价：p1 拍卖，最后自己压过所有人 → 25 全额进银行
    s = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: oneOffer });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p2', amount: 10 });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p0', amount: 15 });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 25 });

    expect(s.lastOutcome?.winnerId).toBe('p1');
    expect(cashOf(s, 1)).toBe(55);
    expect(s.bank).toBe(25);
    expect(cashOf(s, 0)).toBe(120); // 落败者不付钱
    expect(cashOf(s, 2)).toBe(100);
    expect(totalMoney(s)).toBe(300);

    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    expect(s.players[s.currentPlayerIndex].id).toBe('p2');

    // ③ 暗标：p2 拍卖，p0 以 30 拍得 → p0 付给 p2
    s = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p2', artworkId: hidden });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 30 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 10 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 5 });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(90);
    expect(cashOf(s, 1)).toBe(55);
    expect(cashOf(s, 2)).toBe(130);
    expect(s.bank).toBe(25);
    expect(totalMoney(s)).toBe(300);

    // 作品归属正确
    expect(s.players[0].purchased).toEqual([hidden]);
    expect(s.players[1].purchased).toEqual([open, oneOffer]);
    expect(s.players[2].purchased).toEqual([]);
  });

  it('拍卖师自购：定价拍卖无人接手时，定价金额全额进入银行', () => {
    const s0 = scenario(3);
    const fixed = pick(s0, 'D', 'FIXED');
    giveHand(s0, 0, [fixed]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: fixed });
    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 40 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(60);
    expect(s.bank).toBe(40);
    expect(totalMoney(s)).toBe(300);
    expect(s.players[0].purchased).toEqual([fixed]);
  });

  it('资金不足的出价一律被拒绝，恰好等于现金的出价允许', () => {
    const s0 = scenario(3);
    const open = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [open]);
    setCash(s0, 1, 18);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: open });

    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 19 }).ok).toBe(false);
    expect(validateAction(s, { type: 'PLACE_BID', playerId: 'p1', amount: 18 }).ok).toBe(true);

    // 被拒绝的动作不会改变任何状态
    const after = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 19 });
    expect(after).toBe(s);
    expect(cashOf(after, 1)).toBe(18);
  });

  it('免费获得（无人出价）不产生任何资金流动', () => {
    const s0 = scenario(3);
    const open = pick(s0, 'E', 'OPEN');
    giveHand(s0, 0, [open]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: open });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.lastOutcome?.free).toBe(true);
    expect(s.lastOutcome?.price).toBe(0);
    expect(s.players.every((p) => p.cash === 100)).toBe(true);
    expect(s.bank).toBe(0);
    expect(totalMoney(s)).toBe(300);
  });

  it('联合拍卖的分账在奇数金额下仍然守恒（共同拍卖师多拿 1k）', () => {
    const s0 = scenario(4);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [second]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: second });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p2', amount: 41 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p3' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p1' });

    expect(cashOf(s, 2)).toBe(59); // 付出 41
    expect(cashOf(s, 0)).toBe(120); // floor(41/2) = 20
    expect(cashOf(s, 1)).toBe(121); // ceil(41/2) = 21
    expect(s.bank).toBe(0);
    expect(totalMoney(s)).toBe(400);
  });
});
