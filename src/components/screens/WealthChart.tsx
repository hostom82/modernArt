import type { GameState } from '@/types/game';

const W = 320;
const H = 150;
const PAD_L = 30;
const PAD_R = 26;
const PAD_T = 10;
const PAD_B = 20;

/** 各玩家现金随轮次变化的折线图 */
export function WealthChart({ game }: { game: GameState }) {
  const snaps = game.cashSnapshots; // [0] = 开局，之后每轮一份
  if (snaps.length < 2) return null;

  const maxV = Math.max(120, ...snaps.flat());
  const rounds = snaps.length - 1;

  const x = (r: number) => PAD_L + (rounds === 0 ? 0 : (r / rounds) * (W - PAD_L - PAD_R));
  const y = (v: number) => H - PAD_B - (v / maxV) * (H - PAD_T - PAD_B);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="玩家财富曲线">
      {/* 网格 */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            y1={y(maxV * t)}
            x2={W - PAD_R}
            y2={y(maxV * t)}
            stroke="#2E2E2E"
            strokeWidth={0.5}
            strokeDasharray={t === 0 ? undefined : '2 3'}
          />
          <text x={PAD_L - 4} y={y(maxV * t) + 3} fontSize={7} fill="#8A8578" textAnchor="end">
            {Math.round(maxV * t)}
          </text>
        </g>
      ))}

      {/* 轮次刻度 */}
      {Array.from({ length: rounds + 1 }, (_, r) => (
        <text key={r} x={x(r)} y={H - 6} fontSize={7} fill="#8A8578" textAnchor="middle">
          {r === 0 ? '开局' : `R${r}`}
        </text>
      ))}

      {/* 玩家曲线 */}
      {game.players.map((p, pi) => {
        const pts = snaps.map((snap, r) => [x(r), y(snap[pi] ?? 0)] as [number, number]);
        const d = pts
          .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`)
          .join(' ');
        const last = pts[pts.length - 1];
        return (
          <g key={p.id}>
            <path
              d={d}
              fill="none"
              stroke={p.avatarColor}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map((pt, i) => (
              <circle key={i} cx={pt[0]} cy={pt[1]} r={2} fill={p.avatarColor} />
            ))}
            <text x={last[0] + 4} y={last[1] + 2.5} fontSize={7.5} fill={p.avatarColor} fontWeight="bold">
              {p.name.slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
