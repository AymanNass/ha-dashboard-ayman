import { useEffect, useRef } from 'react';
import { isLiteMode, isMobileLayout } from '../lib/perfMode';

interface Options {
  /** Fire to move to the next page (swipe left) or previous (swipe right). */
  onSwipe: (dir: 'next' | 'prev') => void;
  /** Only arm the gesture when this media query matches (e.g. phone widths). */
  query?: string;
  /** Minimum horizontal travel, in px, to count as a swipe. */
  threshold?: number;
  /** Horizontal travel must exceed vertical by this factor (keeps vertical
   *  scrolling from being read as a sideways swipe). */
  ratio?: number;
}

/** Is `el` (or an ancestor up to `stop`) horizontally scrollable? Swipes that
 *  start on a carousel (scenes row, camera strip) should scroll it, not flip
 *  the page. */
function inHorizontalScroller(el: Element | null, stop: Element): boolean {
  // Lite mode: skip the ancestor walk. getComputedStyle + scrollWidth/clientWidth
  // on every node up the chain forces a synchronous style+layout flush right
  // inside touchstart — a direct INP hit on a slow device. We accept that a
  // swipe starting on a horizontal carousel may flip the page instead of
  // scrolling it; negligible on a wall tablet.
  if (isLiteMode()) return false;
  let node: Element | null = el;
  while (node && node !== stop) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      const ox = style.overflowX;
      if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 2) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Attach horizontal swipe-to-navigate to an element (the scrolling page area).
 * Built for phone portrait, where the sidebar is hidden: a left swipe advances
 * to the next page, a right swipe goes back. Listeners are passive (they never
 * block native vertical scrolling); the gesture only commits on touch end when
 * the motion is clearly, dominantly horizontal and didn't begin inside a
 * horizontal carousel.
 */
export function useSwipeNav(
  ref: React.RefObject<HTMLElement | null>,
  { onSwipe, query = '(max-width: 480px)', threshold = 60, ratio = 1.5 }: Options,
) {
  // Keep the latest callback without re-binding listeners every render.
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Mobile layout uses the bottom nav for paging; swipe-to-change-page gets
    // in the way of normal vertical scrolling and fires by accident, so it's
    // disabled there.
    if (isMobileLayout()) return;

    const mq = window.matchMedia(query);
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (!mq.matches || e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      if (inHorizontalScroller(e.target as Element, el)) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * ratio) return;
      cb.current(dx < 0 ? 'next' : 'prev');
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [ref, query, threshold, ratio]);
}
