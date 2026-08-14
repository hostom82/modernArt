import { useState } from 'react';
import type { GameState } from '@/types/game';
import { currentHiddenHuman, needsHandoff, useGameStore } from '@/store/gameStore';
import { BidControls } from './BidControls';
import { cx, money } from '@/utils/format';

export function HiddenAuction({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const handoffAcked = useGameStore((s) => s.handoffAcked);
  const ackHandoff = useGameStore((s) => s.ackHandoff);
  const mySeat = useGameStore((s) => s.mySeat);

  const auction = game.currentAuction!;
  const me = currentHiddenHuman(game, mySeat);
  const mustHandoff = needsHandoff(game, mySeat);
  const covered = mustHandoff && !handoffAcked;

  return (
    <div className="space-y-2">
      {/* 提交进度 */}
      <div className="rounded-lg border border-line/60 bg-ink/50 p-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-widest text-muted">提交进度</span>
          <span className="stat text-[11px] text-muted">
            {auction.submitted.length} / {game.players.length}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {game.players.map((p) => {
            const done = auction.submitted.includes(p.id);
            return (
              <div
                key={p.id}
                className={cx(
                  'rounded-md border px-1 py-1.5 text-center transition-colors',
                  done ? 'border-gold/50 bg-gold/10' : 'border-line/60 bg-slate2/40',
                )}
                title={p.name}
              >
                <div className={cx('truncate text-[10px]', done ? 'text-gold' : 'text-muted')}>
                  {p.name}
                </div>
                <div className="mt-0.5 text-[13px] leading-none">
                  {done ? (
                    <span className="text-gold">🔒</span>
                  ) : (
                    <span className="text-muted/40">…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 输入区 */}
      {me ? (
        covered ? (
          <HandoffScreen name={me.name} onReady={ackHandoff} />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-ink/40 px-2.5 py-1.5">
              <span className="text-[12px] text-cream">
                <span className="font-semibold text-gold">{me.name}</span> 的秘密报价
              </span>
              <span className="stat text-[12px] text-muted">现金 {money(me.cash)}</span>
            </div>
            <BidControls
              key={`${auction.id}-${me.id}`}
              min={0}
              max={me.cash}
              initial={0}
              onSubmit={(amount) =>
                dispatch({ type: 'SUBMIT_HIDDEN_BID', playerId: me.id, amount })
              }
              submitLabel="密封提交"
              hint="可以出 0 表示不想要 · 平局时拍卖师优先"
            />
          </div>
        )
      ) : (
        <div className="rounded-lg border border-dashed border-line/60 py-2.5 text-center text-[12px] text-muted">
          等待其他买家密封报价…
        </div>
      )}
    </div>
  );
}

/** 多位真人同屏时的隐私遮挡屏 */
function HandoffScreen({ name, onReady }: { name: string; onReady: () => void }) {
  const [hold, setHold] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-lg border border-gold/40 bg-gradient-to-b from-charcoal to-ink p-6 text-center animate-popIn">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #C9A227 0 2px, transparent 2px 12px)',
          }}
        />
      </div>

      <div className="relative">
        <div className="mb-2 text-3xl">🤫</div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-muted">请把设备交给</div>
        <div className="brush-title my-1.5 text-2xl font-bold text-gold">{name}</div>
        <p className="mx-auto mb-4 max-w-xs text-[12px] leading-relaxed text-cream/70">
          其他人请暂时移开视线。
          <br />
          确认只有 {name} 能看到屏幕后再继续。
        </p>
        <button
          className={cx('btn-gold w-full max-w-xs py-2.5', hold && 'animate-pulseGold')}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          onClick={onReady}
        >
          我是 {name}，开始报价
        </button>
      </div>
    </div>
  );
}
