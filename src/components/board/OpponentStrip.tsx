import type { GameState, Player } from '@/types/game';
import { AI_PROFILES } from '@/ai';
import { purchasedByArtist } from '@/store/selectors';
import { cx, money } from '@/utils/format';

interface Props {
  game: GameState;
  /** 当前需要操作的玩家 id，用于高亮 */
  activeId?: string;
}

/** 手机版横向紧凑对手条：每名玩家一个窄卡，人数多时整条横滑。 */
export function OpponentStrip({ game, activeId }: Props) {
  const auction = game.currentAuction;
  return (
    <div className="scroll-soft flex shrink-0 gap-2 overflow-x-auto px-3 py-2">
      {game.players.map((p) => (
        <OpponentChip
          key={p.id}
          game={game}
          player={p}
          active={p.id === activeId}
          isAuctioneer={auction?.auctioneerId === p.id}
          isCoAuctioneer={auction?.coAuctioneerId === p.id}
        />
      ))}
    </div>
  );
}

function OpponentChip({
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
  const holdings = purchasedByArtist(game, player);
  const handCount = (player as Player & { handCount?: number }).handCount ?? player.hand.length;
  const cashHidden = (player as Player & { cashHidden?: boolean }).cashHidden;

  return (
    <div
      className={cx(
        'flex w-[5.25rem] shrink-0 flex-col gap-1 rounded-xl border p-2 transition-colors',
        active
          ? 'border-gold/70 bg-gold/[0.07]'
          : 'border-line/60 bg-ink/40',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-ink"
          style={{ backgroundColor: player.avatarColor }}
        >
          {player.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-cream">
          {player.name}
        </span>
      </div>

      <div className="flex items-center justify-between">
        {cashHidden ? (
          <span className="stat text-[12px] font-bold text-muted/70" title="资金对其他玩家隐藏">
            🔒
          </span>
        ) : (
          <span className="stat text-[12px] font-bold text-gold">{money(player.cash)}</span>
        )}
        <span className="stat text-[10px] text-muted">🂠{handCount}</span>
      </div>

      <div className="flex min-h-[12px] flex-wrap items-center gap-1">
        {holdings.map((h) => {
          const c = game.artists[h.artistId].color;
          return (
            <span
              key={h.artistId}
              className="flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold"
              style={{ backgroundColor: `${c}22`, color: c }}
              title={`${game.artists[h.artistId].name} ×${h.ids.length}`}
            >
              <span className="h-1.5 w-1.5 rounded-[1px]" style={{ backgroundColor: c }} />
              {h.ids.length}
            </span>
          );
        })}
      </div>

      {(isAuctioneer || isCoAuctioneer) && (
        <span className="tag-gold !px-1.5 !py-0 !text-[9px]">
          {isCoAuctioneer ? '共同拍卖师' : '拍卖师'}
        </span>
      )}
      {player.type === 'AI' && !isAuctioneer && !isCoAuctioneer && (
        <span className="rounded bg-slate2 px-1 py-px !text-[9px] text-muted">
          {AI_PROFILES[player.aiLevel ?? 'normal'].label}
        </span>
      )}
    </div>
  );
}
