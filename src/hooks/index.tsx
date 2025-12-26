import { useRef, useEffect } from 'react';

// ロード時に実行
export function useIsMounted() {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;  // ロード完了後にtrue
  }, []);
  return isMounted;
}