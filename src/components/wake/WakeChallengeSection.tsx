import React from 'react';
import { ChevronLeft, Clock, AlarmClock } from 'lucide-react';
import { CHALLENGES } from '../../lib/wakeChallenge';

interface Props {
  userId: string | null;
  isPro?: boolean;
  entitlementStatus?: string;
  onUpgrade?: () => void;
  onBack?: () => void;
}

/**
 * Wake Challenge — not yet available.
 *
 * The alarm logic, composer, challenge screens and server scheduler are all
 * built and tested. What is missing is not code: a browser cannot reliably
 * ring an alarm once the phone is asleep, because the operating system defers
 * or drops background notifications, and iOS restricts them further.
 *
 * Shipping a working-looking alarm on top of that would mean someone trusts
 * it and is not woken, which is worse than not offering it. So this screen
 * shows what is coming and nothing that pretends to work. The components are
 * unchanged in the codebase and switch back on with the Android build.
 */
export const WakeChallengeSection: React.FC<Props> = ({ onBack }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="icon-btn shrink-0">
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="t-title">Wake Challenge</h1>
        <p className="t-meta mt-0.5">Earn your way out of bed.</p>
      </div>
    </div>

    <div
      className="rounded-xl p-5 text-center"
      style={{
        background:
          'linear-gradient(150deg, color-mix(in oklab, var(--signal) 22%, var(--surface)), var(--surface))',
        border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
      }}
    >
      <span
        className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
        style={{ background: 'var(--signal)' }}
      >
        <AlarmClock className="w-7 h-7 shrink-0" style={{ color: '#fff' }} />
      </span>

      <p
        className="text-[11px] font-bold uppercase mt-4"
        style={{ color: 'var(--warn)', letterSpacing: '0.08em' }}
      >
        Coming soon
      </p>

      <p className="text-[19px] font-bold mt-2 leading-tight">
        Arriving with the Android app
      </p>

      <p className="t-sub mt-3 leading-relaxed max-w-sm mx-auto">
        An alarm you have to earn: finish a short challenge before it stops. A web
        browser cannot reliably ring once your phone is asleep, so this ships with
        the Android app where it can use a real system alarm.
      </p>
    </div>

    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">What is coming</span>
        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
      </div>

      {CHALLENGES.map((c) => (
        <div key={c.id} className="panel-row">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: 'var(--signal)' }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">{c.name}</span>
            <span className="t-meta block mt-0.5 truncate">{c.blurb}</span>
          </span>
        </div>
      ))}
    </div>

    <p className="t-meta text-center leading-relaxed">
      Everything else in Body Training works today.
    </p>
  </div>
);
