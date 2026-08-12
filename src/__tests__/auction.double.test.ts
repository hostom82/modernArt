import { describe, expect, it } from 'vitest';
import { reduce, validateAction } from '@/engine/rulesEngine';
import { cashOf, giveHand, pick, scenario } from './helpers';

describe('联合拍卖 Double Auction', () => {
  it('6. 拍卖师自己追加第二幅 → 没有共同拍卖师，独得全款', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [dbl, second]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    expect(s.phase).toBe('AUCTION_DOUBLE_WAIT');
    expect(s.pendingDouble?.artistId).toBe('A');

    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p0', artworkId: second });
    expect(s.phase).toBe('AUCTION_DOUBLE_RUNNING');
    expect(s.currentAuction?.type).toBe('OPEN');
    expect(s.currentAuction?.coAuctioneerId).toBeUndefined();
    expect(s.currentAuction?.artworkIds).toEqual([dbl, second]);

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 30 });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p2' });
    s = reduce(s, { type: 'PASS_BID', playerId: 'p0' });

    expect(s.lastOutcome?.winnerId).toBe('p1');
    expect(cashOf(s, 1)).toBe(70);
    expect(cashOf(s, 0)).toBe(130); // 独得全款
    expect(s.players[1].purchased).toHaveLength(2);
  });

  it('6b. 其他玩家追加 → 成为共同拍卖师，奇数金额时多拿 1k', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'HIDDEN');
    giveHand(s0, 0, [dbl]); // 拍卖师手里没有可追加的牌 → 自动跳过
    giveHand(s0, 1, [second]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    expect(s.phase).toBe('AUCTION_DOUBLE_SELECT');
    expect(s.pendingDouble?.askQueue[s.pendingDouble.askIndex]).toBe('p1');

    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: second });
    expect(s.currentAuction?.coAuctioneerId).toBe('p1');
    expect(s.currentAuction?.type).toBe('HIDDEN');

    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 25 });

    // 25 → 原拍卖师 12，共同拍卖师 13
    expect(cashOf(s, 2)).toBe(75);
    expect(cashOf(s, 0)).toBe(112);
    expect(cashOf(s, 1)).toBe(113);
    expect(s.bank).toBe(0);
  });

  it('6c. 共同拍卖师自己拍下 → 仍需付一半给原拍卖师，自己那半进银行', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'B', 'DOUBLE');
    const second = pick(s0, 'B', 'HIDDEN');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [second]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: second });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 25 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 0 });

    expect(s.lastOutcome?.winnerId).toBe('p1');
    expect(cashOf(s, 1)).toBe(75); // 付出 25
    expect(cashOf(s, 0)).toBe(112); // 收到 12
    expect(s.bank).toBe(13); // 自己那 13 进银行
    expect(cashOf(s, 0) + cashOf(s, 1) + cashOf(s, 2) + s.bank).toBe(300);
  });

  it('6d. 原拍卖师自己拍下 → 自己那半进银行，另一半付给共同拍卖师', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'C', 'DOUBLE');
    const second = pick(s0, 'C', 'HIDDEN');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [second]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: second });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p0', amount: 25 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p1', amount: 0 });
    s = reduce(s, { type: 'SUBMIT_HIDDEN_BID', playerId: 'p2', amount: 0 });

    expect(s.lastOutcome?.winnerId).toBe('p0');
    expect(cashOf(s, 0)).toBe(75);
    expect(cashOf(s, 1)).toBe(113);
    expect(s.bank).toBe(12);
    expect(cashOf(s, 0) + cashOf(s, 1) + cashOf(s, 2) + s.bank).toBe(300);
  });

  it('6e. 无人追加 → 官方规则：拍卖师免费获得该联合拍卖牌', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'D', 'DOUBLE');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [pick(s0, 'E', 'OPEN')]); // 不同艺术家，不能追加

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.free).toBe(true);
    expect(s.players[0].purchased).toEqual([dbl]);
    expect(cashOf(s, 0)).toBe(100);
  });

  it('6f. 全员主动拒绝追加 → 同样由拍卖师免费获得', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'D', 'DOUBLE');
    giveHand(s0, 0, [dbl, pick(s0, 'D', 'OPEN')]);
    giveHand(s0, 1, [pick(s0, 'D', 'HIDDEN')]);
    giveHand(s0, 2, [pick(s0, 'D', 'FIXED')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    s = reduce(s, { type: 'DOUBLE_DECLINE', playerId: 'p0' });
    expect(s.phase).toBe('AUCTION_DOUBLE_SELECT');
    s = reduce(s, { type: 'DOUBLE_DECLINE', playerId: 'p1' });
    s = reduce(s, { type: 'DOUBLE_DECLINE', playerId: 'p2' });

    expect(s.phase).toBe('AUCTION_RESULT');
    expect(s.lastOutcome?.free).toBe(true);
    expect(s.players[0].purchased).toEqual([dbl]);
  });

  it('非法追加全部被拦截：不同艺术家 / 第二幅也是联合拍卖 / 插队', () => {
    const s0 = scenario(3);
    const dbl = pick(s0, 'E', 'DOUBLE');
    const wrongArtist = pick(s0, 'A', 'OPEN');
    const anotherDouble = pick(s0, 'E', 'DOUBLE');
    const legal = pick(s0, 'E', 'OPEN');
    giveHand(s0, 0, [dbl, wrongArtist, anotherDouble, legal]);
    giveHand(s0, 1, [pick(s0, 'E', 'HIDDEN')]);

    const s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    expect(validateAction(s, { type: 'DOUBLE_ADD', playerId: 'p0', artworkId: wrongArtist }).ok).toBe(false);
    expect(validateAction(s, { type: 'DOUBLE_ADD', playerId: 'p0', artworkId: anotherDouble }).ok).toBe(false);
    expect(validateAction(s, { type: 'DOUBLE_ADD', playerId: 'p1', artworkId: legal }).ok).toBe(false);
    expect(validateAction(s, { type: 'DOUBLE_ADD', playerId: 'p0', artworkId: legal }).ok).toBe(true);
  });

  it('官方座次规则：有共同拍卖师时，下一位出牌者是共同拍卖师的左手', () => {
    const s0 = scenario(4);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [dbl]);
    giveHand(s0, 1, [pick(s0, 'B', 'OPEN')]);
    giveHand(s0, 2, [second]);
    giveHand(s0, 3, [pick(s0, 'C', 'OPEN')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    // p0、p1 没有 A 的可追加牌 → 自动跳到 p2
    expect(s.pendingDouble?.askQueue[s.pendingDouble.askIndex]).toBe('p2');

    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p2', artworkId: second });
    expect(s.currentAuction?.coAuctioneerId).toBe('p2');

    s = reduce(s, { type: 'PLACE_BID', playerId: 'p3', amount: 10 });
    s = reduce(s, { type: 'RESOLVE_OPEN_AUCTION' });
    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });

    expect(s.phase).toBe('PLAYER_TURN');
    expect(s.players[s.currentPlayerIndex].id).toBe('p3'); // p1 被跳过
  });

  it('没有共同拍卖师时，下一位出牌者是拍卖师的左手', () => {
    const s0 = scenario(4);
    const dbl = pick(s0, 'A', 'DOUBLE');
    const second = pick(s0, 'A', 'OPEN');
    giveHand(s0, 0, [dbl, second]);
    giveHand(s0, 1, [pick(s0, 'B', 'OPEN')]);
    giveHand(s0, 2, [pick(s0, 'C', 'OPEN')]);
    giveHand(s0, 3, [pick(s0, 'D', 'OPEN')]);

    let s = reduce(s0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: dbl });
    s = reduce(s, { type: 'DOUBLE_ADD', playerId: 'p0', artworkId: second });
    s = reduce(s, { type: 'PLACE_BID', playerId: 'p1', amount: 5 });
    s = reduce(s, { type: 'RESOLVE_OPEN_AUCTION' });
    s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });

    expect(s.players[s.currentPlayerIndex].id).toBe('p1');
  });
});
