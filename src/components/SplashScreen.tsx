import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { EliteLifeLogo } from './EliteLifeLogo';
import { Activity, Sparkles } from 'lucide-react';

interface Props {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      onClick={() => {
        if (onFinish) onFinish();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0E14] text-[#F4F6F8] select-none cursor-pointer overflow-hidden font-sans"
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
        {/* Elite Life Logo */}
        <EliteLifeLogo size="hero" showSubtext={true} />

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 0.85 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-xs md:text-sm font-mono text-[#A5B4FC] tracking-wide"
        >
          Plan. Execute. Improve.
        </motion.p>

        {/* Smooth 2.5-second Loading Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="w-full space-y-2 pt-2"
        >
          <div className="h-1.5 w-full bg-[#171B22] rounded-full overflow-hidden border border-[#2A313C]">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.1, ease: [0.4, 0, 0.2, 1] }}
              className="h-full bg-gradient-to-r from-[#5C6CF2] to-[#818CF8]"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-[#98A2B3]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#5C6CF2] animate-pulse" />
              <span>Initializing Protocol...</span>
            </span>
            <span className="text-[#818CF8] font-bold font-mono">READY</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 font-mono text-[10px] text-[#98A2B3] uppercase tracking-widest flex items-center gap-1.5"
      >
        <Sparkles className="w-3 h-3 text-[#5C6CF2]" />
        <span>Tap anywhere to skip</span>
      </motion.div>
    </motion.div>
  );
};

