import type { GameState, LogEntry } from '@/types/game';

/** 往日志里追加一条记录（就地修改 draft，只在引擎内部使用） */
export function pushLog(
  state: GameState,
  kind: LogEntry['kind'],
  text: string,
  extra?: { playerId?: string; artistId?: LogEntry['artistId'] },
): void {
  state.logCounter += 1;
  state.log.push({
    id: state.logCounter,
    round: state.currentRound,
    kind,
    text,
    playerId: extra?.playerId,
    artistId: extra?.artistId,
  });
  // 日志上限，避免长局无限增长
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

/** 金额展示：内部整数 → €35k */
export function money(n: number): string {
  return `€${n}k`;
}
