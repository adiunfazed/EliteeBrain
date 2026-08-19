import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, CoachChatMessage } from '../types';
import { soundFx } from '../utils/audio';
import { calculateBrainScore } from '../utils/storage';
import { Send, Sparkles, Bot, User as UserIcon, RefreshCw, Crown, Lock, ArrowRight, Zap, Lightbulb, CalendarCheck, LifeBuoy, TrendingUp, Target, Repeat, Flag, Scale, Brain, Plus } from 'lucide-react';
import { getIdToken } from '../lib/firebase';
import {
  COACH_ACTIONS,
  clearChatEverywhere,
  loadChat,
  saveChat,
  saveChatEverywhere,
  subscribeChat,
} from '../lib/coachChat';

interface AICoachSectionProps {
  /** Chats are stored per account so users never see each other's thread. */
  currentUser?: { uid: string } | null;
  profile: UserProfile;
  onOpenProModal: () => void;
}

export const AICoachSection: React.FC<AICoachSectionProps> = ({
  profile,
  currentUser,
  onOpenProModal,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = currentUser?.uid || null;
  /** Guards against reacting to this device's own cloud write. */
  const lastWriteRef = useRef<string>('');
  const messagesRef = useRef<CoachChatMessage[]>([]);

  const brainScore = calculateBrainScore(profile);

  // Restore the local copy immediately so the thread is on screen without
  // waiting for the network.
  useEffect(() => {
    const saved = loadChat(userId);
    if (saved.length > 0) setMessages(saved);
    setLoaded(true);
  }, [userId]);

  // Then follow the cloud copy, so a phone and a laptop signed into the same
  // account converge on one conversation.
  useEffect(() => {
    if (!userId) return;
    return subscribeChat(userId, (cloud, updatedAt) => {
      // Ignore this device's own write coming back.
      if (updatedAt && updatedAt === lastWriteRef.current) return;
      // A failed or empty cloud read must never wipe a local conversation.
      if (cloud.length === 0) return;

      // Adopt the cloud copy when it differs. Comparing content rather than
      // length catches edits and replacements, not just additions.
      const localIds = messagesRef.current.map((m) => m.id).join('|');
      const cloudIds = cloud.map((m) => m.id).join('|');
      if (localIds === cloudIds) return;

      lastWriteRef.current = updatedAt;
      messagesRef.current = cloud;
      setMessages(cloud);
      saveChat(userId, cloud);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Persist locally and to the cloud on every change.
  useEffect(() => {
    if (!loaded) return;
    messagesRef.current = messages;
    const stamp = new Date().toISOString();
    lastWriteRef.current = stamp;
    // Pass the same stamp we recorded, so the echo guard can actually
    // recognise this device's own write coming back.
    saveChatEverywhere(userId, messages, stamp);
  }, [messages, loaded, userId]);

  // Initial welcome message
  useEffect(() => {
    if (loaded && messages.length === 0) {
      const welcomeMessage: CoachChatMessage = {
        id: 'welcome_1',
        sender: 'coach',
        text: `Hi\n\nI'm your training coach. I can see your scores so far (index ${brainScore}, day ${profile.currentDay} of 30) and help you decide what to work on.\n\nWhat would you like help with?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([welcomeMessage]);
    }
  }, [brainScore, profile.currentDay, loaded]);

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
      soundFx.playSuccess();
    } catch (e) {
      console.error(e);
      const fallbackMsg: CoachChatMessage = {
        id: `coach_${Date.now()}`,
        sender: 'coach',
        text:
          e instanceof Error && e.message
            ? e.message
            : "I couldn't reach the coach just now. Try again in a moment.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const startNewChat = () => {
    soundFx.playClick();
    clearChatEverywhere(userId);
    setMessages([]);
    setChatInput('');
  };

  const iconFor = (name: string) => {
    const map: Record<string, any> = {
      CalendarCheck,
      LifeBuoy,
      TrendingUp,
      Target,
      Repeat,
      Flag,
      Scale,
      Brain,
    };
    return map[name] || Sparkles;
  };

  /** Cards only show on a fresh thread — once talking, they'd be clutter. */
  const showActions = (messages.length <= 1 || actionsOpen) && !isTyping;

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#12161F] via-[#1A1F2C] to-[#12161F] border border-[#2A313C] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/20 border-2 border-[#8B5CF6]/50 text-[#A78BFA] flex items-center justify-center shadow-lg shrink-0">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A78BFA] px-2 py-0.5 bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 rounded-md">
                  Your coach
                </span>
                {profile.isProUser ? (
                  <span className="text-[10px] font-mono font-bold eb-warn px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded-md">
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
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Ask about your plan, your habits, or what to do next.
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
      <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-3.5 sm:p-6 space-y-3 flex flex-col h-[min(72vh,620px)] shadow-2xl relative overflow-hidden">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'coach' && (
                <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[82%] sm:max-w-[72%] px-4 py-3 text-sm leading-relaxed break-words ${
                  msg.sender === 'user'
                    ? 'bg-[#8B5CF6] text-white rounded-2xl rounded-br-md shadow-[0_4px_14px_-6px_rgba(139,92,246,0.8)]'
                    : 'bg-[#171B22] border border-[#2A313C] text-[#E7EAEE] rounded-2xl rounded-bl-md whitespace-pre-line'
                }`}
              >
                {msg.text}
                <span
                  className={`block text-[11px] font-mono mt-1.5 ${
                    msg.sender === 'user' ? 'text-white/60 text-right' : 'text-[#5A6472]'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3.5 bg-[#171B22] border border-[#2A313C] rounded-2xl rounded-bl-md flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

        {/* Action cards — starting points on a fresh thread. Each sends a
            real question so the coach has something specific to answer. */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 pt-3 mt-1 border-t border-[#2A313C]">
                {COACH_ACTIONS.map((action, i) => {
                  const Icon = iconFor(action.icon);
                  const hues = ['#7C5CFF', '#FF6B57', '#00C2A8', '#FFB020', '#4C9AFF', '#A78BFA', '#FF8FA3', '#5BE9B9'];
                  const hue = hues[i % hues.length];
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        setActionsOpen(false);
                        handleSendMessage(action.prompt);
                      }}
                      style={{ color: hue }}
                      className="eb-press eb-shine eb-tint text-left p-3 rounded-xl bg-[#14171F] border border-[#262C38] hover:border-current transition-colors min-w-0 relative"
                    >
                      <Icon className="w-4 h-4 mb-2 relative" />
                      <p className="eb-heading text-xs text-[#F2F4F7] leading-snug break-words relative">
                        {action.title}
                      </p>
                      <p className="text-[12px] text-[#8A93A5] mt-1 leading-snug break-words relative">
                        {action.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

          <div ref={chatEndRef} />
        </div>



        {messages.length > 1 && (
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setActionsOpen((v) => !v)}
              className="eb-press text-[10px] font-mono font-bold px-3 py-2 rounded-xl border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] hover:border-[#3A424F] flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              {actionsOpen ? 'Hide ideas' : 'Ideas'}
            </button>
            <button
              onClick={startNewChat}
              className="eb-press text-[10px] font-mono font-bold px-3 py-2 rounded-xl border border-[#2A313C] text-[#98A2B3] hover:text-[#F4F6F8] hover:border-[#3A424F] flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              New chat
            </button>
          </div>
        )}

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
            className="flex-1 px-4 py-3 bg-[#0D1117] border border-[#2A313C] text-white font-mono text-xs rounded-2xl focus:border-[#8B5CF6] focus:outline-none disabled:opacity-50"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!profile.isProUser || isTyping || !chatInput.trim()}
            className="p-3 bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 disabled:opacity-40 text-white rounded-2xl cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Non-Pro overlay if applicable */}
        {!profile.isProUser && (
          <div className="absolute inset-x-0 bottom-0 top-36 bg-[#0D1117]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 eb-warn flex items-center justify-center">
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
