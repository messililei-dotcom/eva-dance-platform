export type DropTarget = { id: number; edge: 'before' | 'after' };
export type DragBounds = { top: number; bottom: number; left: number; right: number };

export function dragScrollSpeed(y: number, top: number, bottom: number) {
  const edge = Math.min(80, (bottom - top) / 3);
  if (edge <= 0 || y < top || y > bottom) return 0;
  if (y < top + edge) return -720 * (1 - (y - top) / edge);
  if (y > bottom - edge) return 720 * (1 - (bottom - y) / edge);
  return 0;
}

export function lessonDropPosition(ids: number[], movingId: number, target: DropTarget) {
  const from = ids.indexOf(movingId);
  const to = ids.indexOf(target.id);
  if (from < 0 || to < 0 || movingId === target.id) return from + 1;
  const insertion = to + (target.edge === 'after' ? 1 : 0);
  return insertion - (from < insertion ? 1 : 0) + 1;
}

// A continuous animation loop is essential: scrolling must continue even when
// the pointer is held still at an edge, with no further pointermove events.
export function startDragScrollLoop(options: {
  getBounds: () => DragBounds;
  getPointer: () => { x: number; y: number };
  scrollBy: (distance: number) => void;
  onFrame: () => void;
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
}) {
  let frame = 0;
  let previous: number | undefined;
  let stopped = false;
  const tick = (time: number) => {
    if (stopped) return;
    const elapsed = previous === undefined ? 0 : Math.min(32, time - previous);
    previous = time;
    const point = options.getPointer();
    const bounds = options.getBounds();
    if (point.x >= bounds.left && point.x <= bounds.right) {
      options.scrollBy(dragScrollSpeed(point.y, bounds.top, bounds.bottom) * elapsed / 1000);
    }
    options.onFrame();
    if (!stopped) frame = options.requestFrame(tick);
  };
  frame = options.requestFrame(tick);
  return () => { stopped = true; options.cancelFrame(frame); };
}
