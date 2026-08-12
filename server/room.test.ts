import { describe, it, expect } from 'vitest';
import { Room } from './room';
import { projectView } from './view';
import type { ClientView, ServerMessage } from '@/shared/protocol';
import type { AuctionState, GameState } from '@/types/game';

/** 捕获发送到该「客户端」的所有消息的假 socket */
function fakeSocket() {
  const sent: ServerMessage[] = [];
  return {
    sent,
    socket: {
      send: (data: string) => sent.push(JSON.parse(data) as ServerMessage),
      close: () => {},
    } as { send: (data: string) => void; close: () => void },
  };
}

/** 建一间 4 人房（1 房主 + 1 客人，其余 AI），双方都「已连接」 */
function setup(roomCode = 'TEST') {
  const room = new Room(roomCode, 4, 'normal', '房主');
  const join = room.join('小二');
  expect('seat' in join && join.seat).toBe(1);
  const s0 = fakeSocket();
  const s1 = fakeSocket();
  room.attach(0, s0.socket);
  room.attach(1, s1.socket);
  room.start();
  return { room, s0, s1 };
}

describe('联机房间：权威服务端 + 战争迷雾', () => {
  it('创建 / 加入 / 开局 并正确广播', () => {
    const { room, s0, s1 } = setup();
    const g = room.game!;
    expect(g.players.length).toBe(4);
    expect(g.players.filter((p) => p.type === 'HUMAN').length).toBe(2);
    // 开局广播
    expect(s0.sent.some((m) => m.t === 'start')).toBe(true);
    expect(s0.sent.some((m) => m.t === 'sync')).toBe(true);
    expect(s1.sent.some((m) => m.t === 'sync')).toBe(true);
    room.dispose();
  });

  it('战争迷雾：每个客户端只看到自己的手牌，他人只显示张数', () => {
    const { room, s0 } = setup();
    const g = room.game!;
    const v0 = projectView(g, 0) as unknown as ClientView;
    const v1 = projectView(g, 1) as unknown as ClientView;
    expect(v0.players[0].hand.length).toBe(g.players[0].hand.length);
    expect(v0.players[1].hand.length).toBe(0);
    expect(v0.players[1].handCount).toBe(g.players[1].hand.length);
    expect(v1.players[0].hand.length).toBe(0);
    expect(v1.players[1].hand.length).toBe(g.players[1].hand.length);
    expect(s0.sent.length).toBeGreaterThan(0);
    room.dispose();
  });

  it('暗标未揭示时，仅本人报价可见，他人报价被抹掉', () => {
    const { room } = setup();
    const g = room.game!;
    const hidden: AuctionState = {
      id: 'h1',
      type: 'HIDDEN',
      auctioneerId: 'p0',
      artworkIds: ['a1'],
      bids: { p0: 5, p1: 8, p2: 3 },
      currentHighestBid: 0,
      turnQueue: [],
      turnIndex: 0,
      submitted: ['p0', 'p1', 'p2'],
      revealed: false,
      status: 'running',
    };
    const masked = projectView({ ...g, currentAuction: hidden }, 0) as unknown as ClientView;
    expect(masked.currentAuction!.bids['p0']).toBe(5);
    expect(masked.currentAuction!.bids['p1']).toBeUndefined();
    expect(masked.currentAuction!.bids['p2']).toBeUndefined();
    room.dispose();
  });

  it('房主出牌动作被服务端接受、生效并广播给所有人', () => {
    const { room, s0, s1 } = setup();
    const g = room.game!;
    const card = g.players[0].hand[0];
    room.handleClientAction(0, { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card });
    const after = room.game!;
    const moved =
      after.currentAuction !== undefined ||
      after.phase !== 'PLAYER_TURN' ||
      after.currentPlayerIndex !== g.currentPlayerIndex;
    expect(moved).toBe(true);
    expect(s0.sent.filter((m) => m.t === 'sync').length).toBeGreaterThan(0);
    expect(s1.sent.filter((m) => m.t === 'sync').length).toBeGreaterThan(0);
    room.dispose();
  });

  it('不能替他人操作：伪造 playerId 会被拒绝', () => {
    const { room, s0 } = setup();
    const before = room.game!;
    room.handleClientAction(0, { type: 'PLAY_ARTWORK', playerId: 'p1', artworkId: before.players[0].hand[0] });
    const err = s0.sent.find((m) => m.t === 'error');
    expect(err && err.t === 'error').toBe(true);
    expect(room.game!.phase).toBe(before.phase); // 未生效
    room.dispose();
  });

  it('开局后允许人不在场时由 AI 接管（掉线转 AI，牌局不卡死）', () => {
    const { room } = setup();
    const g = room.game!;
    room.detach(1); // 客人掉线
    expect(g.players[1].type).toBe('AI');
    room.dispose();
  });
});
