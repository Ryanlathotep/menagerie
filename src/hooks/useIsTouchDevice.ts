// Detects whether the primary input is touch (no fine pointer / no hover).
// Used to suppress hover-triggered tooltips and hover-cards on mobile, where
// they open on tap and obscure the underlying UI.

import { useEffect, useState } from 'react';

export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setIsTouch(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isTouch;
}
