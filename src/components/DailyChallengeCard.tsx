import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Target, Trophy, Check, ChevronRight, Flame } from 'lucide-react';
import type { ModuleId, UserProfile } from '../types';
import { challengeStreak, getDailyChallenge } from '../lib/challenge';
import { soundFx } from '../utils/audio';

interface Props {
  profile: UserProfile;
  onLaunchModule: (id: ModuleId) => void;
}

export const DailyChallengeCard: React.FC<Props> = ({ profile, onLaunchModule }) => {
  const challenge = useMemo(() => getDailyChallenge(profile), [profile]);
  const streak = useMemo(() => challengeStreak(profile), [profile]);

  if (!challenge) return null;

  const { completed, todayScore, previousBest, best, attempts, beatRecord } = challenge;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl p-4 sm:p-5 border ${
        beatRecord
          ? 'bg-yellow-500/10 border-yellow-500/40'
          : completed
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-[#0E1116] border-[#2A313C]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Target
            className={`w-4 h-4 shrink-0 ${completed ? 'text-emerald-400' : 'text-rose-400'}`}
          />
          <span className="eb-label">
            Today's challenge
          </span>
        </div>

        {streak > 1 && (
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1 shrink-0">
            <Flame className="w-3 h-3" />
            {streak} day{streak === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <h3 className="text-base sm:text-lg font-black text-[#F4F6F8] font-mono tracking-tight mt-2 break-words">
        {challenge.name}
      </h3>
      <p className="text-[11px] text-[#98A2B3] mt-0.5">{challenge.tagline}</p>

      {completed ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-[#0E1116]/60 border border-[#2A313C] rounded-xl p-2.5 text-center min-w-0">
              <p className="text-lg font-black font-mono text-[#F4F6F8] tabular-nums leading-none">
                {todayScore}
              </p>
              <p className="text-[9px] font-mono text-[#5A6472] mt-1">TODAY</p>
            </div>
            <div className="bg-[#0E1116]/60 border border-[#2A313C] rounded-xl p-2.5 text-center min-w-0">
              <p className="text-lg font-black font-mono text-yellow-400 tabular-nums leading-none">
                {best}
              </p>
              <p className="text-[9px] font-mono text-[#5A6472] mt-1">BEST</p>
            </div>
            <div className="bg-[#0E1116]/60 border border-[#2A313C] rounded-xl p-2.5 text-center min-w-0">
              <p className="text-lg font-black font-mono text-[#98A2B3] tabular-nums leading-none">
                {attempts}
              </p>
              <p className="text-[9px] font-mono text-[#5A6472] mt-1">ATTEMPTS</p>
            </div>
          </div>

          <p
            className={`text-[11px] font-mono mt-3 flex items-center gap-1.5 ${
              beatRecord ? 'text-yellow-300 font-bold' : 'text-emerald-300'
            }`}
          >
            {beatRecord ? (
              <>
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                New record — you beat {previousBest}.
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                Done for today.
                {previousBest > 0 && ` Your best is still ${previousBest}.`}
              </>
            )}
          </p>

          <button
            onClick={() => {
              soundFx.playClick();
              onLaunchModule(challenge.moduleId);
            }}
            className="mt-3 text-[11px] font-mono font-bold text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1 transition-colors"
          >
            Try again
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          {previousBest > 0 && (
            <p className="text-[11px] font-mono text-[#98A2B3] mt-3">
              Your best so far: <span className="text-yellow-400 font-bold">{previousBest}</span>
              {attempts > 0 && ` · ${attempts} attempt${attempts === 1 ? '' : 's'}`}
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              soundFx.playClick();
              onLaunchModule(challenge.moduleId);
            }}
            className="eb-lift eb-glow-brand eb-shine mt-4 w-full py-3 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-mono font-black flex items-center justify-center gap-2"
          >
            <Target className="w-4 h-4" />
            Start challenge
          </motion.button>
        </>
      )}
    </motion.div>
  );
};
