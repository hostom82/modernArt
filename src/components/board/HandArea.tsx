import { useMemo, useState } from 'react';
import type { ArtistId, GameState, Player } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';
import { AUCTION_TYPE_DESC, AUCTION_TYPE_LABEL } from '@/data/artists';
import { useGameStore } from '@/store/gameStore';
import { artistMarket, handOwner } from '@/store/selectors';
import { ArtworkCard } from './ArtworkCard';
import { cx, money } from '@/utils/format';

type SortMode = 'artist' | 'type';

export function HandArea({ game, mobile }: { game: GameState; mobile?: boolean }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const selectedId = useGameStore((s) => s.selectedArtworkId);
  const selectArtwork = useGameStore((s) => s.selectArtwork);
  const mySeat = useGameStore((s) => s.mySeat);
  const [sort, setSort] = useState<SortMode>('artist');

  const owner = handOwner(game, mySeat);
  const canPlay =
    !!owner &&
    game.phase === 'PLAYER_TURN' &&
    game.players[game.currentPlayerIndex]?.id === owner.id;

  const sorted = useMemo(() => {
    if (!owner) return [];
    const ids = [...owner.hand];
    ids.sort((a, b) => {
      const A = game.artworks[a];
      const B = game.artworks[b];
      if (sort === 'artist') {
        const d = ARTIST_ORDER.indexOf(A.artistId) - ARTIST_ORDER.indexOf(B.artistId);
        if (d !== 0) return d;
        return A.auctionType < B.auctionType ? -1 : 1;
      }
      if (A.auctionType !== B.auctionType) return A.auctionType < B.auctionType ? -1 : 1;
      return ARTIST_ORDER.indexOf(A.artistId) - ARTIST_ORDER.indexOf(B.artistId);
    });
    return ids;
  }, [owner, game.artworks, sort]);

  if (!owner) {
    return (
      <section className="panel flex items-center justify-center px-4 py-5 text-center text-[12px] text-muted">
        多人同屏模式 · 轮到你时会自动展示你的手牌
      </section>
    );
  }

  const counts = countByArtist(game, owner);
  const selected = selectedId && owner.hand.includes(selectedId) ? game.artworks[selectedId] : undefined;

  return (
    <section className={cx('panel flex min-h-0 flex-col', mobile && 'h-full overflow-hidden')}>
      {/* 头部 */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line/60 px-3.5 py-2.5">
        <h2 className="panel-title">
          {owner.name} 的手牌
          <span className="stat ml-1 text-cream/80">{owner.hand.length}</span>
        </h2>

        {/* 持仓概览 */}
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {ARTIST_ORDER.filter((a) => counts[a] > 0).map((a) => (
            <span
              key={a}
              className="flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-semibold"
              style={{
                backgroundColor: `${game.artists[a].color}22`,
                color: game.artists[a].color,
              }}
              title={`${game.artists[a].name} ×${counts[a]}`}
            >
              {a}
              <span className="opacity-70">×{counts[a]}</span>
            </span>
          ))}
        </div>

        <div className="flex shrink-0 gap-1">
          {(['artist', 'type'] as SortMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setSort(m)}
              className={cx(
                'rounded px-2 py-0.5 text-[10px] transition',
                sort === m ? 'bg-gold/20 text-gold' : 'text-muted hover:text-cream',
              )}
            >
              按{m === 'artist' ? '艺术家' : '拍卖方式'}
            </button>
          ))}
        </div>
      </div>

      {/* 牌 */}
      <div
        className={cx(
          'scroll-soft min-h-0 flex-1 overflow-x-auto px-3 py-3',
          mobile ? 'overflow-y-auto' : 'overflow-y-hidden',
        )}
      >
        {owner.hand.length === 0 ? (
          <div className="flex h-full min-h-[100px] items-center justify-center text-[12px] text-muted">
            手牌已出完 · 本轮你不再出牌，但仍可竞买
          </div>
        ) : (
          <div className="flex h-full items-end gap-2 pb-1">
            {sorted.map((id) => (
              <ArtworkCard
                key={id}
                artwork={game.artworks[id]}
                artist={game.artists[game.artworks[id].artistId]}
                size="sm"
                selected={selectedId === id}
                disabled={!canPlay}
                onClick={canPlay ? () => selectArtwork(id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* 出牌确认条 */}
      {canPlay && (
        <div className="shrink-0 border-t border-line/60 px-3 py-2.5">
          {selected ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-cream">
                  《{selected.name}》
                </div>
                <div className="truncate text-[11px] text-muted">
                  <span style={{ color: game.artists[selected.artistId].color }}>
                    {game.artists[selected.artistId].name}
                  </span>
                  {' · '}
                  {AUCTION_TYPE_LABEL[selected.auctionType]}
                  {' · '}
                  {AUCTION_TYPE_DESC[selected.auctionType]}
                </div>
              </div>
              <FifthWarning game={game} artistId={selected.artistId} />
              <button
                className="btn-gold shrink-0"
                onClick={() => {
                  dispatch({ type: 'PLAY_ARTWORK', playerId: owner.id, artworkId: selected.id });
                  selectArtwork(undefined);
                }}
              >
                推上拍卖台
              </button>
            </div>
          ) : (
            <p className="text-center text-[12px] text-muted">
              选择一幅作品 · 现金 <span className="stat text-gold">{money(owner.cash)}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** 打出这张会不会触发本轮结束 */
function FifthWarning({ game, artistId }: { game: GameState; artistId: ArtistId }) {
  const next = game.roundArtworkCounts[artistId] + 1;
  if (next < 5) {
    const row = artistMarket(game).find((r) => r.artistId === artistId)!;
    if (next === 4) {
      return (
        <span className="shrink-0 rounded-md bg-slate2 px-2 py-1 text-[10px] leading-tight text-cream/70">
          打出后 4/5
          <br />
          再一幅即结束
        </span>
      );
    }
    return (
      <span className="shrink-0 rounded-md bg-slate2 px-2 py-1 text-[10px] leading-tight text-muted">
        {row.name} {next}/5
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md border border-red-500/50 bg-red-950/40 px-2 py-1 text-[10px] font-semibold leading-tight text-red-300">
      第 5 幅 · 立即结算
      <br />
      <span className="font-normal opacity-80">不拍卖但计入排名</span>
    </span>
  );
}

function countByArtist(game: GameState, player: Player): Record<ArtistId, number> {
  const c: Record<ArtistId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  player.hand.forEach((id) => {
    c[game.artworks[id].artistId] += 1;
  });
  return c;
}
