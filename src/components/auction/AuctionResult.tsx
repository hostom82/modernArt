import type { GameState } from '@/types/game';
import { AUCTION_TYPE_LABEL } from '@/data/artists';
import { useGameStore } from '@/store/gameStore';
import { cx, money } from '@/utils/format';

export function AuctionResult({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const out = game.lastOutcome;
  if (!out) return null;

  const winner = out.winnerId ? game.players.find((p) => p.id === out.winnerId) : undefined;
  const auctioneer = game.players.find((p) => p.id === out.auctioneerId);
  const co = out.coAuctioneerId ? game.players.find((p) => p.id === out.coAuctioneerId) : undefined;

  return (
    <div className="space-y-2 animate-popIn">
      {/* 落槌横幅 */}
      <div
        className={cx(
          'relative overflow-hidden rounded-lg border p-3 text-center',
          out.voided
            ? 'border-red-500/40 bg-red-950/25'
            : out.free
              ? 'border-line/70 bg-slate2/40'
              : 'border-gold/50 bg-gradient-to-br from-[#241e0d] to-ink',
        )}
      >
        {out.voided ? (
          <>
            <div className="mb-1 text-2xl">⛔</div>
            <div className="brush-title text-lg font-bold text-red-300">本轮就此结束</div>
            <p className="mt-1 text-[12px] leading-relaxed text-cream/70">
              这是该艺术家的第 5 幅作品。
              <br />
              作品<strong className="text-cream">不进行拍卖、不归属任何人</strong>，
              但<strong className="text-gold">计入本轮排名</strong>。
            </p>
          </>
        ) : out.free ? (
          <>
            <div className="mb-1 text-2xl">🎁</div>
            <div className="brush-title text-lg font-bold text-cream">无人出价</div>
            <p className="mt-1 text-[12px] text-cream/70">
              <span className="font-semibold text-gold">{auctioneer?.name}</span> 免费获得
              {out.artworkIds.length > 1 ? '这两幅作品' : '这幅作品'}
            </p>
          </>
        ) : (
          <>
            <div className="mb-1 text-2xl">🔨</div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted">落槌成交</div>
            <div className="brush-title my-0.5 text-xl font-bold text-cream">{winner?.name}</div>
            <div className="stat text-3xl font-bold text-gold">{money(out.price)}</div>
            <div className="mt-1 text-[11px] text-muted">
              {AUCTION_TYPE_LABEL[out.type]}
              {out.artworkIds.length > 1 && ' · 两幅一起成交'}
            </div>
          </>
        )}
      </div>

      {/* 资金流向 */}
      {out.transfers.length > 0 && (
        <div className="space-y-1 rounded-lg border border-line/60 bg-ink/50 p-2.5">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">资金流向</div>
          {out.transfers.map((t, i) => {
            const from = t.from ? game.players.find((p) => p.id === t.from) : undefined;
            const to = t.to ? game.players.find((p) => p.id === t.to) : undefined;
            return (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-cream/80">
                  {from?.name ?? '银行'}
                </span>
                <span className="shrink-0 text-muted">→</span>
                <span
                  className={cx(
                    'min-w-0 flex-1 truncate',
                    t.toBank ? 'text-muted' : 'text-cream/80',
                  )}
                >
                  {t.toBank ? '银行' : (to?.name ?? '银行')}
                </span>
                <span className="stat shrink-0 font-semibold text-gold">{money(t.amount)}</span>
              </div>
            );
          })}
          {co && !out.voided && !out.free && (
            <p className="pt-1 text-[10px] text-muted">
              联合拍卖 · {auctioneer?.name} 与 {co.name} 平分货款（奇数时原拍卖师多得 1k）
            </p>
          )}
        </div>
      )}

      <button className="btn-ghost w-full" onClick={() => dispatch({ type: 'ACKNOWLEDGE_RESULT' })}>
        继续
      </button>
    </div>
  );
}
