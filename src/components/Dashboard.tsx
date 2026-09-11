import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, ModuleId, Task } from '../types';
import { MODULE_METADATA } from '../utils/storage';
import { ModuleRoster } from './ModuleRoster';
import { ModuleCard } from './ModuleCard';
import { AchievementsDashboardSection } from './AchievementsDashboardSection';
import { LeaderboardScreen } from './LeaderboardScreen';
import { ShareCard } from './ShareCard';
import { RankProgress } from './RankProgress';
import { LevelUpToast } from './LevelUpToast';
import { CoachTools, COACH_TOOLS, CoachToolId } from './coach/CoachTools';
import { ImageToolScreen } from './coach/ImageToolScreen';
import { VoiceCoachScreen } from './coach/VoiceCoachScreen';
import { t } from '../lib/i18n';
import { RankProgressionSection } from './RankProgressionSection';
import { AICoachSection } from './AICoachSection';
import { GamesSection } from './GamesSection';
import { TasksSection } from './TasksSection';
import { FocusSection } from './FocusSection';
import { GoalsSection } from './GoalsSection';
import { ProGate } from './ProGate';
import { LifeSection } from './LifeSection';
import { MomentumChart } from './MomentumChart';
import { AttributesRadar } from './AttributesRadar';
import { ConsistencyCalendar } from './ConsistencyCalendar';
import { TodayScreen } from './TodayScreen';
import { careerXp, levelFromXp } from '../lib/xp';
import { useCareerStats } from '../lib/careerStats';
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
  Cloud,
  LogIn,
  Bot,
  Repeat,
  CalendarCheck,
  BarChart2,
  Award,
  ChevronDown,
  ChevronRight,
  Medal,
  Share2,
  Swords,
  ArrowLeft,
  Trophy,
  Brain,
  Flame,
  Activity,
  CheckSquare,
  TrendingUp,
  Target,
  Clock,
} from 'lucide-react';

interface Props {
  /** False until the cloud profile is applied — values are unknown before then. */
  isHydrated?: boolean;
  profile: UserProfile;
  currentUser?: User | null;
  onLaunchModule: (id: ModuleId) => void;
  onOpenProModal: () => void;
  onOpenAuthModal?: () => void;
  onOpenBadgesGallery?: () => void;
  onProfileUpdate?: (updatedProfile: UserProfile) => void;
}

export type DashboardSection =
  | 'engine'
  | 'exercises'
  | 'coach'
  | 'games'
  | 'hub'
  | 'progress';

/** 1st, 2nd, 3rd — reads better than a bare number for a placing. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const Dashboard: React.FC<Props> = ({
  profile,
  isHydrated = true,
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
  const [hubPane, setHubPane] = useState<'tasks' | 'habits' | 'goals' | 'routine'>('tasks');
  const [focusHandoff, setFocusHandoff] = useState<Task | null>(null);
  const [lifePane, setLifePane] = useState<'routine' | 'week' | 'sleep' | undefined>();
  const [showDeepStats, setShowDeepStats] = useState(false);
  const [trainTab, setTrainTab] = useState<'modules' | 'games'>('modules');
  const [trainFilter, setTrainFilter] = useState<string | null>(null);
  const [moreDrawer, setMoreDrawer] = useState<string | null>('rank');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [coachTool, setCoachTool] = useState<CoachToolId | null>(null);
  const lastUnlockSignatureRef = useRef<string>('');
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

    // Don't evaluate against empty collections on first render — that is not
    // "no activity", it's "not loaded yet".
    const loaded =
      allHabits.length > 0 ||
      routineBlocks.length > 0 ||
      allFocus.length > 0 ||
      allTasks.length > 0 ||
      allGoals.length > 0 ||
      sleepLogs.length > 0;
    if (!loaded) return;

    const { updatedProfile, newlyUnlocked } = checkAchievements(profile, life);
    if (newlyUnlocked.length === 0) return;

    // Guard against a re-render writing the same unlocks again.
    const signature = newlyUnlocked.map((a) => a.id).sort().join(',');
    if (signature === lastUnlockSignatureRef.current) return;
    lastUnlockSignatureRef.current = signature;

    onProfileUpdate?.(updatedProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHabits, allHabitLogs, routineBlocks, routineLogs, allFocus, allTasks, allGoals, sleepLogs]);

  // One career total shared by Rank and Level.
  const careerXpTotal = useMemo(
    () =>
      careerXp(profile, {
        tasks: allTasks,
        habits: allHabits,
        habitLogs: allHabitLogs,
        focusSessions: allFocus,
        routineBlocks,
        routineLogs,
        sleepLogs,
      }),
    [profile, allTasks, allHabits, allHabitLogs, allFocus, routineBlocks, routineLogs, sleepLogs]
  );

  // Server-authoritative XP. The local calculation only sees data synced to
  // this device, which is why the rank screen and the leaderboard disagreed.
  const serverStats = useCareerStats(careerXpTotal, currentUser?.uid);
  const unifiedXp = serverStats.authoritative ? serverStats.careerXp : careerXpTotal;

  const derivedStreak = useMemo(
    () => computeStreak(momentumInput, todayISO(), profile.streakResetAt).current,
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
    setHubPane('tasks');
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
      // Show the real number. Capping at three reported "0 of 3" to someone
      // with nine tasks due, which is simply untrue.
      setTasksTarget(openToday + doneToday);
      setAllTasks(list);
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeSection]);

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
      shortLabel: t('nav.today'),
      icon: Flame,
      activeColor: 'eb-warn bg-amber-500/15 border-amber-500/40',
      badge: `${profile.streakDays}d`,
    },
    {
      id: 'hub' as DashboardSection,
      label: 'Plan',
      shortLabel: t('nav.plan'),
      icon: CheckSquare,
      activeColor: 'eb-done bg-emerald-500/15 border-emerald-500/40',
      badge: openTaskCount > 0 ? `${openTaskCount}` : '',
    },
    {
      id: 'progress' as DashboardSection,
      label: 'More',
      shortLabel: 'ARENA',
      icon: TrendingUp,
      activeColor: 'text-sky-400 bg-sky-500/15 border-sky-500/40',
      badge: '',
    },
    {
      id: 'exercises' as DashboardSection,
      label: 'Train',
      shortLabel: t('nav.train'),
      icon: Brain,
      activeColor: 'eb-chip-active',
      badge: `${completedTodayCount}/${MODULE_METADATA.length}`,
    },
    {
      id: 'coach' as DashboardSection,
      label: 'Coach',
      shortLabel: t('nav.coach'),
      icon: Bot,
      activeColor: 'eb-chip-active',
    },
  ];

  return (
    <div className="eb-page pb-[calc(5.25rem+env(safe-area-inset-bottom))] font-sans select-none relative">
      
      {/* Prominent Non-Logged-In Guest Sync Banner */}
      {!currentUser && (
        <div className="p-4 md:p-5 bg-surface border border-indigo-500/40 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl shrink-0">
              <Cloud className="w-5 h-5 shrink-0 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="t-meta uppercase tracking-wider text-indigo-400 px-1.5 py-0.5 bg-indigo-950/80 border border-indigo-500/30 rounded-md">
                  UNSYNCED GUEST SESSION
                </span>
                <span className="t-meta text-ink-muted hidden sm:inline">
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
              className="flex-1 min-w-0 md:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 bg-ink text-ground hover:bg-ink/90 font-mono text-xs font-bold rounded-xl cursor-pointer transition-colors"
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
              className="flex-1 min-w-0 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-sunk border border-rule text-ink font-mono text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
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
            <TodayScreen
              userId={currentUser?.uid || null}
              displayName={profile.displayName || currentUser?.displayName || undefined}
              tasks={allTasks}
              habits={allHabits}
              habitLogs={allHabitLogs}
              routineBlocks={routineBlocks}
              routineLogs={routineLogs}
              sleepLogs={sleepLogs}
              goals={allGoals
                .filter((g: any) => g.status === 'active')
                .map((g: any) => ({ id: g.id, title: g.title }))}
              onGo={goToPane}
              onStartFocus={(task) => {
                setFocusHandoff(task);
                goToPane('tasks');
              }}
              level={levelFromXp(unifiedXp).level}
              questDoneToday={profile.questLog?.date === todayISO()}
              recentQuestIds={profile.recentQuestIds || []}
              completedQuest={
                profile.questLog?.date === todayISO() ? profile.questLog : null
              }
              onOpenRank={() => {
                setActiveSection('progress');
                setMoreDrawer('rank');
              }}
              careerXp={serverStats.authoritative ? unifiedXp : undefined}
              streakDays={derivedStreak}
              questReady={!currentUser || isHydrated}
              storedQuest={
                profile.questPin?.date === todayISO() ? profile.questPin : null
              }
              onStoreQuest={(q) => {
                // Written once per day. Guarded so a re-render cannot replace
                // an already-chosen quest with a freshly computed one.
                if (profile.questPin?.date === q.date) return;
                onProfileUpdate?.({ ...profile, questPin: q });
              }}
              onCompleteQuest={(quest) => {
                const today = todayISO();
                // Guarded by date: a second completion on the same day is a
                // no-op rather than a second XP award.
                if (profile.questLog?.date === today) return;

                onProfileUpdate?.({
                  ...profile,
                  gamesXp: (profile.gamesXp || 0) + quest.xp,
                  // Store the full quest, not just its id. The card reads this
                  // back rather than recomputing — recomputing after
                  // completion picked a different quest, because the id had
                  // just been added to the "recent" exclusion list.
                  questLog: {
                    date: today,
                    id: quest.id,
                    title: quest.title,
                    xp: quest.xp,
                  },
                  recentQuestIds: [quest.id, ...(profile.recentQuestIds || [])].slice(0, 12),
                });
              }}
            />

            {/* Focus lives with Today, not Plan: a session is always started
                on something from today's list, so separating them meant
                navigating away to begin work. */}
            <section className="sec">
              <FocusSection
                userId={currentUser?.uid || null}
                incomingTask={focusHandoff}
                onConsumeIncoming={() => setFocusHandoff(null)}
                incomingHabit={habitHandoff}
                onConsumeHabit={() => setHabitHandoff(null)}
              />
            </section>
          </motion.div>
        )}

        {activeSection === 'exercises' && (
          <motion.div
            key="section-exercises"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-2">
              {([
                { id: 'modules' as const, label: 'Training' },
                { id: 'games' as const, label: 'Games' },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    soundFx.playClick();
                    setTrainTab(id);
                  }}
                  className={`flex-1 min-h-[46px] rounded-xl text-sm font-semibold border transition-colors ${
                    trainTab === id
                      ? 'eb-chip-active'
                      : 'text-[var(--ink-muted)] border-[var(--rule)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {trainTab === 'games' && (
              <GamesSection profile={profile} onProfileUpdate={onProfileUpdate} />
            )}

            {trainTab === 'modules' && (
              <>
            <DailyChallengeCard profile={profile} onLaunchModule={onLaunchModule} />

            {/* Exercises Content Grid / Roster */}
            <div>
              {/* Filter. Nine modules across four groups is a long scroll;
                  choosing a category makes it two rows. */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4 -mx-1 px-1">
                {([null, ...SKILL_GROUP_ORDER] as (string | null)[]).map((g) => {
                  const active = trainFilter === g;
                  const label = g ? SKILL_GROUPS[g as keyof typeof SKILL_GROUPS].label : 'All';
                  const count = g
                    ? MODULE_METADATA.filter((m) => skillGroupOf(m.id) === g).length
                    : MODULE_METADATA.length;

                  return (
                    <button
                      key={label}
                      onClick={() => {
                        soundFx.playClick();
                        setTrainFilter(g);
                      }}
                      className="shrink-0 min-h-[40px] px-4 rounded-xl border text-[13px] font-semibold transition-colors"
                      style={{
                        background: active ? 'var(--surface)' : 'transparent',
                        borderColor: active ? 'var(--signal)' : 'var(--rule)',
                        color: active ? 'var(--ink)' : 'var(--ink-dim)',
                      }}
                    >
                      {label}
                      <span className="ml-1.5 text-[11px] opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>

              {viewMode === 'grid' ? (
                <div className="space-y-6">
                  {(() => {
                    const focusFirst = emphasisedGroup(profile.focusGoal);
                    const ordered = focusFirst
                      ? [focusFirst, ...SKILL_GROUP_ORDER.filter((g) => g !== focusFirst)]
                      : SKILL_GROUP_ORDER;
                    return trainFilter ? ordered.filter((g) => g === trainFilter) : ordered;
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
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${info.accent} ${info.tint}`}
                          >
                            {info.label.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-[var(--ink-muted)] leading-snug">
                            {info.blurb}
                          </span>
                          {emphasisedGroup(profile.focusGoal) === group && (
                            <span className="t-meta shrink-0">
                              YOUR GOAL
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
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
              </>
            )}
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
            {coachTool === null && (
              <>
                <h1 className="t-display">Coach</h1>
                <p className="t-sub mt-2 mb-6 leading-relaxed">
                  Six tools that use what you have actually recorded.
                </p>
                <CoachTools onOpen={setCoachTool} />
              </>
            )}

            {coachTool === 'chat' && (
              <>
                <button
                  onClick={() => setCoachTool(null)}
                  className="icon-btn mb-5"
                  aria-label="Back to Coach"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </button>
                <AICoachSection
                  profile={profile}
                  currentUser={currentUser}
                  onOpenProModal={onOpenProModal}
                />
              </>
            )}

            {coachTool === 'voice' && <VoiceCoachScreen onBack={() => setCoachTool(null)} />}

            {coachTool !== null && coachTool !== 'chat' && coachTool !== 'voice' && (
              <ImageToolScreen
                tool={COACH_TOOLS.find((t) => t.id === coachTool)!}
                onBack={() => setCoachTool(null)}
              />
            )}
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
              <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] font-mono tracking-tight">
                Plan and execute
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-sunk)] border border-[var(--rule)]">
              {([
                { id: 'tasks' as const, label: t('plan.tasks'), icon: CheckSquare, accent: '#7C5CFF' },
                { id: 'habits' as const, label: t('plan.habits'), icon: Repeat, accent: '#00C2A8' },
                { id: 'routine' as const, label: t('plan.routine'), icon: Clock, accent: '#7FD4E8' },
                { id: 'goals' as const, label: t('plan.goals'), icon: Target, accent: '#FFB020' },
              ]).map(({ id, label, icon: Icon, accent }) => {
                const active = hubPane === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      soundFx.playClick();
                      setHubPane(id);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className="relative min-h-[64px] rounded-xl flex flex-col items-center justify-center gap-1.5 px-1 transition-colors"
                  >
                    {active && (
                      <motion.span
                        layoutId="plan-tab-indicator"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: `linear-gradient(180deg, color-mix(in oklab, ${accent} 22%, var(--surface)), var(--surface))`,
                          border: `1px solid color-mix(in oklab, ${accent} 50%, var(--rule))`,
                          boxShadow: `0 1px 0 0 rgba(255,255,255,0.08) inset, 0 6px 16px -10px ${accent}`,
                        }}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}

                    <Icon
                      className="relative w-[19px] h-[19px] shrink-0"
                      strokeWidth={active ? 2.4 : 1.9}
                      style={{ color: active ? accent : 'var(--ink-dim)' }}
                    />
                    <span
                      className="relative text-[12px] leading-none text-center"
                      style={{
                        color: active ? 'var(--ink)' : 'var(--ink-dim)',
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="t-sub">
              {hubPane === 'tasks'
                ? 'One-off work. Link a task to a goal and finishing it moves the goal.'
                : hubPane === 'habits'
                  ? 'Things you repeat. Do them whenever suits — the day is what counts.'
                  : hubPane === 'routine'
                    ? 'Time-bound blocks. Your day, in the order it actually happens.'
                    : 'What you are working toward, broken into milestones.'}
            </p>

            {hubPane === 'tasks' && (
              <TasksSection
                onOpenGoal={() => setHubPane('goals')}
                userId={currentUser?.uid || null}
                goals={allGoals
                  .filter((g: any) => g.status === 'active')
                  .map((g: any) => ({ id: g.id, title: g.title }))}
                onStartFocus={(task) => {
                  setFocusHandoff(task);
                  setActiveSection('engine');
                }}
              />
            )}
            {(hubPane === 'goals' || hubPane === 'habits') && (
              <ProGate
                profile={profile}
                feature={hubPane === 'habits' ? 'Habits' : 'Goals'}
                blurb={
                  hubPane === 'habits'
                    ? 'Build habits with streaks, history and targets that actually stick.'
                    : "Set goals, break them into milestones, and see what's actually moving."
                }
                onOpenPro={onOpenProModal}
              >
              <GoalsSection
                userId={currentUser?.uid || null}
                pane={hubPane === 'habits' ? 'habits' : 'goals'}
                tasks={allTasks}
                routineBlocks={routineBlocks}
                routineLogs={routineLogs}
                onStartFocus={(title, minutes, habitId) => {
                  setHabitHandoff({ title, minutes, habitId });
                  setActiveSection('engine');
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
                  habits={allHabits.filter((h: any) => h.status === 'active')}
                  goals={allGoals
                    .filter((g: any) => g.status === 'active')
                    .map((g: any) => ({ id: g.id, title: g.title }))}
                />
              </ProGate>
            )}

          </motion.div>
        )}

        {/* PROGRESS & REVIEW */}
        {activeSection === 'progress' && showLeaderboard && (
          <motion.div
            key="section-leaderboard"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            <LeaderboardScreen onBack={() => setShowLeaderboard(false)} />
          </motion.div>
        )}

        {activeSection === 'progress' && !showLeaderboard && (
          <motion.div
            key="section-arena"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            <div>
              <h1 className="t-display">Arena</h1>
              <p className="t-sub mt-1.5">Where you stand.</p>
            </div>

            {/* Rank and progress to the next tier. */}
            <RankProgress
              careerXp={unifiedXp}
              pending={!serverStats.authoritative}
            />

            {/* Streak, XP and badges as one strip rather than three cards. */}
            <div className="stat-strip grid-cols-3">
              <div>
                <span className="eb-label block">Streak</span>
                <span className="t-figure block mt-1.5" style={{ fontSize: 22, color: '#FFB020' }}>
                  {derivedStreak}
                </span>
                <span className="t-meta block mt-1">
                  {derivedStreak === 1 ? 'day' : 'days'}
                </span>
              </div>

              <div>
                <span className="eb-label block">Total XP</span>
                <span className="t-figure block mt-1.5" style={{ fontSize: 22 }}>
                  {serverStats.authoritative ? unifiedXp.toLocaleString('en-IN') : '—'}
                </span>
                <span className="t-meta block mt-1">earned</span>
              </div>

              <button
                onClick={() => {
                  soundFx.playClick();
                  onOpenBadgesGallery?.();
                }}
                className="text-left"
              >
                <span className="eb-label block">Badges</span>
                <span
                  className="t-figure block mt-1.5"
                  style={{ fontSize: 22, color: 'var(--signal-ink)' }}
                >
                  {(profile.unlockedAchievements || []).length}
                </span>
                <span className="t-meta block mt-1">unlocked</span>
              </button>
            </div>

            {/* Leaderboard — the reason this section exists. */}
            <button
              onClick={() => {
                soundFx.playClick();
                setShowLeaderboard(true);
              }}
              className="w-full text-left rounded-2xl p-4 flex items-center gap-4"
              style={{
                background:
                  'linear-gradient(150deg, color-mix(in oklab, var(--signal) 20%, var(--surface)), var(--surface))',
                border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                boxShadow: '0 1px 0 0 rgba(255,255,255,0.07) inset',
              }}
            >
              <span
                className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center"
                style={{ background: 'color-mix(in oklab, var(--signal) 22%, transparent)' }}
              >
                <Trophy className="w-6 h-6 shrink-0" style={{ color: 'var(--signal-ink)' }} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="t-section block">Leaderboard</span>
                <span className="t-meta block mt-0.5">
                  {serverStats.rank
                    ? `You are ${ordinal(serverStats.rank)} of ${serverStats.totalMembers}`
                    : 'See where you stand'}
                </span>
              </span>

              <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--signal-ink)' }} />
            </button>

            {/* Share, at the bottom as asked. */}
            <button
              onClick={() => {
                soundFx.playClick();
                setShowShare(true);
              }}
              className="w-full text-left rounded-2xl eb-card p-4 flex items-center gap-4"
            >
              <span
                className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: 'var(--surface-sunk)' }}
              >
                <Share2 className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="t-section block">Share your week</span>
                <span className="t-meta block mt-0.5">Streak, tasks and XP as an image</span>
              </span>

              <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Rank-up moment. Watches the authoritative XP so it fires on the real
          value rather than a local estimate that may be corrected. */}
      {serverStats.authoritative && <LevelUpToast careerXp={unifiedXp} />}

      {showShare && (
        <ShareCard
          displayName={profile.displayName || 'Athlete'}
          careerXp={unifiedXp}
          streakDays={derivedStreak}
          tasksThisWeek={
            allTasks.filter((t: any) => {
              if (!t.completed || !t.completedAt) return false;
              return Date.now() - Date.parse(t.completedAt) < 7 * 86400000;
            }).length
          }
          focusMinutesThisWeek={Math.round(
            allFocus
              .filter((f: any) => Date.now() - Date.parse(f.startedAt || '') < 7 * 86400000)
              .reduce((n: number, f: any) => n + (f.focusedSeconds || 0) / 60, 0)
          )}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* PERSISTENT BOTTOM NAVIGATION BAR (Fixed at bottom of screen, sleek & compact) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0D1117]/95 backdrop-blur-2xl px-1.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] overflow-visible"
          style={{
            borderTop: '1px solid color-mix(in oklab, var(--signal) 40%, var(--rule))',
            boxShadow: '0 -1px 14px -6px color-mix(in oklab, var(--signal) 55%, transparent)',
          }}>
        <div
          className="max-w-md mx-auto grid gap-0.5"
          style={{
            // The centre column is wider because Arena sits in it. Equal
            // columns left the button overlapping the tabs either side.
            gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr',
          }}
        >
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = activeSection === item.id;

            // The centre tab is raised and carries the rank crest.
            if (item.id === 'progress') {

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    soundFx.playClick();
                    setActiveSection(item.id);
                  }}
                  data-active={isActive}
                  className="relative flex items-end justify-center cursor-pointer min-h-[46px]"
                  aria-label="Arena"
                >
                  {/* Glow beneath the point. The shield tapers to almost
                      nothing at the bottom, so it casts no light on its own. */}
                  <span
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none transition-opacity"
                    style={{
                      width: 84,
                      height: 26,
                      bottom: 2,
                      borderRadius: '50%',
                      background:
                        'radial-gradient(ellipse at center, rgba(124,92,255,0.55), rgba(124,92,255,0) 70%)',
                      filter: 'blur(6px)',
                      opacity: isActive ? 1 : 0.55,
                    }}
                  />

                  <span
                    className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-start pt-2 gap-0.5 transition-transform whitespace-nowrap"
                    style={{
                      // An angular plate rather than a pill: straight edges
                      // suit crossed blades, and a pill reads as a create
                      // button, which this is not.
                      width: 84,
                      height: 52,
                      bottom: 12,
                      // Shield: square shoulders tapering to a point, which
                      // suits the swords and reads as a crest.
                      clipPath: 'polygon(0% 0%, 100% 0%, 100% 62%, 50% 100%, 0% 62%)',
                      borderRadius: 4,
                      background:
                        'linear-gradient(160deg, color-mix(in oklab, var(--signal) 45%, var(--surface)), color-mix(in oklab, var(--signal) 14%, var(--surface)))',
                      // A clipped element cannot carry a border, so the edge
                      // is drawn as a filter glow. Concrete rgba rather than
                      // color-mix, which is not reliable inside drop-shadow.
                      filter: isActive
                        ? 'drop-shadow(0 0 7px rgba(124, 92, 255, 0.95)) drop-shadow(0 0 18px rgba(124, 92, 255, 0.55))'
                        : 'drop-shadow(0 2px 6px rgba(124, 92, 255, 0.5))',
                      transform: isActive ? 'translateY(-2px)' : undefined,
                    }}
                  >
                    <Swords
                      className="w-[19px] h-[19px] shrink-0"
                      strokeWidth={2.4}
                      style={{ color: '#fff' }}
                    />

                    <span
                      className="text-[10.5px] font-extrabold uppercase whitespace-nowrap leading-none"
                      style={{ color: '#fff', letterSpacing: '0.08em' }}
                    >
                      Arena
                    </span>
                  </span>
                </button>
              );
            }

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
                    : 'text-[var(--ink-muted)] hover:text-white'
                }`}
              >
                {/* Active mark. A short bar rather than a filled pill: a pill
                    on the tab beside Arena read as two competing blocks. */}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomTabGlow"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-full"
                    style={{
                      background: 'var(--signal)',
                      boxShadow: '0 0 8px 0 color-mix(in oklab, var(--signal) 70%, transparent)',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}

                <IconComp
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'scale-110 text-[var(--signal-ink)]' : 'opacity-70'
                  }`}
                />

                <span className="t-meta tracking-tight font-black uppercase truncate max-w-full px-0.5 text-center">
                  {item.shortLabel || item.label}
                </span>

                {/* Active Indicator Underline */}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomTabLine"
                    className="w-3 h-0.5 shrink-0 bg-[var(--signal)] rounded-full"
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
