import type { AiLevel, GameState, Player } from '@/types/game';
import type { GameAction } from '@/types/actions';

/** 投影后的玩家：手牌对其他人隐藏，仅保留 handCount；现金对其他人隐藏 */
export interface ClientPlayer extends Player {
  handCount: number;
  /** 联机模式下，非本人的现金被隐藏（数据不下发，仅留占位标记） */
  cashHidden?: boolean;
}

/** 客户端看到的局面：战争迷雾已 applied（他人手牌清空、暗标未揭示时只留本人报价） */
export type ClientView = Omit<GameState, 'players'> & { players: ClientPlayer[] };

/** 大厅里的席位信息（对局开始前） */
export interface RoomPlayerInfo {
  seat: number;
  name: string;
  isHost: boolean;
  connected: boolean;
}

/* ----------------------------- 客户端 → 服务端 ----------------------------- */
export type ClientMessage =
  | { t: 'create'; playerCount: number; aiLevel: AiLevel; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'start' }
  | { t: 'action'; action: GameAction }
  | { t: 'ping' };

/* ----------------------------- 服务端 → 客户端 ----------------------------- */
export type ServerMessage =
  | { t: 'created'; code: string; seat: number }
  | { t: 'joined'; code: string; seat: number }
  | { t: 'room'; players: RoomPlayerInfo[]; hostSeat: number; started: boolean }
  | { t: 'start' }
  | { t: 'sync'; view: ClientView; mySeat: number; countdownMs: number }
  | { t: 'tick'; countdownMs: number }
  | { t: 'error'; msg: string }
  | { t: 'closed'; msg?: string };
