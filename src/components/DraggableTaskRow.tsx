import React, { useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { Task } from '../types';
import { soundFx } from '../utils/audio';

interface Props {
  task: Task;
  onDragEnd: () => void;
  /**
   * Given the handle to place inside the row.
   *
   * The handle is handed to the row rather than layered over it so it can sit
   * in the flex line after the completion control, where it takes its own
   * space. Absolutely positioning it meant it floated over whatever happened
   * to be underneath and swallowed touches meant for the list.
   */
  children: (handle: React.ReactNode) => React.ReactNode;
}

/**
 * One draggable row.
 *
 * This exists as its own component because `useDragControls` is a hook and
 * cannot be called inside a loop. Sharing a single controller across every
 * row meant the handle always started a drag on whichever row registered
 * first — so tapping the third row's grip dragged the first one, and nothing
 * ever landed where it was dropped.
 */
export const DraggableTaskRow: React.FC<Props> = ({ task, onDragEnd, children }) => {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);

  const handle = (
    <button
      onPointerDown={(e) => {
        // Only a deliberate press on the handle starts a drag. The row itself
        // has no drag listener, so a swipe or a scroll anywhere else on the
        // list behaves exactly as it would in a plain scrolling list.
        e.preventDefault();
        // The row is also a swipe target. Stopping here means a press that
        // began on the handle can only ever become a reorder, never a
        // half-committed swipe-to-complete.
        e.stopPropagation();
        soundFx.playClick();
        setDragging(true);
        controls.start(e);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      aria-label="Drag to reorder"
      // touch-none is what stops the browser claiming the gesture as a scroll
      // before the drag can begin — and it applies to this 28px square only,
      // so the rest of the row still scrolls normally.
      className="task-grip touch-none"
      data-dragging={dragging ? 'true' : 'false'}
    >
      <GripVertical className="w-4 h-4 shrink-0" />
    </button>
  );

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      whileDrag={{ scale: 1.015, zIndex: 30 }}
      className="relative"
    >
      {children(handle)}
    </Reorder.Item>
  );
};
