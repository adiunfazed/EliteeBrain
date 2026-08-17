import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  onExit: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper giving every game a distraction-free mode.
 *
 * Games that need drags or swipes conflict with page scrolling — a swipe meant
 * for the board scrolls the page instead, which costs the player the move.
 * Fullscreen locks body scroll and removes the surrounding chrome so gestures
 * only reach the game.
 */
export const GameShell: React.FC<Props> = ({ title, onExit, children }) => {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = (document.body.style as any).overscrollBehavior;
    document.body.style.overflow = 'hidden';
    (document.body.style as any).overscrollBehavior = 'none';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).overscrollBehavior = prevOverscroll;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0B0D12] flex flex-col">
        <div className="flex items-center justify-between gap-2 p-3 shrink-0">
          <span className="eb-heading text-sm truncate">{title}</span>
          <button
            onClick={() => setFullscreen(false)}
            className="eb-btn-ghost px-3 py-2 text-[11px] font-mono flex items-center gap-1.5 shrink-0"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Exit
          </button>
        </div>

        {/* touch-none stops the browser interpreting in-game gestures as scroll */}
        <div className="flex-1 overflow-auto overscroll-contain touch-pan-y p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onExit}
          className="eb-btn-ghost px-3 py-2 text-[11px] font-mono flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Games
        </button>

        <button
          onClick={() => setFullscreen(true)}
          className="eb-btn-primary px-3.5 py-2 text-[11px] font-mono flex items-center gap-1.5"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fullscreen
        </button>
      </div>

      {children}
    </div>
  );
};
