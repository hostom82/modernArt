import type { GameState } from '@/types/game';
import { currentDoubleAsked } from '@/engine/auction/double';
import { doubleCandidates } from '@/engine/helpers';
import { useGameStore } from '@/store/gameStore';
import { isLocalActor } from '@/store/selectors';
import { ArtworkCard } from '@/components/board/ArtworkCard';
import { AUCTION_TYPE_LABEL } from '@/data/artists';
import { cx } from '@/utils/format';

/**
 * 联合拍卖的追加询问界面。
 * 询问顺序：拍卖师本人 → 左手 → 顺时针；无合法牌的玩家由引擎自动跳过。
 */
export function DoublePrompt({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const mySeat = useGameStore((s) => s.mySeat);
  const pd = game.pendingDouble;
  if (!pd) return null;

  const askedId = currentDoubleAsked(game);
  const asked = game.players.find((p) => p.id === askedId);
  const isAuctioneer = pd.askQueue[0] === askedId;
  const artist = game.artists[pd.artistId];
  const first = game.artworks[pd.firstArtworkId];
  const candidates = askedId ? doubleCandidates(game, askedId, pd.artistId) : [];
  const isMe = askedId ? isLocalActor(game, mySeat, askedId) : false;

  return (
    <div className="space-y-2">
      {/* 说明 */}
      <div className="rounded-lg border border-[#7D3CB5]/40 bg-[#7D3CB5]/[0.08] p-2.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-base text-[#B9A2DA]">═</span>
          <span className="text-[13px] font-semibold text-cream">联合拍卖</span>
        </div>
        <p className="text-[12px] leading-relaxed text-cream/75">
          《{first.name}》需要一幅
          <strong className="text-cream"> {artist.name} </strong>
          的作品与它一同拍卖。第二幅作品决定实际的拍卖方式，
          {isAuctioneer ? (
            <>由你追加则货款<strong className="text-cream">全归你</strong>。</>
          ) : (
            <>由你追加则你成为共同拍卖师，货款<strong className="text-cream">两人平分</strong>。</>
          )}
        </p>
      </div>

      {/* 询问顺序 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {pd.askQueue.map((pid, i) => {
          const p = game.players.find((x) => x.id === pid)!;
          const can = doubleCandidates(game, pid, pd.artistId).length > 0;
          const now = i === pd.askIndex;
          const done = i < pd.askIndex;
          return (
            <span
              key={pid}
              className={cx(
                'rounded-md border px-2 py-1 text-[11px] transition-colors',
                now
                  ? 'border-gold bg-gold/15 font-semibold text-gold'
                  : done
                    ? 'border-line/50 text-muted/50 line-through'
                    : can
                      ? 'border-line/70 text-cream/70'
                      : 'border-line/40 text-muted/40',
              )}
              title={can ? undefined : '手上没有可追加的作品，将被跳过'}
            >
              {p.name}
              {i === 0 && <span className="ml-1 opacity-60">拍卖师</span>}
              {!can && <span className="ml-1 opacity-60">跳过</span>}
            </span>
          );
        })}
      </div>

      {/* 操作 */}
      {isMe && asked ? (
        <div className="space-y-2">
          <div className="text-[12px] text-cream">
            <span className="font-semibold text-gold">{asked.name}</span>
            ，选择一幅追加，或者放弃：
          </div>
          <div className="scroll-soft flex gap-2 overflow-x-auto pb-1.5">
            {candidates.map((id) => (
              <ArtworkCard
                key={id}
                artwork={game.artworks[id]}
                artist={game.artists[game.artworks[id].artistId]}
                size="sm"
                badge={AUCTION_TYPE_LABEL[game.artworks[id].auctionType].slice(0, 2)}
                onClick={() =>
                  dispatch({ type: 'DOUBLE_ADD', playerId: asked.id, artworkId: id })
                }
              />
            ))}
          </div>
          <button
            className="btn-ghost w-full"
            onClick={() => dispatch({ type: 'DOUBLE_DECLINE', playerId: asked.id })}
          >
            不追加
          </button>
          <p className="text-center text-[11px] text-muted">
            所有人都不追加时，{game.players.find((p) => p.id === pd.askQueue[0])?.name}
            将<strong className="text-gold">免费获得</strong>这幅作品
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line/60 py-2.5 text-center text-[12px] text-muted">
          等待 {asked?.name ?? '玩家'} 决定是否追加…
        </div>
      )}
    </div>
  );
}
