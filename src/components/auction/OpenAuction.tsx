import { useEffect, useState } from 'react';
import type { GameState, Player } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { eligibleOpenHumans } from '@/store/selectors';
import { BidControls } from './BidControls';
import { cx, money } from '@/utils/format';

export function OpenAuction({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const countdownMs = useGameStore((s) => s.countdownMs);
  const paused = useGameStore((s) => s.paused);
  const mySeat = useGameStore((s) => s.mySeat);

  const auction = game.currentAuction!;
  const eligible = eligibleOpenHumans(game, mySeat);
  const [activeId, setActiveId] = useState<string | undefined>(eligible[0]?.id);

  // 可出价的人变了就跟着切换
  useEffect(() => {
    if (!eligible.some((p) => p.id === activeId)) setActiveId(eligible[0]?.id);
  }, [eligible, activeId]);

  const me: Player | undefined = eligible.find((p) => p.id === activeId);
  const total = game.settings.openAuctionSeconds * 1000;
  const ratio = total > 0 ? Math.max(0, Math.min(1, countdownMs / total)) : 0;
  const seconds = Math.ceil(countdownMs / 1000);
  const urgent = countdownMs <= 3000;

  const leader = auction.highestBidder
    ? game.players.find((p) => p.id === auction.highestBidder)
    : undefined;

  return (
    <div className="space-y-3">
      {/* 倒计时 + 当前最高价 */}
      <div className="flex items-center gap-3 rounded-lg border border-line/60 bg-ink/50 p-3">
        <Countdown ratio={ratio} seconds={seconds} urgent={urgent} paused={paused} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-widest text-muted">当前最高价</div>
          <div
            className={cx(
              'stat text-2xl font-bold leading-tight transition-colors',
              auction.currentHighestBid > 0 ? 'text-gold' : 'text-muted/60',
            )}
          >
            {auction.currentHighestBid > 0 ? money(auction.currentHighestBid) : '尚无出价'}
          </div>
          <div className="truncate text-[11px] text-cream/70">
            {leader ? (
              <>
                领先者 <span className="font-medium text-cream">{leader.name}</span>
              </>
            ) : (
              '任何人都可以开价'
            )}
          </div>
        </div>
      </div>

      {/* 出价者切换（两位以上真人同屏时） */}
      {eligible.length > 1 && (
        <div className="flex gap-1.5">
          {eligible.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={cx(
                'flex-1 rounded-md border px-2 py-1.5 text-[12px] font-medium transition',
                p.id === activeId
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-line/70 text-cream/70 hover:border-gold/40',
              )}
            >
              {p.name}
              <span className="ml-1 font-mono text-[10px] opacity-70">
                {p.cashHidden ? '🔒' : money(p.cash)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 出价控件 */}
      {me ? (
        <BidControls
          key={`${auction.id}-${me.id}-${auction.currentHighestBid}`}
          min={auction.currentHighestBid + 1}
          max={me.cash}
          onSubmit={(amount) => dispatch({ type: 'PLACE_BID', playerId: me.id, amount })}
          submitLabel="出价"
          secondary={{
            label: '放弃',
            onClick: () => dispatch({ type: 'PASS_BID', playerId: me.id }),
          }}
          hint={`${me.name} 的现金 ${money(me.cash)} · 每次加价都会重置倒计时`}
        />
      ) : (
        <WaitingNote game={game} />
      )}
    </div>
  );
}

function WaitingNote({ game }: { game: GameState }) {
  const auction = game.currentAuction!;
  const humans = game.players.filter((p) => p.type === 'HUMAN');
  const allPassed = humans.every((p) => auction.bids[p.id] === null);
  const leading = humans.some((p) => auction.highestBidder === p.id);

  return (
    <div className="rounded-lg border border-dashed border-line/60 py-4 text-center text-[12px] text-muted">
      {leading
        ? '你正处于最高价，等待其他人应价'
        : allPassed
          ? '你已放弃这场拍卖'
          : '等待其他买家出价'}
    </div>
  );
}

function Countdown({
  ratio,
  seconds,
  urgent,
  paused,
}: {
  ratio: number;
  seconds: number;
  urgent: boolean;
  paused: boolean;
}) {
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#333" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={urgent ? '#E0533F' : '#C9A227'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {paused ? (
          <span className="text-[10px] text-muted">暂停</span>
        ) : (
          <span
            className={cx(
              'stat text-xl font-bold tabular-nums',
              urgent ? 'text-red-400' : 'text-gold',
            )}
          >
            {seconds}
          </span>
        )}
      </div>
    </div>
  );
}
