import { useEffect, useRef, useState } from 'react';

const KEY = 'size-resume.editor-width';
const initialWidth = () => window.innerWidth >= 1600 ? 450 : window.innerWidth > 1250 ? 420 : 360;
export function usePanelResize() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => {
    try { const value = Number(localStorage.getItem(KEY)); if (Number.isFinite(value) && value >= 340) return value; } catch {}
    return initialWidth();
  });
  const [maximum, setMaximum] = useState(900);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const sidebar = node.firstElementChild?.getBoundingClientRect().width ?? 252;
      setMaximum(Math.max(340, node.clientWidth - sidebar - 10 - 320));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, String(width)); } catch {} }, [width]);
  const actualWidth = Math.min(width, maximum);
  const update = (next: number) => setWidth(Math.round(Math.max(340, Math.min(maximum, next))));
  const stop = () => { drag.current = null; setDragging(false); };
  return { workspaceRef, width: actualWidth, dragging, separatorProps: {
    role: 'separator' as const, tabIndex: 0, 'aria-label': '调整编辑区宽度',
    'aria-orientation': 'vertical' as const, 'aria-valuemin': 340,
    'aria-valuemax': maximum, 'aria-valuenow': actualWidth,
    title: '左右拖动调整宽度，双击恢复默认',
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, width: actualWidth }; setDragging(true);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current) update(drag.current.width + event.clientX - drag.current.x);
    },
    onPointerUp: stop, onPointerCancel: stop, onLostPointerCapture: stop,
    onDoubleClick: () => update(initialWidth()),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      update(event.key === 'Home' ? 340 : event.key === 'End' ? maximum : actualWidth + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 50 : 10));
    },
  } };
}
