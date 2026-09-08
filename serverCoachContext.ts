import { getFirestore } from 'firebase-admin/firestore';

/**
 * Coach context.
 *
 * Built on the SERVER from the user's stored data rather than sent by the
 * browser, for two reasons: the client could otherwise claim any history it
 * liked, and the coach previously only received module scores — so it could
 * not answer "what should I do today?" with anything specific.
 *
 * Only summaries are assembled, never raw records. The model needs to know
 * that three tasks are overdue, not the contents of every task ever created.
 */

function iso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CoachContext {
  today: string;
  openTasksToday: string[];
  overdueTasks: { title: string; daysLate: number; postponed: number }[];
  completedToday: number;
  habitsToday: { title: string; done: boolean; streak: number }[];
  routineToday: { title: string; time: string; state: string }[];
  activeGoals: { title: string; percent: number }[];
  focusMinutesToday: number;
  focusMinutesWeek: number;
  sleptLastNight: boolean;
  streakDays: number;
}

/**
 * Assemble a compact picture of the user's current state.
 *
 * Reads are bounded by date and count so this stays cheap even for accounts
 * with years of history.
 */
export async function buildCoachContext(uid: string): Promise<CoachContext | null> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const today = todayISO();
  const weekAgo = iso(7);

  try {
    const [tasksSnap, habitsSnap, habitLogsSnap, routineSnap, routineLogsSnap, focusSnap, sleepSnap, goalsSnap] =
      await Promise.all([
        userRef.collection('tasks').where('completed', '==', false).limit(60).get(),
        userRef.collection('habits').where('status', '==', 'active').limit(30).get(),
        userRef.collection('habitLogs').where('date', '>=', weekAgo).limit(300).get(),
        userRef.collection('routineBlocks').where('active', '==', true).limit(30).get(),
        userRef.collection('routineLogs').where('date', '==', today).limit(40).get(),
        userRef.collection('focusSessions').where('startedAt', '>=', weekAgo).limit(200).get(),
        userRef.collection('sleepLogs').where('date', '==', today).limit(1).get(),
        userRef.collection('goals').where('status', '==', 'active').limit(15).get(),
      ]);

    // --- Tasks: what's due today, and what's slipping ---
    const openTasksToday: string[] = [];
    const overdueTasks: CoachContext['overdueTasks'] = [];

    for (const doc of tasksSnap.docs) {
      const t = doc.data();
      if (!t.title) continue;
      if (t.dueDate === today) {
        openTasksToday.push(String(t.title).slice(0, 60));
      } else if (t.dueDate && t.dueDate < today) {
        const daysLate = Math.round(
          (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${t.dueDate}T00:00:00Z`)) / 86400000
        );
        overdueTasks.push({
          title: String(t.title).slice(0, 60),
          daysLate,
          postponed: t.postponeCount || 0,
        });
      }
    }
    // Most-slipped first — that's what the coach should raise.
    overdueTasks.sort((a, b) => b.postponed - a.postponed || b.daysLate - a.daysLate);

    // --- Habits: today's status and current streaks ---
    const logsByHabit = new Map<string, Map<string, number>>();
    for (const doc of habitLogsSnap.docs) {
      const l = doc.data();
      if (!logsByHabit.has(l.habitId)) logsByHabit.set(l.habitId, new Map());
      logsByHabit.get(l.habitId)!.set(l.date, l.value || 0);
    }

    const habitsToday: CoachContext['habitsToday'] = habitsSnap.docs.map((doc) => {
      const h = doc.data();
      const target = Math.max(1, h.targetValue || 1);
      const logs = logsByHabit.get(doc.id) || new Map();

      let streak = 0;
      for (let i = 0; i < 7; i++) {
        const day = iso(i);
        if ((logs.get(day) || 0) >= target) streak++;
        else if (i > 0) break;
      }

      return {
        title: String(h.title || '').slice(0, 40),
        done: (logs.get(today) || 0) >= target,
        streak,
      };
    });

    // --- Routine for today ---
    const stateByBlock = new Map<string, string>();
    for (const doc of routineLogsSnap.docs) {
      const l = doc.data();
      stateByBlock.set(l.blockId, l.state || 'pending');
    }

    const weekday = new Date(`${today}T00:00:00`).getDay();
    const routineToday = routineSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((b) => !b.weekdays || b.weekdays.length === 0 || b.weekdays.includes(weekday))
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
      .map((b) => ({
        title: String(b.title || '').slice(0, 40),
        time: `${b.startTime}–${b.endTime}`,
        state: stateByBlock.get(b.id) || 'pending',
      }));

    // --- Focus ---
    let focusMinutesToday = 0;
    let focusMinutesWeek = 0;
    for (const doc of focusSnap.docs) {
      const s = doc.data();
      const mins = (s.focusedSeconds || 0) / 60;
      focusMinutesWeek += mins;
      if (String(s.startedAt || '').startsWith(today)) focusMinutesToday += mins;
    }

    // --- Goals ---
    const activeGoals = goalsSnap.docs.map((doc) => {
      const g = doc.data();
      const ms = Array.isArray(g.milestones) ? g.milestones : [];
      const percent =
        ms.length > 0
          ? Math.round((ms.filter((m: any) => m.done).length / ms.length) * 100)
          : Math.round(((g.currentValue || 0) / Math.max(1, g.targetValue || 1)) * 100);
      return { title: String(g.title || '').slice(0, 60), percent: Math.min(100, percent) };
    });

    const userSnap = await userRef.get();
    const profile = userSnap.exists ? (userSnap.data() as any)?.profileData || {} : {};

    return {
      today,
      openTasksToday: openTasksToday.slice(0, 10),
      overdueTasks: overdueTasks.slice(0, 5),
      completedToday: 0,
      habitsToday: habitsToday.slice(0, 10),
      routineToday: routineToday.slice(0, 10),
      activeGoals: activeGoals.slice(0, 5),
      focusMinutesToday: Math.round(focusMinutesToday),
      focusMinutesWeek: Math.round(focusMinutesWeek),
      sleptLastNight: !sleepSnap.empty,
      streakDays: profile.streakDays || 0,
    };
  } catch (err) {
    // The coach still works without context; it just answers more generally.
    console.warn('Could not build coach context:', (err as Error)?.message);
    return null;
  }
}

/**
 * Render the context as plain text for the prompt.
 *
 * Written as short factual lines rather than JSON — models follow prose more
 * reliably, and it keeps the token cost low.
 */
export function describeContext(ctx: CoachContext | null): string {
  if (!ctx) return '';

  const lines: string[] = [];

  if (ctx.routineToday.length > 0) {
    const done = ctx.routineToday.filter((b) => b.state === 'done').length;
    lines.push(
      `Routine today (${done}/${ctx.routineToday.length} done): ` +
        ctx.routineToday.map((b) => `${b.title} ${b.time} [${b.state}]`).join(', ')
    );
  }

  if (ctx.habitsToday.length > 0) {
    lines.push(
      'Habits today: ' +
        ctx.habitsToday
          .map((h) => `${h.title} [${h.done ? 'done' : 'not yet'}${h.streak > 1 ? `, ${h.streak}-day streak` : ''}]`)
          .join(', ')
    );
  }

  if (ctx.openTasksToday.length > 0) {
    lines.push(`Tasks due today: ${ctx.openTasksToday.join(', ')}`);
  }

  if (ctx.overdueTasks.length > 0) {
    lines.push(
      'Overdue: ' +
        ctx.overdueTasks
          .map((t) => `${t.title} (${t.daysLate}d late${t.postponed > 0 ? `, moved ${t.postponed}x` : ''})`)
          .join(', ')
    );
  }

  if (ctx.activeGoals.length > 0) {
    lines.push('Goals: ' + ctx.activeGoals.map((g) => `${g.title} at ${g.percent}%`).join(', '));
  }

  lines.push(
    `Focus: ${ctx.focusMinutesToday} min today, ${ctx.focusMinutesWeek} min this week. ` +
      `Sleep logged last night: ${ctx.sleptLastNight ? 'yes' : 'no'}. Streak: ${ctx.streakDays} days.`
  );

  return `\n\nWhat this person actually has right now (${ctx.today}):\n${lines.join('\n')}`;
}
