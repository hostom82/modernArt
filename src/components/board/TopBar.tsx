import type { GameState } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { phaseLabel } from '@/store/selectors';
import { cx } from '@/utils/format';

export function TopBar({ game, mobile }: { game: GameState; mobile?: boolean }) {
  const paused = useGameStore((s) => s.paused);
  const fast = useGameStore((s) => s.fast);
  const setPaused = useGameStore((s) => s.setPaused);
  const toggleFast = useGameStore((s) => s.toggleFast);
  const setShowLog = useGameStore((s) => s.setShowLog);
  const setShowRules = useGameStore((s) => s.setShowRules);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const mode = useGameStore((s) => s.mode);
  const roomCode = useGameStore((s) => s.roomCode);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const over = game.phase === 'GAME_END';
  const online = mode === 'network';

  return (
    <header className="flex items-center gap-3 border-b border-line/70 bg-charcoal/80 px-3 py-2 backdrop-blur-md sm:px-4">
      {/* 轮次 */}
      <div className="flex items-center gap-2.5">
        <span className="brush-title hidden text-base font-semibold text-cream sm:inline">现代艺术</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((r) => (
            <span
              key={r}
              title={`第 ${r} 轮`}
              className={cx(
                'flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-semibold transition-colors',
                r === game.currentRound && !over
                  ? 'bg-gold text-ink'
                  : r < game.currentRound || over
                    ? 'bg-slate2 text-muted'
                    : 'border border-line/70 text-muted/50',
              )}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* 阶段 */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-cream/90">{phaseLabel(game)}</div>
        {online && roomCode && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span
              className={cx(
                'inline-block h-1.5 w-1.5 rounded-full',
                connectionStatus === 'connected' || connectionStatus === 'connecting'
                  ? 'bg-green-400'
                  : 'bg-red-400',
              )}
            />
            <span>房间 {roomCode}</span>
          </div>
        )}
      </div>

      {/* 控制 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {!online && !over && (
          <>
            <IconBtn
              active={fast}
              onClick={toggleFast}
              title={fast ? '恢复正常节奏' : '加快 AI 节奏'}
              label="⏩"
            />
            <IconBtn
              active={paused}
              onClick={() => setPaused(!paused)}
              title={paused ? '继续' : '暂停 AI 与倒计时'}
              label={paused ? '▶' : '⏸'}
            />
          </>
        )}
        {!mobile && <IconBtn onClick={() => setShowLog(true)} title="牌局日志" label="☰" />}
        <IconBtn onClick={() => setShowRules(true)} title="规则" label="?" />
        <button
          className="btn-ghost px-2.5 py-1.5 text-xs"
          onClick={quitToMenu}
          title="离开房间（当前进度会丢失）"
        >
          {online ? '离开' : '退出'}
        </button>
      </div>
    </header>
  );
}

function IconBtn({
  onClick,
  title,
  label,
  active,
}: {
  onClick: () => void;
  title: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx(
        'flex h-8 w-8 items-center justify-center rounded-md border text-sm transition',
        active
          ? 'border-gold/70 bg-gold/15 text-gold'
          : 'border-line/70 text-cream/75 hover:border-gold/50 hover:bg-slate2/60',
      )}
    >
      {label}
    </button>
  );
}
