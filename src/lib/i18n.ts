/**
 * Translation.
 *
 * Strings live here rather than in components so a second language does not
 * require touching every file. Kept deliberately simple: a lookup with an
 * English fallback, no library, no bundle cost beyond the strings themselves.
 *
 * Anything missing falls back to English rather than showing a key, so a
 * partial translation degrades gracefully instead of breaking the screen.
 */

export type Lang = 'en' | 'hi';

type Dict = Record<string, string>;

const EN: Dict = {
  // Navigation
  'nav.today': 'Today',
  'nav.train': 'Train',
  'nav.coach': 'Coach',
  'nav.plan': 'Plan',
  'nav.more': 'More',

  // Plan tabs
  'plan.tasks': 'Tasks',
  'plan.habits': 'Habits',
  'plan.routine': 'Routine',
  'plan.goals': 'Goals',

  // Common actions
  'action.add': 'Add',
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.done': 'Done',
  'action.start': 'Start',
  'action.undo': 'Undo',
  'action.close': 'Close',
  'action.retry': 'Try again',

  // Today
  'today.greeting.morning': 'Good morning',
  'today.greeting.afternoon': 'Good afternoon',
  'today.greeting.evening': 'Good evening',
  'today.doNext': 'Do this next',
  'today.yourDay': 'Your day',
  'today.toDo': 'To do today',
  'today.toRepeat': 'To repeat',
  'today.allDone': 'Everything you planned today is done.',

  // Quest
  'quest.title': 'Daily quest',
  'quest.markDone': 'Mark done',
  'quest.completed': 'Completed',
  'quest.resetsAtMidnight': 'Done today. A new quest arrives at midnight.',

  // Streak and stats
  'stats.streak': 'Streak',
  'stats.days': 'days',
  'stats.rank': 'Rank',
  'stats.totalXp': 'Total XP',
  'stats.badges': 'Badges',

  // Empty states
  'empty.noTasks': 'Clear day',
  'empty.noGoals': 'No goals yet',
  'empty.noHabits': 'No habits yet',

  // Pro
  'pro.choosePlan': 'Choose a plan',
  'pro.monthly': 'Monthly',
  'pro.yearly': 'Yearly',
  'pro.lifetime': 'Lifetime',
  'pro.perMonth': 'per month',
  'pro.perYear': 'per year',
  'pro.oneTime': 'one time',
};

/**
 * Hindi.
 *
 * Written in Devanagari with the English terms Indian students actually use
 * left as-is — "task", "streak" and "XP" are more natural to this audience
 * than invented Hindi equivalents nobody says out loud.
 */
const HI: Dict = {
  'nav.today': 'आज',
  'nav.train': 'ट्रेन',
  'nav.coach': 'कोच',
  'nav.plan': 'प्लान',
  'nav.more': 'और',

  'plan.tasks': 'टास्क',
  'plan.habits': 'आदतें',
  'plan.routine': 'रूटीन',
  'plan.goals': 'लक्ष्य',

  'action.add': 'जोड़ें',
  'action.save': 'सेव करें',
  'action.cancel': 'रद्द करें',
  'action.delete': 'हटाएं',
  'action.done': 'हो गया',
  'action.start': 'शुरू करें',
  'action.undo': 'वापस लाएं',
  'action.close': 'बंद करें',
  'action.retry': 'फिर कोशिश करें',

  'today.greeting.morning': 'सुप्रभात',
  'today.greeting.afternoon': 'नमस्ते',
  'today.greeting.evening': 'शुभ संध्या',
  'today.doNext': 'अब यह करें',
  'today.yourDay': 'आपका दिन',
  'today.toDo': 'आज करना है',
  'today.toRepeat': 'रोज़ करना है',
  'today.allDone': 'आज का पूरा प्लान हो गया।',

  'quest.title': 'आज का क्वेस्ट',
  'quest.markDone': 'पूरा हुआ',
  'quest.completed': 'पूरा हो गया',
  'quest.resetsAtMidnight': 'आज हो गया। नया क्वेस्ट रात 12 बजे आएगा।',

  'stats.streak': 'स्ट्रीक',
  'stats.days': 'दिन',
  'stats.rank': 'रैंक',
  'stats.totalXp': 'कुल XP',
  'stats.badges': 'बैज',

  'empty.noTasks': 'आज कुछ बाकी नहीं',
  'empty.noGoals': 'अभी कोई लक्ष्य नहीं',
  'empty.noHabits': 'अभी कोई आदत नहीं',

  'pro.choosePlan': 'प्लान चुनें',
  'pro.monthly': 'मासिक',
  'pro.yearly': 'सालाना',
  'pro.lifetime': 'लाइफटाइम',
  'pro.perMonth': 'प्रति माह',
  'pro.perYear': 'प्रति वर्ष',
  'pro.oneTime': 'एक बार',
};

const DICTS: Record<Lang, Dict> = { en: EN, hi: HI };

export const LANGUAGES: { id: Lang; label: string; native: string }[] = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

let current: Lang = 'en';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem('elitebrain_lang', lang);
  } catch {
    /* private mode — resets next launch */
  }
  document.documentElement.lang = lang;
}

/** Restore the saved choice, falling back to the browser's language. */
export function initLang(): Lang {
  try {
    const saved = localStorage.getItem('elitebrain_lang') as Lang | null;
    if (saved && DICTS[saved]) {
      setLang(saved);
      return saved;
    }
    const browser = navigator.language?.slice(0, 2);
    if (browser === 'hi') {
      setLang('hi');
      return 'hi';
    }
  } catch {
    /* fall through to English */
  }
  setLang('en');
  return 'en';
}

/**
 * Look up a string.
 *
 * Falls back to English, then to the key itself. A missing translation should
 * show readable English, never a raw key.
 */
export function t(key: string, lang: Lang = current): string {
  return DICTS[lang]?.[key] ?? EN[key] ?? key;
}
