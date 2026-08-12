import type { Artist, Artwork } from '@/types/game';
import { AUCTION_TYPE_ICON, AUCTION_TYPE_LABEL } from '@/data/artists';
import { ArtworkArt } from '@/art/generateArtwork';
import { cx } from '@/utils/format';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<CardSize, string> = {
  xs: 'w-14',
  sm: 'w-24',
  md: 'w-32',
  lg: 'w-44',
};

const TITLE_CLASS: Record<CardSize, string> = {
  xs: 'text-[7px] leading-tight',
  sm: 'text-[10px] leading-tight',
  md: 'text-xs leading-snug',
  lg: 'text-sm leading-snug',
};

interface ArtworkCardProps {
  artwork: Artwork;
  artist: Artist;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  /** 高亮描边，用于「这是本次拍卖品」 */
  spotlight?: boolean;
  onClick?: () => void;
  className?: string;
  /** 右上角自定义角标 */
  badge?: string;
}

export function ArtworkCard({
  artwork,
  artist,
  size = 'md',
  selected,
  disabled,
  spotlight,
  onClick,
  className,
  badge,
}: ArtworkCardProps) {
  const clickable = !!onClick && !disabled;
  const showMeta = size !== 'xs';

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      title={`${artwork.name} · ${artist.name} · ${AUCTION_TYPE_LABEL[artwork.auctionType]}`}
      className={cx(
        'group relative shrink-0 overflow-hidden rounded-lg border text-left transition-all duration-200',
        SIZE_CLASS[size],
        selected
          ? '-translate-y-2 border-gold shadow-[0_0_0_2px_rgba(201,162,39,0.45),0_12px_28px_rgba(0,0,0,0.55)]'
          : 'border-line/80',
        spotlight && 'border-gold/70 shadow-[0_0_24px_rgba(201,162,39,0.28)]',
        clickable && !selected && 'hover:-translate-y-1.5 hover:border-gold/60 hover:shadow-xl',
        disabled && 'opacity-45 saturate-50',
        !clickable && 'cursor-default',
        className,
      )}
      style={{ backgroundColor: '#151515' }}
    >
      {/* 画面 */}
      <div className="relative aspect-[100/128] w-full overflow-hidden">
        <ArtworkArt
          seed={artwork.seed}
          artistId={artwork.artistId}
          styleFamily={artist.styleFamily}
          className="h-full w-full"
          rich={size !== 'xs'}
        />
        {/* 艺术家色条 */}
        <div
          className="absolute inset-x-0 bottom-0 h-[3px]"
          style={{ backgroundColor: artist.color }}
        />
        {badge && (
          <span className="absolute right-1 top-1 rounded bg-black/75 px-1 py-px text-[9px] font-semibold text-gold">
            {badge}
          </span>
        )}
      </div>

      {/* 铭牌 */}
      {showMeta && (
        <div className="plank space-y-0.5 px-1.5 py-1.5">
          <div className={cx('truncate font-medium text-cream', TITLE_CLASS[size])}>
            {artwork.name}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[9px] text-muted">{artist.name}</span>
            <span
              className="shrink-0 text-[9px] font-semibold"
              style={{ color: artist.color }}
              title={AUCTION_TYPE_LABEL[artwork.auctionType]}
            >
              {AUCTION_TYPE_ICON[artwork.auctionType]}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

/** 卡背，用于对手手牌 */
export function CardBack({ size = 'xs', count }: { size?: CardSize; count?: number }) {
  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden rounded-md border border-line/70',
        SIZE_CLASS[size],
      )}
    >
      <div className="flex aspect-[100/128] w-full items-center justify-center bg-gradient-to-br from-slate2 to-charcoal">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-gold/40 text-[9px] text-gold/70">
          M
        </div>
      </div>
      {count !== undefined && (
        <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[9px] text-cream/80">
          ×{count}
        </span>
      )}
    </div>
  );
}
