import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Zap,
  Calendar,
  TrendingUp,
  Target,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Flame,
  Shield,
  Award,
  Activity,
  Layers,
  Compass,
  Sliders,
  X,
  ArrowRight,
  Lock,
  BarChart3,
  Clock,
  Cpu,
  Check,
  RotateCcw,
  Play,
  Gauge,
  Layers3,
  Binary,
  Boxes,
  Eye,
  Shuffle,
  ShieldCheck,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { GOAL_OPTIONS, goalById } from '../lib/goals';

interface OnboardingFlowProps {
  onCompleteOnboarding: (baselineScore: number, goalSettings?: { focusGoal: string; dailyMinutes: number }) => void;
  onSkipOnboarding: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onCompleteOnboarding,
  onSkipOnboarding,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1); // 1 to 5

  // Step 2: 30-Day Phase active tab
  const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);

  // Step 3: Difficulty simulator state
  const [simAccuracy, setSimAccuracy] = useState<number>(92);
  const [simLatency, setSimLatency] = useState<number>(310);

  // Step 4: Core Module Domain showcase tab
  const [activeDomain, setActiveDomain] = useState<number>(0);

  // Step 4 Mini Demos States
  const [stroopAnswered, setStroopAnswered] = useState<boolean | null>(null);
  const [digitDemoValue, setDigitDemoValue] = useState<string>('');
  const [digitDemoSuccess, setDigitDemoSuccess] = useState<boolean | null>(null);
  const [reactionDemoTime, setReactionDemoTime] = useState<number | null>(null);
  const [reactionStartTime, setReactionStartTime] = useState<number>(0);
  const [reactionState, setReactionState] = useState<'idle' | 'waiting' | 'ready' | 'done'>('idle');

  // Step 5: Initial Profile Setup
  const [selectedFocusGoal, setSelectedFocusGoal] = useState<string>('focus');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(10);
  const [isQuickCalibrating, setIsQuickCalibrating] = useState<boolean>(false);
  const [calibrationScore, setCalibrationScore] = useState<number>(240);

  const totalSteps = 5;

  const handleNext = () => {
    soundFx.playClick();
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    soundFx.playClick();
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    soundFx.playLevelUp();
    onCompleteOnboarding(calibrationScore, {
      focusGoal: selectedFocusGoal,
      dailyMinutes: selectedMinutes,
    });
  };

  // Quick Mini Reaction Demo Handler
  const startReactionDemo = () => {
    setReactionState('waiting');
    setReactionDemoTime(null);
    const delay = 1200 + Math.random() * 1000;
    setTimeout(() => {
      setReactionState('ready');
      setReactionStartTime(Date.now());
    }, delay);
  };

  const handleReactionClick = () => {
    if (reactionState === 'ready') {
      const ms = Date.now() - reactionStartTime;
      setReactionDemoTime(ms);
      setReactionState('done');
      soundFx.playSuccess();
    }
  };

  // Modules List for Step 4
  const domainPillars = [
    {
      id: 'memory',
      title: 'Working Memory Span',
      badge: 'Memory Capacity',
      icon: Binary,
      color: 'amber',
      accentColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
      description: 'Expand your mental workbench to store and manipulate complex information simultaneously.',
      modules: ['Digit Span Backwards', 'Spatial Dual N-Back'],
      miniDemoType: 'digit',
    },
    {
      id: 'focus',
      title: 'Selective Attention & Focus',
      badge: 'Distraction Suppression',
      icon: Target,
      color: 'rose',
      accentColor: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
      description: 'Filter irrelevant sensory noise and zero in on crucial targets under tight temporal constraints.',
      modules: ['Stroop Interference Match', 'Mindful Stillness Hold'],
      miniDemoType: 'stroop',
    },
    {
      id: 'logic',
      title: 'Pattern & Fluid IQ',
      badge: 'Abstract Logic',
      icon: Boxes,
      color: 'violet',
      accentColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
      description: 'Recognize hidden geometric rules, inductive spatial sequences, and matrix transformations.',
      modules: ['Pattern Matrix Reasoning'],
      miniDemoType: 'matrix',
    },
    {
      id: 'flexibility',
      title: 'Cognitive Shift',
      badge: 'Executive Switch',
      icon: Shuffle,
      color: 'emerald',
      accentColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
      description: 'Switch between fluid cognitive rules seamlessly without loss of speed or accuracy.',
      modules: ['Cognitive Shift Sorting'],
      miniDemoType: 'flexibility',
    },
    {
      id: 'inhibition',
      title: 'Inhibitory & Visuospatial',
      badge: 'Reflex Control',
      icon: Compass,
      color: 'sky',
      accentColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
      description: 'Suppress automatic impulse triggers and mentally rotate complex 3D visual structures.',
      modules: ['Reaction Inhibitor', '3D Visuospatial Rotation'],
      miniDemoType: 'reaction',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto select-none font-sans">
      <div className="relative w-full max-w-3xl bg-surface border border-rule rounded-3xl p-5 sm:p-8 shadow-2xl overflow-hidden my-auto">
        
        {/* Top Header Bar with Progress Indicator */}
        <div className="flex items-center justify-between pb-4 border-b border-rule mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-signal/15 border border-signal/40 text-signal flex items-center justify-center font-bold font-mono text-xs">
              {currentStep}
            </div>
            <div>
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider block">
                Onboarding Protocol • Step {currentStep} of {totalSteps}
              </span>
              <h2 className="text-sm sm:text-base font-display font-bold text-ink">
                {currentStep === 1 && 'Welcome to Elite Brain'}
                {currentStep === 2 && '30-Day Cognitive Roadmap'}
                {currentStep === 3 && 'Self-Adjusting Difficulty Engine'}
                {currentStep === 4 && 'Core Cognitive Training Domains'}
                {currentStep === 5 && 'Initial Setup & Day 1 Launch'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Progress Dots */}
            <div className="hidden sm:flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    s === currentStep
                      ? 'w-6 bg-signal'
                      : s < currentStep
                      ? 'w-2 bg-emerald-400'
                      : 'w-2 bg-surface-sunk border border-rule'
                  }`}
                />
              ))}
            </div>

            {/* Skip Button */}
            <button
              onClick={() => {
                soundFx.playClick();
                onSkipOnboarding();
              }}
              className="text-xs font-mono text-ink-muted hover:text-ink px-2.5 py-1 rounded-lg hover:bg-surface-sunk transition-colors cursor-pointer"
            >
              Skip →
            </button>
          </div>
        </div>

        {/* STEP CONTENT SWITCHER */}
        <div className="min-h-[380px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: WELCOME & CONCEPT */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-signal/15 border border-signal/30 text-signal text-xs font-mono font-bold rounded-full uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Your daily system for mental training and focused work</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-ink tracking-tight">
                    Train Your Brain with Deliberate Practice
                  </h1>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Elite Brain combines clinical neuroscience paradigms into a structured, daily 5-minute training routine designed to elevate working memory span, attention control, and processing speed.
                  </p>
                </div>

                {/* Animated Brain Synapse Core Visual */}
                <div className="relative mx-auto w-full max-w-md bg-gradient-to-b from-surface-sunk to-surface border border-rule rounded-2xl p-6 text-center overflow-hidden shadow-inner">
                  {/* Glowing Animated Ring Background */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                      className="w-64 h-64 rounded-full border-2 border-dashed border-signal"
                    />
                  </div>

                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-20 h-20 rounded-2xl bg-signal/20 border-2 border-signal/50 text-signal flex items-center justify-center mb-4 shadow-lg shadow-signal/20"
                    >
                      <Brain className="w-10 h-10" />
                    </motion.div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full mt-2">
                      <div className="p-2.5 bg-surface border border-rule rounded-xl text-center">
                        <span className="block text-base font-extrabold font-mono text-signal">30 Days</span>
                        <span className="text-[10px] text-ink-muted uppercase font-mono">Structured Plan</span>
                      </div>
                      <div className="p-2.5 bg-surface border border-rule rounded-xl text-center">
                        <span className="block text-base font-extrabold font-mono text-emerald-400">100%</span>
                        <span className="text-[10px] text-ink-muted uppercase font-mono">Adaptive AI</span>
                      </div>
                      <div className="p-2.5 bg-surface border border-rule rounded-xl text-center">
                        <span className="block text-base font-extrabold font-mono text-amber-400">8 Core</span>
                        <span className="text-[10px] text-ink-muted uppercase font-mono">Cognitive Modules</span>
                      </div>
                      <div className="p-2.5 bg-surface border border-rule rounded-xl text-center">
                        <span className="block text-base font-extrabold font-mono text-violet-400">5 Mins</span>
                        <span className="text-[10px] text-ink-muted uppercase font-mono">Daily Commitment</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-surface-sunk border border-rule rounded-xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-ink font-bold">Daily Micro-Sessions</strong>
                      <span className="text-[11px] text-ink-muted">Consistently short, targeted workouts built to prevent cognitive burnout.</span>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-sunk border border-rule rounded-xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-signal shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-ink font-bold">Dynamic Scaling</strong>
                      <span className="text-[11px] text-ink-muted">Tasks automatically level up as your reaction time and accuracy improve.</span>
                    </div>
                  </div>
                  <div className="p-3 bg-surface-sunk border border-rule rounded-xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-ink font-bold">Real-time Metrics</strong>
                      <span className="text-[11px] text-ink-muted">Track your scores over time and see your personal bests.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: 30-DAY STRUCTURE */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold rounded-md mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Neuro-Gym Roadmap</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-ink">
                    The 30-Day Cognitive Protocol
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-muted">
                    Your training is broken down into 3 evolutionary phases. Each phase targets key cognitive adaptations and increases task complexity over 30 consecutive days.
                  </p>
                </div>

                {/* Phase Selection Tabs */}
                <div className="grid grid-cols-3 gap-2 bg-surface-sunk p-1 border border-rule rounded-2xl">
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setActivePhase(1);
                    }}
                    className={`py-2 px-3 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer text-center ${
                      activePhase === 1
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Phase 1 (Days 1–7)
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setActivePhase(2);
                    }}
                    className={`py-2 px-3 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer text-center ${
                      activePhase === 2
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Phase 2 (Days 8–18)
                  </button>
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setActivePhase(3);
                    }}
                    className={`py-2 px-3 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer text-center ${
                      activePhase === 3
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Phase 3 (Days 19–30)
                  </button>
                </div>

                {/* Active Phase Banner Box */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePhase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`p-5 rounded-2xl border ${
                      activePhase === 1
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : activePhase === 2
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-surface border border-rule text-ink">
                          {activePhase === 1 && 'DAYS 1 — 7'}
                          {activePhase === 2 && 'DAYS 8 — 18'}
                          {activePhase === 3 && 'DAYS 19 — 30'}
                        </span>
                        <h3 className="text-base font-display font-bold text-ink">
                          {activePhase === 1 && 'Foundation & Calibration'}
                          {activePhase === 2 && 'Working Memory & Attention Surge'}
                          {activePhase === 3 && 'High-Frequency Cognitive Mastery'}
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-ink-muted">Phase {activePhase} of 3</span>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed mb-4">
                      {activePhase === 1 &&
                        'Establish your cognitive baseline across memory span, Stroop interference, and response latency. Focus on building consistency.'}
                      {activePhase === 2 &&
                        'Escalate difficulty into Spatial Dual N-Back and Pattern Matrix reasoning. Expand short-term mental holding capacity under strict time constraints.'}
                      {activePhase === 3 &&
                        'Peak cognitive conditioning with fluid rule-switching, 3D visuospatial rotations, and rapid impulse inhibition tasks.'}
                    </p>

                    {/* Interactive Days Preview Timeline */}
                    <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-rule/30 text-center font-mono text-xs">
                      {Array.from({ length: 7 }, (_, i) => {
                        const dayNum =
                          activePhase === 1 ? i + 1 : activePhase === 2 ? i + 8 : i + 19;
                        const isFirstInPhase = i === 0;

                        return (
                          <div
                            key={dayNum}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                              isFirstInPhase
                                ? 'bg-signal text-white border-signal shadow-xs font-bold'
                                : 'bg-surface border-rule text-ink-muted'
                            }`}
                          >
                            <span className="text-[10px] opacity-70">DAY</span>
                            <span className="text-xs font-bold">{dayNum}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="p-3 bg-surface-sunk border border-rule rounded-xl text-xs font-mono text-ink-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Consistency Multiplier: Missing a day resets your active streak!</span>
                  </div>
                  <span className="text-ink font-bold">+100 XP Daily</span>
                </div>
              </motion.div>
            )}

            {/* STEP 3: SELF-ADJUSTING DIFFICULTY ENGINE */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold rounded-md mb-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Real-Time Flow State Engine</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-ink">
                    Self-Adjusting Difficulty Engine
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-muted">
                    Elite Brain measures your response latency (in milliseconds) and accuracy rate after every trial to ensure you remain in your peak growth window.
                  </p>
                </div>

                {/* Interactive Simulator Card */}
                <div className="bg-surface-sunk border border-rule rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-rule pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-signal" />
                      <span className="text-xs font-mono font-bold text-ink">
                        Interactive Difficulty Engine Preview
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-ink-muted">Try tweaking parameters below</span>
                  </div>

                  {/* Simulator Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Accuracy Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">Trial Accuracy:</span>
                        <span className="text-emerald-400 font-bold">{simAccuracy}%</span>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={100}
                        value={simAccuracy}
                        onChange={(e) => setSimAccuracy(Number(e.target.value))}
                        className="w-full accent-signal cursor-pointer"
                      />
                    </div>

                    {/* Latency Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">Response Latency:</span>
                        <span className="text-amber-400 font-bold">{simLatency} ms</span>
                      </div>
                      <input
                        type="range"
                        min={180}
                        max={800}
                        step={10}
                        value={simLatency}
                        onChange={(e) => setSimLatency(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Dynamic Computed Outcome */}
                  {(() => {
                    let levelAction = 'MAINTAIN LEVEL 3 (Stabilizing)';
                    let levelColor = 'text-amber-400 bg-amber-500/15 border-amber-500/30';
                    let description =
                      'That sat in the target difficulty range — hard enough to stretch you, not so hard it stops being useful.';

                    if (simAccuracy >= 88 && simLatency < 400) {
                      levelAction = '⚡ LEVEL UP! (Level 3 → Level 4)';
                      levelColor = 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
                      description =
                        'High accuracy and rapid response detected. Increasing digit span sequence and reducing time limit.';
                    } else if (simAccuracy < 65 || simLatency > 550) {
                      levelAction = '🛡️ AUTO-CALIBRATE (Level 3 → Level 2)';
                      levelColor = 'text-rose-400 bg-rose-500/15 border-rose-500/30';
                      description =
                        'Higher error margin detected. Easing sequence load to build confidence and prevent fatigue.';
                    }

                    return (
                      <div className={`p-4 rounded-xl border transition-all ${levelColor}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-extrabold">{levelAction}</span>
                          <span className="text-[10px] font-mono">Real-time Feedback</span>
                        </div>
                        <p className="text-xs opacity-90 leading-relaxed">{description}</p>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-surface border border-rule rounded-xl flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>High Accuracy:</strong> Speeds up sequence tempo and expands span length.</span>
                  </div>
                  <div className="p-3 bg-surface border border-rule rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-signal shrink-0" />
                    <span><strong>Zero Penalty:</strong> Eases load safely without losing accumulated XP points.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: COGNITIVE MODULES SHOWCASE */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold rounded-md mb-1">
                    <Layers3 className="w-3.5 h-3.5" />
                    <span>Targeted Brain Pillars</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-ink">
                    5 Core Cognitive Domains
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Select a domain below to preview its training modules and test a quick micro-demo.
                  </p>
                </div>

                {/* Domain Selector Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {domainPillars.map((domain, idx) => {
                    const IconComp = domain.icon;
                    const isActive = activeDomain === idx;
                    return (
                      <button
                        key={domain.id}
                        onClick={() => {
                          soundFx.playClick();
                          setActiveDomain(idx);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-signal text-white shadow-xs'
                            : 'bg-surface-sunk hover:bg-surface border border-rule text-ink-muted hover:text-ink'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{domain.title.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Domain Card Preview */}
                {(() => {
                  const currentPillar = domainPillars[activeDomain];
                  const IconComp = currentPillar.icon;

                  return (
                    <div className="bg-surface-sunk border border-rule rounded-2xl p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${currentPillar.accentColor}`}>
                            <IconComp className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-ink-muted uppercase">
                              {currentPillar.badge}
                            </span>
                            <h3 className="text-base font-display font-bold text-ink">
                              {currentPillar.title}
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {currentPillar.modules.map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 bg-surface border border-rule rounded-md text-[10px] font-mono font-bold text-ink"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-ink-muted leading-relaxed">
                        {currentPillar.description}
                      </p>

                      {/* Mini Interactive Demo Box */}
                      <div className="p-3 bg-surface border border-rule rounded-xl space-y-2">
                        <span className="text-[10px] font-mono uppercase text-ink-muted font-bold block">
                          Interactive Mini Preview
                        </span>

                        {currentPillar.miniDemoType === 'digit' && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-mono text-ink">
                              Sequence: <strong className="text-amber-400 font-bold text-sm tracking-widest">8 • 3 • 5 • 1</strong>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={4}
                                placeholder="___"
                                value={digitDemoValue}
                                onChange={(e) => setDigitDemoValue(e.target.value)}
                                className="w-20 text-center font-mono text-xs p-1.5 bg-surface-sunk border border-rule rounded-lg text-ink focus:border-amber-400 focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  if (digitDemoValue.trim() === '8351') {
                                    setDigitDemoSuccess(true);
                                    soundFx.playSuccess();
                                  } else {
                                    setDigitDemoSuccess(false);
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold rounded-lg cursor-pointer"
                              >
                                Test
                              </button>
                            </div>
                            {digitDemoSuccess === true && <span className="text-xs font-mono text-emerald-400 font-bold">✓ Match!</span>}
                            {digitDemoSuccess === false && <span className="text-xs font-mono text-rose-400 font-bold">Try 8351</span>}
                          </div>
                        )}

                        {currentPillar.miniDemoType === 'stroop' && (
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-display font-extrabold text-blue-500 px-3 py-1 bg-surface-sunk border border-rule rounded-lg">
                              RED
                            </div>
                            <span className="text-xs text-ink-muted">Select ink color:</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setStroopAnswered(false);
                                }}
                                className="px-2.5 py-1.5 bg-surface-sunk border border-rule text-xs font-mono rounded-lg cursor-pointer"
                              >
                                Red Text
                              </button>
                              <button
                                onClick={() => {
                                  setStroopAnswered(true);
                                  soundFx.playSuccess();
                                }}
                                className="px-2.5 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-mono font-bold rounded-lg cursor-pointer"
                              >
                                Blue Ink ✓
                              </button>
                            </div>
                            {stroopAnswered === true && <span className="text-xs font-mono text-emerald-400 font-bold">Correct!</span>}
                          </div>
                        )}

                        {currentPillar.miniDemoType === 'reaction' && (
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={reactionState === 'ready' ? handleReactionClick : startReactionDemo}
                              className={`px-4 py-2 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer ${
                                reactionState === 'ready'
                                  ? 'bg-sky-500 text-slate-950 animate-pulse'
                                  : 'bg-surface-sunk border border-rule text-ink'
                              }`}
                            >
                              {reactionState === 'idle' && 'Click to Start Reflex Test'}
                              {reactionState === 'waiting' && 'Wait for Blue...'}
                              {reactionState === 'ready' && 'CLICK NOW!'}
                              {reactionState === 'done' && 'Test Again'}
                            </button>
                            {reactionDemoTime && (
                              <span className="text-xs font-mono text-emerald-400 font-bold">
                                Latency: {reactionDemoTime} ms!
                              </span>
                            )}
                          </div>
                        )}

                        {(currentPillar.miniDemoType === 'matrix' || currentPillar.miniDemoType === 'flexibility') && (
                          <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                            <span>Evaluates visual logic matrix, rule rotations & card classification.</span>
                            <span className="text-signal font-bold">Active in Daily Plan</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* STEP 5: INITIAL SETUP & DAY 1 LAUNCH */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold rounded-md mb-1">
                    <RocketIcon className="w-3.5 h-3.5" />
                    <span>Final Protocol Setup</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-display font-extrabold text-ink">
                    Set Your Daily Goal & Launch Day 1
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-muted">
                    Tailor your training priority and daily commitment. Your Day 1 recommended exercises are queued and ready.
                  </p>
                </div>

                {/* Setup Controls Form */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Focus Selection */}
                  <div className="p-4 bg-surface-sunk border border-rule rounded-2xl space-y-2">
                    <span className="text-xs font-mono font-bold text-ink block">
                      1. Primary Cognitive Goal
                    </span>
                    <div className="space-y-1.5">
                      {GOAL_OPTIONS.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedFocusGoal(g.id);
                          }}
                          className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-2 ${
                            selectedFocusGoal === g.id
                              ? 'bg-signal/20 border border-signal/40'
                              : 'bg-surface hover:bg-surface-sunk border border-rule'
                          }`}
                        >
                          <span className="min-w-0">
                            <span
                              className={`block text-xs font-mono font-bold ${
                                selectedFocusGoal === g.id ? 'text-signal' : 'text-ink'
                              }`}
                            >
                              {g.label}
                            </span>
                            <span className="block text-[10px] text-ink-muted mt-0.5 leading-snug">
                              {g.blurb}
                            </span>
                          </span>
                          {selectedFocusGoal === g.id && (
                            <Check className="w-3.5 h-3.5 text-signal shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Daily Commitment Selection */}
                  <div className="p-4 bg-surface-sunk border border-rule rounded-2xl space-y-3">
                    <span className="text-xs font-mono font-bold text-ink block">
                      2. Daily Workout Commitment
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { mins: 5, label: 'Light', desc: '1 Module/day' },
                        { mins: 10, label: 'Standard', desc: '2 Modules/day' },
                        { mins: 15, label: 'Elite Pro', desc: '3 Modules/day' },
                      ].map((opt) => (
                        <button
                          key={opt.mins}
                          onClick={() => {
                            soundFx.playClick();
                            setSelectedMinutes(opt.mins);
                          }}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                            selectedMinutes === opt.mins
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                              : 'bg-surface hover:bg-surface-sunk border-rule text-ink-muted'
                          }`}
                        >
                          <Clock className="w-4 h-4 mb-1" />
                          <span className="text-xs font-bold font-mono">{opt.mins} Mins</span>
                          <span className="text-[9px] opacity-80">{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="p-3 bg-surface border border-rule rounded-xl text-xs font-mono text-ink-muted space-y-1">
                      <div className="flex items-center justify-between text-ink font-bold">
                        <span>Starting Day 1 Status:</span>
                        <span className="text-emerald-400">Ready to Begin</span>
                      </div>
                      <p className="text-[11px]">
                        Targeting <strong>{goalById(selectedFocusGoal)?.label || selectedFocusGoal}</strong> with <strong>{selectedMinutes} mins/day</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Day 1 Launch Banner */}
                <div className="bg-gradient-to-r from-signal/15 via-indigo-500/10 to-emerald-500/15 border border-signal/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-signal text-white flex items-center justify-center font-bold font-mono text-sm shrink-0 shadow-lg shadow-signal/30">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-display text-ink">
                        Day 1 Protocol Enqueued
                      </h4>
                      <p className="text-xs text-ink-muted">
                        Digit Span Memory & Stroop Match calibration tests are queued for your first workout session.
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleFinish}
                    className="w-full sm:w-auto py-3 px-6 bg-signal hover:bg-signal/90 text-white font-mono text-xs font-bold rounded-xl shadow-lg shadow-signal/25 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>🚀 Launch Day 1 Workout</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Bottom Navigation Buttons */}
          <div className="flex items-center justify-between pt-5 border-t border-rule mt-6">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-4 py-2 text-xs font-mono font-bold text-ink-muted hover:text-ink disabled:opacity-30 disabled:hover:text-ink-muted rounded-xl hover:bg-surface-sunk transition-colors cursor-pointer flex items-center gap-1 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="text-xs font-mono text-ink-muted hidden sm:block">
              Step {currentStep} of {totalSteps}
            </div>

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 bg-signal hover:bg-signal/90 text-white text-xs font-mono font-bold rounded-xl shadow-md shadow-signal/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <span>
                  {currentStep === 1 && 'Next: 30-Day Structure'}
                  {currentStep === 2 && 'Next: Adaptive Engine'}
                  {currentStep === 3 && 'Next: Core Modules'}
                  {currentStep === 4 && 'Next: Profile Setup'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-mono font-bold rounded-xl shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Complete & Start Protocol</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// Rocket icon component helper
function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.79-1.81.2-2.55L4.5 16.5z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z" />
      <path d="M9 18l3 3" />
    </svg>
  );
}
