import { useEffect, useRef } from 'react';

/**
 * Calls onDismiss when pointerdown occurs outside containerRef.
 * Ignores events for graceMs after mount so the opening tap does not close the popover.
 */
export default function useOutsidePointerDismiss(containerRef, onDismiss, graceMs = 400) {
  useEffect(() => {
    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, graceMs);

    const handlePointerDown = (event) => {
      if (!armed) return;
      if (containerRef.current?.contains(event.target)) return;
      onDismiss();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      clearTimeout(armTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [containerRef, onDismiss, graceMs]);
}

/**
 * Returns a function that is true during graceMs after `active` becomes true.
 * Use on backdrop onClick so the opening tap does not immediately dismiss.
 */
export function useOpenGrace(graceMs = 400, active = true) {
  const openedAtRef = useRef(performance.now());

  useEffect(() => {
    if (!active) return;
    openedAtRef.current = performance.now();
  }, [active, graceMs]);

  return () => performance.now() - openedAtRef.current < graceMs;
}
