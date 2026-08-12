import { describe, expect, it } from 'vitest';
import type { AiLevel, GameState } from '@/types/game';
import { activeAuctionType, reduce, startGame, validateAction } from '@/engine/rulesEngine';
import { decide, nextAiAction } from '@/ai';
import { roleFactor } from '@/ai/valuation';
import { pick, setRoundCount } from './helpers';

function aiScenario(playerCount = 3, aiLevel: AiLevel = 'hard', seed = 11): GameState {
  const s = startGame({ playerCount, humanCount: 0, aiLevel, seed });
  s.players.forEach((p) => {
    p.hand = [];
    p.purchased = [];
    p.cash = 100;
  });
  s.deck = [];
  s.discardPile = [];
  s.bank = 0;
  return s;
}

/** 让一桌 AI 自己把牌打完；顺便校验它们从不产出非法动作 */
function playOut(start: GameState, maxSteps = 6000): GameState {
  let s = start;
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === 'GAME_END') return s;

    if (s.phase === 'AUCTION_RESULT') {
      s = reduce(s, { type: 'ACKNOWLEDGE_RESULT' });
      continue;
    }
    if (s.phase === 'ROUND_SCORING' || s.phase === 'SELL_ARTWORK') {
      s = reduce(s, { type: 'CONTINUE' });
      continue;
    }

    const next = nextAiAction(s);
    if (next) {
      const check = validateAction(s, next.action);
      if (!check.ok) {
        throw new Error(`AI ${next.playerId} 在 ${s.phase} 给出了非法动作：${check.reason}`);
      }
      const after = reduce(s, next.action);
      if (after === s) throw new Error(`AI 动作没有推进状态：${JSON.stringify(next.action)}`);
      s = after;
    } else if (activeAuctionType(s) === 'OPEN') {
      // 没有 AI 想继续加价 —— 相当于真实对局里倒计时归零
      s = reduce(s, { type: 'RESOLVE_OPEN_AUCTION' });
    } else {
      throw new Error(`阶段 ${s.phase} 下没有任何 AI 可以行动`);
    }

    if (s.players.some((p) => p.cash < 0)) throw new Error('出现了负资金');
  }
  throw new Error('AI 对局超过最大步数');
}

describe('AI 决策', () => {
  for (const level of ['easy', 'normal', 'hard'] as AiLevel[]) {
    it(`${level} 难度的 AI 能独立打完整局且从不违规`, () => {
      const end = playOut(startGame({ playerCount: 4, humanCount: 0, aiLevel: level, seed: 31 }));
      expect(end.phase).toBe('GAME_END');
      expect(end.currentRound).toBe(4);
      expect(end.finalRanking).toHaveLength(4);
      expect(end.players.every((p) => p.cash >= 0)).toBe(true);
      // 至少发生过真实的成交，而不是全程流拍
      expect(end.log.filter((l) => l.kind === 'result').length).toBeGreaterThan(5);
    });
  }

  it('3 / 5 人局同样可以由 AI 自行完成', () => {
    expect(playOut(startGame({ playerCount: 3, humanCount: 0, aiLevel: 'normal', seed: 5 })).phase).toBe(
      'GAME_END',
    );
    expect(playOut(startGame({ playerCount: 5, humanCount: 0, aiLevel: 'hard', seed: 8 })).phase).toBe(
      'GAME_END',
    );
  });

  it('不会为了替对手结算而抢着打出第 5 幅', () => {
    const s = aiScenario(3, 'hard');
    setRoundCount(s, 'A', 4);
    const trap = pick(s, 'A', 'OPEN');
    const safe = pick(s, 'B', 'OPEN');
    s.players[0].hand = [trap, safe];
    // 对手手里全是 A 的作品，现在结算等于白送他 90k
    s.players[1].purchased = [pick(s, 'A', 'HIDDEN'), pick(s, 'A', 'FIXED'), pick(s, 'A', 'ONE_OFFER')];

    const action = decide(s, 'p0');
    expect(action).toMatchObject({ type: 'PLAY_ARTWORK', artworkId: safe });
  });

  it('自己领先时会果断打出第 5 幅锁定收益', () => {
    const s = aiScenario(3, 'hard');
    setRoundCount(s, 'A', 4);
    const finisher = pick(s, 'A', 'OPEN');
    const other = pick(s, 'B', 'OPEN');
    s.players[0].hand = [finisher, other];
    s.players[0].purchased = [pick(s, 'A', 'HIDDEN'), pick(s, 'A', 'FIXED'), pick(s, 'A', 'ONE_OFFER')];

    const action = decide(s, 'p0');
    expect(action).toMatchObject({ type: 'PLAY_ARTWORK', artworkId: finisher });
  });

  it('拍卖师对自己的拍卖会明显更保守（自购的钱进银行）', () => {
    const s = aiScenario(3, 'hard');
    const card = pick(s, 'C', 'OPEN');
    s.players[0].hand = [card];
    const running = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    const auction = running.currentAuction!;

    expect(roleFactor(auction, 'p0')).toBeLessThan(roleFactor(auction, 'p1'));
    expect(roleFactor(auction, 'p1')).toBe(1);
  });

  it('资金不足时只会 PASS，绝不会出超过现金的价', () => {
    const s = aiScenario(3, 'hard');
    const card = pick(s, 'E', 'OPEN');
    s.players[0].hand = [card];
    s.players[1].cash = 3;
    s.players[2].cash = 100;

    let running = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    running = reduce(running, { type: 'PLACE_BID', playerId: 'p2', amount: 40 });

    const action = decide(running, 'p1');
    expect(action).toEqual({ type: 'PASS_BID', playerId: 'p1' });
  });

  it('暗标出价始终落在 [0, 现金] 区间内', () => {
    const s = aiScenario(4, 'normal');
    const card = pick(s, 'D', 'HIDDEN');
    s.players[0].hand = [card];
    s.players[1].cash = 7;

    const running = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    for (const p of running.players) {
      const action = decide(running, p.id);
      expect(action?.type).toBe('SUBMIT_HIDDEN_BID');
      const amount = (action as { amount: number }).amount;
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(p.cash);
      expect(Number.isInteger(amount)).toBe(true);
    }
  });

  it('定价拍卖的报价永远不超过拍卖师自己的现金', () => {
    const s = aiScenario(3, 'normal');
    const card = pick(s, 'D', 'FIXED');
    s.players[0].hand = [card];
    s.players[0].cash = 9;

    const running = reduce(s, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    const action = decide(running, 'p0');

    expect(action?.type).toBe('SET_FIXED_PRICE');
    const price = (action as { price: number }).price;
    expect(price).toBeGreaterThanOrEqual(1);
    expect(price).toBeLessThanOrEqual(9);
    expect(validateAction(running, action!).ok).toBe(true);
  });

  it('相同种子下 AI 的决策完全可复现', () => {
    const a = playOut(startGame({ playerCount: 4, humanCount: 0, aiLevel: 'normal', seed: 77 }));
    const b = playOut(startGame({ playerCount: 4, humanCount: 0, aiLevel: 'normal', seed: 77 }));
    expect(a.players.map((p) => p.cash)).toEqual(b.players.map((p) => p.cash));
    expect(a.finalRanking).toEqual(b.finalRanking);
  });
});
