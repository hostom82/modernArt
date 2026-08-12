import { describe, expect, it } from 'vitest';
import { reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario, setCash } from './helpers';

describe('暗标拍卖 Hidden Auction', () => {
  it('3. 正常成交：最高秘密报价者获得作品', () => {
    const s0 = scenario(4);
    const card = pick(s0, 'A', 'HIDDEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(s.phase).toBe('AUCTION_HIDDEN');

    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 25 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 18 });
    expect(s.phase).toBe('AUCTION_HIDDEN');
    expect(s.currentAuction?.revealed).toBe(false);

    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p3', amount: 32 });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.winnerId).toBe('p3');
    expect(s.lastOutcome?.price).toBe(32);
    expect(cashOf(s, 3)).toBe(68);
    expect(cashOf(s, 0)).toBe(132);
  });

  it('4. 平局：从拍卖师左手起顺时针决定优先级', () => {
    const s0 = scenario(4);
    const card = pick(s0, 'B', 'HIDDEN');
    giveHand(s0, 1, [card]); // 拍卖师是 p1
    s0.currentPlayerIndex = 1;

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: card });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 20 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 5 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 20 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p3', amount: 20 });

    // 拍卖师 p1 出价不是最高，平局按 p2 → p3 → p0 的顺时针顺序，p2 胜出
    expect(s.lastOutcome?.winnerId).toBe('p2');
    expect(s.lastOutcome?.price).toBe(20);
  });

  it('4b. 拍卖师参与最高价并形成平局 → 拍卖师获胜', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'C', 'HIDDEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 30 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 30 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 12 });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(70);
    expect(s.bank).toBe(30); // 拍卖师自购 → 进银行
  });

  it('全员出价 0 → 拍卖师免费获得', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'HIDDEN');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 0 });

    expect(s.lastOutcome?.free).toBe(true);
    expect(s.players[0].purchased).toContain(card);
    expect(cashOf(s, 0)).toBe(100);
  });

  it('不能重复提交，不能超过现金', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'E', 'HIDDEN');
    giveHand(s0, 0, [card]);
    setCash(s0, 1, 10);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(validateAction(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 11 }).ok).toBe(false);
    expect(validateAction(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: -1 }).ok).toBe(false);

    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 10 });
    expect(validateAction(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 5 }).ok).toBe(false);
  });
});
