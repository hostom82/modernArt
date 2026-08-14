import type { GameState } from '@/types/game';
import { currentAsker } from '@/engine/auction/core';
import { useGameStore } from '@/store/gameStore';
import { isLocalActor } from '@/store/selectors';
import { BidControls } from './BidControls';
import { cx, money } from '@/utils/format';

export function OneOfferAuction({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const mySeat = useGameStore((s) => s.mySeat);
  const auction = game.currentAuction!;
  const askerId = currentAsker(auction);
  const asker = game.players.find((p) => p.id === askerId);
  const isMe = askerId ? isLocalActor(game, mySeat, askerId) : false;
  const isLast = auction.turnIndex === auction.turnQueue.length - 1;

  const leader = auction.highestBidder
    ? game.players.find((p) => p.id === auction.highestBidder)
    : undefined;

  return (
    <div className="space-y-2">
      {/* 报价顺序 */}
      <div className="rounded-lg border border-line/60 bg-ink/50 p-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-widest text-muted">报价顺序</span>
          <span className="text-[11px] text-muted">拍卖师最后决定</span>
        </div>
        <ol className="space-y-1">
          {auction.turnQueue.map((pid, i) => {
            const p = game.players.find((x) => x.id === pid)!;
            const v = auction.bids[pid];
            const done = i < auction.turnIndex;
            const now = i === auction.turnIndex;
            return (
              <li
                key={pid}
                className={cx(
                  'flex items-center gap-2 rounded px-2 py-1 text-[12px] transition-colors',
                  now && 'bg-gold/10 ring-1 ring-gold/40',
                )}
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted">
                  {i + 1}
                </span>
                <span
                  className={cx(
                    'min-w-0 flex-1 truncate',
                    now ? 'font-semibold text-gold' : done ? 'text-cream/70' : 'text-muted/60',
                  )}
                >
                  {p.name}
                  {pid === auction.auctioneerId && (
                    <span className="ml-1 text-[10px] text-muted">（拍卖师）</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px]">
                  {v === null ? (
                    <span className="text-muted/60">放弃</span>
                  ) : typeof v === 'number' ? (
                    <span className={auction.highestBidder === pid ? 'text-gold' : 'text-cream/70'}>
                      {money(v)}
                    </span>
                  ) : now ? (
                    <span className="text-gold">报价中…</span>
                  ) : (
                    <span className="text-muted/40">—</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* 当前最高 */}
      <div className="flex items-center justify-between rounded-lg bg-ink/40 px-2.5 py-1.5">
        <span className="text-[11px] text-muted">当前最高</span>
        <span className="stat text-lg font-bold text-gold">
          {auction.currentHighestBid > 0 ? money(auction.currentHighestBid) : '尚无出价'}
          {leader && <span className="ml-2 text-[11px] font-normal text-cream/60">{leader.name}</span>}
        </span>
      </div>

      {/* 操作 */}
      {isMe && asker ? (
        <BidControls
          key={`${auction.id}-${asker.id}`}
          min={auction.currentHighestBid + 1}
          max={asker.cash}
          onSubmit={(amount) => dispatch({ type: 'PLACE_BID', playerId: asker.id, amount })}
          submitLabel="报价"
          secondary={{ label: '放弃', onClick: () => dispatch({ type: 'PASS_BID', playerId: asker.id }) }}
          hint={
            isLast
              ? `${asker.name}：你是最后一位，只需高出 1k 即可截胡`
              : `${asker.name} 只有这一次机会，报出后不能反悔`
          }
        />
      ) : (
        <div className="rounded-lg border border-dashed border-line/60 py-2.5 text-center text-[12px] text-muted">
          等待 {asker?.name ?? '玩家'} 报价…
        </div>
      )}
    </div>
  );
}
