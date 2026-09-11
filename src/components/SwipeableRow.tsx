import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Check, CalendarClock, Trash2 } from 'lucide-react';

export type SwipeAction = 'complete' | 'reschedule' | 'delete';

interface Props {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightAction?: SwipeAction;
  leftAction?: SwipeAction;
  disabled?: boolean;
}

const ACTIONS: Record<SwipeAction, { label: string; color: string; Icon: any }> = {
  complete: { label: 'Complete', color: '#00C2A8', Icon: Check },
  reschedule: { label: 'Tomorrow', color: '#FFB020', Icon: CalendarClock },
  delete: { label: 'Delete', color: '#FF5A6E', Icon: Trash2 },
};

/** How far the card must travel before the action commits. */
const THRESHOLD = 96;

/**
 * Swipeable row.
 *
 * The action is named and coloured as the card moves, so the gesture is
 * discoverable rather than something you have to already know. A gesture
 * whose outcome is a surprise is worse than a button.
 *
 * Commits only past a threshold — a short drag springs back, so brushing the
 * screen while scrolling never completes a task.
 */
export const SwipeableRow: React.FC<Props> = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightAction = 'complete',
  leftAction = 'reschedule',
  disabled = false,
}) => {
  const x = useMotionValue(0);
  const [committing, setCommitting] = useState(false);
  const firedRef = useRef(false);

  // The backdrop deepens as the card travels, so the intent is visible before
  // the finger lifts.
  const rightOpacity = useTransform(x, [0, 12, THRESHOLD], [0, 0.35, 1]);
  const leftOpacity = useTransform(x, [-THRESHOLD, -12, 0], [1, 0.35, 0]);
  const rightScale = useTransform(x, [0, THRESHOLD], [0.8, 1]);
  const leftScale = useTransform(x, [-THRESHOLD, 0], [1, 0.8]);

  const right = ACTIONS[rightAction];
  const left = ACTIONS[leftAction];

  const handleEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (firedRef.current) return;

    const travelled = info.offset.x;
    // A fast flick counts even if short — matching how every native list behaves.
    const flicked = Math.abs(info.velocity.x) > 500;
    const past = Math.abs(travelled) > THRESHOLD;

    if (!(past || flicked)) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
      return;
    }

    const goingRight = travelled > 0;
    const handler = goingRight ? onSwipeRight : onSwipeLeft;

    if (!handler) {
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
      return;
    }

    firedRef.current = true;
    setCommitting(true);

    // Slide clear of the screen before firing, so the row visibly leaves
    // rather than snapping back and then vanishing.
    animate(x, goingRight ? 400 : -400, {
      type: 'spring',
      stiffness: 320,
      damping: 34,
      onComplete: () => {
        handler();
        // Reset for the case where the row stays (completing, not deleting).
        firedRef.current = false;
        setCommitting(false);
        x.set(0);
      },
    });
  };

  if (disabled) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Right-swipe backdrop */}
      {onSwipeRight && (
        <motion.div
          className="absolute inset-0 flex items-center justify-start pl-5 rounded-2xl pointer-events-none"
          style={{ background: right.color, opacity: rightOpacity }}
        >
          <motion.span
            className="flex items-center gap-2 font-semibold text-[14px] text-white"
            style={{ scale: rightScale }}
          >
            <right.Icon className="w-5 h-5 shrink-0" strokeWidth={2.6} />
            {right.label}
          </motion.span>
        </motion.div>
      )}

      {/* Left-swipe backdrop */}
      {onSwipeLeft && (
        <motion.div
          className="absolute inset-0 flex items-center justify-end pr-5 rounded-2xl pointer-events-none"
          style={{ background: left.color, opacity: leftOpacity }}
        >
          <motion.span
            className="flex items-center gap-2 font-semibold text-[14px] text-white"
            style={{ scale: leftScale }}
          >
            {left.label}
            <left.Icon className="w-5 h-5 shrink-0" strokeWidth={2.6} />
          </motion.span>
        </motion.div>
      )}

      <motion.div
        drag={committing ? false : 'x'}
        dragDirectionLock
        // Elastic resistance past the edges signals the limit without a wall.
        dragConstraints={{ left: onSwipeLeft ? -400 : 0, right: onSwipeRight ? 400 : 0 }}
        dragElastic={0.12}
        onDragEnd={handleEnd}
        style={{ x }}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
