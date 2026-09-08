import React, { useEffect, useState } from 'react';

/**
 * Scroll progress indicator.
 *
 * A thin accent line across the top that fills as the page scrolls, plus a
 * soft glow at the leading edge — the treatment from the reference. Uses a
 * passive scroll listener and requestAnimationFrame so it never blocks input
 * on a phone.
 */
export const ScrollProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      // A page shorter than the viewport has nothing to indicate.
      setProgress(scrollable > 40 ? Math.min(1, doc.scrollTop / scrollable) : 0);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (progress <= 0) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[80] h-[3px] pointer-events-none">
      <div
        className="h-full bg-[var(--signal)] transition-[width] duration-75 ease-out"
        style={{
          width: `${progress * 100}%`,
          boxShadow: '0 0 12px 1px var(--signal)',
        }}
      />
    </div>
  );
};
