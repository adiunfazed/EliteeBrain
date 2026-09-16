import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';

interface Props {
  /** True once auth has resolved and critical data is warm. */
  ready?: boolean;
  onFinish?: () => void;
}

/**
 * Logo letterforms.
 *
 * Paste the `d` attribute of the E and the L from the logo SVG here and the
 * splash animates the real letterforms instead of typed characters. Both must
 * come from the same artboard so they stay aligned; LOGO_VIEWBOX is that
 * artboard's size.
 *
 * Left empty, the splash falls back to text — which is what it does today.
 */
const LOGO_E = '';
const LOGO_L = '';
const LOGO_VIEWBOX = { w: 100, h: 100 };
/** Rendered size = viewBox × this. Tune once the real paths are in. */
const LOGO_SCALE = 0.72;

export const SplashScreen: React.FC<Props> = ({ onFinish, ready = false }) => {
  /** Mount time, held in a ref so it survives the effect re-running. */
  const startedAt = useRef(Date.now());

  /** Progress shown on the bar, 0–100. */
  const [pct, setPct] = useState(8);

  /**
   * Creep forward while waiting.
   *
   * Real loading has no measurable percentage, so this eases toward 90 and
   * stops — never claiming completion the app has not reached. It slows as it
   * climbs, which reads as work getting harder rather than stalling.
   */
  useEffect(() => {
    if (ready) return;

    const id = window.setInterval(() => {
      setPct((p) => (p >= 90 ? p : p + Math.max(1, Math.round((90 - p) / 12))));
    }, 120);

    return () => window.clearInterval(id);
  }, [ready]);

  useEffect(() => {
    // A brief floor so the logo does not flash on a very fast load, and a
    // ceiling so a slow network never traps anyone here.
    const MIN_MS = 900;
    const MAX_MS = 5000;

    if (ready) {
      setPct(100);
      // Measured from mount, so a load that already took a second does not
      // wait another one.
      const elapsed = Date.now() - startedAt.current;
      const remaining = Math.max(0, MIN_MS - elapsed);
      const t = window.setTimeout(() => onFinish?.(), remaining);
      return () => window.clearTimeout(t);
    }

    const timer = window.setTimeout(() => onFinish?.(), MAX_MS);
    return () => window.clearTimeout(timer);
  }, [onFinish, ready]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#07060B] text-[var(--ink)] select-none overflow-hidden font-sans"
    >
      {/* Background Radial Gradient & Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(122,99,224,0.22)_0%,transparent_72%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#2E2740_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none" />

      {/* Central Animated Logo & Card Container */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center space-y-7 z-10 p-8 text-center max-w-sm w-full"
      >
        {/* Letters converge, then the wordmark resolves. Kept to a single
            beat — a logo that assembles for two seconds becomes a delay. */}
        <div className="relative h-[72px] flex items-center justify-center">
          <motion.span
            initial={{ x: -90, opacity: 0, rotate: -14 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
            className="flex items-center"
          >
            {LOGO_E ? (
              <svg
                width={LOGO_VIEWBOX.w * LOGO_SCALE}
                height={LOGO_VIEWBOX.h * LOGO_SCALE}
                viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
                aria-hidden="true"
              >
                <path d={LOGO_E} fill="#FFFFFF" />
              </svg>
            ) : (
              <span
                className="font-display font-extrabold leading-none"
                style={{ fontSize: 62, color: '#FFFFFF', letterSpacing: '-0.04em' }}
              >
                E
              </span>
            )}
          </motion.span>

          <motion.span
            initial={{ x: 90, y: 60, opacity: 0, rotate: 14 }}
            animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
            className="flex items-center"
          >
            {LOGO_L ? (
              <svg
                width={LOGO_VIEWBOX.w * LOGO_SCALE}
                height={LOGO_VIEWBOX.h * LOGO_SCALE}
                viewBox={`0 0 ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`}
                aria-hidden="true"
              >
                <path d={LOGO_L} fill="#9B7FF0" />
              </svg>
            ) : (
              <span
                className="font-display font-extrabold leading-none"
                style={{ fontSize: 62, color: '#9B7FF0', letterSpacing: '-0.04em' }}
              >
                L
              </span>
            )}
          </motion.span>

          {/* Light sweep across the letters as they land. */}
          <motion.span
            initial={{ x: '-140%', opacity: 0 }}
            animate={{ x: '140%', opacity: [0, 0.5, 0] }}
            transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
            className="absolute inset-y-0 w-16 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
              filter: 'blur(6px)',
            }}
          />
        </div>

        {/* The full name resolves once the letters have met. */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.4 }}
          className="font-display font-extrabold tracking-tight"
          style={{ fontSize: 21, marginTop: 4 }}
        >
          Elite<span style={{ color: '#9B7FF0' }}>Life</span>
        </motion.p>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 0.85 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="t-sub"
          style={{ color: '#C6B9F0' }}
        >
          Plan. Execute. Improve.
        </motion.p>

        {/* Status line. Tied to real readiness rather than a timer, so it
            never claims to be done while work is still running. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.3 }}
          className="t-meta"
          style={{ minHeight: 18 }}
        >
          {ready ? 'Ready' : 'Getting your day together…'}
        </motion.p>

        {/* Progress, driven by actual readiness rather than a timer. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.88, duration: 0.35 }}
          className="w-full space-y-2 pt-2"
        >
          <div className="h-1.5 w-full bg-[var(--surface-sunk)] rounded-full overflow-hidden border border-[var(--rule)]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#7E63DC] to-[#9B7FF0]"
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              // Quick when it completes, unhurried while waiting — so the
              // jump to full reads as finishing rather than as a glitch.
              transition={{ duration: ready ? 0.2 : 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <Activity
                className={`w-3.5 h-3.5 shrink-0 text-[#7E63DC] ${ready ? '' : 'animate-pulse'}`}
              />
              <span>{ready ? 'Ready' : 'Loading your data…'}</span>
            </span>
            <span className="text-[var(--signal-ink)] font-bold tabular-nums">{pct}%</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer Hint */}
    </motion.div>
  );
};

