import type { CoachChatMessage } from '../types';

/**
 * Coach conversation storage.
 *
 * Chats persist until the user explicitly starts a new one. Keyed per account
 * so two people on the same device never see each other's conversation, and a
 * guest session never inherits a signed-in user's history.
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
