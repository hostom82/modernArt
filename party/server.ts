import type * as Party from 'partykit/server';
import type { AiLevel, GameState } from '@/types/game';
import type { GameAction } from '@/types/actions';
import { reduce, startGame, validateAction } from '@/engine/rulesEngine';
import { activeAuctionType } from '@/engine/validate';
import { nextAiAction, thinkDelay } from '@/ai';
import { projectView } from '../server/view';
import type { ClientMessage, RoomPlayerInfo, ServerMessage } from '@/shared/protocol';

/**
 * PartyKit 上的权威服务端（跑在 Cloudflare Durable Object 里）。
 * 逻辑与 server/room.ts 同源：跑引擎 + AI + 公开竞价倒计时，并按座位做战争迷雾。
 * 复用全部纯函数模块（engine / ai / view / protocol），不依赖任何 Node 专属 API。
 *
 * 与 Node 版的区别：
 *  - 房间号 = PartyKit 的 room.id（即 URL 路径 /parties/main/<code>），客户端连接即确定房间
 *  - 座位在 onConnect 时由服务端按连接分配，动作安全归属到该座位
 *  - 状态持久化到 room.storage，冷启动（DO 被回收）后可恢复
 */

const CLOCK_MS = 100;
const RESULT_DWELL_MS = 2400;

interface Seat {
  seat: number;
  name: string;
  isHost: boolean;
  connected: boolean;
  connId: string | null;
  type: 'HUMAN' | 'AI';
}

interface Persist {
  game: GameState;
  seats: (Seat | null)[];
  playerCount: number;
  aiLevel: AiLevel;
  hostSeat: number;
  openDeadline: number;
  lastOpenKey: string;
}

export default class GameServer implements Party.Server {
  private seats: (Seat | null)[] = [];
  private playerCount = 5;
  private aiLevel: AiLevel = 'normal';
  private hostSeat = 0;
  private game: GameState | null = null;

  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private openDeadline = 0;
  private lastOpenKey = '';

  constructor(readonly room: Party.Room) {}

  /* ----------------------------- 连接生命周期 ----------------------------- */

  async onConnect(conn: Party.Connection): Promise<void> {
    // 对局进行中或房间已满：拒绝新连接（暂不支持中途加入 / 重连）
    if (this.game || this.connectedCount() >= this.playerCount) {
      conn.send(
        JSON.stringify(
          ({ t: 'error', msg: this.game ? '对局已开始，暂不支持中途加入' : '房间已满' }) satisfies ServerMessage,
        ),
      );
      conn.close();
      return;
    }

    const seat = this.allocSeat(conn.id);
    conn.send(JSON.stringify(({ t: 'joined', code: this.room.id, seat }) satisfies ServerMessage));
    this.broadcastRoom();

    // 冷启动恢复：DO 被回收后首次连接时把局面从存储里读回来
    if (!this.game) {
      const saved = await this.room.storage.get<Persist>('state');
      if (saved) {
        this.restore(saved);
        this.broadcastSync();
        this.pump();
      }
    }
  }

  async onMessage(raw: string | ArrayBuffer | ArrayBufferView, conn: Party.Connection): Promise<void> {
    let msg: ClientMessage;
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      msg = JSON.parse(text) as ClientMessage;
    } catch {
      return;
    }

    const seat = this.seatOf(conn.id);
    if (seat < 0) return;
    const s = this.seats[seat];
    if (!s) return;

    switch (msg.t) {
      case 'create':
        this.playerCount = msg.playerCount;
        this.aiLevel = msg.aiLevel;
        s.name = msg.name;
        this.broadcastRoom();
        break;
      case 'join':
        s.name = msg.name;
        this.broadcastRoom();
        break;
      case 'start':
        if (seat === this.hostSeat && !this.game) this.start();
        break;
      case 'action':
        this.handleClientAction(seat, msg.action);
        break;
      case 'ping':
        conn.send(
          JSON.stringify(({ t: 'tick', countdownMs: this.countdownNow() }) satisfies ServerMessage),
        );
        break;
      default:
        break;
    }
  }

  async onClose(conn: Party.Connection): Promise<void> {
    const seat = this.seatOf(conn.id);
    if (seat < 0) return;
    const s = this.seats[seat];
    if (!s) return;

    if (!this.game) {
      // 大厅阶段：释放座位，必要时转移房主；全员离开则清空存储
      this.seats[seat] = null;
      if (s.isHost) {
        const next = this.connectedSeats()[0];
        if (next !== undefined) this.seats[next]!.isHost = true;
      }
      this.broadcastRoom();
      if (this.connectedCount() === 0) await this.room.storage.delete('state');
    } else {
      // 对局中掉线：该座位转交 AI 接管，避免牌局卡死
      s.connected = false;
      s.connId = null;
      const p = this.game.players[seat];
      if (p) p.type = 'AI';
      this.broadcastSync();
      this.pump();
    }
  }

  /* ----------------------------- 座位管理 ----------------------------- */

  private allocSeat(connId: string): number {
    for (let i = 0; i < this.playerCount; i++) {
      if (!this.seats[i]) {
        const isHost = i === 0 && this.connectedSeats().length === 0;
        this.seats[i] = {
          seat: i,
          name: `玩家${i + 1}`,
          isHost,
          connected: true,
          connId,
          type: 'HUMAN',
        };
        if (isHost) this.hostSeat = i;
        return i;
      }
    }
    return -1;
  }

  private seatOf(connId: string): number {
    return this.seats.findIndex((s) => s && s.connId === connId);
  }

  private connectedSeats(): number[] {
    const out: number[] = [];
    this.seats.forEach((s, i) => {
      if (s && s.connected) out.push(i);
    });
    return out;
  }

  private connectedCount(): number {
    return this.connectedSeats().length;
  }

  /* ----------------------------- 对局流程 ----------------------------- */

  private start(): void {
    if (this.game) return;
    const humans = this.connectedSeats();
    if (humans.length < 1) return;
    const names = this.seats.map((s) => s?.name).filter((n): n is string => !!n);
    const seed = Math.floor(Math.random() * 1_000_000) + 1;
    this.game = startGame({
      playerCount: this.playerCount,
      humanCount: humans.length,
      aiLevel: this.aiLevel,
      names,
      seed,
    });
    this.broadcast({ t: 'start' });
    this.broadcastSync();
    this.persist();
    this.pump();
  }

  private handleClientAction(seat: number, action: GameAction): void {
    if (!this.game) return;
    // 动作归属到本连接座位（忽略客户端自报的 playerId，防作弊）
    const owned: GameAction =
      'playerId' in action ? { ...action, playerId: `p${seat}` } : action;
    const check = validateAction(this.game, owned);
    if (!check.ok) {
      this.send(seat, { t: 'error', msg: check.reason ?? '这一步不符合规则' });
      return;
    }
    this.apply(owned);
  }

  private apply(action: GameAction): void {
    if (!this.game) return;
    const next = reduce(this.game, action);
    if (next === this.game) return;
    this.game = next;
    this.broadcastSync();
    this.persist();
    this.pump();
  }

  /** 每次状态变化后重排 AI 与公开竞价倒计时 */
  private pump(): void {
    this.clearTimers();
    const g = this.game;
    if (!g) return;
    if (g.phase === 'GAME_END') return;
    if (g.phase === 'ROUND_SCORING' || g.phase === 'SELL_ARTWORK') return; // 等真人点「继续」

    if (g.phase === 'AUCTION_RESULT') {
      this.resultTimer = setTimeout(
        () => this.apply({ type: 'ACKNOWLEDGE_RESULT' }),
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
      this.aiTimer = setTimeout(() => this.apply(next.action), delay);
    }
  }

  private startClock(): void {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      const left = this.openDeadline - Date.now();
      if (left <= 0) {
        this.stopClock();
        this.apply({ type: 'RESOLVE_OPEN_AUCTION' });
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

  private countdownNow(): number {
    if (!this.game || activeAuctionType(this.game) !== 'OPEN') return 0;
    return Math.max(0, Math.round(this.openDeadline - Date.now()));
  }

  /* ----------------------------- 消息收发 ----------------------------- */

  private roomInfo(): RoomPlayerInfo[] {
    return this.seats.map((s, i) =>
      s
        ? { seat: i, name: s.name, isHost: s.isHost, connected: s.connected }
        : { seat: i, name: `AI 席位 ${i + 1}`, isHost: false, connected: false },
    );
  }

  private broadcastRoom(): void {
    this.broadcast({
      t: 'room',
      players: this.roomInfo(),
      hostSeat: this.hostSeat,
      started: !!this.game,
    });
  }

  private broadcastSync(): void {
    if (!this.game) return;
    this.seats.forEach((s, i) => {
      if (s && s.connected && s.connId) {
        const c = this.room.getConnection(s.connId);
        c?.send(
          JSON.stringify(
            ({
              t: 'sync',
              view: projectView(this.game!, i),
              mySeat: i,
              countdownMs: this.countdownNow(),
            }) satisfies ServerMessage,
          ),
        );
      }
    });
  }

  private broadcast(msg: ServerMessage): void {
    this.room.broadcast(JSON.stringify(msg));
  }

  private send(seat: number, msg: ServerMessage): void {
    const s = this.seats[seat];
    if (s && s.connId) this.room.getConnection(s.connId)?.send(JSON.stringify(msg));
  }

  /* ----------------------------- 持久化 ----------------------------- */

  private persist(): void {
    if (!this.game) return;
    void this.room.storage.put('state', {
      game: this.game,
      seats: this.seats,
      playerCount: this.playerCount,
      aiLevel: this.aiLevel,
      hostSeat: this.hostSeat,
      openDeadline: this.openDeadline,
      lastOpenKey: this.lastOpenKey,
    } satisfies Persist);
  }

  private restore(d: Persist): void {
    this.game = d.game;
    this.seats = d.seats;
    this.playerCount = d.playerCount;
    this.aiLevel = d.aiLevel;
    this.hostSeat = d.hostSeat;
    this.openDeadline = d.openDeadline;
    this.lastOpenKey = d.lastOpenKey;
  }
}
