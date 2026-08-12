import type { ArtistId, Artwork, AuctionType } from '@/types/game';

/**
 * 70 张作品牌。
 * 张数：A=12 B=13 C=14 D=15 E=16
 * 类型分布（公开/一轮/暗标/定价/联合）：
 *   A = 3/3/2/2/2   B = 3/2/3/3/2   C = 3/3/3/3/2   D = 3/3/3/3/3   E = 4/3/3/3/3
 */

const NAMES: Record<ArtistId, string[]> = {
  A: [
    '朱红断面',
    '静默的方阵',
    '正午边界',
    '第七块红',
    '对峙',
    '无题·橙',
    '墙与光',
    '切割的地平线',
    '赤色纪年',
    '两个矩形的争论',
    '晨间几何',
    '最后的直角',
  ],
  B: [
    '蓝色构成',
    '坐标之下',
    '一千条经线',
    '制图师的梦',
    '网格研究 No.4',
    '频率',
    '冷静的秩序',
    '穿过雨的线',
    '数据风景',
    '靛蓝矩阵',
    '呼吸的栅栏',
    '北纬四十度',
    '未完成的图表',
  ],
  C: [
    '潮汐记忆',
    '藤蔓与河',
    '绿色低语',
    '生长的证据',
    '贝壳内部',
    '一场缓慢的雨',
    '苔的地图',
    '液体清晨',
    '根系',
    '漂浮的岛',
    '呼吸练习',
    '春分曲线',
    '水下花园',
    '无风的湖面',
  ],
  D: [
    '撕裂的报纸',
    '城市残片',
    '琥珀档案',
    '拼贴自画像',
    '被折叠的星期二',
    '广告牌之死',
    '旧信与灰',
    '碎裂的黄昏',
    '拾荒者的收藏',
    '墙上的通告',
    '断章',
    '九月的碎片',
    '被覆盖的名字',
    '金属与纸',
    '遗失的入场券',
  ],
  E: [
    '紫外线',
    '万千微尘',
    '夜空的噪点',
    '粒子花园',
    '光的失眠',
    '一万个瞬间',
    '雾中信号',
    '散射',
    '紫罗兰频谱',
    '星尘统计',
    '颗粒的重量',
    '显影',
    '末梢神经',
    '薰衣草噪声',
    '无声的雪',
    '像素黄昏',
  ],
};

const O: AuctionType = 'OPEN';
const N: AuctionType = 'ONE_OFFER';
const H: AuctionType = 'HIDDEN';
const F: AuctionType = 'FIXED';
const D: AuctionType = 'DOUBLE';

const TYPES: Record<ArtistId, AuctionType[]> = {
  A: [O, N, H, F, D, O, N, H, F, D, O, N],
  B: [O, N, H, F, D, O, N, H, F, D, O, H, F],
  C: [O, N, H, F, D, O, N, H, F, D, O, N, H, F],
  D: [O, N, H, F, D, O, N, H, F, D, O, N, H, F, D],
  E: [O, N, H, F, D, O, N, H, F, D, O, N, H, F, D, O],
};

/** 简单的字符串哈希，用来给每张牌一个稳定的卡面种子 */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function rarityOf(index: number, total: number): Artwork['rarity'] {
  if (index === total - 1) return 'rare';
  if (index % 4 === 1) return 'uncommon';
  return 'common';
}

export function createArtworks(): Record<string, Artwork> {
  const out: Record<string, Artwork> = {};
  (Object.keys(NAMES) as ArtistId[]).forEach((artistId) => {
    const names = NAMES[artistId];
    const types = TYPES[artistId];
    if (names.length !== types.length) {
      throw new Error(`艺术家 ${artistId} 的作品名与拍卖类型数量不一致`);
    }
    names.forEach((name, i) => {
      const id = `${artistId}${String(i + 1).padStart(2, '0')}`;
      out[id] = {
        id,
        artistId,
        name,
        seed: hashString(id + name),
        auctionType: types[i],
        rarity: rarityOf(i, names.length),
      };
    });
  });
  return out;
}

/** 整副牌的 id 列表（未洗牌，固定顺序） */
export function allArtworkIds(): string[] {
  return Object.keys(createArtworks());
}
