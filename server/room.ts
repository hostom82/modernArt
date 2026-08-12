import type { AiLevel, GameState } from '@/types/game';
import type { GameAction } from '@/types/actions';
import { reduce, startGame, validateAction } from '@/engine/rulesEngine';
import { activeAuctionType } from '@/engine/validate';
import { nextAiAction, thinkDelay } from '@/ai';
import { projectView } from './view';
import type { RoomPlayerInfo, ServerMessage } from '@/shared/protocol';

/** 服务端只依赖 socket 的最小接口，避免直接耦合 ws 类型 */
export interface SocketLike {
  send(data: string): void;
  close(): void;
}

const CLOCK_MS = 100;
const RESULT_DWELL_MS = 2400;

interface Seat {
  seat: number;
  name: string;
  isHost: boolean;
  connected: boolean;
  socket: SocketLike | null;
}

/**
 * 一个联机房间 = 权威的游戏状态 + 驱动的 AI / 倒计时 + 广播。
 * 所有规则判定仍走引擎的 validateAction / reduce，服务端只负责：
 *  1. 校验「这个动作确实来自它声称的座位」
 *  2. 跑 AI 与公开竞价倒计时
 *  3. 给每位玩家发各自的战争迷雾投影
 */
export class Room {
  readonly code: string;
  readonly playerCount: number;
  readonly aiLevel: AiLevel;
  hostSeat = 0;
  game: GameState | null = null;
  closed = false;

  private seats: (Seat | null)[];
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private openDeadline = 0;
  private lastOpenKey = '';

  constructor(code: string, playerCount: number, aiLevel: AiLevel, hostName: string) {
    this.code = code;
    this.playerCount = playerCount;
    this.aiLevel = aiLevel;
    this.seats = new Array(playerCount).fill(null);
    this.seats[0] = { seat: 0, name: hostName, isHost: true, connected: false, socket: null };
  }

  private get connectedHumanSeats(): number[] {
    const out: number[] = [];
    this.seats.forEach((s, i) => {
      if (s && s.connected) out.push(i);
    });
    return out;
  }

  private freeSeat(): number {
    for (let i = 0; i < this.playerCount; i++) if (!this.seats[i]) return i;
    return -1;
  }

  /** 大厅阶段加入：分配座位或返回错误 */
  join(name: string): { seat: number } | { error: string } {
    if (this.game) return { error: '游戏已经开始，无法加入' };
    const seat = this.freeSeat();
    if (seat < 0) return { error: '房间已满（最多 5 人）' };
    this.seats[seat] = { seat, name, isHost: false, connected: false, socket: null };
    return { seat };
  }

  attach(seat: number, socket: SocketLike): void {
    const s = this.seats[seat];
    if (!s) return;
    s.connected = true;
    s.socket = socket;
  }

  detach(seat: number): void {
    const s = this.seats[seat];
    if (!s) return;
    s.connected = false;
    s.socket = null;

    // 大厅阶段：转移房主 / 无人则关房
    if (!this.game) {
      if (s.isHost) {
        const next = this.connectedHumanSeats[0];
        if (next !== undefined) this.seats[next]!.isHost = true;
      }
      this.broadcastRoom();
      if (this.connectedHumanSeats.length === 0) this.closeRoom();
      return;
    }

    // 对局中掉线：该座位转交 AI 接管，避免牌局卡死
    const p = this.game.players[seat];
    if (p) p.type = 'AI';
    this.broadcastSync();
  }

  /** 房主开局 */
  start(): void {
    if (this.game) return;
    if (this.connectedHumanSeats.length < 1) return;
    const names = this.seats.map((s) => s?.name).filter((n): n is string => !!n);
    const humanCount = this.connectedHumanSeats.length;
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    this.game = startGame({
      playerCount: this.playerCount,
      humanCount,
      aiLevel: this.aiLevel,
      names,
      seed,
    });
    this.broadcast({ t: 'start' });
    this.broadcastSync();
    this.pump();
  }

  /** 收到客户端动作：先校验座位归属，再应用 */
  handleClientAction(seat: number, action: GameAction): void {
    if (!this.game) return;
    if ('playerId' in action && action.playerId) {
      if (action.playerId !== `p${seat}`) {
        this.send(seat, { t: 'error', msg: '你不能替其他玩家操作' });
        return;
      }
    } else if (
      action.type !== 'RESTART' &&
      action.type !== 'CONTINUE' &&
      action.type !== 'ACKNOWLEDGE_RESULT'
    ) {
      this.send(seat, { t: 'error', msg: '无效的操作' });
      return;
    }
    this.apply(action, true, seat);
  }

  /* ----------------------------- 内部驱动 ----------------------------- */

  private apply(action: GameAction, fromClient: boolean, seat?: number): void {
    if (!this.game) return;
    const check = validateAction(this.game, action);
    if (!check.ok) {
      if (fromClient && seat !== undefined) {
        this.send(seat, { t: 'error', msg: check.reason ?? '这一步不符合规则' });
      }
      return;
    }
    const next = reduce(this.game, action);
    if (next === this.game) return;
    this.game = next;
    this.broadcastSync();
    this.pump();
  }

  /** 每次状态变化后重新安排 AI 与公开竞价倒计时 */
  private pump(): void {
    this.clearTimers();
    const g = this.game;
    if (!g) return;
    if (g.phase === 'GAME_END') return;
    if (g.phase === 'ROUND_SCORING' || g.phase === 'SELL_ARTWORK') return; // 等真人点「继续」

    if (g.phase === 'AUCTION_RESULT') {
      this.resultTimer = setTimeout(
        () => this.apply({ type: 'ACKNOWLEDGE_RESULT' }, false),
        RESULT_DWELL_MS,
      );
      return;
    }

    const type = activeAuctionType(g);
    if (type === 'OPEN') {
      const a = g.currentAuction!;
      const key = `${a.id}|${a.currentHighestBid}|${a.highestBidder ?? ''}`;
      if (key !== this.lastOpenKey) {
        this.lastOpenKey = key;
        this.openDeadline = Date.now() + g.settings.openAuctionSeconds * 1000;
      }
      this.startClock();
    } else {
      this.lastOpenKey = '';
    }

    const next = nextAiAction(g);
    if (next) {
      const delay = thinkDelay(g, next.playerId);
      this.aiTimer = setTimeout(() => this.apply(next.action, false), delay);
    }
  }

  private startClock(): void {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      const left = this.openDeadline - Date.now();
      if (left <= 0) {
        this.stopClock();
        this.apply({ type: 'RESOLVE_OPEN_AUCTION' }, false);
      } else {
        this.broadcast({ t: 'tick', countdownMs: Math.max(0, Math.round(left)) });
      }
    }, CLOCK_MS);
  }

  private stopClock(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    this.stopClock();
  }

  /** 释放所有计时器（房间销毁 / 测试收尾用） */
  dispose(): void {
    this.clearTimers();
  }

  private countdownNow(): number {
    if (!this.game || activeAuctionType(this.game) !== 'OPEN') return 0;
    return Math.max(0, Math.round(this.openDeadline - Date.now()));
  }

  private roomInfo(): RoomPlayerInfo[] {
    return this.seats.map((s, i) =>
      s
        ? { seat: i, name: s.name, isHost: s.isHost, connected: s.connected }
        : { seat: i, name: `AI 席位 ${i + 1}`, isHost: false, connected: false },
    );
  }

  /** 大厅状态广播（对局开始前） */
  broadcastRoom(): void {
    this.broadcast({ t: 'room', players: this.roomInfo(), hostSeat: this.hostSeat, started: !!this.game });
  }

  private broadcastSync(): void {
    if (!this.game) return;
    this.seats.forEach((s, i) => {
      if (s && s.connected && s.socket) {
        s.socket.send(
          JSON.stringify({
            t: 'sync',
            view: projectView(this.game!, i),
            mySeat: i,
            countdownMs: this.countdownNow(),
          }),
        );
      }
    });
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    this.seats.forEach((s) => {
      if (s && s.connected && s.socket) s.socket.send(data);
    });
  }

  private send(seat: number, msg: ServerMessage): void {
    const s = this.seats[seat];
    if (s && s.socket) s.socket.send(JSON.stringify(msg));
  }

  private closeRoom(): void {
    this.closed = true;
    this.clearTimers();
    this.broadcast({ t: 'closed', msg: '房间已关闭' });
  }
}
