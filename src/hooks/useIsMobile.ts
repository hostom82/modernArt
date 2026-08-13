import { useEffect, useState } from 'react';

/**
 * 监听媒体查询是否匹配。默认以 640px 为界：
 * <=639px 视为手机竖屏（走 MobileGameLayout），>=640px 沿用桌面三栏。
 * 初始值同步读取，避免 SPA 首屏闪烁。
 */
export function useIsMobile(query = '(max-width: 639px)'): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
