import { describe, expect, it } from 'vitest';
import type { GameState } from '@/types/game';
import { actingPlayerId, activeAuctionType, reduce, startGame } from '@/engine/rulesEngine';
import { dealCountFor } from '@/engine/setup';
import { doubleCandidates } from '@/engine/helpers';
import { currentDoubleAsked } from '@/engine/auction/double';

/**
 * 一个完全确定性的「自动对局器」：在每个阶段挑选第一个合法动作。
 * 它不含任何 AI 策略，只用来验证状态机能从开局一路跑到 GAME_END 而不卡死。
 */
function step(s: GameState): GameState {
  switch (s.phase) {
    case 'PLAYER_TURN': {
      const p = s.players[s.currentPlayerIndex];
      return reduce(s, { type: 'PLAY_ARTWORK', playerId: p.id, artworkId: p.hand[0] });
    }
    case 'AUCTION_DOUBLE_WAIT':
    case 'AUCTION_DOUBLE_SELECT': {
      const asked = currentDoubleAsked(s)!;
      const cands = doubleCandidates(s, asked, s.pendingDouble!.artistId);
      if (cands.length > 0) {
        return reduce(s, { type: 'DOUBLE_ADD', playerId: asked, artworkId: cands[0] });
      }
      return reduce(s, { type: 'DOUBLE_DECLINE', playerId: asked });
    }
    case 'AUCTION_RESULT':
      return reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
    case 'ROUND_SCORING':
    case 'SELL_ARTWORK':
      return reduce(s, { type: 'CONTINUE' });
    default:
      break;
  }

  const a = s.currentAuction;
  const type = activeAuctionType(s);
  if (!a || !type) throw new Error(`阶段 ${s.phase} 没有可执行的动作`);

  if (type === 'OPEN') {
    const bidder = s.players.find(
      (p) => a.bids[p.id] !== null && a.highestBidder !== p.id && p.cash > a.currentHighestBid,
    );
    if (a.currentHighestBid < 3 && bidder) {
      return reduce(s, { type: 'PLACE_BID', playerId: bidder.id, amount: a.currentHighestBid + 1 });
    }
    const passer = s.players.find((p) => a.bids[p.id] !== null && a.highestBidder !== p.id);
    if (passer) return reduce(s, { type: 'PASS_BID', playerId: passer.id });
    return reduce(s, { type: 'RESOLVE_OPEN_AUCTION' });
  }

  if (type === 'ONE_OFFER') {
    const who = actingPlayerId(s)!;
    const player = s.players.find((p) => p.id === who)!;
    const amount = a.currentHighestBid + 1;
    if (a.currentHighestBid < 2 && player.cash >= amount) {
      return reduce(s, { type: 'PLACE_BID', playerId: who, amount });
    }
    return reduce(s, { type: 'PASS_BID', playerId: who });
  }

  if (type === 'HIDDEN') {
    const next = s.players.find((p) => !a.submitted.includes(p.id))!;
    return reduce(s, {
      type: 'SUBMIT_HIDDEN_BID',
      playerId: next.id,
      amount: Math.min(next.cash, next.seatIndex + 1),
    });
  }

  if (type === 'FIXED') {
    if (a.fixedPrice === undefined) {
      const auctioneer = s.players.find((p) => p.id === a.auctioneerId)!;
      return reduce(s, {
        type: 'SET_FIXED_PRICE',
        playerId: a.auctioneerId,
        price: Math.min(2, auctioneer.cash),
      });
    }
    const who = actingPlayerId(s)!;
    const player = s.players.find((p) => p.id === who)!;
    if (player.cash >= a.fixedPrice) return reduce(s, { type: 'BUY_FIXED', playerId: who });
    return reduce(s, { type: 'PASS_BID', playerId: who });
  }

  throw new Error(`未处理的拍卖方式 ${type}`);
}

function runToEnd(start: GameState, maxSteps = 5000): GameState {
  let cur = start;
  for (let i = 0; i < maxSteps; i++) {
    if (cur.phase === 'GAME_END') return cur;
    const next = step(cur);
    if (next === cur) {
      throw new Error(`第 ${i} 步在阶段 ${cur.phase} 卡住（动作被判定为非法）`);
    }
    cur = next;
  }
  throw new Error(`超过 ${maxSteps} 步仍未结束，疑似死循环`);
}

function totalCards(s: GameState): number {
  return (
    s.deck.length +
    s.discardPile.length +
    s.players.reduce((n, p) => n + p.hand.length + p.purchased.length, 0)
  );
}

describe('完整牌局 Full Game', () => {
  it('14. 第 4 轮不补牌', () => {
    expect(dealCountFor(3, 1)).toBe(10);
    expect(dealCountFor(4, 1)).toBe(9);
    expect(dealCountFor(5, 1)).toBe(8);
    expect(dealCountFor(3, 2)).toBe(6);
    expect(dealCountFor(4, 3)).toBe(4);
    expect(dealCountFor(5, 3)).toBe(3);
    expect(dealCountFor(3, 4)).toBe(0);
    expect(dealCountFor(4, 4)).toBe(0);
    expect(dealCountFor(5, 4)).toBe(0);
  });

  for (const playerCount of [3, 4, 5]) {
    it(`14b. ${playerCount} 人局能从开局跑完 4 轮到 GAME_END，不会死锁`, () => {
      const start = startGame({ playerCount, humanCount: playerCount, aiLevel: 'normal', seed: 7 });
      expect(start.phase).toBe('PLAYER_TURN');
      expect(start.players[0].hand).toHaveLength(dealCountFor(playerCount, 1));

      const end = runToEnd(start);

      expect(end.phase).toBe('GAME_END');
      expect(end.currentRound).toBe(4);
      expect(end.roundHistory).toHaveLength(4);
      expect(end.cashSnapshots).toHaveLength(5); // 起始快照 + 4 轮
      expect(end.log.some((l) => l.text.includes('本轮不补牌'))).toBe(true);

      // 每一轮都完成过结算并卖出
      expect(end.roundHistory.every((r) => r.sold)).toBe(true);
      expect(end.players.every((p) => p.purchased.length === 0)).toBe(true);

      // 70 张牌一张不多一张不少
      expect(totalCards(end)).toBe(70);
    });
  }

  it('15. 最终排名按现金从高到低，冠军就是排名第一的人', () => {
    const end = runToEnd(startGame({ playerCount: 4, humanCount: 4, aiLevel: 'normal', seed: 2026 }));

    expect(end.finalRanking).toHaveLength(4);
    expect(end.winnerId).toBe(end.finalRanking![0]);

    const cashes = end.finalRanking!.map((id) => end.players.find((p) => p.id === id)!.cash);
    for (let i = 1; i < cashes.length; i++) {
      expect(cashes[i - 1]).toBeGreaterThanOrEqual(cashes[i]);
    }
    expect(cashes[0]).toBe(Math.max(...end.players.map((p) => p.cash)));

    // 排名里每位玩家只出现一次
    expect(new Set(end.finalRanking).size).toBe(4);
  });

  it('牌局结束后任何操作都不再生效', () => {
    const end = runToEnd(startGame({ playerCount: 3, humanCount: 3, aiLevel: 'normal', seed: 5 }));
    const after = reduce(end, { type: 'CONTINUE' });
    expect(after).toBe(end);
  });

  it('相同随机种子产生完全相同的牌局结果', () => {
    const a = runToEnd(startGame({ playerCount: 3, humanCount: 3, aiLevel: 'normal', seed: 99 }));
    const b = runToEnd(startGame({ playerCount: 3, humanCount: 3, aiLevel: 'normal', seed: 99 }));

    expect(a.players.map((p) => p.cash)).toEqual(b.players.map((p) => p.cash));
    expect(a.finalRanking).toEqual(b.finalRanking);
    expect(a.artists.A.valueHistory).toEqual(b.artists.A.valueHistory);
  });
});
