import React from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { Task } from '../types';
import { soundFx } from '../utils/audio';

interface Props {
  task: Task;
  onDragEnd: () => void;
  children: React.ReactNode;
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

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.015, zIndex: 30 }}
      className="relative"
    >
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          soundFx.playClick();
          controls.start(e);
        }}
        aria-label="Drag to reorder"
        className="absolute left-0 top-0 bottom-0 z-20 w-6 flex items-start justify-center pt-[13px] touch-none"
        style={{ color: 'var(--rule-strong)' }}
      >
        <GripVertical className="w-3.5 h-3.5 shrink-0" />
      </button>

      {/* The handle sits on the left because the right of every task row is
          the completion control, which must stay the easiest thing to hit. */}
      <div className="pl-5">{children}</div>
    </Reorder.Item>
  );
};
