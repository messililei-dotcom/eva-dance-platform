'use client';

import { useEffect } from 'react';
import { getHistorySwipeDirection } from '@/lib/mobile-history-swipe';

const INTENT_LOCK_DISTANCE = 12;
const INTENT_LOCK_RATIO = 1.2;
const SYSTEM_EDGE_GUARD = 24;
const SWIPE_IGNORE_SELECTOR = [
  '[data-history-swipe="ignore"]',
  '[contenteditable="true"]',
  '[draggable="true"]',
  '[role="slider"]',
  'input',
  'textarea',
  'select',
  'option',
  'video',
  'audio',
  'canvas',
].join(',');

type ActiveGesture = {
  startX: number;
  startY: number;
  startedAt: number;
  intent: 'pending' | 'horizontal' | 'cancelled';
};

function isInsideHorizontalScroller(target: Element) {
  let element: Element | null = target;

  while (element && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll')
      && element.scrollWidth > element.clientWidth + 1
    ) {
      return true;
    }
    element = element.parentElement;
  }

  return false;
}

function shouldIgnoreTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;
  return Boolean(target.closest(SWIPE_IGNORE_SELECTOR)) || isInsideHorizontalScroller(target);
}

/**
 * Enables app-like history navigation on touch devices:
 * swipe right to go back, swipe left to go forward.
 */
export default function MobileHistorySwipe() {
  useEffect(() => {
    if (navigator.maxTouchPoints <= 0 && !('ontouchstart' in window)) return;

    let gesture: ActiveGesture | null = null;
    let navigationInFlight = false;
    let navigationResetTimer: number | null = null;

    const resetGesture = () => {
      gesture = null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      resetGesture();
      if (
        navigationInFlight
        || event.touches.length !== 1
        || document.fullscreenElement
        || shouldIgnoreTarget(event.target)
      ) {
        return;
      }

      const touch = event.touches[0];
      // Preserve Safari/Chrome's native edge gesture and prevent two history
      // moves from being fired for the same swipe.
      if (
        touch.clientX <= SYSTEM_EDGE_GUARD
        || touch.clientX >= window.innerWidth - SYSTEM_EDGE_GUARD
      ) {
        return;
      }

      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: performance.now(),
        intent: 'pending',
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1 || gesture.intent === 'cancelled') return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < INTENT_LOCK_DISTANCE) return;

      if (gesture.intent === 'pending') {
        const horizontalDistance = Math.abs(deltaX);
        const verticalDistance = Math.abs(deltaY);
        if (horizontalDistance >= verticalDistance * INTENT_LOCK_RATIO) {
          gesture.intent = 'horizontal';
        } else if (verticalDistance >= horizontalDistance * INTENT_LOCK_RATIO) {
          gesture.intent = 'cancelled';
        }
      }

      if (gesture.intent === 'horizontal') {
        // Cancels click activation and horizontal viewport bounce only after
        // the user has made a clear horizontal gesture.
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (!gesture || navigationInFlight || event.changedTouches.length !== 1) {
        resetGesture();
        return;
      }

      const completedGesture = gesture;
      resetGesture();
      if (completedGesture.intent === 'cancelled') return;

      const touch = event.changedTouches[0];
      const direction = getHistorySwipeDirection({
        deltaX: touch.clientX - completedGesture.startX,
        deltaY: touch.clientY - completedGesture.startY,
        durationMs: performance.now() - completedGesture.startedAt,
      });
      if (!direction) return;

      event.preventDefault();
      event.stopPropagation();
      navigationInFlight = true;

      if (direction === 'back') window.history.back();
      else window.history.forward();

      // If no matching history entry exists, the browser stays on this page.
      // Re-enable gestures shortly afterward in that case.
      navigationResetTimer = window.setTimeout(() => {
        navigationInFlight = false;
      }, 700);
    };

    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    document.addEventListener('touchcancel', resetGesture, { capture: true, passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchcancel', resetGesture, true);
      if (navigationResetTimer !== null) window.clearTimeout(navigationResetTimer);
    };
  }, []);

  return null;
}
