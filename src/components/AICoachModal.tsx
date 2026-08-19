import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, CoachChatMessage } from '../types';
import { soundFx } from '../utils/audio';
import { calculateBrainScore } from '../utils/storage';
import { X, Send, Sparkles, Bot, User as UserIcon, RefreshCw, Crown, Lock, ArrowRight, Zap } from 'lucide-react';
import { getIdToken } from '../lib/firebase';

interface Props {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onOpenProModal: () => void;
}

export const AICoachModal: React.FC<Props> = ({
  isOpen,
  profile,
  onClose,
  onOpenProModal,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const brainScore = calculateBrainScore(profile);

  // Initialize initial welcoming AI Coach message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: CoachChatMessage = {
        id: 'welcome_1',
        sender: 'coach',
        text: `Hi\n\nI'm your training coach. I can see your scores so far (index ${brainScore}, day ${profile.currentDay} of 30) and help you decide what to work on.\n\nWhat would you like help with?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, brainScore, profile.currentDay]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

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
      // The server verifies this token and reads Pro status from Firestore.
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error(
          'You need to be signed in with Google or email to use the AI Coach. Guest mode has no account to verify.'
        );
      }
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          userProfile: profile,
          userMessage: query,
          history: messages.slice(-10),
          mode: 'chat',
        }),
      });

      let data = await res.json();

      // A 401 can be a token that expired between mint and arrival. Retry once
      // with a freshly forced token before reporting a failure.
      if (res.status === 401) {
        const retryToken = await getIdToken();
        if (retryToken && retryToken !== idToken) {
          const retry = await fetch('/api/coach', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${retryToken}`,
            },
            body: JSON.stringify({
              userProfile: profile,
              userMessage: query,
              history: messages.slice(-10),
              mode: 'chat',
            }),
          });
          data = await retry.json();
          if (!retry.ok) throw new Error(data?.error || `Request failed (${retry.status})`);
        } else {
          throw new Error(data?.error || 'Could not verify your sign-in.');
        }
      } else if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      const replyText = data.reply;
      if (!replyText) throw new Error('The coach returned an empty reply.');

      const botMsg: CoachChatMessage = {
        id: `coach_${Date.now()}`,
        sender: 'coach',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Coach API Error:', err);
      const fallbackMsg: CoachChatMessage = {
        id: `coach_err_${Date.now()}`,
        sender: 'coach',
        text: "Based on your current 30-day training protocol, I recommend practicing the Spatial N-Back and Digit Span modules to expand active working memory and focus span.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePromptClick = (promptText: string) => {
    handleSendMessage(promptText);
  };

  const handleClearChat = () => {
    soundFx.playClick();
    setMessages([
      {
        id: `welcome_reset_${Date.now()}`,
        sender: 'coach',
        text: "Chat cleared. Ask me any question about your cognitive training, working memory, or daily protocol!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl h-[90vh] max-h-[700px] bg-slate-900 border border-cyan-500/30 rounded-2xl sm:rounded-3xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden font-sans my-auto">
        
        {/* ChatGPT-style Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-1.5">
                  <span>AI Brain Coach</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </h3>
                {profile.isProUser ? (
                  <span className="text-[11px] font-mono font-bold text-cyan-400 px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/40 rounded-full">
                    PRO
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold eb-warn px-1.5 py-0.5 bg-amber-950/60 border border-amber-500/40 rounded-full flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" /> Free Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Online · Powered by Gemini AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearChat}
              title="Reset Conversation"
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Conversation Scroll View */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-slate-900/60">
          {messages.map((m) => {
            const isCoach = m.sender === 'coach';
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[88%] sm:max-w-[80%] ${
                  isCoach ? 'mr-auto' : 'ml-auto flex-row-reverse'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCoach
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-blue-600 text-white shadow-md'
                  }`}
                >
                  {isCoach ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>

                {/* Message Speech Bubble */}
                <div
                  className={`rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isCoach
                      ? 'bg-slate-950/90 border border-slate-800 text-slate-200 shadow-md'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-medium shadow-lg'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <span
                    className={`block text-[11px] font-mono mt-1.5 ${
                      isCoach ? 'text-slate-500' : 'text-slate-900/70 text-right'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 max-w-[80%] mr-auto">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                <span className="font-mono text-[11px] ml-1">Analyzing cognitive metrics...</span>
              </div>
            </div>
          )}

          {/* Pro Unlock Banner inside Chat if not Pro */}
          {!profile.isProUser && (
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-cyan-500/10 border border-amber-500/40 rounded-2xl text-center space-y-2 mt-4 shadow-md">
              <div className="flex items-center justify-center gap-1.5 eb-warn font-bold text-xs uppercase tracking-wider">
                <Crown className="w-4 h-4" />
                <span>Unlock the AI Coach</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                Pro gives you unlimited AI coaching, every training module, and your full progress history.
              </p>
              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenProModal();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <span>Upgrade to Pro Suite</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Prompt Chips */}
        <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0 pl-1">
            Prompts:
          </span>
          <button
            onClick={() => handlePromptClick("How can I improve my working memory score?")}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-[11px] font-mono rounded-lg shrink-0 cursor-pointer transition-colors"
          >
            🧠 Boost Working Memory
          </button>
          <button
            onClick={() => handlePromptClick("Analyze my current cognitive profile stats.")}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-[11px] font-mono rounded-lg shrink-0 cursor-pointer transition-colors"
          >
            📊 Analyze My Stats
          </button>
          <button
            onClick={() => handlePromptClick("What is the best daily order to train modules?")}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 text-[11px] font-mono rounded-lg shrink-0 cursor-pointer transition-colors"
          >
            ⚡ Daily Routine Strategy
          </button>
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={
              profile.isProUser
                ? "Ask AI Coach anything about your brain training..."
                : "Ask AI Coach (Upgrade to Pro for full chat)..."
            }
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isTyping}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
