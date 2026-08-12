import { WebSocket } from 'ws';

const URL = process.env.SMOKE_URL ?? 'ws://localhost:8787';

interface Msg {
  t: string;
  [k: string]: unknown;
}

function connect(url: string, tries = 25): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      const ws = new WebSocket(url);
      const fail = (e: unknown) => {
        ws.removeAllListeners();
        if (n <= 1) return reject(e);
        setTimeout(() => attempt(n - 1), 250);
      };
      ws.once('open', () => resolve(ws));
      ws.once('error', fail);
    };
    attempt(tries);
  });
}

function makeClient(name: string) {
  const log: Msg[] = [];
  const waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void; to: ReturnType<typeof setTimeout> }[] = [];
  const push = (m: Msg) => {
    log.push(m);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(m)) {
        const wt = waiters[i];
        waiters.splice(i, 1);
        clearTimeout(wt.to);
        wt.resolve(m);
      }
    }
  };
  const waitFor = (pred: (m: Msg) => boolean, ms = 5000): Promise<Msg> =>
    new Promise((resolve, reject) => {
      const hit = log.find(pred);
      if (hit) return resolve(hit);
      const to = setTimeout(() => {
        const idx = waiters.findIndex((w) => w.pred === pred);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(new Error(`${name}: timeout waiting for message`));
      }, ms);
      waiters.push({ pred, resolve, to });
    });
  (globalThis as Record<string, Msg[]>)[`__${name}`] = log;
  return {
    name,
    log,
    waitFor,
    open: (ws: WebSocket) => {
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as Msg;
        console.log(`  [${name}] recv`, m.t, m.t === 'sync' ? `(players=${(m.view as { players: unknown[] }).players?.length})` : '');
        push(m);
      });
    },
    send: (ws: WebSocket, m: Msg) => ws.send(JSON.stringify(m)),
  };
}

async function main() {
  const A = makeClient('A');
  const wsA = await connect(URL);
  A.open(wsA);
  (globalThis as Record<string, WebSocket>).__wsA = wsA;

  A.send(wsA, { t: 'create', playerCount: 3, aiLevel: 'easy', name: '房主' });
  const created = await A.waitFor((m) => m.t === 'created');
  console.log('[A] created code=%s seat=%s', created.code, created.seat);

  const B = makeClient('B');
  const wsB = await connect(URL);
  B.open(wsB);
  (globalThis as Record<string, WebSocket>).__wsB = wsB;
  B.send(wsB, { t: 'join', code: created.code, name: '客人' });
  const joined = await B.waitFor((m) => m.t === 'joined');
  console.log('[B] joined code=%s seat=%s', joined.code, joined.seat);

  A.send(wsA, { t: 'start' });
  console.log('[dbg] before A.start');
  await A.waitFor((m) => m.t === 'start');
  console.log('[dbg] A.start ok; before B.start');
  await B.waitFor((m) => m.t === 'start');
  console.log('[dbg] B.start ok; before A.sync');
  const syncA = await A.waitFor((m) => m.t === 'sync' && (m.view as { players: unknown[] }).players?.length === 3);
  console.log('[dbg] A.sync ok; before B.sync');
  const syncB = await B.waitFor((m) => m.t === 'sync' && (m.view as { players: unknown[] }).players?.length === 3);
  console.log('[A] both syncs received');
  const va = syncA.view as { players: { name: string; hand: unknown[]; type: string }[] };
  console.log('[A] view:', va.players.map((p) => `${p.name}(${p.type},手牌${p.hand.length})`).join(' | '));

  // 房主出一张手牌
  console.log('[A] reached play section; handLen=', va.players[0].hand.length, 'phase=', (syncA.view as { phase: string }).phase);
  const card = va.players[0].hand[0];
  const before = va.players[0].hand.length;
  console.log('[A] 准备出牌 card=%s before=%d', card, before);
  const actionMsg = { t: 'action', action: { type: 'PLAY_ARTWORK', playerId: 'p0', artworkId: card } };
  console.log('[A] action=', JSON.stringify(actionMsg));
  A.send(wsA, actionMsg);
  console.log('[A] 已发送 PLAY_ARTWORK');

  const afterA = await A.waitFor((m) => m.t === 'sync' && ((m.view as { players: { hand: unknown[] }[] }).players[0].hand.length < before));
  const afterB = await B.waitFor((m) => m.t === 'sync' && ((m.view as { players: { hand: unknown[] }[] }).players[0].hand.length === 0));
  console.log('[A] 出牌后自己手牌 %d→%d', before, (afterA.view as { players: { hand: unknown[] }[] }).players[0].hand.length);
  console.log('[B] 看到房主手牌是否隐藏(应为0):', (afterB.view as { players: { hand: unknown[] }[] }).players[0].hand.length);

  console.log('E2E OK');
  wsA.close();
  wsB.close();
  process.exitCode = 0;
}

main().catch((e) => {
  console.error('E2E FAIL:', e);
  console.error('  A 收到:', (globalThis as Record<string, Msg[]>).__A?.map((m) => m.t) ?? 'n/a');
  console.error('  B 收到:', (globalThis as Record<string, Msg[]>).__B?.map((m) => m.t) ?? 'n/a');
  (globalThis as Record<string, WebSocket>).__wsA?.close();
  (globalThis as Record<string, WebSocket>).__wsB?.close();
  process.exitCode = 1;
});
