import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { CoachChatMessage } from '../types';

/**
 * Coach conversation storage.
 *
 * Chats persist until the user explicitly starts a new one.
 *
 * Storage is two-layer. localStorage keeps the thread instantly available and
 * keeps working offline; Firestore mirrors it so the same account shows the
 * same conversation on every device. Local-only storage is per-device by
 * definition, which is why a phone and a laptop signed into one account were
 * showing different chats.
 */

const PREFIX = 'elitebrain_coach_chat_v1';
/** Trim very long threads so storage can't fill up. */
const MAX_MESSAGES = 200;

function keyFor(userId: string | null): string {
  return `${PREFIX}:${userId || 'guest'}`;
}

export function loadChat(userId: string | null): CoachChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChat(userId: string | null, messages: CoachChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    const trimmed =
      messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
  } catch {
    /* quota or private mode — the in-memory thread still works */
  }
}

export function clearChat(userId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Action cards                                                        */
/* ------------------------------------------------------------------ */

export interface CoachAction {
  id: string;
  title: string;
  hint: string;
  /** Icon name resolved by the component. */
  icon: string;
  /** The message sent when tapped. */
  prompt: string;
}

/**
 * Starting points, written for what this app actually does — planning,
 * habits, focus and follow-through. Each sends a real question rather than a
 * keyword, so the model has something specific to answer.
 */
export const COACH_ACTIONS: CoachAction[] = [
  {
    id: 'plan-day',
    title: 'Plan my day',
    hint: 'Turn what I have into a realistic order',
    icon: 'CalendarCheck',
    prompt:
      'Look at my tasks, habits and routine for today and tell me a realistic order to do them in. Be specific about what to start with and what to drop if I run out of time.',
  },
  {
    id: 'stuck',
    title: "I'm stuck",
    hint: "Something I keep putting off",
    icon: 'LifeBuoy',
    prompt:
      "I keep postponing something important and I can't get started. Ask me what's blocking it, then give me one small first step I can do in ten minutes.",
  },
  {
    id: 'progress',
    title: 'How am I doing?',
    hint: 'Honest read on my consistency',
    icon: 'TrendingUp',
    prompt:
      'Based on my streak, habit consistency and completed tasks, give me an honest assessment of how I am actually doing. Tell me the one area that needs the most attention.',
  },
  {
    id: 'focus',
    title: 'Help me focus',
    hint: 'Concentration keeps slipping',
    icon: 'Target',
    prompt:
      'I struggle to concentrate for long. Give me two or three practical things I can change today, based on how I have actually been using focus sessions.',
  },
  {
    id: 'habit',
    title: 'Build a habit',
    hint: 'Make something stick this time',
    icon: 'Repeat',
    prompt:
      'I want to build a habit that actually sticks. Ask me what the habit is, then help me set a realistic frequency and a cue that fits my existing routine.',
  },
  {
    id: 'goal',
    title: 'Break down a goal',
    hint: 'Big target into real steps',
    icon: 'Flag',
    prompt:
      'I have a goal that feels too big. Ask me what it is, then break it into milestones and the first few concrete tasks I should put in my plan.',
  },
  {
    id: 'overloaded',
    title: 'I planned too much',
    hint: 'Cut it down to what fits',
    icon: 'Scale',
    prompt:
      'I keep planning more than I finish. Look at what I have scheduled and tell me honestly what to cut so the day is actually achievable.',
  },
  {
    id: 'training',
    title: 'Training advice',
    hint: 'Which modules to work on',
    icon: 'Brain',
    prompt:
      'Based on my module scores, which cognitive training should I focus on next and why? Keep it to the two that would help me most.',
  },
];


/* ------------------------------------------------------------------ */
/* Cloud sync                                                          */
/* ------------------------------------------------------------------ */

/** Cap what goes to Firestore; a document has a 1MB ceiling. */
const CLOUD_MESSAGES = 60;

/**
 * Mirror the thread to the cloud. Local storage is written first so the UI is
 * never waiting on the network.
 */
export async function saveChatEverywhere(
  userId: string | null,
  messages: CoachChatMessage[]
): Promise<void> {
  saveChat(userId, messages);
  if (!userId || !db) return;

  try {
    const trimmed = messages.slice(-CLOUD_MESSAGES);
    await setDoc(
      doc(db, 'users', userId, 'coachChat', 'current'),
      { messages: trimmed, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    // A failed sync must not lose the conversation — the local copy stands.
    console.warn('Could not sync coach chat:', err);
  }
}

/**
 * Watch the cloud copy and hand back updates.
 *
 * The newest thread wins: whichever device wrote last is the one the others
 * adopt, so opening the app on a second device continues the conversation
 * rather than resurrecting an older one.
 */
export function subscribeChat(
  userId: string | null,
  onChange: (messages: CoachChatMessage[], updatedAt: string) => void
): () => void {
  if (!userId || !db) return () => {};

  try {
    return onSnapshot(
      doc(db, 'users', userId, 'coachChat', 'current'),
      (snap) => {
        const data = snap.data();
        if (!data || !Array.isArray(data.messages)) return;
        onChange(data.messages as CoachChatMessage[], data.updatedAt || '');
      },
      (err) => console.warn('Coach chat listener error:', err)
    );
  } catch (err) {
    console.warn('Could not subscribe to coach chat:', err);
    return () => {};
  }
}

export async function clearChatEverywhere(userId: string | null): Promise<void> {
  clearChat(userId);
  if (!userId || !db) return;
  try {
    await setDoc(
      doc(db, 'users', userId, 'coachChat', 'current'),
      { messages: [], updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not clear cloud chat:', err);
  }
}
