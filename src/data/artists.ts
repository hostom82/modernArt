import type { Artist, ArtistId } from '@/types/game';

/** 五位原创虚构艺术家。固定顺序 A > B > C > D > E 同时用于平名次决胜。 */
export const ARTIST_DEFS: Record<ArtistId, Omit<Artist, 'roundCounts' | 'valueHistory' | 'cumulativeValue'>> = {
  A: {
    id: 'A',
    name: '艾琳·莫尔',
    latinName: 'ELIN MOHR',
    color: '#E0B400',
    styleFamily: 'hardEdge',
    tagline: '硬边色域 · yellow field',
    totalCards: 12,
  },
  B: {
    id: 'B',
    name: '诺亚·维克',
    latinName: 'NOAH VIK',
    color: '#2E9E5B',
    styleFamily: 'lineGrid',
    tagline: '精密网格 · green order',
    totalCards: 13,
  },
  C: {
    id: 'C',
    name: '莉亚·森',
    latinName: 'LIA SEN',
    color: '#C0392B',
    styleFamily: 'organic',
    tagline: '有机曲线 · red line',
    totalCards: 14,
  },
  D: {
    id: 'D',
    name: '亚历克斯·罗恩',
    latinName: 'ALEX RONE',
    color: '#7D3CB5',
    styleFamily: 'collage',
    tagline: '撕裂拼贴 · purple paper',
    totalCards: 15,
  },
  E: {
    id: 'E',
    name: '米娅·凯尔',
    latinName: 'MIA KELL',
    color: '#8A5A2B',
    styleFamily: 'pointillism',
    tagline: '点彩噪点 · brown particle',
    totalCards: 16,
  },
};

export function createArtists(): Record<ArtistId, Artist> {
  const out = {} as Record<ArtistId, Artist>;
  (Object.keys(ARTIST_DEFS) as ArtistId[]).forEach((id) => {
    out[id] = {
      ...ARTIST_DEFS[id],
      roundCounts: [0, 0, 0, 0],
      valueHistory: [0, 0, 0, 0],
      cumulativeValue: 0,
    };
  });
  return out;
}

export const AUCTION_TYPE_LABEL: Record<string, string> = {
  OPEN: '公开竞价',
  ONE_OFFER: '一轮报价',
  HIDDEN: '暗标拍卖',
  FIXED: '定价拍卖',
  DOUBLE: '联合拍卖',
};

export const AUCTION_TYPE_ICON: Record<string, string> = {
  OPEN: '✚', // 公开竞价 → 十字
  ONE_OFFER: '↻', // 一轮报价 → 顺时针圆圈箭头
  HIDDEN: '●', // 暗标拍卖 → 实心圆
  FIXED: '$', // 定价拍卖 → 美元
  DOUBLE: '═', // 联合拍卖 → 两条横杠
};

export const AUCTION_TYPE_DESC: Record<string, string> = {
  OPEN: '所有人自由加价，倒计时归零落槌',
  ONE_OFFER: '每人仅一次机会，拍卖师最后决定',
  HIDDEN: '同时秘密出价，最高者得',
  FIXED: '拍卖师定价，无人接手则自购',
  DOUBLE: '可追加同艺术家第二幅，收益平分',
};
