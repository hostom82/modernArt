import { useGameStore } from '@/store/gameStore';
import { cx } from '@/utils/format';

/** 联机大厅：等待其他玩家加入，房主可开局 */
export function Lobby() {
  const roomCode = useGameStore((s) => s.roomCode);
  const roomPlayers = useGameStore((s) => s.roomPlayers);
  const hostSeat = useGameStore((s) => s.hostSeat);
  const mySeat = useGameStore((s) => s.mySeat);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const startRoom = useGameStore((s) => s.startRoom);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  const players = roomPlayers ?? [];
  const isHost = mySeat !== undefined && mySeat === hostSeat;
  const humanCount = players.filter((p) => !p.name.startsWith('AI 席位')).length;

  return (
    <div className="scroll-soft min-h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
        <header className="mb-7 text-center animate-fadeUp">
          <h1 className="brush-title text-3xl font-bold text-cream">联机大厅</h1>
          <p className="mt-2 text-sm text-muted">
            把房间号告诉朋友，人齐后由房主开局。
          </p>
        </header>

        <div className="panel mx-auto w-full max-w-lg p-5 animate-fadeUp">
          {/* 房间号 */}
          <div className="mb-4 flex items-center justify-between rounded-lg border border-line/60 bg-ink/50 px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted">房间号</span>
            <span className="select-all font-mono text-2xl font-bold tracking-[0.3em] text-gold">
              {roomCode}
            </span>
          </div>

          {/* 玩家列表 */}
          <div className="mb-4 space-y-2">
            {players.map((p) => {
              const isAi = p.name.startsWith('AI 席位');
              return (
                <div
                  key={p.seat}
                  className={cx(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5',
                    isAi ? 'border-line/40 bg-ink/30' : 'border-line/60 bg-ink/50',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink',
                      isAi ? 'bg-slate2 text-muted' : 'bg-gold',
                    )}
                  >
                    {p.seat + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-cream">
                    {isAi ? 'AI 席位（自动补满）' : p.name}
                    {p.seat === mySeat && (
                      <span className="ml-1.5 text-[10px] text-gold">（你）</span>
                    )}
                  </span>
                  {p.isHost && (
                    <span className="rounded bg-gold/20 px-1.5 py-px text-[9px] font-semibold text-gold">
                      房主
                    </span>
                  )}
                  <span
                    className={cx(
                      'h-2 w-2 shrink-0 rounded-full',
                      p.connected ? 'bg-green-400' : 'bg-muted/40',
                    )}
                    title={p.connected ? '已连接' : '离线'}
                  />
                </div>
              );
            })}
          </div>

          {/* 状态 / 操作 */}
          {isHost ? (
            <button
              className="btn-gold w-full py-3 text-base"
              onClick={startRoom}
              disabled={humanCount < 1}
            >
              开始游戏（{humanCount} 名真人）
            </button>
          ) : (
            <div className="rounded-lg border border-dashed border-line/60 py-3 text-center text-[12px] text-muted">
              等待房主（{players.find((p) => p.isHost)?.name ?? '房主'}）开始游戏…
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <p className="mt-2 text-center text-[11px] text-muted">正在连接服务器…</p>
          )}
          {connectionStatus === 'error' && (
            <p className="mt-2 text-center text-[11px] text-red-400">连接失败，请检查服务器是否启动</p>
          )}

          <button className="btn-ghost mt-3 w-full py-2" onClick={leaveRoom}>
            离开房间
          </button>
        </div>
      </div>
    </div>
  );
}
