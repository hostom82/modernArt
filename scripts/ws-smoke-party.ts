/* PartyKit 联机端到端冒烟：创建房间→加入→开局→出牌→双方同步（含战争迷雾） */
import { WebSocket } from 'ws';
import type { ServerMessage } from '../src/shared/protocol';

type Msg = ServerMessage;
const URL = 'ws://127.0.0.1:1999';
const CODE = `T${Date.now().toString(36).slice(-3).toUpperCase().padStart(3, 'X')}`;

interface Client {
  name: string;
  log: Msg[];
  waiters: ((m: Msg) => void)[];
  push: (m: Msg) => void;
  waitFor: (pred: (m: Msg) => boolean, ms?: number) => Promise<Msg>;
}

function makeClient(name: string): Client {
  const log: Msg[] = [];
  const waiters: ((m: Msg) => void)[] = [];
  const push = (m: Msg) => {
    log.push(m);
    // 只移除第一个命中谓词的等待者，避免消息乱序导致误删
    const idx = waiters.findIndex((w) => w(m));
    if (idx >= 0) {
      const [w] = waiters.splice(idx, 1);
      w(m);
    }
  };
  const waitFor = (pred: (m: Msg) => boolean, ms = 8000): Promise<Msg> =>
    new Promise((resolve, reject) => {
      const hit = log.find(pred);
      if (hit) return resolve(hit);
      let done = false;
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`${name}: timeout waiting for message`));
      }, ms);
      waiters.push((m) => {
        if (done) return;
        if (pred(m)) {
          done = true;
          clearTimeout(to);
          resolve(m);
        }
      });
    });
  return { name, log, waiters, push, waitFor };
}

function connect(c: Client): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${URL}/parties/main/${CODE}`);
    ws.on('open', () => resolve(ws));
    ws.on('message', (d) => c.push(JSON.parse(d.toString()) as Msg));
    ws.on('error', reject);
  });
}

function send(ws: WebSocket, msg: unknown) {
  ws.send(JSON.stringify(msg));
}

async function main() {
  const A = makeClient('A');
  const B = makeClient('B');

  const wsA = await connect(A);
  const wsB = await connect(B);

  // 房主创建（玩家数 4：2 真人 + 2 AI）
  wsA.on('open', () => {});
  A.waitFor((m) => m.t === 'joined').then(() => {});
  send(wsA, { t: 'create', playerCount: 4, aiLevel: 'normal', name: 'A' });
  const jA = await A.waitFor((m) => m.t === 'joined');
  console.log('[A] joined seat=%d code=%s', (jA as any).seat, (jA as any).code);

  // 加入方
  send(wsB, { t: 'join', code: CODE, name: 'B' });
  const jB = await B.waitFor((m) => m.t === 'joined');
  console.log('[B] joined seat=%d', (jB as any).seat);

  // 房主开局
  send(wsA, { t: 'start' });
  await A.waitFor((m) => m.t === 'start');
  await B.waitFor((m) => m.t === 'start');
  const syncA = await A.waitFor((m) => m.t === 'sync' && (m as any).view?.players?.length === 4);
  const syncB = await B.waitFor((m) => m.t === 'sync' && (m as any).view?.players?.length === 4);
  console.log('[A/B] both got full sync (4 players)');

  const va = (syncA as any).view as any;
  const vb = (syncB as any).view as any;

  console.log('[DEBUG] phase=%s currentPlayer=%d', va.phase, va.currentPlayerIndex);
  va.players.forEach((p: any, i: number) => {
    console.log('  player[%d] name=%s type=%s hand=%d handCount=%d', i, p.name, p.type, p.hand.length, p.handCount);
  });

  // 战争迷雾：A 看到自己手牌，他人手牌折叠为 0 但 handCount 与真人一致
  const aOwn = va.players[0].hand.length;
  const bAsSeenByA = va.players[1];
  const cAsSeenByA = va.players[3];
  console.log('[A] own hand=%d; B hand(seen)=%d handCount=%d; C hand(seen)=%d handCount=%d',
    aOwn, bAsSeenByA.hand.length, bAsSeenByA.handCount, cAsSeenByA.hand.length, cAsSeenByA.handCount);
  console.log('[DEBUG] first card shape:', JSON.stringify(va.players[0].hand[0])?.slice(0, 120));
  if (aOwn < 1) console.warn('WARN: A own hand empty');
  if (bAsSeenByA.hand.length !== 0 || bAsSeenByA.handCount !== aOwn) console.warn('WARN: fog broken for B');
  if (cAsSeenByA.hand.length !== 0 || cAsSeenByA.handCount !== aOwn) console.warn('WARN: fog broken for C');

  // A 出一张手牌
  const firstCard = va.players[0].hand[0];
  const card = typeof firstCard === 'string' ? firstCard : (firstCard as any)?.id;
  const before = va.players[0].hand.length;
  console.log('[A] playing card %s (before=%d)', card, before);
  send(wsA, { t: 'action', action: { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card } });

  const afterA = await A.waitFor((m) => m.t === 'sync' && (m as any).view.players[0].hand.length < before);
  const afterB = await B.waitFor((m) => m.t === 'sync' && (m as any).view.players[0].hand.length === 0 && (m as any).view.players[0].handCount === before);
  const na = (afterA as any).view;
  const nb = (afterB as any).view;
  console.log('[A] hand after=%d; [B] sees A hand=%d handCount=%d',
    na.players[0].hand.length, nb.players[0].hand.length, nb.players[0].handCount);
  if (na.players[0].hand.length !== before - 1) throw new Error('A hand did not shrink');
  if (nb.players[0].hand.length !== 0 || nb.players[0].handCount !== before) throw new Error('B fog broken after play');

  console.log('E2E OK (PartyKit)');
  wsA.close();
  wsB.close();
}

main().catch((e) => {
  console.error('E2E FAIL:', e.message);
  process.exitCode = 1;
});
