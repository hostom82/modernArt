import type { AiLevel } from '@/types/game';

/**
 * AI 难度档位。
 * 三档的差别集中在「估值有多准」「敢出多少钱」「会不会预测本轮排名」。
 */
export interface AiProfile {
  level: AiLevel;
  label: string;
  desc: string;
  /** 估值噪声幅度：0.3 表示估值会在 ±30% 之间随机偏移 */
  noise: number;
  /** 出价上限相对理论价值的比例 */
  aggression: number;
  /** 现金储备比例，不会把钱一次花光 */
  reserve: number;
  /** 是否预测本轮排名（easy 只看历史累计价值） */
  forecast: boolean;
  /** 暗标出价 = 上限 × 该系数 */
  hiddenFactor: number;
  /** 定价拍卖的定价 = 估值 × 该系数 */
  fixedFactor: number;
  /** 追加第二幅作品的心理门槛（估值低于此值就不追加） */
  doubleThreshold: number;
  /** 随机犯错概率 */
  blunder: number;
  /** 思考时长区间（毫秒），纯 UI 表现 */
  thinkMs: [number, number];
}

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  easy: {
    level: 'easy',
    label: '新手藏家',
    desc: '只看艺术家的历史身价，估价飘忽，偶尔冲动出价',
    noise: 0.34,
    aggression: 0.82,
    reserve: 0.3,
    forecast: false,
    hiddenFactor: 0.66,
    fixedFactor: 0.72,
    doubleThreshold: 26,
    blunder: 0.16,
    thinkMs: [500, 1100],
  },
  normal: {
    level: 'normal',
    label: '画廊主理',
    desc: '会预测本轮排名，出价稳健，懂得留一点周转金',
    noise: 0.15,
    aggression: 0.92,
    reserve: 0.16,
    forecast: true,
    hiddenFactor: 0.8,
    fixedFactor: 0.84,
    doubleThreshold: 18,
    blunder: 0.05,
    thinkMs: [450, 950],
  },
  hard: {
    level: 'hard',
    label: '市场操盘手',
    desc: '精算累计价值与持仓协同，会为了拉抬自己的仓位而出牌',
    noise: 0.05,
    aggression: 1.0,
    reserve: 0.08,
    forecast: true,
    hiddenFactor: 0.9,
    fixedFactor: 0.9,
    doubleThreshold: 12,
    blunder: 0,
    thinkMs: [400, 800],
  },
};

export function profileOf(level: AiLevel | undefined): AiProfile {
  return AI_PROFILES[level ?? 'normal'];
}
