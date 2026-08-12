import type { GameState } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { WealthChart } from './WealthChart';
import { cx, medal, money } from '@/utils/format';

export function GameOver({ game }: { game: GameState }) {
  const restart = useGameStore((s) => s.restart);
  const quitToMenu = useGameStore((s) => s.quitToMenu);
  const setShowLog = useGameStore((s) => s.setShowLog);

  const ranking = (game.finalRanking ?? game.players.map((p) => p.id))
    .map((id) => game.players.find((p) => p.id === id)!)
    .filter(Boolean);
  const winner = ranking[0];
  const start = game.cashSnapshots[0] ?? game.players.map(() => 100);

  return (
    <div className="scroll-soft min-h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* 冠军 */}
        <div className="mb-6 text-center animate-fadeUp">
          <div className="text-[11px] uppercase tracking-[0.32em] text-muted">四轮拍卖结束</div>
          <div className="my-2 text-5xl">🏆</div>
          <h1 className="brush-title text-3xl font-bold text-cream">{winner?.name}</h1>
          <div className="stat mt-1 text-2xl font-bold text-gold">{money(winner?.cash ?? 0)}</div>
          <p className="mt-1.5 text-[12px] text-muted">
            从 €100k 起步 · 净赚 {money((winner?.cash ?? 0) - 100)}
          </p>
        </div>

        {/* 最终排名 */}
        <div className="panel mb-4 overflow-hidden animate-fadeUp">
          <div className="border-b border-line/60 px-4 py-2.5">
            <h2 className="panel-title">最终排名</h2>
          </div>
          <div className="divide-y divide-line/50">
            {ranking.map((p, i) => {
              const seat = game.players.findIndex((x) => x.id === p.id);
              const delta = p.cash - (start[seat] ?? 100);
              return (
                <div
                  key={p.id}
                  className={cx('flex items-center gap-3 px-4 py-3', i === 0 && 'bg-gold/[0.06]')}
                >
                  <span className="w-6 shrink-0 text-center text-lg">
                    {medal(i + 1) || <span className="font-mono text-sm text-muted">{i + 1}</span>}
                  </span>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-ink"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {p.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-cream">{p.name}</div>
                    <div className="text-[11px] text-muted">
                      {p.type === 'AI' ? `AI · ${p.aiLevel ?? 'normal'}` : '真人玩家'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="stat text-base font-bold text-gold">{money(p.cash)}</div>
                    <div
                      className={cx(
                        'stat text-[11px]',
                        delta >= 0 ? 'text-green-400/85' : 'text-red-400/85',
                      )}
                    >
                      {delta >= 0 ? '+' : ''}
                      {delta}k
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 财富曲线 */}
        <div className="panel mb-4 p-4 animate-fadeUp">
          <h2 className="panel-title mb-3">财富曲线</h2>
          <WealthChart game={game} />
        </div>

        {/* 艺术家终值 */}
        <div className="panel mb-4 p-4 animate-fadeUp">
          <h2 className="panel-title mb-3">艺术家身价（每轮加成）</h2>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-muted">
                <th className="pb-2 text-left font-medium">艺术家</th>
                {[1, 2, 3, 4].map((r) => (
                  <th key={r} className="pb-2 text-center font-medium">
                    R{r}
                  </th>
                ))}
                <th className="pb-2 text-right font-medium">终值</th>
              </tr>
            </thead>
            <tbody>
              {[...ARTIST_ORDER]
                .sort((a, b) => game.artists[b].cumulativeValue - game.artists[a].cumulativeValue)
                .map((id) => {
                  const a = game.artists[id];
                  return (
                    <tr key={id} className="border-t border-line/50">
                      <td className="py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: a.color }}
                          />
                          <span className="text-cream">{a.name}</span>
                        </span>
                      </td>
                      {a.valueHistory.map((v, i) => (
                        <td
                          key={i}
                          className={cx(
                            'stat text-center',
                            v > 0 ? 'text-green-400/85' : 'text-muted/40',
                          )}
                        >
                          {v > 0 ? `+${v}` : '—'}
                        </td>
                      ))}
                      <td className="stat text-right font-bold text-gold">{a.cumulativeValue}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap gap-2 animate-fadeUp">
          <button className="btn-gold flex-1 py-2.5" onClick={restart}>
            再来一局
          </button>
          <button className="btn-ghost flex-1 py-2.5" onClick={() => setShowLog(true)}>
            查看完整日志
          </button>
          <button className="btn-ghost flex-1 py-2.5" onClick={quitToMenu}>
            返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
