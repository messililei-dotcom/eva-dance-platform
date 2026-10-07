'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { lessonDropPosition, startDragScrollLoop, type DropTarget } from '@/lib/lesson-drag-sort';
import styles from './lesson-drag-sort.module.css';

export function useLessonDragSort({ ids, disabled, onMove }: {
  ids: number[];
  disabled: boolean;
  onMove: (id: number, position: number) => void;
}) {
  const [drag, setDrag] = useState<{ id: number; target: DropTarget | null } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const latest = useRef({ ids, disabled, onMove });
  latest.current = { ids, disabled, onMove };
  useEffect(() => () => cleanupRef.current?.(), []);
  useEffect(() => { if (disabled) cleanupRef.current?.(); }, [disabled]);

  const start = (event: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    if (latest.current.disabled || event.button !== 0 || !event.isPrimary) return;
    const handle = event.currentTarget;
    const host = handle.closest('.admin-adaptive-table');
    const body = host?.querySelector<HTMLElement>('.ant-table-body');
    if (!body) return;
    event.preventDefault();
    cleanupRef.current?.();
    handle.focus({ preventScroll: true });
    const initialIds = [...latest.current.ids];
    const pointerId = event.pointerId;
    const origin = { x: event.clientX, y: event.clientY };
    const point = { ...origin };
    let active = false;
    let done = false;
    let target: DropTarget | null = null;
    let stopLoop = () => {};
    const bounds = () => {
      const rect = body.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: Math.max(0, rect.top), bottom: Math.min(window.innerHeight, rect.bottom) };
    };
    const updateTarget = () => {
      const rect = bounds();
      let next: DropTarget | null = null;
      if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
        const rows = Array.from(body.querySelectorAll<HTMLElement>('tr[data-row-key]'));
        for (const row of rows) {
          const box = row.getBoundingClientRect();
          if (box.bottom <= rect.top || box.top >= rect.bottom) continue;
          const rowId = Number(row.dataset.rowKey);
          if (point.y <= box.bottom) {
            next = { id: rowId, edge: point.y < (box.top + box.bottom) / 2 ? 'before' : 'after' };
            break;
          }
          next = { id: rowId, edge: 'after' };
        }
      }
      if (next?.id !== target?.id || next?.edge !== target?.edge) {
        target = next;
        setDrag({ id, target });
      }
    };
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      stopLoop();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hidden);
      handle.removeEventListener('lostpointercapture', cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      cleanupRef.current = null;
      setDrag(null);
      // Never submit a stale drag after the lesson data has changed.
      if (commit && active && target && !latest.current.disabled && initialIds.join(',') === latest.current.ids.join(',')) {
        const position = lessonDropPosition(initialIds, id, target);
        if (position > 0 && position !== initialIds.indexOf(id) + 1) latest.current.onMove(id, position);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point.x = e.clientX; point.y = e.clientY;
      if (!active && Math.hypot(point.x - origin.x, point.y - origin.y) >= 5) {
        active = true;
        setDrag({ id, target: null });
        stopLoop = startDragScrollLoop({
          getBounds: bounds, getPointer: () => point,
          scrollBy: distance => { body.scrollTop += distance; },
          onFrame: updateTarget,
          requestFrame: callback => window.requestAnimationFrame(callback),
          cancelFrame: frame => window.cancelAnimationFrame(frame),
        });
      }
      if (active) { e.preventDefault(); updateTarget(); }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point.x = e.clientX; point.y = e.clientY;
      if (active) updateTarget();
      finish(true);
    };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    const hidden = () => { if (document.hidden) cancel(); };
    cleanupRef.current = cancel;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    handle.addEventListener('lostpointercapture', cancel);
    handle.setPointerCapture(pointerId);
  };

  return {
    start,
    dragging: Boolean(drag),
    handleClassName: styles.handle,
    rowClassName: (id: number) => [
      drag?.id === id ? styles.moving : '',
      drag?.target?.id === id && drag.id !== id ? (drag.target.edge === 'before' ? styles.before : styles.after) : '',
    ].filter(Boolean).join(' '),
  };
}
