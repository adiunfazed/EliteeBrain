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
        className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-12 flex items-center justify-center touch-none"
        style={{ color: 'var(--ink-dim)' }}
      >
        <GripVertical className="w-4 h-4 shrink-0" />
      </button>

      <div className="pr-7">{children}</div>
    </Reorder.Item>
  );
};
