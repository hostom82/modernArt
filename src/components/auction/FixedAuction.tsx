import type { GameState } from '@/types/game';
import { currentAsker } from '@/engine/auction/core';
import { useGameStore } from '@/store/gameStore';
import { isLocalActor } from '@/store/selectors';
import { BidControls } from './BidControls';
import { cx, money } from '@/utils/format';

export function FixedAuction({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const mySeat = useGameStore((s) => s.mySeat);
  const auction = game.currentAuction!;
  const auctioneer = game.players.find((p) => p.id === auction.auctioneerId)!;

  /* --------------------------- 阶段一：定价 --------------------------- */
  if (auction.fixedPrice === undefined) {
    const isMe = isLocalActor(game, mySeat, auctioneer.id);
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-line/60 bg-ink/50 p-2.5 text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted">等待定价</div>
          <div className="mt-1 text-sm text-cream">
            <span className="font-semibold text-gold">{auctioneer.name}</span> 正在为这幅作品标价
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            定价后从其左手边逐个询问。
            <strong className="text-red-400/90">无人接手时，拍卖师必须自己按此价买下。</strong>
          </p>
        </div>

        {isMe ? (
          <BidControls
            key={`${auction.id}-price`}
            min={auctioneer.cash > 0 ? 1 : 0}
            max={auctioneer.cash}
            initial={Math.max(1, Math.round(auctioneer.cash * 0.15))}
            onSubmit={(price) =>
              dispatch({ type: 'SET_FIXED_PRICE', playerId: auctioneer.id, price })
            }
            submitLabel="标价"
            hint={`你的现金 ${money(auctioneer.cash)}，定价不能超过它`}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-line/60 py-2.5 text-center text-[12px] text-muted">
            {auctioneer.name} 正在思考定价…
          </div>
        )}
      </div>
    );
  }

  /* --------------------------- 阶段二：询问 --------------------------- */
  const price = auction.fixedPrice;
  const askerId = currentAsker(auction);
  const asker = game.players.find((p) => p.id === askerId);
  const isMe = askerId ? isLocalActor(game, mySeat, askerId) : false;
  const affordable = !!asker && asker.cash >= price;

  return (
    <div className="space-y-2">
      {/* 价签 */}
      <div className="relative overflow-hidden rounded-lg border border-gold/40 bg-gradient-to-br from-[#221c0e] to-ink p-3 text-center">
        <div className="text-[11px] uppercase tracking-[0.24em] text-muted">
          {auctioneer.name} 标价
        </div>
        <div className="stat my-0.5 text-4xl font-bold text-gold">{money(price)}</div>
        <div className="text-[11px] text-cream/60">先接手者得</div>
      </div>

      {/* 询问队列 */}
      <div className="flex flex-wrap gap-1.5">
        {auction.turnQueue.map((pid, i) => {
          const p = game.players.find((x) => x.id === pid)!;
          const passed = auction.bids[pid] === null;
          const now = i === auction.turnIndex;
          return (
            <span
              key={pid}
              className={cx(
                'rounded-md border px-2 py-1 text-[11px] transition-colors',
                now
                  ? 'border-gold bg-gold/15 font-semibold text-gold'
                  : passed
                    ? 'border-line/50 text-muted/50 line-through'
                    : 'border-line/70 text-cream/70',
              )}
            >
              {p.name}
            </span>
          );
        })}
        <span className="rounded-md border border-dashed border-red-500/40 px-2 py-1 text-[11px] text-red-400/80">
          都不要 → {auctioneer.name} 自购
        </span>
      </div>

      {/* 操作 */}
      {isMe && asker ? (
        <div className="flex gap-2">
          <button
            className="btn-ghost flex-1"
            onClick={() => dispatch({ type: 'PASS_BID', playerId: asker.id })}
          >
            不要
          </button>
          <button
            className="btn-gold flex-[1.6]"
            disabled={!affordable}
            onClick={() => dispatch({ type: 'BUY_FIXED', playerId: asker.id })}
          >
            {affordable ? `买下 ${money(price)}` : `现金不足（${money(asker.cash)}）`}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line/60 py-2.5 text-center text-[12px] text-muted">
          等待 {asker?.name ?? '玩家'} 决定…
        </div>
      )}
    </div>
  );
}
