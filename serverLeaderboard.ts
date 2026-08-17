import { getFirestore } from 'firebase-admin/firestore';
import { readDisplayName, resolveEntitlement } from './serverEntitlement';

/**
 * Leaderboard.
 *
 * Two decisions shape this file:
 *
 * 1. A SEPARATE public collection. User documents hold email addresses,
 *    payment UTRs and trial dates, so they can never be world-readable. The
 *    `leaderboard` collection holds only what a leaderboard needs to show.
 *
 * 2. WRITTEN ONLY BY THE SERVER. The client never writes its own entry — if it
 *    could, anyone could POST themselves 10,000,000 XP. The server reads the
 *    user's real activity from Firestore and computes the total itself, so the
 *    number on the board is one the client cannot influence.
 */

const TRAINING_XP_KEY = 'totalXp';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  careerXp: number;
  weeklyXp: number;
  level: number;
  /** Lifetime or active trial — shown as a badge, never inferred client-side. */
  isPro: boolean;
  updatedAt: string;
}

/** Recompute an entry if its cached copy is older than this. */
const STALE_MS = 5 * 60 * 1000;

/**
 * How many users may be recomputed inside a single request. Everyone else is
 * served from cache and refreshed on later requests, so response time stays
 * flat as the member count grows.
 */
const MAX_RECOMPUTE_PER_REQUEST = 6;

/** Mirrors resolveEntitlement — Pro means lifetime or an unexpired trial. */
/* ------------------------------------------------------------------ */
/* XP rules — must match src/lib/xp.ts                                 */
/* ------------------------------------------------------------------ */

const XP = {
  taskCompleted: 10,
  taskDailyCap: 60,
  habitMet: 15,
  habitDailyCap: 75,
  routineBlockDone: 12,
  routineDailyCap: 60,
  focusPerBlock: 20,
  focusDailyCap: 100,
  sleepLogged: 8,
  perfectDayBonus: 50,
} as const;

function dayKey(iso: string): string {
  return (iso || '').slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Monday 00:00 UTC of the current week — the same boundary for every user. */
function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 30 * (level - 1) * (level + 2);
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (level < 200 && totalXp >= xpForLevel(level + 1)) level++;
  return level;
}

/**
 * Recompute a user's XP from their stored activity.
 *
 * Reads are limited to the fields needed and capped by date, so this stays
 * cheap even for long-standing accounts.
 */
export async function computeUserXp(uid: string): Promise<{ career: number; weekly: number }> {
  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const weekStart = startOfWeekISO();
  const horizon = isoDaysAgo(400);

  const [tasksSnap, habitsSnap, habitLogsSnap, focusSnap, routineLogsSnap, sleepSnap, userSnap] =
    await Promise.all([
      userRef.collection('tasks').get(),
      userRef.collection('habits').get(),
      userRef.collection('habitLogs').where('date', '>=', horizon).get(),
      userRef.collection('focusSessions').get(),
      userRef.collection('routineLogs').where('date', '>=', horizon).get(),
      userRef.collection('sleepLogs').where('date', '>=', horizon).get(),
      userRef.get(),
    ]);

  // Bucket every contribution by day so the daily caps can be applied.
  const byDay = new Map<
    string,
    { tasks: number; habits: number; routine: number; focusMin: number; sleep: boolean; sched: number; done: number }
  >();
  const bucket = (d: string) => {
    if (!byDay.has(d)) {
      byDay.set(d, { tasks: 0, habits: 0, routine: 0, focusMin: 0, sleep: false, sched: 0, done: 0 });
    }
    return byDay.get(d)!;
  };

  for (const doc of tasksSnap.docs) {
    const t = doc.data();
    if (t.completed && t.completedAt) {
      const b = bucket(dayKey(t.completedAt));
      b.tasks += 1;
      b.done += 1;
    }
    if (t.dueDate) bucket(t.dueDate).sched += 1;
  }

  const habitTargets = new Map<string, number>();
  for (const doc of habitsSnap.docs) {
    const h = doc.data();
    if (h.status === 'active') habitTargets.set(doc.id, Math.max(1, h.targetValue || 1));
  }
  for (const doc of habitLogsSnap.docs) {
    const l = doc.data();
    const target = habitTargets.get(l.habitId);
    if (target === undefined) continue;
    if ((l.value || 0) >= target) {
      const b = bucket(l.date);
      b.habits += 1;
      b.done += 1;
    }
    bucket(l.date).sched += 1;
  }

  for (const doc of routineLogsSnap.docs) {
    const l = doc.data();
    if (l.state === 'done') {
      const b = bucket(l.date);
      b.routine += 1;
      b.done += 1;
    }
    bucket(l.date).sched += 1;
  }

  for (const doc of focusSnap.docs) {
    const s = doc.data();
    if (!s.startedAt) continue;
    bucket(dayKey(s.startedAt)).focusMin += (s.focusedSeconds || 0) / 60;
  }

  for (const doc of sleepSnap.docs) {
    bucket(doc.data().date).sleep = true;
  }

  let career = 0;
  let weekly = 0;

  for (const [date, b] of byDay) {
    const day =
      Math.min(b.tasks * XP.taskCompleted, XP.taskDailyCap) +
      Math.min(b.habits * XP.habitMet, XP.habitDailyCap) +
      Math.min(b.routine * XP.routineBlockDone, XP.routineDailyCap) +
      Math.min(Math.floor(b.focusMin / 25) * XP.focusPerBlock, XP.focusDailyCap) +
      (b.sleep ? XP.sleepLogged : 0) +
      (b.sched >= 3 && b.done >= b.sched ? XP.perfectDayBonus : 0);

    career += day;
    if (date >= weekStart) weekly += day;
  }

  // Training and game XP live on the user document.
  const data = userSnap.exists ? userSnap.data() : null;
  const profile = data?.profileData || {};
  const modules = profile.modules || {};
  const trainingXp = Object.values(modules).reduce(
    (sum: number, m: any) => sum + (m?.[TRAINING_XP_KEY] || m?.xp || 0),
    0
  );
  career += Number(trainingXp) || 0;
  career += Number(profile.gamesXp) || 0;

  return { career, weekly };
}

/**
 * Recompute and publish one user's public entry.
 *
 * The display name is taken from the account, never invented. A missing name
 * falls back to a neutral placeholder rather than a fabricated person.
 */
export async function syncLeaderboardEntry(uid: string): Promise<LeaderboardEntry> {
  const db = getFirestore();
  const userSnap = await db.collection('users').doc(uid).get();
  const data = userSnap.exists ? userSnap.data() : null;

  const displayName = readDisplayName(data);

  const { career, weekly } = await computeUserXp(uid);

  const entry: LeaderboardEntry = {
    uid,
    displayName,
    careerXp: career,
    weeklyXp: weekly,
    level: levelFromXp(career),
    isPro: resolveEntitlement(data).isPro,
    updatedAt: new Date().toISOString(),
  };

  await db.collection('leaderboard').doc(uid).set(entry, { merge: true });
  return entry;
}

export interface LeaderboardPage {
  entries: (LeaderboardEntry & { rank: number })[];
  totalMembers: number;
  /** The requesting user's rank, even when outside the returned page. */
  yourRank: number | null;
  yourEntry: (LeaderboardEntry & { rank: number }) | null;
}

/**
 * Top entries plus the caller's own position.
 *
 * Ties are broken by uid so ordering is identical for every viewer and stable
 * across refreshes — without that, two users on the same XP would swap places
 * unpredictably.
 */
/**
 * Build the leaderboard across ALL registered users.
 *
 * The previous version only listed users who had opened the Arena, because
 * entries were created on visit — so a board with seventeen sign-ups showed
 * one member. This walks the users collection instead, so everyone with an
 * account appears whether or not they've ever looked at the rankings.
 *
 * Cached entries are reused when fresh; stale ones are recomputed. With a
 * small user base that is cheap, and it stays bounded as the base grows.
 */
export async function getLeaderboard(
  uid: string | null,
  mode: 'career' | 'weekly' = 'career',
  limit = 20
): Promise<LeaderboardPage> {
  const db = getFirestore();
  const field = mode === 'weekly' ? 'weeklyXp' : 'careerXp';

  const [usersSnap, cacheSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('leaderboard').get(),
  ]);

  const cache = new Map<string, LeaderboardEntry>();
  for (const doc of cacheSnap.docs) cache.set(doc.id, doc.data() as LeaderboardEntry);

  const now = Date.now();
  const entries: LeaderboardEntry[] = [];
  const toPersist: LeaderboardEntry[] = [];
  let recomputed = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();

    // Skip records that aren't real accounts.
    if (!data || data.accountStatus === 'deleted' || data.accountStatus === 'banned') continue;

    const cached = cache.get(doc.id);
    const fresh =
      cached && Date.parse(cached.updatedAt || '') > now - STALE_MS && typeof cached.careerXp === 'number';

    const displayName = readDisplayName(data);
    const pro = resolveEntitlement(data).isPro;

    if (fresh) {
      // Name and Pro status are cheap to read, so keep them current even when
      // the XP figure is being served from cache.
      entries.push({ ...cached!, displayName, isPro: pro });
      continue;
    }

    // Serve a stale entry rather than blocking the response on a recompute.
    // Only a few accounts are refreshed per request, so the first load stays
    // fast no matter how many members exist.
    if (cached && recomputed >= MAX_RECOMPUTE_PER_REQUEST) {
      entries.push({ ...cached, displayName, isPro: pro });
      continue;
    }

    try {
      recomputed++;
      const { career, weekly } = await computeUserXp(doc.id);
      const entry: LeaderboardEntry = {
        uid: doc.id,
        displayName,
        careerXp: career,
        weeklyXp: weekly,
        level: levelFromXp(career),
        isPro: pro,
        updatedAt: new Date().toISOString(),
      };
      entries.push(entry);
      toPersist.push(entry);
    } catch (err) {
      // One unreadable account must not take down the whole board.
      console.warn('Could not compute XP for', doc.id, (err as Error)?.message);
      if (cached) entries.push({ ...cached, displayName, isPro: pro });
    }
  }

  // Persist recomputed entries without blocking the response.
  if (toPersist.length > 0) {
    const batch = db.batch();
    for (const e of toPersist) batch.set(db.collection('leaderboard').doc(e.uid), e, { merge: true });
    batch.commit().catch((err) => console.warn('Leaderboard cache write failed:', err?.message));
  }

  const ranked = entries
    .sort((a, b) => {
      const diff = ((b as any)[field] || 0) - ((a as any)[field] || 0);
      if (diff !== 0) return diff;
      // Deterministic tiebreak — same order for everyone, every time.
      return a.uid.localeCompare(b.uid);
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const yourEntry = uid ? ranked.find((e) => e.uid === uid) || null : null;

  return {
    entries: ranked.slice(0, limit),
    totalMembers: ranked.length,
    yourRank: yourEntry ? yourEntry.rank : null,
    yourEntry,
  };
}
