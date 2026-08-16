import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';

interface XpEvent {
  id: number;
  amount: number;
  label: string;
}

interface XpContextValue {
  /** Show a brief +XP confirmation. */
  awardXp: (amount: number, label: string) => void;
}

const XpContext = createContext<XpContextValue>({ awardXp: () => {} });

export const useXp = () => useContext(XpContext);

/**
 * Reward feedback.
 *
 * The moment of completion is when the reward has to land — a number that only
 * updates on a stats screen isn't felt. These float up from the bottom and
 * clear themselves, so they never block the interface or need dismissing.
 */
export const XpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<XpEvent[]>([]);

  const awardXp = useCallback((amount: number, label: string) => {
    if (amount <= 0) return;
    const id = Date.now() + Math.random();
    setEvents((prev) => [...prev.slice(-2), { id, amount, label }]);
    setTimeout(() => setEvents((prev) => prev.filter((e) => e.id !== id)), 2000);
  }, []);

  const value = useMemo(() => ({ awardXp }), [awardXp]);

  return (
    <XpContext.Provider value={value}>
      {children}

      <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[75] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {events.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--signal)] text-white shadow-[0_4px_0_0_rgba(0,0,0,0.4)]"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="text-sm font-mono font-black tabular-nums">+{e.amount}</span>
              <span className="text-[11px] font-mono opacity-85">{e.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </XpContext.Provider>
  );
};
