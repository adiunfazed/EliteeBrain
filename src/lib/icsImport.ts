/**
 * Calendar import from an .ics file.
 *
 * Deliberately file-based rather than Google Calendar OAuth. An .ics export
 * works with Google, Apple, Outlook and everything else, needs no API keys, no
 * OAuth consent screen and no ongoing permission to read someone's calendar —
 * the user hands over exactly one file, once.
 */

export interface ImportedBlock {
  title: string;
  startTime: string;
  endTime: string;
  /** 0-6, Sunday first. Empty means every day. */
  weekdays: number[];
}

/** Unfold RFC 5545 line continuations, which wrap at 75 characters. */
function unfold(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(Boolean);
}

function hhmm(value: string): string | null {
  // DTSTART forms: 20260902T093000Z, 20260902T093000, or a date only.
  const m = /T(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

function weekdayOf(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d.getTime()) ? d.getDay() : null;
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Parse an .ics file into routine blocks.
 *
 * Only recurring, timed events are imported. A one-off meeting is not a
 * routine, and importing hundreds of them would bury the blocks that matter.
 */
export function parseIcs(raw: string, limit = 20): ImportedBlock[] {
  const lines = unfold(raw);
  const blocks: ImportedBlock[] = [];

  let inEvent = false;
  let summary = '';
  let start = '';
  let end = '';
  let rrule = '';

  const flush = () => {
    const startTime = hhmm(start);
    const endTime = hhmm(end);

    // All-day events have no time, so they cannot become a routine block.
    if (summary && startTime && endTime && rrule.includes('FREQ=WEEKLY')) {
      const byday = /BYDAY=([^;]+)/.exec(rrule);
      let weekdays: number[] = [];

      if (byday) {
        weekdays = byday[1]
          .split(',')
          .map((d) => BYDAY[d.trim().slice(-2)])
          .filter((n): n is number => n !== undefined);
      } else {
        const w = weekdayOf(start);
        if (w !== null) weekdays = [w];
      }

      blocks.push({
        title: summary.slice(0, 60),
        startTime,
        endTime,
        weekdays: weekdays.sort(),
      });
    }

    inEvent = false;
    summary = '';
    start = '';
    end = '';
    rrule = '';
  };

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (inEvent) flush();
      if (blocks.length >= limit) break;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith('SUMMARY')) {
      summary = line.slice(line.indexOf(':') + 1).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
    } else if (line.startsWith('DTSTART')) {
      start = line.slice(line.indexOf(':') + 1).trim();
    } else if (line.startsWith('DTEND')) {
      end = line.slice(line.indexOf(':') + 1).trim();
    } else if (line.startsWith('RRULE')) {
      rrule = line.slice(line.indexOf(':') + 1).trim();
    }
  }

  // Same title at the same time twice is one block, not two.
  const seen = new Set<string>();
  return blocks.filter((b) => {
    const key = `${b.title}|${b.startTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
