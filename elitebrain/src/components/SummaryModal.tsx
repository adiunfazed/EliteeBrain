import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { SessionResult } from '../types';
import { Trophy, TrendingUp, TrendingDown, Minus, ArrowRight, Sparkles } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface Props {
  result: SessionResult;
  onClose: () => void;
}

export const SummaryModal: React.FC<Props> = ({ result, onClose }) => {
  useEffect(() => {
    if (result.levelChange === 'up') {
      soundFx.playLevelUp();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#5C6CF2', '#818CF8', '#10B981', '#F59E0B'],
      });
    } else {
      soundFx.playSuccess();
    }
  }, [result.levelChange]);

  const getLevelBadge = () => {
    if (result.levelChange === 'up') {
      return (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 px-4 py-2 rounded-xl">
          <TrendingUp className="w-5 h-5 text-emerald-400 animate-bounce" />
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">Level Increased!</span>
            <span className="text-sm font-extrabold">Promoted to Level {result.levelAfter}</span>
          </div>
        </div>
      );
    }
    if (result.levelChange === 'down') {
      return (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-400 px-4 py-2 rounded-xl">
          <TrendingDown className="w-5 h-5 text-rose-400" />
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">Adaptive Recalibration</span>
            <span className="text-sm font-extrabold">Adjusted to Level {result.levelAfter}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 bg-[#0E1116] border border-[#2A313C] text-[#98A2B3] px-4 py-2 rounded-xl">
        <Minus className="w-5 h-5 text-[#98A2B3]" />
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider">Baseline Maintained</span>
          <span className="text-sm font-extrabold text-[#F4F6F8]">Remains Level {result.levelAfter}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#171B22] border border-[#2A313C] rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden text-[#F4F6F8]">
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5C6CF2]/15 border border-[#5C6CF2]/30 mb-3 shadow-inner">
            <Trophy className="w-8 h-8 text-[#5C6CF2]" />
          </div>
          <h2 className="text-2xl font-black text-[#F4F6F8] tracking-tight">
            Session Completed
          </h2>
          <p className="text-xs text-[#98A2B3] mt-1">
            Performance recorded & adaptive difficulty adjusted
          </p>
        </div>

        {/* Level Status Badge */}
        <div className="mb-6 flex justify-center">
          {getLevelBadge()}
        </div>

        {/* Core Scores */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <div className="bg-[#0E1116] border border-[#2A313C] p-3 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-[#98A2B3]">Accuracy</span>
            <div className="text-xl font-black text-[#5C6CF2] mt-0.5">{result.accuracy}%</div>
          </div>
          <div className="bg-[#0E1116] border border-[#2A313C] p-3 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-[#98A2B3]">Score</span>
            <div className="text-xl font-black text-indigo-300 mt-0.5">{result.score}</div>
          </div>
          <div className="bg-[#0E1116] border border-[#2A313C] p-3 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-[#98A2B3]">XP Gained</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">+{result.xpGained}</div>
          </div>
        </div>

        {/* Custom Metrics */}
        {result.details && result.details.length > 0 && (
          <div className="bg-[#0E1116] border border-[#2A313C] rounded-2xl p-4 mb-6">
            <h4 className="text-xs font-bold text-[#98A2B3] uppercase tracking-wider mb-3">
              Performance Analytics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {result.details.map((detail, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-[#98A2B3] font-medium">{detail.label}:</span>
                  <span className="font-bold text-[#F4F6F8]">{detail.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptive Explanation */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0E1116] border border-[#2A313C] text-xs text-[#98A2B3] mb-6">
          <Sparkles className="w-4 h-4 text-[#5C6CF2] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {result.levelChange === 'up'
              ? 'Excellent cognitive precision! Next session will introduce higher target complexity.'
              : result.levelChange === 'down'
              ? 'Difficulty decreased slightly to optimize working memory stabilization.'
              : 'Consistent baseline performance. Maintain accuracy >= 80% to trigger level promotion.'}
          </p>
        </div>

        {/* Confirm Action */}
        <button
          onClick={() => {
            soundFx.playClick();
            onClose();
          }}
          className="w-full py-3.5 rounded-2xl bg-[#5C6CF2] hover:bg-[#5C6CF2]/90 text-white font-black text-sm tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};
