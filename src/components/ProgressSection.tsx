import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Flame, Timer, CheckSquare, Brain, TrendingUp } from 'lucide-react';
import type { UserProfile } from '../types';
import { buildActivityStats, buildRecords } from '../lib/records';
import {
  formatDuration,
  focusSecondsToday,
  subscribeFocusSessions,
} from '../lib/focus';
import { completedTodayCount, subscribeTasks } from '../lib/tasks';

interface Props {
  profile: UserProfile;
  userId: string | null;
}

export const ProgressSection: React.FC<Props> = ({ profile, userId }) => {
  const [focusSecondsAll, setFocusSecondsAll] = useState(0);
  const [focusTodaySeconds, setFocusTodaySeconds] = useState(0);
  const [focusCount, setFocusCount] = useState(0);
  const [tasksAllTime, setTasksAllTime] = useState(0);
  const [tasksToday, setTasksToday] = useState(0);

  useEffect(() => {
    return subscribeFocusSessions(userId, (list) => {
      setFocusSecondsAll(list.reduce((s, x) => s + (x.focusedSeconds || 0), 0));
      setFocusTodaySeconds(focusSecondsToday(list));
      setFocusCount(list.length);
    });
  }, [userId]);

  useEffect(() => {
    return subscribeTasks(userId, (list) => {
      setTasksAllTime(list.filter((t) => t.completed).length);
      setTasksToday(completedTodayCount(list));
    });
  }, [userId]);

  const stats = useMemo(() => buildActivityStats(profile), [profile]);
  const records = useMemo(() => buildRecords(profile), [profile]);

  const tiles = [
    {
      icon: Brain,
      label: 'Training sessions',
      value: `${stats.trainingSessions}`,
      sub: `${stats.modulesTried} module${stats.modulesTried === 1 ? '' : 's'} tried`,
      tint: 'text-[#A78BFA]',
    },
    {
      icon: Timer,
      label: 'Focused time',
      value: focusSecondsAll > 0 ? formatDuration(focusSecondsAll) : '—',
      sub:
        focusTodaySeconds > 0
          ? `${formatDuration(focusTodaySeconds)} today`
          : `${focusCount} session${focusCount === 1 ? '' : 's'}`,
      tint: 'text-amber-400',
    },
    {
      icon: CheckSquare,
      label: 'Tasks completed',
      value: `${tasksAllTime}`,
      sub: tasksToday > 0 ? `${tasksToday} today` : 'None today yet',
      tint: 'text-emerald-400',
    },
    {
      icon: Flame,
      label: 'Current streak',
      value: `${stats.currentStreak}`,
      sub: `${stats.activeDays} active day${stats.activeDays === 1 ? '' : 's'}`,
      tint: 'text-orange-400',
    },
    {
      icon: TrendingUp,
      label: 'Consistency',
      value: `${stats.consistency}%`,
      sub: `${stats.activeDays} of ${stats.daysElapsed} days`,
      tint: 'text-sky-400',
    },
    {
      icon: Trophy,
      label: 'Personal bests',
      value: `${stats.personalBests}`,
      sub: 'Modules with a record',
      tint: 'text-yellow-400',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-[#F4F6F8] font-mono tracking-tight">
          What you've actually done
        </h2>
        <p className="text-[11px] sm:text-xs text-[#98A2B3] mt-1 leading-relaxed">
          Every number here comes from activity you logged. Nothing is estimated.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="eb-card p-3.5 min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${t.tint}`} />
                <span className="text-[9px] font-mono font-bold text-[#98A2B3] tracking-widest uppercase truncate">
                  {t.label}
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono text-[#F4F6F8] mt-1.5 tabular-nums">
                {t.value}
              </p>
              <p className="text-[10px] text-[#5A6472] font-mono mt-0.5 truncate">{t.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Personal records */}
      <div>
        <h3 className="text-sm font-black text-[#F4F6F8] font-mono tracking-tight flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Personal bests
        </h3>
        <p className="text-[11px] text-[#98A2B3] mt-1">
          Your scores against your own previous results — not against anyone else.
        </p>

        {records.length === 0 ? (
          <div className="mt-3 text-center py-10 px-6 border border-dashed border-[#2A313C] rounded-2xl">
            <Trophy className="w-7 h-7 text-[#5A6472] mx-auto mb-2.5" />
            <p className="text-sm font-bold text-[#F4F6F8] font-mono">No records yet</p>
            <p className="text-[11px] text-[#98A2B3] mt-1 max-w-xs mx-auto leading-relaxed">
              Finish a training module and your best score will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {records.map((r, i) => (
              <motion.div
                key={r.moduleId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
                className="eb-card p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#F4F6F8] truncate">{r.name}</span>
                    {r.isNewRecord && (
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 shrink-0">
                        NEW RECORD
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-[#98A2B3] mt-1">
                    {r.previousBest > 0 ? `Previous best ${r.previousBest} · ` : ''}
                    Last {r.lastScore} · {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xl font-black font-mono text-yellow-400 tabular-nums leading-none">
                    {r.best}
                  </p>
                  <p className="text-[9px] font-mono text-[#5A6472] mt-1">BEST</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[#5A6472] font-mono leading-relaxed text-center max-w-md mx-auto">
        These are EliteLife activity and training metrics. They measure your practice on
        this app — not intelligence, and not a clinical assessment.
      </p>
    </div>
  );
};
