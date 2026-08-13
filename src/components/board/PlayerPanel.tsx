import type { GameState, Player } from '@/types/game';
import { AI_PROFILES } from '@/ai';
import { estimatedHoldingsValue, purchasedByArtist } from '@/store/selectors';
import { activeAuctionType } from '@/engine/validate';
import { cx, money } from '@/utils/format';

interface Props {
  game: GameState;
  /** 当前需要操作的玩家 id，用于高亮 */
  activeId?: string;
}

export function PlayerPanel({ game, activeId }: Props) {
  const auction = game.currentAuction;

  return (
    <section className="panel flex h-full min-h-0 flex-col">
      <div className="border-b border-line/60 px-3.5 py-2.5">
        <h2 className="panel-title">
          <span>座次</span>
          <span className="text-muted/50">·</span>
          <span className="normal-case tracking-normal text-muted/70">{game.players.length} 人</span>
        </h2>
      </div>
      <div className="scroll-soft min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {game.players.map((p) => (
          <PlayerRow
            key={p.id}
            game={game}
            player={p}
            active={p.id === activeId}
            isAuctioneer={auction?.auctioneerId === p.id}
            isCoAuctioneer={auction?.coAuctioneerId === p.id}
          />
        ))}
      </div>
    </section>
  );
}

function PlayerRow({
  game,
  player,
  active,
  isAuctioneer,
  isCoAuctioneer,
}: {
  game: GameState;
  player: Player;
  active: boolean;
  isAuctioneer: boolean;
  isCoAuctioneer: boolean;
}) {
  const auction = game.currentAuction;
  const type = activeAuctionType(game);
  const holdings = purchasedByArtist(game, player);
  const est = estimatedHoldingsValue(game, player);
  const cashHidden = (player as Player & { cashHidden?: boolean }).cashHidden;

  // 竞价状态
  let bidTag: { text: string; tone: 'gold' | 'muted' | 'dim' } | undefined;
  if (auction && type) {
    const v = auction.bids[player.id];
    if (type === 'HIDDEN') {
      if (auction.revealed && typeof v === 'number') {
        bidTag = { text: money(v), tone: auction.highestBidder === player.id ? 'gold' : 'muted' };
      } else if (auction.submitted.includes(player.id)) {
        bidTag = { text: '已提交', tone: 'dim' };
      }
    } else if (v === null) {
      bidTag = { text: '放弃', tone: 'dim' };
    } else if (typeof v === 'number') {
      bidTag = { text: money(v), tone: auction.highestBidder === player.id ? 'gold' : 'muted' };
    }
  }

  return (
    <div
      className={cx(
        'rounded-lg border p-2.5 transition-all duration-200',
        active
          ? 'border-gold/70 bg-gold/[0.07] shadow-[0_0_0_1px_rgba(201,162,39,0.25)]'
          : 'border-line/60 bg-ink/40',
      )}
    >
      {/* 头部 */}
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink"
          style={{ backgroundColor: player.avatarColor }}
        >
          {player.name.slice(0, 1)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-cream">{player.name}</span>
            {player.type === 'AI' && (
              <span
                className="shrink-0 rounded bg-slate2 px-1 py-px text-[9px] text-muted"
                title={AI_PROFILES[player.aiLevel ?? 'normal'].label}
              >
                AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isAuctioneer && <span className="tag-gold !px-1.5 !text-[9px]">拍卖师</span>}
            {isCoAuctioneer && <span className="tag-gold !px-1.5 !text-[9px]">共同拍卖师</span>}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {cashHidden ? (
            <div className="stat text-sm font-bold text-muted/70" title="资金对其他玩家隐藏">
              🔒
            </div>
          ) : (
            <div className="stat text-sm font-bold text-gold">{money(player.cash)}</div>
          )}
          {est > 0 && (
            <div className="stat text-[10px] text-muted" title="本轮收藏若此刻结算的估值">
              +{money(est)}?
            </div>
          )}
        </div>
      </div>

      {/* 底部：手牌数 / 收藏 / 竞价状态 */}
      <div className="mt-2 flex items-center gap-2">
        <span className="chip !px-1.5 !text-[10px]" title="手牌数量">
          🂠 {(player as Player & { handCount?: number }).handCount ?? player.hand.length}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {holdings.map((h) => (
            <span
              key={h.artistId}
              className="flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-semibold"
              style={{
                backgroundColor: `${game.artists[h.artistId].color}22`,
                color: game.artists[h.artistId].color,
              }}
              title={`${game.artists[h.artistId].name} ×${h.ids.length}`}
            >
              {h.artistId}
              <span className="opacity-70">×{h.ids.length}</span>
            </span>
          ))}
          {holdings.length === 0 && <span className="text-[10px] text-muted/50">本轮暂无收藏</span>}
        </div>

        {bidTag && (
          <span
            className={cx(
              'stat shrink-0 rounded px-1.5 py-px text-[10px] font-semibold',
              bidTag.tone === 'gold' && 'bg-gold/20 text-gold',
              bidTag.tone === 'muted' && 'bg-slate2 text-cream/70',
              bidTag.tone === 'dim' && 'bg-slate2/60 text-muted',
            )}
          >
            {bidTag.text}
          </span>
        )}
      </div>
    </div>
  );
}
