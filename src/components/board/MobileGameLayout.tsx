import { useState } from 'react';
import type { GameState } from '@/types/game';
import { TopBar } from './TopBar';
import { OpponentStrip } from './OpponentStrip';
import { AuctionHall } from './AuctionHall';
import { MarketPanel } from './MarketPanel';
import { HandArea } from './HandArea';
import { GameLogPanel } from './GameLog';
import { cx } from '@/utils/format';

type Tab = 'board' | 'market' | 'log';

/**
 * 手机竖屏（<640px）对局布局：
 * 固定顶栏 → 固定对手条 → 中央标签内容(牌局/行情/日志) → 固定手牌 → 底部标签栏。
 * 整列高度锁定为视口高度并裁剪溢出，手牌区高度封顶，保证底部标签栏永不被挤出屏幕。
 */
export function MobileGameLayout({
  game,
  activeId,
}: {
  game: GameState;
  activeId?: string;
}) {
  const [tab, setTab] = useState<Tab>('board');

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-ink via-charcoal to-ink pt-[env(safe-area-inset-top)]">
      <TopBar game={game} mobile />

      <OpponentStrip game={game} activeId={activeId} />

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'board' && <AuctionHall game={game} />}
        {tab === 'market' && (
          <div className="h-full p-2.5">
            <MarketPanel game={game} />
          </div>
        )}
        {tab === 'log' && (
          <div className="h-full p-2.5">
            <GameLogPanel game={game} />
          </div>
        )}
      </main>

      {/* 固定手牌区（始终可见），确定高度封顶，避免挤出底部标签栏 */}
      <div className="h-[32vh] min-h-[190px] max-h-[300px] shrink-0">
        <HandArea game={game} mobile />
      </div>

      {/* 底部标签栏（含安全区） */}
      <nav className="flex shrink-0 border-t border-line/70 bg-ink/80 pb-[env(safe-area-inset-bottom)]">
        <TabButton label="牌局" active={tab === 'board'} onClick={() => setTab('board')} />
        <TabButton label="行情" active={tab === 'market'} onClick={() => setTab('market')} />
        <TabButton label="日志" active={tab === 'log'} onClick={() => setTab('log')} />
      </nav>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
        active ? 'text-gold' : 'text-muted hover:text-cream/80',
      )}
      style={active ? { borderTop: '2px solid #C9A227' } : { borderTop: '2px solid transparent' }}
    >
      {label}
    </button>
  );
}
