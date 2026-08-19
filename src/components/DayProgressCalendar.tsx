import React, { useState } from 'react';
import { UserProfile, ModuleId } from '../types';
import { Eyebrow } from './ui/Eyebrow';
import { MODULE_METADATA } from '../utils/storage';
import { soundFx } from '../utils/audio';
import { Calendar, CheckCircle2, AlertCircle, Clock, X, ArrowRight } from 'lucide-react';

interface DayProgressCalendarProps {
  profile: UserProfile;
  onLaunchModule?: (id: ModuleId) => void;
  className?: string;
}

export const DayProgressCalendar: React.FC<DayProgressCalendarProps> = ({
  profile,
  onLaunchModule,
  className = '',
}) => {
  const currentDay = profile.currentDay;
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  const selectedDayLog = selectedDayNum ? profile.dailyLogs[selectedDayNum] : null;

  return (
    <div className={`bg-surface border border-rule rounded-2xl p-4 md:p-6 shadow-md ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule mb-4">
        <div>
          <Eyebrow>DAILY PROGRESS & STREAK MATRIX</Eyebrow>
          <h3 className="text-sm md:text-base font-bold text-ink font-mono mt-0.5 flex items-center gap-2">
            <span>DAY {currentDay} OF 30</span>
            <span className="text-xs text-ink-muted">· {profile.streakDays} DAY STREAK CONTINUITY</span>
          </h3>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-ink-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" />
            <span>COMPLETED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-signal rounded-full inline-block animate-pulse" />
            <span>CURRENT DAY</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-surface-sunk border border-rule rounded-full inline-block" />
            <span>MISSED / FUTURE</span>
          </div>
        </div>
      </div>

      {/* 30 Interactive Punch-Card Grid Cells */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
        {days.map((dayNum) => {
          const dayLog = profile.dailyLogs[dayNum];
          const isCompleted = dayLog && dayLog.status === 'completed';
          const isCurrent = dayNum === currentDay;
          const isMissed = dayLog && dayLog.status === 'missed';

          let cellStyle = 'bg-surface hover:bg-surface-sunk border-rule text-ink-muted';

          if (isCompleted) {
            cellStyle =
              'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:eb-done font-bold shadow-xs hover:bg-emerald-500/25';
          } else if (isCurrent) {
            cellStyle =
              'bg-signal/15 border-2 border-signal text-signal font-bold shadow-sm hover:bg-signal/25';
          } else if (isMissed) {
            cellStyle = 'bg-surface-sunk border-rule text-ink-muted/50 line-through';
          }

          return (
            <button
              key={dayNum}
              onClick={() => {
                soundFx.playClick();
                setSelectedDayNum(dayNum);
              }}
              title={`Day ${dayNum}: Click for daily logs`}
              className={`aspect-square flex flex-col items-center justify-center border rounded-xl p-1 font-mono transition-all cursor-pointer select-none active:scale-95 ${cellStyle}`}
            >
              <span className="text-xs md:text-sm">{dayNum}</span>
              <span className="text-[8px] md:text-[9px] uppercase tracking-tighter mt-0.5">
                {isCompleted ? '✓ DONE' : isCurrent ? 'TODAY' : isMissed ? 'GAP' : `D${dayNum}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-ink-muted text-center mt-3">
        💡 Click on any day cell to view session details and logs.
      </p>

      {/* Interactive Day Details Modal */}
      {selectedDayNum && selectedDayLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-surface border border-rule rounded-2xl p-6 shadow-2xl font-sans">
            <button
              onClick={() => setSelectedDayNum(null)}
              className="absolute top-4 right-4 p-1.5 bg-surface hover:bg-surface-sunk border border-rule rounded-xl text-ink-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-signal" />
              <Eyebrow>DAY {selectedDayNum} PROTOCOL LOG</Eyebrow>
            </div>

            <h3 className="text-lg font-bold font-mono text-ink">
              {selectedDayLog.date || `Day ${selectedDayNum} of 30`}
            </h3>

            <div className="my-4 p-3.5 bg-surface-sunk border border-rule rounded-xl space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">STATUS:</span>
                <span className="font-bold text-ink uppercase">
                  {selectedDayLog.status === 'completed' && (
                    <span className="text-emerald-600 dark:eb-done flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully Completed
                    </span>
                  )}
                  {selectedDayLog.status === 'current' && (
                    <span className="text-signal flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Today's Active Day
                    </span>
                  )}
                  {selectedDayLog.status === 'missed' && (
                    <span className="text-amber-600 dark:eb-warn flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Missed Gap
                    </span>
                  )}
                  {selectedDayLog.status === 'future' && (
                    <span className="text-ink-muted">Upcoming Protocol</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-muted">COGNITIVE INDEX:</span>
                <span className="font-bold text-ink">
                  {selectedDayLog.cognitiveScore > 0 ? selectedDayLog.cognitiveScore : '--'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-ink-muted">MODULES LOGGED:</span>
                <span className="font-bold text-ink">
                  {selectedDayLog.completedModules.length} / 4
                </span>
              </div>
            </div>

            {/* List of Modules Completed for Day */}
            <div className="space-y-2 mb-5">
              <span className="block text-[10px] font-mono font-bold uppercase text-ink-muted">
                Completed Domain Modules:
              </span>
              {selectedDayLog.completedModules.length === 0 ? (
                <p className="text-xs font-mono text-ink-muted italic">
                  No modules recorded for this day yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDayLog.completedModules.map((mId) => {
                    const meta = MODULE_METADATA.find((m) => m.id === mId);
                    return (
                      <div
                        key={mId}
                        className="flex items-center justify-between p-2.5 bg-surface-sunk border border-rule rounded-xl text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="font-bold text-ink">{meta?.name || mId}</span>
                        </div>
                        <span className="text-[10px] text-ink-muted">{meta?.domain}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action */}
            {selectedDayNum === currentDay && onLaunchModule && (
              <button
                onClick={() => {
                  soundFx.playClick();
                  setSelectedDayNum(null);
                  const nextMod = MODULE_METADATA.find((m) => !profile.modules[m.id]?.completedToday) || MODULE_METADATA[0];
                  onLaunchModule(nextMod.id);
                }}
                className="w-full py-2.5 bg-ink text-ground font-mono text-xs font-bold rounded-xl hover:bg-ink/90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Today's Training →</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
