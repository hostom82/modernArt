import { memo, useMemo } from 'react';
import type { Artist, ArtistId } from '@/types/game';

/**
 * 程序化卡面生成器。
 *
 * 每张作品由自己的 seed 决定构图，相同 seed 永远画出同一张画。
 * 五位艺术家各有一套风格族，视觉上一眼可辨：
 *   hardEdge    硬边色域   —— 大色块与切割
 *   lineGrid    精密网格   —— 冷静的直线与刻度
 *   organic     有机曲线   —— 流动的贝塞尔
 *   collage     撕裂拼贴   —— 不规则纸片与压印
 *   pointillism 点彩噪点   —— 密度渐变的粒子
 *
 * 全部为原创算法绘制，不含任何受版权保护的素材。
 */

/* ------------------------------------------------------------------ */
/* 局部随机源（与引擎的 RNG 无关，纯粹用于绘图）                          */
/* ------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

type Rng = () => number;

const rf = (r: Rng, a: number, b: number) => a + r() * (b - a);
const ri = (r: Rng, a: number, b: number) => Math.floor(rf(r, a, b + 1));
const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/* ------------------------------------------------------------------ */
/* 调色                                                                */
/* ------------------------------------------------------------------ */

interface Palette {
  base: string;
  ink: string;
  paper: string;
  accents: string[];
}

const PALETTES: Record<ArtistId, Palette> = {
  A: {
    base: '#E0B400',
    ink: '#241F0A',
    paper: '#FBF3DA',
    accents: ['#E0B400', '#B8860B', '#F4D03F', '#C9A227', '#5A4A12'],
  },
  B: {
    base: '#2E9E5B',
    ink: '#0F1E15',
    paper: '#E6F2EA',
    accents: ['#2E9E5B', '#1E7A43', '#5FBF87', '#3FA968', '#16412A'],
  },
  C: {
    base: '#C0392B',
    ink: '#1E0E0C',
    paper: '#F6E3DF',
    accents: ['#C0392B', '#922B21', '#E5736A', '#D94A3A', '#3A1410'],
  },
  D: {
    base: '#7D3CB5',
    ink: '#160A22',
    paper: '#EDE4F4',
    accents: ['#7D3CB5', '#5A2A85', '#A06FCF', '#9B59B6', '#2E1840'],
  },
  E: {
    base: '#8A5A2B',
    ink: '#1E130A',
    paper: '#F0E6D6',
    accents: ['#8A5A2B', '#6B431E', '#B07C45', '#A8753A', '#3A2412'],
  },
};

/* ------------------------------------------------------------------ */
/* 画布常量                                                             */
/* ------------------------------------------------------------------ */

const W = 100;
const H = 128;

/* ------------------------------------------------------------------ */
/* 五种风格族                                                           */
/* ------------------------------------------------------------------ */

/** 硬边色域：横竖切割出的大色块，边界锐利 */
function hardEdge(r: Rng, p: Palette): JSX.Element[] {
  const out: JSX.Element[] = [];
  const vertical = r() > 0.45;
  const cuts = ri(r, 2, 4);

  // 切割位置
  const stops = [0];
  for (let i = 0; i < cuts; i++) stops.push(rf(r, 0.12, 0.88));
  stops.push(1);
  stops.sort((a, b) => a - b);

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const c = i === 0 ? p.base : pick(r, p.accents);
    out.push(
      vertical ? (
        <rect key={`b${i}`} x={a * W} y={0} width={(b - a) * W} height={H} fill={c} />
      ) : (
        <rect key={`b${i}`} x={0} y={a * H} width={W} height={(b - a) * H} fill={c} />
      ),
    );
  }

  // 一条对冲的窄带
  if (r() > 0.35) {
    const t = rf(r, 0.2, 0.8);
    const thick = rf(r, 2.5, 7);
    out.push(
      vertical ? (
        <rect key="band" x={0} y={t * H} width={W} height={thick} fill={p.paper} opacity={0.92} />
      ) : (
        <rect key="band" x={t * W} y={0} width={thick} height={H} fill={p.paper} opacity={0.92} />
      ),
    );
  }

  // 一个失衡的小方块
  if (r() > 0.4) {
    const s = rf(r, 8, 20);
    out.push(
      <rect
        key="sq"
        x={rf(r, 6, W - s - 6)}
        y={rf(r, 6, H - s - 6)}
        width={s}
        height={s}
        fill={p.ink}
        opacity={0.85}
      />,
    );
  }
  return out;
}

/** 精密网格：等距细线 + 局部加密 + 刻度感 */
function lineGrid(r: Rng, p: Palette): JSX.Element[] {
  const out: JSX.Element[] = [];
  out.push(<rect key="bg" x={0} y={0} width={W} height={H} fill={p.paper} />);

  const cols = ri(r, 9, 18);
  const rows = ri(r, 12, 22);
  const dense = ri(r, 0, cols - 1);

  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * W;
    const near = Math.abs(i - dense) <= 2;
    out.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={H}
        stroke={near ? p.base : p.accents[1]}
        strokeWidth={near ? 0.9 : 0.28}
        opacity={near ? 0.95 : 0.5}
      />,
    );
  }
  for (let i = 0; i <= rows; i++) {
    const y = (i / rows) * H;
    out.push(
      <line
        key={`h${i}`}
        x1={0}
        y1={y}
        x2={W}
        y2={y}
        stroke={p.accents[1]}
        strokeWidth={0.22}
        opacity={0.38}
      />,
    );
  }

  // 实心色块：网格里被「填上」的几格
  const blocks = ri(r, 3, 7);
  for (let i = 0; i < blocks; i++) {
    const cx = ri(r, 0, cols - 1);
    const cy = ri(r, 0, rows - 1);
    const cw = ri(r, 1, 3);
    const ch = ri(r, 1, 3);
    out.push(
      <rect
        key={`bk${i}`}
        x={(cx / cols) * W}
        y={(cy / rows) * H}
        width={(cw / cols) * W}
        height={(ch / rows) * H}
        fill={pick(r, p.accents)}
        opacity={rf(r, 0.55, 1)}
      />,
    );
  }

  // 一条穿越全图的斜线，打破秩序
  if (r() > 0.5) {
    out.push(
      <line
        key="diag"
        x1={0}
        y1={rf(r, 0, H)}
        x2={W}
        y2={rf(r, 0, H)}
        stroke={p.ink}
        strokeWidth={0.8}
        opacity={0.75}
      />,
    );
  }
  return out;
}

/** 有机曲线：层叠的流动波形 */
function organic(r: Rng, p: Palette): JSX.Element[] {
  const out: JSX.Element[] = [];
  out.push(<rect key="bg" x={0} y={0} width={W} height={H} fill={p.paper} />);

  const layers = ri(r, 4, 7);
  for (let i = 0; i < layers; i++) {
    const baseY = ((i + 0.6) / layers) * H;
    const amp = rf(r, 6, 20);
    const y0 = baseY + rf(r, -6, 6);
    const c1x = rf(r, 10, 45);
    const c1y = baseY - amp;
    const c2x = rf(r, 55, 92);
    const c2y = baseY + amp;
    const y1 = baseY + rf(r, -8, 8);
    const d = `M -4 ${y0} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${W + 4} ${y1} L ${W + 4} ${H + 4} L -4 ${H + 4} Z`;
    out.push(
      <path key={`w${i}`} d={d} fill={pick(r, p.accents)} opacity={rf(r, 0.45, 0.9)} />,
    );
  }

  // 悬浮的种子形
  const pods = ri(r, 2, 5);
  for (let i = 0; i < pods; i++) {
    const cx = rf(r, 14, W - 14);
    const cy = rf(r, 12, H * 0.62);
    const rx = rf(r, 3, 9);
    out.push(
      <ellipse
        key={`p${i}`}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={rx * rf(r, 1.1, 2.1)}
        fill={p.ink}
        opacity={rf(r, 0.35, 0.7)}
        transform={`rotate(${rf(r, -35, 35)} ${cx} ${cy})`}
      />,
    );
  }

  // 一条细的引导线
  out.push(
    <path
      key="thread"
      d={`M ${rf(r, 4, 30)} -2 Q ${rf(r, 30, 70)} ${H / 2}, ${rf(r, 60, 96)} ${H + 2}`}
      fill="none"
      stroke={p.paper}
      strokeWidth={0.7}
      opacity={0.8}
    />,
  );
  return out;
}

/** 撕裂拼贴：不规则纸片叠压 + 印刷噪点 */
function collage(r: Rng, p: Palette): JSX.Element[] {
  const out: JSX.Element[] = [];
  out.push(<rect key="bg" x={0} y={0} width={W} height={H} fill={p.ink} />);

  const scraps = ri(r, 5, 9);
  for (let i = 0; i < scraps; i++) {
    const cx = rf(r, 12, W - 12);
    const cy = rf(r, 12, H - 12);
    const rad = rf(r, 12, 30);
    const pts: string[] = [];
    const n = ri(r, 5, 9);
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2;
      const rr = rad * rf(r, 0.55, 1.15); // 撕裂的边缘
      pts.push(`${(cx + Math.cos(ang) * rr).toFixed(1)},${(cy + Math.sin(ang) * rr * 0.85).toFixed(1)}`);
    }
    out.push(
      <polygon
        key={`s${i}`}
        points={pts.join(' ')}
        fill={pick(r, p.accents)}
        opacity={rf(r, 0.7, 1)}
        stroke={p.paper}
        strokeWidth={rf(r, 0, 0.5)}
      />,
    );
  }

  // 「报纸」文字条
  const lines = ri(r, 4, 9);
  for (let i = 0; i < lines; i++) {
    out.push(
      <rect
        key={`t${i}`}
        x={rf(r, 8, 55)}
        y={rf(r, 10, H - 12)}
        width={rf(r, 14, 38)}
        height={rf(r, 0.8, 1.8)}
        fill={p.paper}
        opacity={rf(r, 0.35, 0.8)}
      />,
    );
  }

  // 压印方框
  if (r() > 0.4) {
    const s = rf(r, 16, 32);
    out.push(
      <rect
        key="stamp"
        x={rf(r, 6, W - s - 6)}
        y={rf(r, 6, H - s - 6)}
        width={s}
        height={s * rf(r, 0.6, 1)}
        fill="none"
        stroke={p.base}
        strokeWidth={1.4}
        opacity={0.9}
      />,
    );
  }
  return out;
}

/** 点彩噪点：密度渐变的粒子云 */
function pointillism(r: Rng, p: Palette): JSX.Element[] {
  const out: JSX.Element[] = [];
  out.push(<rect key="bg" x={0} y={0} width={W} height={H} fill={p.ink} />);

  // 两个引力中心，粒子向它们聚集
  const centers = Array.from({ length: ri(r, 1, 3) }, () => ({
    x: rf(r, 18, W - 18),
    y: rf(r, 20, H - 20),
    s: rf(r, 18, 40),
  }));

  const count = ri(r, 190, 300);
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    // 近似高斯：多次均匀采样求和
    const gx = (r() + r() + r() - 1.5) * c.s;
    const gy = (r() + r() + r() - 1.5) * c.s * 1.15;
    const x = c.x + gx;
    const y = c.y + gy;
    if (x < -2 || x > W + 2 || y < -2 || y > H + 2) continue;
    const d = Math.hypot(gx / c.s, gy / c.s);
    out.push(
      <circle
        key={`d${i}`}
        cx={x.toFixed(1)}
        cy={y.toFixed(1)}
        r={rf(r, 0.5, 2.0) * (1.25 - d * 0.4)}
        fill={pick(r, p.accents)}
        opacity={Math.max(0.15, 1 - d * 0.55)}
      />,
    );
  }

  // 一道扫过的光带
  if (r() > 0.35) {
    const y = rf(r, 16, H - 16);
    out.push(
      <rect key="beam" x={0} y={y} width={W} height={rf(r, 1.2, 4)} fill={p.paper} opacity={0.5} />,
    );
  }
  return out;
}

const RENDERERS: Record<Artist['styleFamily'], (r: Rng, p: Palette) => JSX.Element[]> = {
  hardEdge,
  lineGrid,
  organic,
  collage,
  pointillism,
};

/* ------------------------------------------------------------------ */
/* 对外组件                                                             */
/* ------------------------------------------------------------------ */

export interface ArtworkArtProps {
  seed: number;
  artistId: ArtistId;
  styleFamily: Artist['styleFamily'];
  className?: string;
  /** 画框内的暗角与纹理，缩略图可关掉省性能 */
  rich?: boolean;
}

function ArtworkArtImpl({ seed, artistId, styleFamily, className, rich = true }: ArtworkArtProps) {
  const palette = PALETTES[artistId];
  const uid = `${artistId}-${seed >>> 0}`;

  const shapes = useMemo(() => {
    const r = makeRng(seed);
    return RENDERERS[styleFamily](r, palette);
  }, [seed, styleFamily, palette]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="程序化生成的抽象画作"
    >
      <defs>
        <clipPath id={`clip-${uid}`}>
          <rect x={0} y={0} width={W} height={H} rx={1.5} />
        </clipPath>
        {rich && (
          <radialGradient id={`vig-${uid}`} cx="50%" cy="45%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
          </radialGradient>
        )}
      </defs>

      <g clipPath={`url(#clip-${uid})`}>
        <rect x={0} y={0} width={W} height={H} fill={palette.paper} />
        {shapes}
        {rich && <rect x={0} y={0} width={W} height={H} fill={`url(#vig-${uid})`} />}
      </g>

      {/* 画框 */}
      <rect
        x={0.4}
        y={0.4}
        width={W - 0.8}
        height={H - 0.8}
        rx={1.5}
        fill="none"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={0.8}
      />
    </svg>
  );
}

export const ArtworkArt = memo(ArtworkArtImpl);

/** 供图例 / 教程使用的艺术家风格样本 */
export function ArtistSwatch({
  artistId,
  styleFamily,
  className,
}: {
  artistId: ArtistId;
  styleFamily: Artist['styleFamily'];
  className?: string;
}) {
  return (
    <ArtworkArt
      seed={artistId.charCodeAt(0) * 7919 + 13}
      artistId={artistId}
      styleFamily={styleFamily}
      className={className}
      rich={false}
    />
  );
}
