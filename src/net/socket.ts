import type { ClientMessage, ServerMessage } from '@/shared/protocol';
import { WebSocket as PartyWebSocket } from 'partysocket';

interface NetHandlers {
  onOpen?: () => void;
  onMessage: (msg: ServerMessage) => void;
  onClose?: () => void;
  onError?: (e?: Event) => void;
}

/**
 * PartyKit 部署主机（如 modern-art.user.partykit.dev）。
 * 设置后客户端走 PartyKit：wss://<host>/parties/main/<room>。
 * 房间号 = PartyKit 的 room id，因此「创建房间」时由客户端自行生成 4 位房间号并写入 URL。
 */
const PARTYKIT_HOST = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined)?.trim();

function resolveWsUrl(room?: string): string {
  if (PARTYKIT_HOST) {
    const raw = PARTYKIT_HOST.replace(/^https?:\/\//, '');
    const proto = PARTYKIT_HOST.startsWith('http://') ? 'ws' : 'wss';
    const base = `${proto}://${raw}`;
    return room ? `${base}/parties/main/${room}` : `${base}/parties/main/__lobby__`;
  }
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) return `${proto}//${location.hostname}:8787`;
  return `${proto}//${location.host}`;
}

/**
 * 建立联机连接。
 * @param room  PartyKit 模式下为房间号（写入 URL）；Node 服务端模式可省略（房间号由服务端分配）
 */
export function connectWs(room: string | undefined, handlers: NetHandlers): WebSocket {
  const url = resolveWsUrl(room);
  // PartyKit 模式下用 partysocket 的 WebSocket（自带断线重连），其余用浏览器原生 WebSocket
  const ws: WebSocket = PARTYKIT_HOST
    ? (new PartyWebSocket(url) as unknown as WebSocket)
    : new WebSocket(url);

  ws.onopen = () => handlers.onOpen?.();
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse((ev as MessageEvent).data as string) as ServerMessage;
      handlers.onMessage(msg);
    } catch {
      /* 忽略无法解析的消息 */
    }
  };
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = (e) => handlers.onError?.(e as Event);
  return ws;
}

export function sendWs(ws: WebSocket | null, msg: ClientMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

/** 生成 4 位房间号（PartyKit 模式下由创建者本地生成并写入连接 URL） */
export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
