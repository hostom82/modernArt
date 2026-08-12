import { useGameStore } from '@/store/gameStore';
import { actingHuman } from '@/store/selectors';
import { StartScreen } from '@/components/screens/StartScreen';
import { Lobby } from '@/components/screens/Lobby';
import { GameOver } from '@/components/screens/GameOver';
import { RoundScoring } from '@/components/screens/RoundScoring';
import { RulesPage } from '@/components/screens/RulesPage';
import { Tutorial } from '@/components/screens/Tutorial';
import { TopBar } from '@/components/board/TopBar';
import { PlayerPanel } from '@/components/board/PlayerPanel';
import { MarketPanel } from '@/components/board/MarketPanel';
import { AuctionHall } from '@/components/board/AuctionHall';
import { HandArea } from '@/components/board/HandArea';
import { GameLog, GameLogPanel } from '@/components/board/GameLog';
import { ToastHost } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';

export default function App() {
  const game = useGameStore((s) => s.game);
  const mode = useGameStore((s) => s.mode);
  const roomCode = useGameStore((s) => s.roomCode);
  const mySeat = useGameStore((s) => s.mySeat);
  const showLog = useGameStore((s) => s.showLog);
  const setShowLog = useGameStore((s) => s.setShowLog);

  // 主菜单：还没有开局；联机模式已进房间但还没开局时显示大厅
  if (!game) {
    if (mode === 'network' && roomCode) {
      return (
        <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-ink via-charcoal to-ink">
          <Lobby />
          <RulesPage />
          <Tutorial />
          <ToastHost />
        </div>
      );
    }
    return (
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-ink via-charcoal to-ink">
        <StartScreen />
        <RulesPage />
        <Tutorial />
        <ToastHost />
      </div>
    );
  }

  // 终局
  if (game.phase === 'GAME_END') {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-ink via-charcoal to-ink">
        <GameOver game={game} />
        <RoundScoring game={game} />
        <RulesPage />
        <Tutorial />
        <ToastHost />
      </div>
    );
  }

  // 对局中
  const activeId = actingHuman(game, mySeat)?.id;

  return (
    <div className="flex h-[100dvh] flex-col bg-gradient-to-b from-ink via-charcoal to-ink">
      <TopBar game={game} />

      <main className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3 lg:overflow-hidden">
        <div className="grid gap-2.5 sm:gap-3 lg:h-full lg:grid-cols-[17rem_1fr_19rem]">
          {/* 左：座次 */}
          <div className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
            <PlayerPanel game={game} activeId={activeId} />
          </div>

          {/* 中：拍卖台 + 手牌 */}
          <div className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
            <div className="min-h-[320px] lg:min-h-0 lg:flex-1">
              <AuctionHall game={game} />
            </div>
            <div className="shrink-0">
              <HandArea game={game} />
            </div>
          </div>

          {/* 右：市场行情 + 日志 */}
          <div className="flex min-h-0 flex-col gap-2.5 sm:gap-3">
            <div className="min-h-[300px] lg:min-h-0 lg:flex-1">
              <MarketPanel game={game} />
            </div>
            <div className="h-56 shrink-0 lg:h-52">
              <GameLogPanel game={game} />
            </div>
          </div>
        </div>
      </main>

      {/* 全局浮层 */}
      <RoundScoring game={game} />
      <RulesPage />
      <Tutorial />
      <ToastHost />

      {/* 完整日志弹窗 */}
      <Modal
        open={showLog}
        onClose={() => setShowLog(false)}
        title="牌局日志"
        size="md"
        footer={
          <button className="btn-ghost w-full" onClick={() => setShowLog(false)}>
            关闭
          </button>
        }
      >
        <div className="h-[60vh]">
          <GameLog game={game} />
        </div>
      </Modal>
    </div>
  );
}
