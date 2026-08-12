import { describe, expect, it } from 'vitest';
import type { GameState } from '@/types/game';
import { reduce, validateAction } from '@/engine/rulesEngine';
import { giveHand, pick, scenario, setCash } from './helpers';

const ok = (s: GameState, a: Parameters<typeof validateAction>[1]) => validateAction(s, a).ok;

describe('规则拦截 validateAction', () => {
  it('出牌：只有当前玩家能出、只能出自己手上的牌、只能在出牌阶段出', () => {
    const s0 = scenario(3);
    const mine = pick(s0, 'A', 'OPEN');
    const other = pick(s0, 'B', 'OPEN');
    giveHand(s0, 0, [mine]);
    giveHand(s0, 1, [other]);

    expect(ok(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: mine })).toBe(true);
    expect(ok(s0, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: other })).toBe(false); // 还没轮到 p1
    expect(ok(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: other })).toBe(false); // 不在手牌里
    expect(ok(s0, { type: 'PLAY_ARTWORK', playerId: 'px', artworkId: mine })).toBe(false); // 玩家不存在

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: mine });
    expect(ok(s, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: other })).toBe(false); // 拍卖中不能出牌
  });

  it('公开竞价：加价必须更高、不能超现金、放弃后不能回头、领先者不能放弃', () => {
    const s0 = scenario(3);
    const open = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [open]);
    setCash(s0, 2, 12);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: open });

    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: 0 })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: -5 })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: 3.5 })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 13 })).toBe(false); // 只有 12
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 12 })).toBe(true);

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 20 });
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 20 })).toBe(false); // 必须更高
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: 30 })).toBe(false); // 自己顶自己
    expect(ok(s, { type: 'PASS_BID', playerId: 'p1' })).toBe(false); // 领先者不能放弃

    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 40 })).toBe(false); // 放弃后不能回头
    expect(ok(s, { type: 'PASS_BID', playerId: 'p2' })).toBe(false);
  });

  it('一轮报价：不能插队，且必须超过当前最高价', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'B', 'ONE_OFFER');
    giveHand(s0, 0, [card]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    // 询问顺序：p1 → p2 → p0
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 10 })).toBe(false);
    expect(ok(s, { type: 'PASS_BID', playerId: 'p0' })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: 10 })).toBe(true);

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 10 });
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 10 })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p2', amount: 11 })).toBe(true);
  });

  it('暗标：不能重复提交、不能负数、不能超现金，0 是合法的弃权价', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'C', 'HIDDEN');
    giveHand(s0, 0, [card]);
    setCash(s0, 1, 30);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });

    expect(ok(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 0 })).toBe(true);
    expect(ok(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: -1 })).toBe(false);
    expect(ok(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 31 })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p1', amount: 10 })).toBe(false); // 暗标不接受公开出价

    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 10 });
    expect(ok(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 20 })).toBe(false); // 重复提交
  });

  it('定价拍卖：只有拍卖师能定价、定价不得超过自己现金、未定价前不能购买', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'FIXED');
    giveHand(s0, 0, [card]);
    setCash(s0, 0, 25);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });

    expect(ok(s, { type: 'SET_FIXED_PRICE', playerId: 'p1', price: 10 })).toBe(false);
    expect(ok(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 26 })).toBe(false); // 超过自己现金
    expect(ok(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 0 })).toBe(false);
    expect(ok(s, { type: 'BUY_FIXED', playerId: 'p1' })).toBe(false); // 还没定价
    expect(ok(s, { type: 'PASS_BID', playerId: 'p1' })).toBe(false);
    expect(ok(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 25 })).toBe(true);

    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 25 });
    expect(ok(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 10 })).toBe(false); // 不能改价
    expect(ok(s, { type: 'BUY_FIXED', playerId: 'p2' })).toBe(false); // 还没轮到 p2
    expect(ok(s, { type: 'BUY_FIXED', playerId: 'p1' })).toBe(true);
  });

  it('定价拍卖：现金不足的询问者只能放弃', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'D', 'FIXED');
    giveHand(s0, 0, [card]);
    setCash(s0, 1, 5);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    s = reduce(s, { type: 'SET_FIXED_PRICE', playerId: 'p0', price: 30 });

    expect(ok(s, { type: 'BUY_FIXED', playerId: 'p1' })).toBe(false);
    expect(ok(s, { type: 'PASS_BID', playerId: 'p1' })).toBe(true);
  });

  it('阶段性动作：结果确认与结算继续只能在对应阶段触发', () => {
    const s0 = scenario(3);
    const card = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [card]);

    expect(ok(s0, { type: 'ACKNOWLEDGE_RESULT' })).toBe(false);
    expect(ok(s0, { type: 'CONTINUE' })).toBe(false);
    expect(ok(s0, { type: 'RESOLVE_OPEN_AUCTION' })).toBe(false);
    expect(ok(s0, { type: 'DOUBLE_DECLINE', playerId: 'p0' })).toBe(false);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    expect(ok(s, { type: 'RESOLVE_OPEN_AUCTION' })).toBe(true);
    expect(ok(s, { type: 'ACKNOWLEDGE_RESULT' })).toBe(false);
    expect(ok(s, { type: 'CONTINUE' })).toBe(false);
  });

  it('牌局结束后所有操作都被拒绝', () => {
    const base = scenario(3);
    const s: GameState = { ...base, phase: 'GAME_END' };

    expect(ok(s, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: 'anything' })).toBe(false);
    expect(ok(s, { type: 'PLACE_BID', playerId: 'p0', amount: 10 })).toBe(false);
    expect(ok(s, { type: 'CONTINUE' })).toBe(false);
    expect(ok(s, { type: 'ACKNOWLEDGE_RESULT' })).toBe(false);
    // 但重开一局始终允许
    expect(ok(s, { type: 'RESTART' })).toBe(true);
  });

  it('reduce 遇到非法动作时原样返回旧状态（同一引用）', () => {
    const s0 = scenario(3);
    giveHand(s0, 0, [pick(s0, 'A', 'OPEN')]);

    const same = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: 'nope' });
    expect(same).toBe(s0);

    const same2 = reduce(s0, { type: 'PLACE_BID', playerId: 'p0', amount: 10 });
    expect(same2).toBe(s0);
  });
});
