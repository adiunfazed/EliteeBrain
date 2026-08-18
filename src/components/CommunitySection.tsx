import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { soundFx } from '../utils/audio';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  Send,
  Copy,
  Check,
  ExternalLink,
  Youtube,
  Sparkles,
  ShieldCheck,
  Radio,
} from 'lucide-react';

interface CommunitySectionProps {
  userBrainScore?: number;
  userName?: string;
}

export const CommunitySection: React.FC<CommunitySectionProps> = () => {
  // Telegram Channel Link State
  const [telegramLink, setTelegramLink] = useState<string>(() => {
    return (
      localStorage.getItem('elitebrain_telegram_link') ||
      'https://t.me/masculinecultt'
    );
  });

  // YouTube Channel Link State
  const [youtubeLink, setYoutubeLink] = useState<string>(() => {
    return (
      localStorage.getItem('elitebrain_youtube_link') ||
      'https://www.youtube.com/@xdityasharma'
    );
  });

  const [copiedTg, setCopiedTg] = useState(false);
  const [copiedYt, setCopiedYt] = useState(false);

  useEffect(() => {
    // Fetch latest links set by Admin from Firestore
    const fetchLinks = async () => {
      try {
        const commDoc = await getDoc(doc(db, 'system_config', 'community'));
        if (commDoc.exists()) {
          const data = commDoc.data();
          if (data.telegramLink) {
            setTelegramLink(data.telegramLink);
            localStorage.setItem('elitebrain_telegram_link', data.telegramLink);
          }
          if (data.youtubeLink) {
            setYoutubeLink(data.youtubeLink);
            localStorage.setItem('elitebrain_youtube_link', data.youtubeLink);
          }
        }
      } catch (err) {
        console.error('Failed to fetch Community links:', err);
      }
    };
    fetchLinks();
  }, []);

  const handleOpenTg = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    soundFx.playClick();
    if (telegramLink) {
      window.open(telegramLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenYt = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    soundFx.playClick();
    if (youtubeLink) {
      window.open(youtubeLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyTg = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClick();
    navigator.clipboard.writeText(telegramLink);
    setCopiedTg(true);
    setTimeout(() => setCopiedTg(false), 2000);
  };

  const handleCopyYt = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playClick();
    navigator.clipboard.writeText(youtubeLink);
    setCopiedYt(true);
    setTimeout(() => setCopiedYt(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans select-none max-w-5xl mx-auto px-1 sm:px-0">
      
      {/* Community Header Banner */}
      <div className="bg-gradient-to-r from-[#12161F] via-[#1A1F2C] to-[#12161F] border border-[#2A313C] rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[11px] font-mono font-bold rounded-full uppercase tracking-wider">
                <Send className="w-3 h-3" />
                Telegram Community
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-mono font-bold rounded-full uppercase tracking-wider">
                <Youtube className="w-3 h-3" />
                YouTube Channel
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
              Community & Media Hub
            </h1>
            <p className="text-xs sm:text-sm text-[#98A2B3] leading-relaxed">
              Connect with fellow elite mind performers in our Telegram community and subscribe to our official YouTube channel for protocol breakdowns, mental toughness, and focus mastery guides.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              onClick={handleOpenTg}
              className="px-4 py-3 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 rounded-2xl text-center transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center"
            >
              <span className="block text-xs sm:text-sm font-mono font-black text-sky-400">Telegram</span>
              <span className="text-[10px] font-mono text-[#98A2B3] uppercase font-bold">Join Group</span>
            </button>
            <button
              onClick={handleOpenYt}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-2xl text-center transition-all cursor-pointer active:scale-95 flex flex-col items-center justify-center"
            >
              <span className="block text-xs sm:text-sm font-mono font-black text-red-400">YouTube</span>
              <span className="text-[10px] font-mono text-[#98A2B3] uppercase font-bold">Subscribe</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Telegram Channel Feature Card (Bluish Vibe) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="bg-[#12161F] border border-sky-500/40 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-2xl space-y-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-500/25 shrink-0">
                <Send className="w-6 h-6 fill-current ml-0.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400 px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 rounded-md">
                    Official Telegram Channel
                  </span>
                  <span className="text-[11px] font-mono eb-done font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Community
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-white mt-1 truncate">
                  Elite Life Telegram Group
                </h2>
                <p className="text-xs font-mono text-sky-300/80 mt-0.5 truncate max-w-full">
                  {telegramLink}
                </p>
              </div>
            </div>

            {/* Direct Channel Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
              <button
                onClick={handleOpenTg}
                className="flex-1 sm:flex-initial px-5 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono text-xs font-extrabold rounded-xl shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <span>Join Group</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleCopyTg}
                className="px-4 py-3 bg-[#1A1F2C] hover:bg-[#212631] border border-[#2A313C] text-white rounded-xl cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs font-mono font-bold shrink-0"
              >
                {copiedTg ? (
                  <>
                    <Check className="w-3.5 h-3.5 eb-done" />
                    <span className="eb-done">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#98A2B3]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main YouTube Channel Feature Card (Reddish Vibe) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.08 }}
      >
        <div className="bg-[#12161F] border border-red-500/40 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-2xl space-y-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-red-600/25 shrink-0">
                <Youtube className="w-7 h-7 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-md">
                    Official YouTube Channel
                  </span>
                  <span className="text-[11px] font-mono text-red-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    New Videos
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-white mt-1 truncate">
                  @xdityasharma Channel
                </h2>
                <p className="text-xs font-mono text-red-300/80 mt-0.5 truncate max-w-full">
                  {youtubeLink}
                </p>
              </div>
            </div>

            {/* Direct Channel Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
              <button
                onClick={handleOpenYt}
                className="flex-1 sm:flex-initial px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-mono text-xs font-extrabold rounded-xl shadow-md shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <Youtube className="w-3.5 h-3.5 fill-current" />
                <span>Subscribe</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleCopyYt}
                className="px-4 py-3 bg-[#1A1F2C] hover:bg-[#212631] border border-[#2A313C] text-white rounded-xl cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs font-mono font-bold shrink-0"
              >
                {copiedYt ? (
                  <>
                    <Check className="w-3.5 h-3.5 eb-done" />
                    <span className="eb-done">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#98A2B3]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};
