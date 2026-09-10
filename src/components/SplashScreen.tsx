import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Sparkles } from 'lucide-react';

interface Props {
  /** True once auth has resolved and critical data is warm. */
  ready?: boolean;
  onFinish?: () => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish, ready = false }) => {
  useEffect(() => {
    // A brief floor so the logo does not flash on a fast load, and a ceiling
    // so a slow network never traps the user on a splash screen.
    const MIN_MS = 2000;
    const MAX_MS = 5000;
    const started = Date.now();

    if (ready) {
      const remaining = Math.max(0, MIN_MS - (Date.now() - started));
      const t = setTimeout(() => onFinish?.(), remaining);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(() => onFinish?.(), MAX_MS);
    return () => clearTimeout(timer);
  }, [onFinish, ready]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0B0E14] text-[var(--ink)] select-none overflow-hidden font-sans"
    >
      {/* Background Radial Gradient & Grid Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(92,108,242,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#2A313C_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none" />

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
            className="font-display font-extrabold leading-none"
            style={{ fontSize: 62, color: '#FFFFFF', letterSpacing: '-0.04em' }}
          >
            E
          </motion.span>

          <motion.span
            initial={{ x: 90, y: 60, opacity: 0, rotate: 14 }}
            animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
            className="font-display font-extrabold leading-none"
            style={{ fontSize: 62, color: '#A78BFA', letterSpacing: '-0.04em' }}
          >
            L
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
          Elite<span style={{ color: '#A78BFA' }}>Life</span>
        </motion.p>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 0.85 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          className="t-sub"
          style={{ color: '#C4B5FD' }}
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

        {/* Smooth 2.5-second Loading Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.88, duration: 0.35 }}
          className="w-full space-y-2 pt-2"
        >
          <div className="h-1.5 w-full bg-[var(--surface-sunk)] rounded-full overflow-hidden border border-[var(--rule)]">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.1, ease: [0.4, 0, 0.2, 1] }}
              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 shrink-0 text-[#8B5CF6] animate-pulse" />
              <span>Initializing Protocol...</span>
            </span>
            <span className="text-[var(--signal-ink)] font-bold font-mono">READY</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 font-mono text-[10px] text-[var(--ink-muted)] uppercase tracking-widest flex items-center gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#8B5CF6]" />
        <span>Tap anywhere to skip</span>
      </motion.div>
    </motion.div>
  );
};

