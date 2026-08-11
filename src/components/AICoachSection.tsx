import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { UserProfile, CoachChatMessage } from '../types';
import { soundFx } from '../utils/audio';
import { calculateBrainScore } from '../utils/storage';
import { Send, Sparkles, Bot, User as UserIcon, RefreshCw, Crown, Lock, ArrowRight, Zap, Lightbulb } from 'lucide-react';

interface AICoachSectionProps {
  profile: UserProfile;
  onOpenProModal: () => void;
}

export const AICoachSection: React.FC<AICoachSectionProps> = ({
  profile,
  onOpenProModal,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const brainScore = calculateBrainScore(profile);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: CoachChatMessage = {
        id: 'welcome_1',
        sender: 'coach',
        text: `Hi 👋\n\nI'm your training coach. I can see your scores so far (index ${brainScore}, day ${profile.currentDay} of 30) and help you decide what to work on.\n\nWhat would you like help with?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);
    }
  }, [brainScore, profile.currentDay]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query || isTyping) return;

    if (!profile.isProUser) {
      onOpenProModal();
      return;
    }

    setChatInput('');
    soundFx.playClick();

    const userMsg: CoachChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile: profile,
          userMessage: query,
          history: messages.slice(-10),
          mode: 'chat',
        }),
      });

      const data = await res.json();
      const replyText =
        data.reply ||
        "Your accuracy has been holding steady. If it stays high, try the next difficulty rather than adding more sessions.";

      const botMsg: CoachChatMessage = {
        id: `coach_${Date.now()}`,
        sender: 'coach',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      soundFx.playSuccess();
    } catch (e) {
      console.error(e);
      const fallbackMsg: CoachChatMessage = {
        id: `coach_${Date.now()}`,
        sender: 'coach',
        text: "I couldn't reach the coach just now. In the meantime: get accuracy solid before you push for speed.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestionChips = [
    'Analyze my memory span metrics',
    'How do I beat Stroop interference?',
    'Recommend my Day 1 workout plan',
    'How should I structure a session?',
  ];

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#12161F] via-[#1A1F2C] to-[#12161F] border border-[#2A313C] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#5C6CF2]/20 border-2 border-[#5C6CF2]/50 text-[#818CF8] flex items-center justify-center shadow-lg shrink-0">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#818CF8] px-2 py-0.5 bg-[#5C6CF2]/15 border border-[#5C6CF2]/30 rounded-md">
                  AI Neuro Coach Engine
                </span>
                {profile.isProUser ? (
                  <span className="text-[10px] font-mono font-bold text-amber-300 px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-md">
                    Pro Active
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md">
                    Free Preview
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white mt-1">
                AI Coach
              </h2>
              <p className="text-xs font-mono text-[#98A2B3] mt-0.5">
                Real-time feedback on memory span, focus, latency, and cognitive growth.
              </p>
            </div>
          </div>

          {!profile.isProUser && (
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenProModal();
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-extrabold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <Crown className="w-4 h-4" />
              <span>Unlock AI Coach Pro</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Box Container */}
      <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-4 sm:p-6 space-y-4 flex flex-col h-[520px] shadow-2xl relative overflow-hidden">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'coach' && (
                <div className="w-8 h-8 rounded-xl bg-[#5C6CF2]/20 border border-[#5C6CF2]/40 text-[#818CF8] flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-[#5C6CF2] text-white rounded-tr-xs font-mono'
                    : 'bg-[#171B22] border border-[#2A313C] text-slate-200 rounded-tl-xs whitespace-pre-line'
                }`}
              >
                {msg.text}
                <span className="block text-[9px] opacity-60 font-mono text-right mt-1.5">
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#5C6CF2]/20 border border-[#5C6CF2]/40 text-[#818CF8] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-[#171B22] border border-[#2A313C] text-[#98A2B3] rounded-2xl text-xs font-mono flex items-center gap-2">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#2A313C] scrollbar-none">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSendMessage(chip)}
              className="px-3 py-1.5 bg-[#171B22] hover:bg-[#212631] border border-[#2A313C] text-[#98A2B3] hover:text-white text-xs font-mono rounded-xl shrink-0 cursor-pointer transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Chat Input Field */}
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              profile.isProUser
                ? 'Ask your AI Coach anything...'
                : 'Pro subscription required for AI Coach chat...'
            }
            disabled={!profile.isProUser || isTyping}
            className="flex-1 px-4 py-3 bg-[#0D1117] border border-[#2A313C] text-white font-mono text-xs rounded-2xl focus:border-[#5C6CF2] focus:outline-none disabled:opacity-50"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!profile.isProUser || isTyping || !chatInput.trim()}
            className="p-3 bg-[#5C6CF2] hover:bg-[#5C6CF2]/90 disabled:opacity-40 text-white rounded-2xl cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Non-Pro overlay if applicable */}
        {!profile.isProUser && (
          <div className="absolute inset-x-0 bottom-0 top-36 bg-[#0D1117]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-bold text-white">
              Unlock AI Coach
            </h3>
            <p className="text-xs text-[#98A2B3] max-w-md">
              Upgrade to Elite Life Pro to get personalized trial analyses, custom training schedules, and real-time AI guidance.
            </p>
            <button
              onClick={() => {
                soundFx.playClick();
                onOpenProModal();
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-black rounded-xl shadow-lg cursor-pointer transition-all flex items-center gap-2"
            >
              <span>Unlock AI Coach Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
