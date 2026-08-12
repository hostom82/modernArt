import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room';
import type { ClientMessage, ServerMessage } from '@/shared/protocol';

const PORT = Number(process.env.PORT ?? 8787);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(HERE, '..', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const rooms = new Map<string, Room>();

function genCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let filePath = join(DIST, normalize(urlPath));
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) filePath = join(DIST, 'index.html'); // SPA 回退
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const httpServer = createServer((req, res) => {
  void serveStatic(req, res);
});
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let seat = -1;

    ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }

    if (msg.t === 'create') {
      if (room) return;
      const code = genCode();
      const pc = Math.max(3, Math.min(5, (msg.playerCount | 0) || 4));
      room = new Room(code, pc, msg.aiLevel, msg.name?.trim() || '房主');
      rooms.set(code, room);
      seat = 0;
      room.attach(seat, ws);
      ws.send(JSON.stringify({ t: 'created', code, seat } satisfies ServerMessage));
      room.broadcastRoom();
      return;
    }

    if (msg.t === 'join') {
      if (room) return;
      const code = (msg.code ?? '').toUpperCase().trim();
      const target = rooms.get(code);
      if (!target) {
        ws.send(JSON.stringify({ t: 'error', msg: '房间不存在' } satisfies ServerMessage));
        return;
      }
      const r = target.join(msg.name?.trim() || '玩家');
      if ('error' in r) {
        ws.send(JSON.stringify({ t: 'error', msg: r.error } satisfies ServerMessage));
        return;
      }
      room = target;
      seat = r.seat;
      room.attach(seat, ws);
      ws.send(JSON.stringify({ t: 'joined', code, seat } satisfies ServerMessage));
      room.broadcastRoom();
      return;
    }

    if (!room) return;

    if (msg.t === 'start') {
      if (seat === room.hostSeat) room.start();
      return;
    }
    if (msg.t === 'action') {
      if (seat >= 0) room.handleClientAction(seat, msg.action);
      return;
    }
    // 'ping' 等忽略
  });

  ws.on('close', () => {
    if (room && seat >= 0) room.detach(seat);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[modern-art] 联机服务已启动 :${PORT}（WebSocket + 静态资源 dist）`);
});
