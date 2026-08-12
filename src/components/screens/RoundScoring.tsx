import type { GameState } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { Modal } from '@/components/ui/Modal';
import { cx, money } from '@/utils/format';

/**
 * 轮次结算：
 *  ROUND_SCORING → 展示艺术家排名（点击继续才卖画）
 *  SELL_ARTWORK  → 展示每位玩家的售出收入
 */
export function RoundScoring({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const result = game.roundResult;
  const open = game.phase === 'ROUND_SCORING' || game.phase === 'SELL_ARTWORK';
  if (!open || !result) return null;

  const showIncome = game.phase === 'SELL_ARTWORK';
  const isLastRound = game.currentRound >= 4;

  return (
    <Modal
      open
      onClose={() => {}}
      size="md"
      title={
        <span className="flex items-baseline gap-2.5">
          <span className="font-mono text-sm text-gold">第 {result.round} 轮</span>
          <span>{showIncome ? '售出结算' : '市场排名'}</span>
        </span>
      }
      footer={
        <button className="btn-gold w-full" onClick={() => dispatch({ type: 'CONTINUE' })}>
          {showIncome ? (isLastRound ? '查看最终结果' : `进入第 ${result.round + 1} 轮`) : '卖出本轮作品'}
        </button>
      }
    >
      {/* 结束原因 */}
      <div className="mb-3 rounded-md border-l-2 border-gold bg-gold/[0.07] px-3 py-2 text-[12px] text-cream/85">
        {game.roundEndReason === 'fifth-card' && game.roundEndArtistId ? (
          <>
            <strong className="text-gold">{game.artists[game.roundEndArtistId].name}</strong>{' '}
            的第 5 幅作品被打出，本轮结束。该作品不归属任何人，但计入排名。
          </>
        ) : (
          <>所有玩家手牌耗尽，本轮结束。</>
        )}
      </div>

      {/* 艺术家排名 */}
      <div className="mb-4 space-y-1.5">
        {result.artists.map((r) => {
          const artist = game.artists[r.artistId];
          const inTop = r.gained > 0;
          return (
            <div
              key={r.artistId}
              className={cx(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition',
                inTop ? 'border-line/70 bg-ink/60' : 'border-line/40 bg-ink/25 opacity-70',
              )}
            >
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold',
                  r.rank === 1 && inTop && 'bg-gold text-ink',
                  r.rank === 2 && inTop && 'bg-[#9AA0A6] text-ink',
                  r.rank === 3 && inTop && 'bg-[#A0714A] text-ink',
                  !inTop && 'bg-slate2 text-muted',
                )}
              >
                {r.rank}
              </span>

              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: artist.color }} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-cream">{artist.name}</div>
                <div className="text-[10px] text-muted">本轮 {r.count} 幅</div>
              </div>

              <div className="shrink-0 text-right">
                {inTop ? (
                  <>
                    <div className="stat text-sm font-bold text-gold">{money(r.payout)}</div>
                    <div className="stat text-[10px] text-green-400/80">
                      +{r.gained} → 累计 {r.cumulative}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted">本轮无价值</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 玩家收入 */}
      {showIncome && (
        <div className="space-y-2 border-t border-line/60 pt-3 animate-fadeUp">
          <div className="panel-title mb-2">售出收入</div>
          {[...result.incomes]
            .sort((a, b) => b.total - a.total)
            .map((inc) => {
              const p = game.players.find((x) => x.id === inc.playerId)!;
              return (
                <div key={inc.playerId} className="rounded-lg border border-line/60 bg-ink/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-ink"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-cream">
                      {p.name}
                    </span>
                    <span
                      className={cx(
                        'stat text-sm font-bold',
                        inc.total > 0 ? 'text-green-400' : 'text-muted',
                      )}
                    >
                      {inc.total > 0 ? `+${money(inc.total)}` : '—'}
                    </span>
                    <span className="stat w-16 shrink-0 text-right text-sm font-bold text-gold">
                      {money(inc.cashAfter)}
                    </span>
                  </div>

                  {inc.breakdown.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-8">
                      {inc.breakdown.map((b) => (
                        <span
                          key={b.artistId}
                          className={cx(
                            'rounded px-1.5 py-px text-[10px]',
                            b.unit > 0 ? '' : 'bg-slate2/60 text-muted line-through',
                          )}
                          style={
                            b.unit > 0
                              ? {
                                  backgroundColor: `${game.artists[b.artistId].color}22`,
                                  color: game.artists[b.artistId].color,
                                }
                              : undefined
                          }
                        >
                          {b.artistId} ×{b.count} × {b.unit} = {b.total}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </Modal>
  );
}
