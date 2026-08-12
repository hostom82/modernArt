import { useEffect, useRef } from 'react';
import type { GameState, LogEntry } from '@/types/game';
import { cx } from '@/utils/format';

const KIND_STYLE: Record<LogEntry['kind'], string> = {
  system: 'text-muted',
  play: 'text-cream/85',
  bid: 'text-cream/70',
  pass: 'text-muted/70',
  result: 'text-gold',
  money: 'text-green-400/85',
  scoring: 'text-goldsoft',
  round: 'text-cream font-semibold',
  double: 'text-[#B9A2DA]',
};

const KIND_MARK: Record<LogEntry['kind'], string> = {
  system: '·',
  play: '▸',
  bid: '↑',
  pass: '×',
  result: '⚑',
  money: '€',
  scoring: '★',
  round: '❖',
  double: '═',
};

export function GameLog({ game, limit }: { game: GameState; limit?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = limit ? game.log.slice(-limit) : game.log;

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game.log.length]);

  return (
    <div ref={ref} className="scroll-soft h-full overflow-y-auto px-3 py-2">
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-1.5 text-[11.5px] leading-snug animate-ticker">
            <span className={cx('w-3 shrink-0 text-center opacity-60', KIND_STYLE[e.kind])}>
              {KIND_MARK[e.kind]}
            </span>
            <span className={cx('min-w-0 flex-1', KIND_STYLE[e.kind])}>{e.text}</span>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="py-3 text-center text-[11px] text-muted/60">暂无记录</li>
        )}
      </ul>
    </div>
  );
}

export function GameLogPanel({ game }: { game: GameState }) {
  return (
    <section className="panel flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line/60 px-3.5 py-2.5">
        <h2 className="panel-title">牌局日志</h2>
        <span className="text-[10px] text-muted/60">{game.log.length} 条</span>
      </div>
      <div className="min-h-0 flex-1">
        <GameLog game={game} />
      </div>
    </section>
  );
}
