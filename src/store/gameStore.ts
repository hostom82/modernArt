import { create } from 'zustand';
import type { GameAction } from '@/types/actions';
import type { AiLevel, GameState, Player } from '@/types/game';
import { reduce, startGame, validateAction } from '@/engine/rulesEngine';
import { activeAuctionType } from '@/engine/validate';
import { nextAiAction, thinkDelay } from '@/ai';
import { connectWs, sendWs, generateRoomCode } from '@/net/socket';
import type { RoomPlayerInfo, ServerMessage } from '@/shared/protocol';

/* ------------------------------------------------------------------ */
/* 计时器全部放在模块作用域：规则引擎与 AI 都是纯函数，不知道时间的存在      */
/* ------------------------------------------------------------------ */

let aiTimer: ReturnType<typeof setTimeout> | null = null;
let resultTimer: ReturnType<typeof setTimeout> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
/** 联机模式下的 WebSocket 连接（仅网络模式使用） */
let socket: WebSocket | null = null;

function clearTimers(): void {
  if (aiTimer) clearTimeout(aiTimer);
  if (resultTimer) clearTimeout(resultTimer);
  if (clockTimer) clearInterval(clockTimer);
  aiTimer = null;
  resultTimer = null;
  clockTimer = null;
}

const CLOCK_MS = 100;
const RESULT_DWELL_MS = 2400;

/* ------------------------------------------------------------------ */
/* 派生查询（单机模式用；网络模式由服务端投影后同样适用）                     */
/* ------------------------------------------------------------------ */

export function humanPlayers(game: GameState): Player[] {
  return game.players.filter((p) => p.type === 'HUMAN');
}

/** 公开竞价是否正在进行（含联合拍卖里跑公开竞价的情况） */
export function isOpenAuctionRunning(game: GameState): boolean {
  return activeAuctionType(game) === 'OPEN';
}

/** 暗标里还没提交的真人，按座位顺序 */
export function pendingHiddenHumans(game: GameState): Player[] {
  const auction = game.currentAuction;
  if (!auction || activeAuctionType(game) !== 'HIDDEN') return [];
  return game.players.filter((p) => p.type === 'HUMAN' && !auction.submitted.includes(p.id));
}

/** 当前该输入暗标的真人（mySeat 给定时只看本地玩家） */
export function currentHiddenHuman(game: GameState, mySeat?: number): Player | undefined {
  const list = pendingHiddenHumans(game);
  if (list.length === 0) return undefined;
  if (mySeat === undefined) return list[0];
  return list.find((p) => p.seatIndex === mySeat);
}

/** 需要「请把设备交给 XX」的交接屏：仅多人同屏（单机）时出现，联机每人只看自己手牌 */
export function needsHandoff(game: GameState, mySeat?: number): boolean {
  if (mySeat !== undefined) return false;
  return humanPlayers(game).length >= 2 && !!currentHiddenHuman(game);
}

/** 标记公开竞价局面的指纹：只要有人加价就会变，用来重置倒计时 */
function openAuctionKey(game: GameState): string {
  const a = game.currentAuction;
  if (!a) return '';
  return `${a.id}|${a.currentHighestBid}|${a.highestBidder ?? ''}`;
}

function handoffKey(game: GameState): string {
  const p = currentHiddenHuman(game);
  return p ? `${game.currentAuction?.id}|${p.id}` : '';
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export interface NewGameOptions {
  playerCount: number;
  humanCount: number;
  aiLevel: AiLevel;
  names?: string[];
  seed?: number;
}

export interface CreateRoomOptions {
  playerCount: number;
  aiLevel: AiLevel;
  name: string;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info' | 'success';
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface GameStore {
  game: GameState | null;
  /** 暂停后 AI 与倒计时都会停住（仅单机模式生效） */
  paused: boolean;
  /** 快进：AI 思考与结果停留时间缩短（仅单机模式生效） */
  fast: boolean;
  /** 公开竞价剩余毫秒 */
  countdownMs: number;
  /** 交接屏是否已被点开 */
  handoffAcked: boolean;
  toast?: Toast;
  /** 手牌里被选中的作品 */
  selectedArtworkId?: string;
  showRules: boolean;
  showLog: boolean;
  showTutorial: boolean;

  /** 联机相关 */
  mode: 'local' | 'network';
  connectionStatus: ConnectionStatus;
  roomCode?: string;
  mySeat?: number;
  hostSeat?: number;
  roomPlayers?: RoomPlayerInfo[];
  roomStarted: boolean;

  newGame: (opts: NewGameOptions) => void;
  restart: () => void;
  quitToMenu: () => void;
  dispatch: (action: GameAction) => void;
  setPaused: (v: boolean) => void;
  toggleFast: () => void;
  ackHandoff: () => void;
  selectArtwork: (id?: string) => void;
  pushToast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: () => void;
  setShowRules: (v: boolean) => void;
  setShowLog: (v: boolean) => void;
  setShowTutorial: (v: boolean) => void;

  createRoom: (opts: CreateRoomOptions) => void;
  joinRoom: (code: string, name: string) => void;
  startRoom: () => void;
  leaveRoom: () => void;
}

let toastSeq = 0;
let lastOpenKey = '';
let lastHandoffKey = '';

export const useGameStore = create<GameStore>()((set, get) => {
  /** 处理来自服务端的消息（联机模式） */
  function handleServer(msg: ServerMessage): void {
    switch (msg.t) {
      case 'created':
        set({ roomCode: msg.code, mySeat: msg.seat, connectionStatus: 'connected' });
        break;
      case 'joined':
        set({ roomCode: msg.code, mySeat: msg.seat, connectionStatus: 'connected' });
        break;
      case 'room':
        set({ roomPlayers: msg.players, hostSeat: msg.hostSeat, roomStarted: msg.started });
        break;
      case 'start':
        set({ roomStarted: true });
        break;
      case 'sync':
        set({ game: msg.view, countdownMs: msg.countdownMs, mySeat: msg.mySeat });
        break;
      case 'tick':
        set({ countdownMs: msg.countdownMs });
        break;
      case 'error':
        get().pushToast(msg.msg, 'error');
        break;
      case 'closed':
        set({
          connectionStatus: 'closed',
          game: null,
          roomCode: undefined,
          mySeat: undefined,
          roomPlayers: [],
          roomStarted: false,
          mode: 'local',
        });
        if (msg.msg) get().pushToast(msg.msg, 'info');
        break;
      default:
        break;
    }
  }

  /** 每次状态变化后重新安排 AI 与计时器（仅单机模式调用） */
  function schedule(): void {
    if (get().mode === 'network') return;
    clearTimers();
    const { game, paused } = get();
    if (!game || paused) return;
    if (
      game.phase === 'GAME_END' ||
      game.phase === 'ROUND_SCORING' ||
      game.phase === 'SELL_ARTWORK'
    ) {
      return; // 结算页等玩家自己点「继续」
    }

    const fast = get().fast;

    // 拍卖结果页：停留一小会儿再自动进入下一手
    if (game.phase === 'AUCTION_RESULT') {
      resultTimer = setTimeout(
        () => get().dispatch({ type: 'ACKNOWLEDGE_RESULT' }),
        fast ? 900 : RESULT_DWELL_MS,
      );
      return;
    }

    // 公开竞价倒计时
    if (isOpenAuctionRunning(game)) {
      clockTimer = setInterval(() => {
        const s = get();
        if (!s.game || s.paused) return;
        const left = s.countdownMs - CLOCK_MS;
        if (left <= 0) {
          set({ countdownMs: 0 });
          s.dispatch({ type: 'RESOLVE_OPEN_AUCTION' });
        } else {
          set({ countdownMs: left });
        }
      }, CLOCK_MS);
    }

    // AI 行动
    const next = nextAiAction(game);
    if (next) {
      const delay = Math.round(thinkDelay(game, next.playerId) * (fast ? 0.35 : 1));
      aiTimer = setTimeout(() => get().dispatch(next.action), delay);
    }
  }

  /** 应用一次状态迁移，并同步所有 UI 侧的派生状态（仅单机模式） */
  function commit(nextState: GameState): void {
    const prevPhase = get().game?.phase;

    // 公开竞价：局面指纹变了就重置倒计时
    let countdownMs = get().countdownMs;
    if (isOpenAuctionRunning(nextState)) {
      const key = openAuctionKey(nextState);
      if (key !== lastOpenKey) {
        lastOpenKey = key;
        countdownMs = nextState.settings.openAuctionSeconds * 1000;
      }
    } else {
      lastOpenKey = '';
      countdownMs = 0;
    }

    // 暗标：换人就重新盖上交接屏
    const hKey = handoffKey(nextState);
    let handoffAcked = get().handoffAcked;
    if (hKey !== lastHandoffKey) {
      lastHandoffKey = hKey;
      handoffAcked = false;
    }

    set({
      game: nextState,
      countdownMs,
      handoffAcked,
      selectedArtworkId: nextState.phase === prevPhase ? get().selectedArtworkId : undefined,
    });
    schedule();
  }

  return {
    game: null,
    paused: false,
    fast: false,
    countdownMs: 0,
    handoffAcked: false,
    showRules: false,
    showLog: false,
    showTutorial: false,

    mode: 'local',
    connectionStatus: 'idle',
    roomCode: undefined,
    mySeat: undefined,
    hostSeat: undefined,
    roomPlayers: undefined,
    roomStarted: false,

    newGame(opts) {
      if (socket) {
        socket.close();
        socket = null;
      }
      clearTimers();
      lastOpenKey = '';
      lastHandoffKey = '';
      const seed = opts.seed ?? Math.floor(Math.random() * 100000) + 1;
      const game = startGame({
        playerCount: opts.playerCount,
        humanCount: opts.humanCount,
        aiLevel: opts.aiLevel,
        names: opts.names,
        seed,
      });
      set({
        game,
        mode: 'local',
        paused: false,
        countdownMs: 0,
        handoffAcked: false,
        selectedArtworkId: undefined,
        roomCode: undefined,
        mySeat: undefined,
        roomPlayers: undefined,
        roomStarted: false,
        connectionStatus: 'idle',
      });
      schedule();
    },

    restart() {
      const { mode } = get();
      if (mode === 'network') {
        if (socket) sendWs(socket, { t: 'action', action: { type: 'RESTART' } });
        return;
      }
      const game = get().game;
      if (!game) return;
      clearTimers();
      lastOpenKey = '';
      lastHandoffKey = '';
      const next = reduce(game, { type: 'RESTART' });
      set({ game: next, paused: false, countdownMs: 0, handoffAcked: false, selectedArtworkId: undefined });
      schedule();
    },

    quitToMenu() {
      const { mode } = get();
      if (mode === 'network') {
        get().leaveRoom();
        return;
      }
      clearTimers();
      lastOpenKey = '';
      lastHandoffKey = '';
      set({ game: null, paused: false, countdownMs: 0, selectedArtworkId: undefined });
    },

    dispatch(action) {
      const { mode, game } = get();
      if (mode === 'network') {
        if (!game) return;
        const check = validateAction(game, action);
        if (!check.ok) {
          get().pushToast(check.reason ?? '这一步不符合规则', 'error');
          return;
        }
        if (socket) sendWs(socket, { t: 'action', action });
        return;
      }

      if (!game) return;
      const check = validateAction(game, action);
      if (!check.ok) {
        get().pushToast(check.reason ?? '这一步不符合规则', 'error');
        return;
      }
      const next = reduce(game, action);
      if (next === game) return;
      commit(next);
    },

    setPaused(v) {
      set({ paused: v });
      if (v) clearTimers();
      else schedule();
    },

    toggleFast() {
      set({ fast: !get().fast });
      schedule();
    },

    ackHandoff() {
      set({ handoffAcked: true });
    },

    selectArtwork(id) {
      set({ selectedArtworkId: id === get().selectedArtworkId ? undefined : id });
    },

    pushToast(text, kind = 'info') {
      toastSeq += 1;
      set({ toast: { id: toastSeq, text, kind } });
    },

    dismissToast() {
      set({ toast: undefined });
    },

    setShowRules(v) {
      set({ showRules: v });
    },
    setShowLog(v) {
      set({ showLog: v });
    },
    setShowTutorial(v) {
      set({ showTutorial: v });
    },

    createRoom(opts) {
      if (socket) socket.close();
      socket = null;
      const pk = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined)?.trim();
      const code = pk ? generateRoomCode() : undefined;
      set({
        mode: 'network',
        connectionStatus: 'connecting',
        roomCode: code,
        mySeat: undefined,
        hostSeat: 0,
        roomPlayers: [],
        roomStarted: false,
        game: null,
        toast: undefined,
        selectedArtworkId: undefined,
      });
      socket = connectWs(code, {
        onOpen: () => {
          if (socket) sendWs(socket, { t: 'create', playerCount: opts.playerCount, aiLevel: opts.aiLevel, name: opts.name });
        },
        onMessage: (m) => handleServer(m),
        onClose: () => {
          if (get().mode === 'network' && get().connectionStatus !== 'closed') {
            set({ connectionStatus: 'closed' });
          }
        },
        onError: () => set({ connectionStatus: 'error' }),
      });
    },

    joinRoom(code, name) {
      if (socket) socket.close();
      socket = null;
      const room = code.toUpperCase().trim();
      set({
        mode: 'network',
        connectionStatus: 'connecting',
        roomCode: room,
        mySeat: undefined,
        hostSeat: undefined,
        roomPlayers: [],
        roomStarted: false,
        game: null,
        toast: undefined,
        selectedArtworkId: undefined,
      });
      socket = connectWs(room, {
        onOpen: () => {
          if (socket) sendWs(socket, { t: 'join', code: room, name });
        },
        onMessage: (m) => handleServer(m),
        onClose: () => {
          if (get().mode === 'network' && get().connectionStatus !== 'closed') {
            set({ connectionStatus: 'closed' });
          }
        },
        onError: () => set({ connectionStatus: 'error' }),
      });
    },

    startRoom() {
      if (socket) sendWs(socket, { t: 'start' });
    },

    leaveRoom() {
      if (socket) {
        socket.close();
        socket = null;
      }
      clearTimers();
      set({
        mode: 'local',
        connectionStatus: 'idle',
        roomCode: undefined,
        mySeat: undefined,
        hostSeat: undefined,
        roomPlayers: undefined,
        roomStarted: false,
        game: null,
        selectedArtworkId: undefined,
        paused: false,
        countdownMs: 0,
        handoffAcked: false,
      });
    },
  };
});
