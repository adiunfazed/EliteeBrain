import React from 'react';
import { MODULE_METADATA } from '../utils/storage';
import { UserProfile, ModuleId } from '../types';
import { Meter } from './ui/Meter';
import { Sparkline } from './ui/Sparkline';
import { ArrowRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface ModuleRosterProps {
  profile: UserProfile;
  onSelectModule: (moduleId: ModuleId) => void;
  onOpenProModal: () => void;
}

export const ModuleRoster: React.FC<ModuleRosterProps> = ({
  profile,
  onSelectModule,
  onOpenProModal,
}) => {
  return (
    <div className="w-full bg-surface border border-rule rounded-[2px] overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 px-4 py-2 bg-surface-sunk border-b border-rule text-[11px] font-mono text-ink-muted uppercase tracking-[0.09em]">
        <div className="col-span-4">Cognitive Training Module</div>
        <div className="col-span-3 text-center">Level Meter</div>
        <div className="col-span-2 text-center">Personal Best</div>
        <div className="col-span-2 text-center">7-Session Trend</div>
        <div className="col-span-1 text-right">Action</div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-rule">
        {MODULE_METADATA.map((meta, index) => {
          const modState = profile.modules[meta.id] || {
            level: 1,
            xp: 0,
            bestScore: 0,
            totalSessions: 0,
            completedToday: false,
            history: [],
          };

          const isLocked = meta.isPro && !profile.isProUser;
          const historyScores = modState.history.slice(-7).map((h) => h.score);
          const sparkData = historyScores.length > 0 ? historyScores : [0, 0, 0, 0, 0, 0, 0];

          return (
            <motion.div
              key={meta.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.1 }}
              whileHover={{ scale: 1.01, x: 4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: index * 0.03, duration: 0.18, type: 'spring', stiffness: 300, damping: 25 }}
              onClick={() => {
                if (isLocked) {
                  onOpenProModal();
                } else {
                  onSelectModule(meta.id);
                }
              }}
              className="group relative flex flex-col md:grid md:grid-cols-12 items-stretch min-h-[64px] px-4 py-3 md:py-0 bg-surface hover:bg-surface-sunk active:bg-[#8B5CF6]/10 active:scale-[0.98] transition-all duration-120 cursor-pointer select-none touch-manipulation"
            >
              {/* 4px -> 6px Domain Accent Bar on Left Edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[4px] group-hover:w-[6px] transition-all duration-120"
                style={{ backgroundColor: meta.domainColor }}
              />

              {/* Col 1: Name & Description */}
              <div className="col-span-4 flex flex-col justify-center pl-2 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink group-hover:text-signal transition-colors">
                    {meta.name}
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted px-1.5 py-0.5 bg-surface-sunk border border-rule rounded-[1px]">
                    {meta.domain}
                  </span>
                  {meta.isPro && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400">
                      <Lock className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted truncate mt-0.5">{meta.description}</p>
              </div>

              {/* Col 2: Level Meter */}
              <div className="col-span-3 flex items-center justify-start md:justify-center my-2 md:my-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-ink">
                    Lv. {isLocked ? 0 : modState.level}
                  </span>
                  <Meter level={isLocked ? 0 : modState.level} domainColor={meta.domainColor} />
                </div>
              </div>

              {/* Col 3: Best Score */}
              <div className="col-span-2 flex items-center justify-start md:justify-center font-mono text-xs text-ink">
                {isLocked ? (
                  <span className="text-ink-muted text-[11px]">—</span>
                ) : (
                  <span>{modState.bestScore > 0 ? `${modState.bestScore}%` : 'Unrated'}</span>
                )}
              </div>

              {/* Col 4: Sparkline / Included in Pro */}
              <div className="col-span-2 flex items-center justify-start md:justify-center">
                {isLocked ? (
                  <span className="text-[11px] font-mono text-signal hover:underline">
                    Included in Pro →
                  </span>
                ) : (
                  <Sparkline data={sparkData} color={meta.domainColor} />
                )}
              </div>

              {/* Col 5: Arrow Action */}
              <div className="col-span-1 flex items-center justify-end">
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-signal group-hover:translate-x-1 transition-transform duration-120" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
