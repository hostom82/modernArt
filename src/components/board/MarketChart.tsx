import type { GameState } from '@/types/game';
import { ARTIST_ORDER } from '@/types/game';

const W = 260;
const H = 96;
const PAD_L = 20;
const PAD_R = 6;
const PAD_T = 8;
const PAD_B = 16;

/**
 * 五位艺术家的累计身价折线图。
 * 横轴为轮次（0 = 开局），纵轴为累计价值。只画已经结算过的轮次。
 */
export function MarketChart({ game }: { game: GameState }) {
  // 已结算轮数：valueHistory 里非零位置的最大索引 + 1；用 roundHistory 更可靠
  const donerounds = game.roundHistory.length;
  const shown = Math.max(donerounds, 0);

  const maxV = Math.max(
    30,
    ...ARTIST_ORDER.map((id) =>
      game.artists[id].valueHistory.slice(0, shown).reduce((s, v) => s + v, 0),
    ),
  );

  const x = (r: number) => PAD_L + (r / 4) * (W - PAD_L - PAD_R);
  const y = (v: number) => H - PAD_B - (v / maxV) * (H - PAD_T - PAD_B);

  if (shown === 0) {
    return (
      <div className="flex h-[96px] items-center justify-center rounded-md border border-dashed border-line/60 text-[11px] text-muted/60">
        第 1 轮结算后显示走势
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="艺术家身价走势图">
      {/* 网格 */}
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line
            x1={PAD_L}
            y1={y(maxV * t)}
            x2={W - PAD_R}
            y2={y(maxV * t)}
            stroke="#333"
            strokeWidth={0.5}
            strokeDasharray={t === 0 ? undefined : '2 3'}
          />
          <text x={PAD_L - 4} y={y(maxV * t) + 3} fontSize={7} fill="#8A8578" textAnchor="end">
            {Math.round(maxV * t)}
          </text>
        </g>
      ))}

      {/* 轮次刻度 */}
      {[1, 2, 3, 4].map((r) => (
        <text key={r} x={x(r)} y={H - 4} fontSize={7} fill="#8A8578" textAnchor="middle">
          R{r}
        </text>
      ))}

      {/* 折线 */}
      {ARTIST_ORDER.map((id) => {
        const artist = game.artists[id];
        let acc = 0;
        const pts: [number, number][] = [[x(0), y(0)]];
        for (let r = 1; r <= shown; r++) {
          acc += artist.valueHistory[r - 1] ?? 0;
          pts.push([x(r), y(acc)]);
        }
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
        const lastPt = pts[pts.length - 1];
        return (
          <g key={id}>
            <path d={d} fill="none" stroke={artist.color} strokeWidth={1.6} strokeLinejoin="round" />
            {pts.slice(1).map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={1.8} fill={artist.color} />
            ))}
            <text
              x={lastPt[0] + 3}
              y={lastPt[1] + 2.5}
              fontSize={7}
              fill={artist.color}
              fontWeight="bold"
            >
              {id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
