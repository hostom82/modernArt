/**
 * 确定性伪随机数。
 * RNG 的状态存在 GameState.rngState 里，引擎因此保持纯函数：
 * 同一个 seed + 同一串动作 => 完全相同的结果，测试可复现。
 */

export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}

export function nextInt(state: number, maxExclusive: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * maxExclusive), state: r.state };
}

/** Fisher-Yates 洗牌，返回新数组与新的 rng 状态 */
export function shuffle<T>(items: readonly T[], state: number): { items: T[]; state: number } {
  const arr = items.slice();
  let s = state;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.state;
    const j = r.value;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return { items: arr, state: s };
}
