import type { GameState } from '@/types/game';
import { artistMarket } from '@/store/selectors';
import { MarketChart } from './MarketChart';
import { cx, money } from '@/utils/format';

const ROUND_END_COUNT = 5;

export function MarketPanel({ game }: { game: GameState }) {
  const rows = artistMarket(game);

  return (
    <section className="panel flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line/60 px-3.5 py-2.5">
        <h2 className="panel-title">市场行情</h2>
        <span className="text-[10px] text-muted/70">第 {game.currentRound} 轮 · 实时推演</span>
      </div>

      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1.5 p-2.5">
          {rows.map((r) => (
            <div
              key={r.artistId}
              className={cx(
                'rounded-lg border px-2.5 py-2 transition-colors',
                r.projectedRank > 0 ? 'border-line/60 bg-ink/50' : 'border-line/40 bg-ink/25',
              )}
            >
              <div className="flex items-center gap-2">
                {/* 名次 */}
                <span
                  className={cx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold',
                    r.projectedRank === 1 && 'bg-gold text-ink',
                    r.projectedRank === 2 && 'bg-[#9AA0A6] text-ink',
                    r.projectedRank === 3 && 'bg-[#A0714A] text-ink',
                    r.projectedRank === 0 && 'bg-slate2 text-muted',
                  )}
                  title={r.projectedRank > 0 ? `暂列第 ${r.projectedRank} 名` : '暂时无缘前三'}
                >
                  {r.projectedRank > 0 ? r.projectedRank : '—'}
                </span>

                {/* 名字 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span
                      className={cx(
                        'truncate text-[12px] font-medium',
                        r.projectedRank > 0 ? 'text-cream' : 'text-muted',
                      )}
                    >
                      {r.name}
                    </span>
                  </div>
                </div>

                {/* 结算价 */}
                <div className="shrink-0 text-right">
                  <div
                    className={cx(
                      'stat text-[13px] font-bold',
                      r.projectedPayout > 0 ? 'text-gold' : 'text-muted/60',
                    )}
                    title="若本轮此刻结算，每幅的售价"
                  >
                    {r.projectedPayout > 0 ? money(r.projectedPayout) : '—'}
                  </div>
                  {r.cumulative > 0 && (
                    <div className="stat text-[9px] text-muted" title="历史累计身价">
                      累计 {r.cumulative}
                      {r.projectedGain > 0 && (
                        <span className="text-green-400/80"> +{r.projectedGain}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 张数进度条 */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex flex-1 gap-0.5">
                  {Array.from({ length: ROUND_END_COUNT }, (_, i) => (
                    <span
                      key={i}
                      className={cx(
                        'h-1.5 flex-1 rounded-sm transition-colors',
                        i < r.count ? '' : 'bg-line/60',
                        i === ROUND_END_COUNT - 1 && i >= r.count && 'bg-red-900/50',
                      )}
                      style={i < r.count ? { backgroundColor: r.color } : undefined}
                    />
                  ))}
                </div>
                <span
                  className={cx(
                    'stat w-9 shrink-0 text-right text-[10px]',
                    r.toFifth === 1 ? 'font-bold text-red-400' : 'text-muted',
                  )}
                  title={r.toFifth === 0 ? '已触发轮次结束' : `再打出 ${r.toFifth} 幅将结束本轮`}
                >
                  {r.count}/5
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 价格走势 */}
        <div className="border-t border-line/60 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="panel-title !text-[10px]">身价走势</span>
            <span className="text-[10px] text-muted/60">累计价值 · 每轮</span>
          </div>
          <MarketChart game={game} />
        </div>
      </div>
    </section>
  );
}
