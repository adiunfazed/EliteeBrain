import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ModuleId, Task } from '../types';
import { MODULE_METADATA, calculateBrainScore } from '../utils/storage';
import { Eyebrow } from './ui/Eyebrow';
import { StatNumber } from './ui/StatNumber';
import { Button } from './ui/Button';
import { ChartRecorder } from './ChartRecorder';
import { ModuleRoster } from './ModuleRoster';
import { ModuleCard } from './ModuleCard';
import { DayProgressCalendar } from './DayProgressCalendar';
import { AchievementsDashboardSection } from './AchievementsDashboardSection';
import { RankProgressionSection } from './RankProgressionSection';
import { AICoachSection } from './AICoachSection';
import { CommunitySection } from './CommunitySection';
import { GamesSection } from './GamesSection';
import { TasksSection } from './TasksSection';
import { FocusSection } from './FocusSection';
import { GoalsSection } from './GoalsSection';
import { ProGate } from './ProGate';
import { LifeSection } from './LifeSection';
import { TodayPane } from './TodayPane';
import { MomentumChart } from './MomentumChart';
import { CommandCenter } from './CommandCenter';
import { StreakCard } from './StreakCard';
import { computeStreak } from '../lib/streak';
import { checkAchievements } from '../utils/achievements';
import { habitStats, valueOn } from '../lib/habits';
import { blocksForDate } from '../lib/routine';
import { todayISO } from '../lib/tasks';
import { dueReminders, fireReminders, loadPrefs, registerServiceWorker } from '../lib/notifications';
import { WeeklyReviewSection } from './WeeklyReviewSection';
import { RealityVsPlan } from './RealityVsPlan';
import {
  subscribeRoutineBlocks,
  subscribeRoutineLogs,
  subscribeSleepLogs,
  subscribeHabits,
  subscribeHabitLogs,
  subscribeGoals,
} from '../lib/goalStore';
import { DailyMission } from './DailyMission';
import { ProgressSection } from './ProgressSection';
import { DailyChallengeCard } from './DailyChallengeCard';
import { SKILL_GROUPS, SKILL_GROUP_ORDER, skillGroupOf } from '../lib/skillGroups';
import { emphasisedGroup } from '../lib/goals';
import { subscribeFocusSessions, focusSessionsToday, focusSecondsToday } from '../lib/focus';
import { completedTodayCount as tasksDoneToday } from '../lib/tasks';
import { subscribeTasks, bucketTasks } from '../lib/tasks';
import { soundFx } from '../utils/audio';
import { User, signInWithGoogle } from '../lib/firebase';
import {
  LayoutGrid,
  List,
  Cloud,
  LogIn,
  Sparkles,
  Crown,
  Zap,
  ShieldCheck,
  ArrowRight,
  Trophy,
  Brain,
  Send,
  Flame,
  Activity,
  MessageCircle,
  Gamepad2,
  CheckSquare,
  TrendingUp,
  Sun,
  Target,
  Clock,
  Timer,
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  currentUser?: User | null;
  onLaunchModule: (id: ModuleId) => void;
  onOpenProModal: () => void;
  onOpenAuthModal?: () => void;
  onOpenBadgesGallery?: () => void;
  onProfileUpdate?: (updatedProfile: UserProfile) => void;
}

export type DashboardSection = 'engine' | 'exercises' | 'coach' | 'games' | 'hub' | 'progress';

export const Dashboard: React.FC<Props> = ({
  profile,
  currentUser,
  onLaunchModule,
  onOpenProModal,
  onOpenAuthModal,
  onOpenBadgesGallery,
  onProfileUpdate,
}) => {
  const [activeSection, setActiveSection] = useState<DashboardSection>('engine');
  const [viewMode, setViewMode] = useState<'grid' | 'roster'>('grid');
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [hubPane, setHubPane] = useState<'today' | 'tasks' | 'goals' | 'routine' | 'focus'>('today');
  const [focusHandoff, setFocusHandoff] = useState<Task | null>(null);
  const [lifePane, setLifePane] = useState<'routine' | 'week' | 'sleep' | undefined>();
  const [habitHandoff, setHabitHandoff] = useState<{ title: string; minutes: number; habitId: string } | null>(null);
  const [tasksDone, setTasksDone] = useState(0);
  const [tasksTarget, setTasksTarget] = useState(0);
  const [focusToday, setFocusToday] = useState({ sessions: 0, seconds: 0 });

  // Life Momentum reads across every system, so the raw collections are
  // subscribed once here and passed down rather than re-fetched per component.
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allFocus, setAllFocus] = useState<any[]>([]);
  const [allHabits, setAllHabits] = useState<any[]>([]);
  const [allHabitLogs, setAllHabitLogs] = useState<any[]>([]);
  const [routineBlocks, setRoutineBlocks] = useState<any[]>([]);
  const [routineLogs, setRoutineLogs] = useState<any[]>([]);
  const [sleepLogs, setSleepLogs] = useState<any[]>([]);
  const [allGoals, setAllGoals] = useState<any[]>([]);

  useEffect(() => subscribeGoals(currentUser?.uid || null, setAllGoals), [currentUser?.uid]);
  useEffect(() => subscribeHabits(currentUser?.uid || null, setAllHabits), [currentUser?.uid]);
  useEffect(() => subscribeHabitLogs(currentUser?.uid || null, setAllHabitLogs), [currentUser?.uid]);
  useEffect(() => subscribeRoutineBlocks(currentUser?.uid || null, setRoutineBlocks), [currentUser?.uid]);
  useEffect(() => subscribeRoutineLogs(currentUser?.uid || null, setRoutineLogs), [currentUser?.uid]);
  useEffect(() => subscribeSleepLogs(currentUser?.uid || null, setSleepLogs), [currentUser?.uid]);

  const momentumInput = useMemo(
    () => ({
      tasks: allTasks,
      habits: allHabits,
      habitLogs: allHabitLogs,
      focusSessions: allFocus,
      routineBlocks,
      routineLogs,
      sleepLogs,
      goals: allGoals,
      profile,
    }),
    [allTasks, allHabits, allHabitLogs, allFocus, routineBlocks, routineLogs, sleepLogs, allGoals, profile]
  );

  // Reminder scheduler. Runs while the app is open, checking once a minute for
  // anything due. Each reminder records that it fired today, so it cannot
  // repeat on the next tick.
  useEffect(() => {
    registerServiceWorker();
    const tick = () => {
      const prefs = loadPrefs();
      if (!prefs.enabled) return;
      const due = dueReminders(
        {
          blocks: routineBlocks,
          routineLogs,
          habits: allHabits,
          habitLogs: allHabitLogs,
          tasks: allTasks,
        },
        prefs
      );
      if (due.length > 0) fireReminders(due);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [routineBlocks, routineLogs, allHabits, allHabitLogs, allTasks]);

  // Life-based badges depend on data spread across several collections, so
  // they are evaluated here where everything is already subscribed.
  useEffect(() => {
    const today = todayISO();
    const bestHabitStreak = allHabits
      .filter((h: any) => h.status === 'active')
      .reduce((best: number, h: any) => Math.max(best, habitStats(h, allHabitLogs, today).bestStreak), 0);

    const dayBlocks = blocksForDate(routineBlocks, routineLogs, today);
    const focusMinutesTotal = Math.round(
      allFocus.reduce((sum: number, s: any) => sum + (s.focusedSeconds || 0), 0) / 60
    );

    const life = {
      habitCount: allHabits.filter((h: any) => h.status === 'active').length,
      bestHabitStreak,
      routineBlockCount: routineBlocks.filter((b: any) => b.active).length,
      perfectRoutineDay: dayBlocks.length > 0 && dayBlocks.every((d: any) => d.state === 'done'),
      focusSessions: allFocus.length,
      focusMinutesTotal,
      tasksCompleted: allTasks.filter((t) => t.completed).length,
      goalCount: allGoals.length,
      goalsCompleted: allGoals.filter((g: any) => g.status === 'completed').length,
      sleepNights: sleepLogs.length,
      trainedToday: (profile.dailyLogs?.[profile.currentDay]?.completedModules?.length || 0) > 0,
      focusedToday: allFocus.some((s: any) => s.startedAt?.startsWith(today)),
      habitHitToday: allHabits.some(
        (h: any) =>
          h.status === 'active' && valueOn(allHabitLogs, h.id, today) >= Math.max(1, h.targetValue || 1)
      ),
    };

    const { updatedProfile, newlyUnlocked } = checkAchievements(profile, life);
    if (newlyUnlocked.length > 0) {
      onProfileUpdate?.(updatedProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHabits, allHabitLogs, routineBlocks, routineLogs, allFocus, allTasks, allGoals, sleepLogs]);

  const derivedStreak = useMemo(
    () => computeStreak(momentumInput).current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTasks, allHabits, allHabitLogs, allFocus, routineLogs, sleepLogs]
  );


  // Only default the pane when arriving at Plan WITHOUT an explicit target.
  // The previous version reset on every entry, which overrode the pane a
  // button had just set — so "Tasks" and "Focus" both opened Today.
  const paneRequestedRef = useRef(false);
  useEffect(() => {
    if (activeSection !== 'hub') return;
    if (paneRequestedRef.current) {
      paneRequestedRef.current = false;
      return;
    }
    setHubPane('today');
    setLifePane(undefined);
  }, [activeSection]);

  /** Open Plan on a specific pane. */
  const goToPane = useCallback((pane: typeof hubPane) => {
    paneRequestedRef.current = true;
    setHubPane(pane);
    setActiveSection('hub');
  }, []);

  useEffect(() => {
    return subscribeFocusSessions(currentUser?.uid || null, (list) => {
      setFocusToday({ sessions: focusSessionsToday(list), seconds: focusSecondsToday(list) });
      setAllFocus(list);
    });
  }, [currentUser?.uid]);

  // Badge on the Hub tab: how many tasks are waiting today.
  useEffect(() => {
    return subscribeTasks(currentUser?.uid || null, (list) => {
      const openToday = bucketTasks(list).today.length;
      const doneToday = tasksDoneToday(list);
      setOpenTaskCount(openToday);
      setTasksDone(doneToday);
      // Target reflects the work that actually exists, capped at three so the
      // goal stays achievable. Zero tasks means zero target, not a phantom 3.
      setTasksTarget(Math.min(3, openToday + doneToday));
      setAllTasks(list);
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSection]);

  const brainScore = profile ? calculateBrainScore(profile) : 100;
  const currentLog = profile?.dailyLogs && profile?.currentDay ? profile.dailyLogs[profile.currentDay] : undefined;
  const completedTodayCount = currentLog?.completedModules ? currentLog.completedModules.length : 0;
  const isDailyComplete = completedTodayCount >= 4;

  const nextPendingModule =
    MODULE_METADATA.find((m) => profile?.modules && !profile.modules[m.id]?.completedToday) || MODULE_METADATA[0];

  const handleDirectGoogleLogin = async () => {
    soundFx.playClick();
    setGoogleAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      if (onOpenAuthModal) onOpenAuthModal();
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  const navItems = [
    {
      id: 'engine' as DashboardSection,
      label: 'Engine',
      shortLabel: 'HOME',
      icon: Flame,
      activeColor: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
      badge: `${profile.streakDays}d`,
    },
    {
      id: 'exercises' as DashboardSection,
      label: 'Train',
      shortLabel: 'TRAIN',
      icon: Brain,
      activeColor: 'eb-chip-active',
      badge: `${completedTodayCount}/8`,
    },
    {
      id: 'coach' as DashboardSection,
      label: 'AI Coach',
      shortLabel: 'COACH',
      icon: Sparkles,
      activeColor: 'text-violet-400 bg-violet-500/15 border-violet-500/40',
      badge: profile.isProUser ? 'Pro' : 'AI',
    },
    {
      id: 'games' as DashboardSection,
      label: 'Games',
      shortLabel: 'GAMES',
      icon: Gamepad2,
      activeColor: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
      badge: '',
    },
    {
      id: 'hub' as DashboardSection,
      label: 'Plan',
      shortLabel: 'PLAN',
      icon: CheckSquare,
      activeColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
      badge: openTaskCount > 0 ? `${openTaskCount}` : '',
    },
    {
      id: 'progress' as DashboardSection,
      label: 'Progress',
      shortLabel: 'LIFE',
      icon: TrendingUp,
      activeColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
      badge: '',
    },
  ];

  return (
    <div className="space-y-6 pb-28 font-sans select-none relative min-h-[80vh]">
      
      {/* Prominent Non-Logged-In Guest Sync Banner */}
      {!currentUser && (
        <div className="p-4 md:p-5 bg-surface border border-indigo-500/40 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
              <Cloud className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 px-1.5 py-0.5 bg-indigo-950/80 border border-indigo-500/30 rounded-md">
                  UNSYNCED GUEST SESSION
                </span>
                <span className="text-[10px] font-mono text-ink-muted hidden sm:inline">
                  Firebase Cloud Sync
                </span>
              </div>
              <h3 className="text-sm md:text-base font-bold text-ink mt-0.5">
                Save your brain training progress & streak continuity across devices
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Sign in with Google or Email to prevent local data loss when clearing browser cache.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={handleDirectGoogleLogin}
              disabled={googleAuthLoading}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 bg-ink text-ground hover:bg-ink/90 font-mono text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleAuthLoading ? 'Connecting...' : 'Google Sign-In'}</span>
            </button>

            <button
              onClick={() => {
                soundFx.playClick();
                if (onOpenAuthModal) onOpenAuthModal();
              }}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-sunk border border-rule text-ink font-mono text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Email Sign-In</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION CONTENT SWITCHER WITH SMOOTH ANIMATIONS */}
      <AnimatePresence mode="wait">
        
        {/* SECTION 1: ENGINE & PROGRESSION */}
        {activeSection === 'engine' && (
          <motion.div
            key="section-engine"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <CommandCenter
              input={momentumInput}
              displayName={profile.displayName || currentUser?.displayName || undefined}
              onOpenHub={goToPane}
              onOpenSleep={() => {
                setLifePane('sleep');
                goToPane('routine');
              }}
            />

            <StreakCard input={momentumInput} />

            <DailyMission
              modulesDone={completedTodayCount}
              modulesTarget={4}
              tasksDone={tasksDone}
              tasksTarget={tasksTarget}
              focusSessions={focusToday.sessions}
              focusSecondsToday={focusToday.seconds}
              onGoTrain={() => setActiveSection('exercises')}
              onGoTasks={() => goToPane('tasks')}
              onGoFocus={() => goToPane('focus')}
            />

            <RankProgressionSection
              profile={profile}
              derivedStreak={derivedStreak}
              onLaunchModule={onLaunchModule}
              onOpenBadgesGallery={onOpenBadgesGallery}
            />
          </motion.div>
        )}

        {/* SECTION 2: EXERCISES & TRAINING MODULES */}
        {activeSection === 'exercises' && (
          <motion.div
            key="section-exercises"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <DailyChallengeCard profile={profile} onLaunchModule={onLaunchModule} />

            {/* Exercises Content Grid / Roster */}
            <div>
              {viewMode === 'grid' ? (
                <div className="space-y-6">
                  {(() => {
                    const focusFirst = emphasisedGroup(profile.focusGoal);
                    return focusFirst
                      ? [focusFirst, ...SKILL_GROUP_ORDER.filter((g) => g !== focusFirst)]
                      : SKILL_GROUP_ORDER;
                  })().map((group) => {
                    const groupModules = MODULE_METADATA.filter(
                      (m) => skillGroupOf(m.id) === group
                    );
                    if (groupModules.length === 0) return null;
                    const info = SKILL_GROUPS[group];

                    return (
                      <div key={group}>
                        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
                          <span
                            className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${info.accent} ${info.tint}`}
                          >
                            {info.label.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-[#98A2B3] leading-snug">
                            {info.blurb}
                          </span>
                          {emphasisedGroup(profile.focusGoal) === group && (
                            <span className="text-[9px] font-mono font-bold text-[#5A6472] shrink-0">
                              YOUR GOAL
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {groupModules.map((meta, idx) => {
                            const state = profile.modules[meta.id] || {
                              level: 1,
                              xp: 0,
                              bestScore: 0,
                              totalSessions: 0,
                              completedToday: false,
                              history: [],
                            };

                            return (
                              <ModuleCard
                                key={meta.id}
                                index={idx}
                                config={meta}
                                state={state}
                                isProUser={profile.isProUser}
                                onLaunch={() => {
                                  if (meta.isPro && !profile.isProUser) {
                                    onOpenProModal();
                                  } else {
                                    onLaunchModule(meta.id);
                                  }
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ModuleRoster
                  profile={profile}
                  onSelectModule={onLaunchModule}
                  onOpenProModal={onOpenProModal}
                />
              )}
            </div>
          </motion.div>
        )}

        {/* SECTION 3: AI COACH */}
        {activeSection === 'coach' && (
          <motion.div
            key="section-coach"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <AICoachSection profile={profile} currentUser={currentUser} onOpenProModal={onOpenProModal} />
          </motion.div>
        )}

        {/* SECTION 4: GAMES */}
        {activeSection === 'games' && (
          <motion.div
            key="section-games"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <GamesSection profile={profile} onProfileUpdate={onProfileUpdate} />
          </motion.div>
        )}

        {/* SECTION 5: COMMUNITY & TELEGRAM */}
        {activeSection === 'hub' && (
          <motion.div
            key="section-hub"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#F4F6F8] font-mono tracking-tight">
                Plan and execute
              </h2>
            </div>

            {/* Each tab states what it is FOR, not just what it's called —
                a label alone made it unclear why five tabs existed. */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {([
                { id: 'today' as const, label: 'Today', icon: Sun, hint: 'Tick off your day' },
                { id: 'tasks' as const, label: 'Tasks', icon: CheckSquare, hint: 'What to do' },
                { id: 'goals' as const, label: 'Goals', icon: Target, hint: 'Where you\'re going' },
                { id: 'routine' as const, label: 'Routine', icon: Clock, hint: 'When you do it' },
                { id: 'focus' as const, label: 'Focus', icon: Timer, hint: 'Deep work timer' },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setHubPane(id)}
                  className={`eb-press eb-shine shrink-0 text-[11px] font-mono font-bold px-3.5 py-2.5 rounded-xl border min-h-[42px] flex items-center gap-1.5 ${
                    hubPane === id
                      ? 'eb-chip-active'
                      : 'text-[#8A93A5] eb-card-sunk hover:border-[var(--signal)] hover:text-[#F2F4F7]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[10px] font-mono text-[#5A6472]">
              {hubPane === 'today'
                ? 'Everything scheduled for today — tick it as you go.'
                : hubPane === 'tasks'
                  ? 'One-off work. Link a task to a goal and finishing it moves the goal.'
                  : hubPane === 'goals'
                    ? 'What you\'re working toward, with milestones and the habits feeding them.'
                    : hubPane === 'routine'
                      ? 'The schedule you repeat. Attach a block to a goal to make it count.'
                      : 'Start a timer on a task or habit. Real minutes get recorded.'}
            </p>

            {hubPane === 'today' && (
              <TodayPane
                userId={currentUser?.uid || null}
                blocks={routineBlocks}
                routineLogs={routineLogs}
                habits={allHabits}
                habitLogs={allHabitLogs}
                tasks={allTasks}
                goals={allGoals
                  .filter((g: any) => g.status === 'active')
                  .map((g: any) => ({ id: g.id, title: g.title }))}
                onGo={(pane) => goToPane(pane)}
              />
            )}

            {hubPane === 'tasks' && (
              <TasksSection
                userId={currentUser?.uid || null}
                goals={allGoals
                  .filter((g: any) => g.status === 'active')
                  .map((g: any) => ({ id: g.id, title: g.title }))}
                onStartFocus={(task) => {
                  setFocusHandoff(task);
                  setHubPane('focus');
                }}
              />
            )}
            {hubPane === 'focus' && (
              <FocusSection
                userId={currentUser?.uid || null}
                incomingTask={focusHandoff}
                onConsumeIncoming={() => setFocusHandoff(null)}
                incomingHabit={habitHandoff}
                onConsumeHabit={() => setHabitHandoff(null)}
              />
            )}
            {hubPane === 'goals' && (
              <ProGate
                profile={profile}
                feature="Goals & Habits"
                blurb="Set goals, build habits with streaks and history, and see what's actually moving."
                onOpenPro={onOpenProModal}
              >
              <GoalsSection
                userId={currentUser?.uid || null}
                tasks={allTasks}
                routineBlocks={routineBlocks}
                routineLogs={routineLogs}
                onStartFocus={(title, minutes, habitId) => {
                  setHabitHandoff({ title, minutes, habitId });
                  setHubPane('focus');
                }}
              />
              </ProGate>
            )}
            {hubPane === 'routine' && (
              <ProGate
                profile={profile}
                feature="Routine"
                blurb="Plan your day in time blocks, track sleep, and see how consistently you execute."
                onOpenPro={onOpenProModal}
              >
                <LifeSection
                  userId={currentUser?.uid || null}
                  profile={profile}
                  initialPane={lifePane}
                  goals={allGoals
                    .filter((g: any) => g.status === 'active')
                    .map((g: any) => ({ id: g.id, title: g.title }))}
                />
              </ProGate>
            )}

          </motion.div>
        )}

        {activeSection === 'progress' && (
          <motion.div
            key="section-progress"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <ProGate
              profile={profile}
              feature="Progress analytics"
              blurb="Personal records, consistency, focus time and full training history."
              onOpenPro={onOpenProModal}
            >
              <div className="space-y-4">
                <MomentumChart input={momentumInput} />
                <RealityVsPlan input={momentumInput} />
                <WeeklyReviewSection input={momentumInput} />
                <ProgressSection profile={profile} userId={currentUser?.uid || null} />
                <CommunitySection />
              </div>
            </ProGate>
          </motion.div>
        )}

      </AnimatePresence>

      {/* PERSISTENT BOTTOM NAVIGATION BAR (Fixed at bottom of screen, sleek & compact) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0D1117]/95 backdrop-blur-2xl border-t border-[#2A313C] px-1.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-6 gap-0.5">
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  soundFx.playClick();
                  setActiveSection(item.id);
                }}
                data-active={isActive}
                className={`eb-press eb-nav-item relative py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer min-h-[46px] ${
                  isActive
                    ? 'text-white font-bold'
                    : 'text-[#98A2B3] hover:text-white'
                }`}
              >
                {/* Active Glow Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomTabGlow"
                    className="absolute inset-0 bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                <IconComp
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'scale-110 text-[#A78BFA]' : 'opacity-70'
                  }`}
                />

                <span className="text-[9px] font-mono tracking-tight font-black uppercase truncate max-w-full px-0.5 text-center">
                  {item.shortLabel || item.label}
                </span>

                {/* Active Indicator Underline */}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomTabLine"
                    className="w-3 h-0.5 bg-[#8B5CF6] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
