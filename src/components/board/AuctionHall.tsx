import type { GameState, Player } from '@/types/game';
import { AUCTION_TYPE_DESC, AUCTION_TYPE_ICON, AUCTION_TYPE_LABEL } from '@/data/artists';
import { activeAuctionType } from '@/engine/validate';
import { ArtworkCard } from './ArtworkCard';
import { OpenAuction } from '@/components/auction/OpenAuction';
import { OneOfferAuction } from '@/components/auction/OneOfferAuction';
import { HiddenAuction } from '@/components/auction/HiddenAuction';
import { FixedAuction } from '@/components/auction/FixedAuction';
import { DoublePrompt } from '@/components/auction/DoublePrompt';
import { AuctionResult } from '@/components/auction/AuctionResult';
import { money } from '@/utils/format';

/** 中央拍卖台：展示当前拍品并根据阶段挂载对应的交互界面 */
export function AuctionHall({ game }: { game: GameState }) {
  const phase = game.phase;
  const auction = game.currentAuction;
  const pd = game.pendingDouble;

  const artworkIds = auction?.artworkIds ?? (pd ? [pd.firstArtworkId] : []);
  const showStage = artworkIds.length > 0;

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* 拍卖台 */}
      {showStage ? (
        <Stage game={game} artworkIds={artworkIds} />
      ) : (
        <IdleStage game={game} />
      )}

      {/* 交互区 */}
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto border-t border-line/60 p-3">
        {phase === 'AUCTION_RESULT' && <AuctionResult game={game} />}
        {(phase === 'AUCTION_DOUBLE_WAIT' || phase === 'AUCTION_DOUBLE_SELECT') && (
          <DoublePrompt game={game} />
        )}
        {auction && phase !== 'AUCTION_RESULT' && <AuctionBody game={game} />}
        {phase === 'PLAYER_TURN' && <TurnHint game={game} />}
      </div>
    </section>
  );
}

function AuctionBody({ game }: { game: GameState }) {
  const type = activeAuctionType(game);
  switch (type) {
    case 'OPEN':
      return <OpenAuction game={game} />;
    case 'ONE_OFFER':
      return <OneOfferAuction game={game} />;
    case 'HIDDEN':
      return <HiddenAuction game={game} />;
    case 'FIXED':
      return <FixedAuction game={game} />;
    default:
      return null;
  }
}

function Stage({ game, artworkIds }: { game: GameState; artworkIds: string[] }) {
  const auction = game.currentAuction;
  const auctioneerId = auction?.auctioneerId ?? game.pendingDouble?.askQueue[0];
  const auctioneer = game.players.find((p) => p.id === auctioneerId);
  const co = auction?.coAuctioneerId
    ? game.players.find((p) => p.id === auction.coAuctioneerId)
    : undefined;

  const type = auction ? auction.type : 'DOUBLE';
  const isPending = !!game.pendingDouble;

  return (
    <div className="relative shrink-0 overflow-hidden bg-gradient-to-b from-ink/80 to-charcoal/40 px-4 py-4">
      {/* 聚光灯 */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-12 h-40 opacity-60"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(201,162,39,0.16), transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-center gap-3">
        {artworkIds.map((id, i) => (
          <div key={id} className="animate-flipIn" style={{ animationDelay: `${i * 90}ms` }}>
            <ArtworkCard
              artwork={game.artworks[id]}
              artist={game.artists[game.artworks[id].artistId]}
              size="md"
              spotlight
            />
          </div>
        ))}
        {isPending && (
          <div className="flex h-[168px] w-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#7D3CB5]/50 text-center">
            <span className="text-2xl text-[#B9A2DA]/70">＋</span>
            <span className="mt-1 px-2 text-[10px] leading-tight text-muted">
              等待追加
              <br />
              第二幅
            </span>
          </div>
        )}
      </div>

      {/* 拍品信息 */}
      <div className="relative mt-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px]">
          <span className="text-muted">拍卖师</span>
          <span className="font-semibold text-cream">{auctioneer?.name}</span>
          {co && (
            <>
              <span className="text-muted">·</span>
              <span className="text-muted">共同拍卖师</span>
              <span className="font-semibold text-cream">{co.name}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-3 py-1">
          <span className="text-sm text-gold">{AUCTION_TYPE_ICON[type]}</span>
          <span className="text-[12px] font-semibold text-gold">{AUCTION_TYPE_LABEL[type]}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">{AUCTION_TYPE_DESC[type]}</p>
      </div>
    </div>
  );
}

function IdleStage({ game }: { game: GameState }) {
  const cur = game.players[game.currentPlayerIndex];
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-4 py-8 text-center">
      <div className="mb-2 flex h-16 w-12 items-center justify-center rounded-md border-2 border-dashed border-line/70">
        <span className="text-xl text-muted/40">?</span>
      </div>
      <div className="brush-title text-base text-cream/85">拍卖台空置</div>
      <p className="mt-0.5 text-[12px] text-muted">
        {cur ? (
          <>
            等待 <span className="text-cream/80">{cur.name}</span> 提出下一件作品
          </>
        ) : (
          '准备中'
        )}
      </p>
    </div>
  );
}

function TurnHint({ game }: { game: GameState }) {
  const cur = game.players[game.currentPlayerIndex];
  if (!cur) return null;

  if (cur.type === 'AI') {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gold/60"
              style={{ animation: `fadeIn .6s ease-in-out ${i * 0.15}s infinite alternate` }}
            />
          ))}
        </span>
        {cur.name} 正在挑选作品…
      </div>
    );
  }

  if ((cur as Player & { handCount?: number }).handCount ?? cur.hand.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line/60 py-4 text-center text-[12px] text-muted">
        你已没有手牌，本轮不再出牌（但仍可竞买）
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-3 text-center">
      <div className="text-[13px] font-semibold text-gold">轮到 {cur.name} 出牌</div>
      <p className="mt-1 text-[11px] leading-relaxed text-cream/70">
        从下方手牌中选择一幅推上拍卖台。
        <br />
        你将成为拍卖师，成交款归你——除非你自己拍下。
      </p>
      <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted">
        <span>
          现金 <span className="stat text-gold">{money(cur.cash)}</span>
        </span>
        <span>
          手牌 <span className="stat text-cream">{(cur as Player & { handCount?: number }).handCount ?? cur.hand.length}</span>
        </span>
      </div>
    </div>
  );
}
