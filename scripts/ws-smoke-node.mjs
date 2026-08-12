import { WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const URL = `ws://localhost:${PORT}`;
const log = (...a) => console.log('[node-smoke]', ...a);

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
function nextMsg(ws, pred, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => {
      ws.off('message', h);
      reject(new Error('timeout waiting for message'));
    }, timeout);
    const h = (raw) => {
      const m = JSON.parse(raw.toString());
      if (!pred || pred(m)) {
        clearTimeout(to);
        ws.off('message', h);
        resolve(m);
      }
    };
    ws.on('message', h);
  });
}
const send = (ws, msg) => ws.send(JSON.stringify(msg));

(async () => {
  const a = await open();
  log('A 已连接');
  send(a, { t: 'create', playerCount: 4, aiLevel: 'normal', name: '房主' });
  const created = await nextMsg(a, (m) => m.t === 'created');
  const code = created.code;
  log('创建房间 code=', code, 'seat=', created.seat);

  const b = await open();
  log('B 已连接');
  send(b, { t: 'join', code, name: '玩家2' });
  const joined = await nextMsg(b, (m) => m.t === 'joined');
  log('B 加入 seat=', joined.seat);

  send(a, { t: 'start' });
  const syncA = await nextMsg(a, (m) => m.t === 'sync');
  const syncB = await nextMsg(b, (m) => m.t === 'sync');
  log('A/B 均收到 sync，玩家数=', syncA.view.players.length);

  const errs = [];
  if (syncA.view.players.length !== 4) errs.push('playerCount 不是 4');
  const myHandA = syncA.view.players[syncA.mySeat].hand;
  if (!Array.isArray(myHandA) || myHandA.length !== 9) errs.push('A 自己手牌不是 9 张');

  const aAsSeenByB = syncB.view.players[created.seat];
  if (aAsSeenByB.hand.length !== 0) errs.push('战争迷雾失效：B 看到了 A 的手牌');
  if (aAsSeenByB.handCount !== 9) errs.push('handCount 不是 9');
  const myHandB = syncB.view.players[syncB.mySeat].hand;
  if (myHandB.length !== 9) errs.push('B 自己手牌不是 9 张');

  if (errs.length) {
    console.error('NODE-SMOKE FAIL:', errs);
    process.exit(1);
  }
  console.log('NODE-SMOKE OK：create/join/start/sync + 战争迷雾 全部通过');
  a.close();
  b.close();
  process.exit(0);
})().catch((e) => {
  console.error('NODE-SMOKE ERROR', e);
  process.exit(1);
});
