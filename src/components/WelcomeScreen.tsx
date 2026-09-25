import React, { useState } from 'react';
import { ArrowRight, Check, Moon, Sun } from 'lucide-react';

interface Props {
  /** Suggested name from the sign-in provider, if any. */
  suggested?: string;
  /** Which theme is on right now, so the picker opens on the truth. */
  dark?: boolean;
  /** Applied live as it is chosen — the preview is the app itself. */
  onTheme: (dark: boolean) => void;
  onDone: (name: string) => void;
}

/**
 * A miniature of the app, drawn in the theme it represents.
 *
 * Deliberately not a screenshot: a picture would go stale the first time
 * anything changed, and would be wrong on a phone that renders type
 * differently. This is the same tokens the app uses, at a tenth of the size.
 */
const ThemePreview: React.FC<{ dark: boolean }> = ({ dark }) => {
  const ground = dark ? '#08080B' : '#F2F5F9';
  const surface = dark ? '#131319' : '#FFFFFF';
  const rule = dark ? '#23232C' : '#C9D2DF';
  const ink = dark ? '#F5F4F8' : '#0B0E13';
  const dim = dark ? '#7F7D8C' : '#64718A';
  const signal = dark ? '#7C6BE8' : '#6A52D6';

  return (
    <span className="theme-preview" style={{ background: ground, borderColor: rule }}>
      <span className="theme-preview-bar" style={{ background: ink, opacity: 0.85 }} />
      <span className="theme-preview-bar short" style={{ background: dim }} />

      <span className="theme-preview-card" style={{ background: surface, borderColor: rule }}>
        <span className="theme-preview-dot" style={{ background: signal }} />
        <span className="theme-preview-lines">
          <span style={{ background: ink, opacity: 0.8 }} />
          <span style={{ background: dim }} />
        </span>
      </span>

      <span className="theme-preview-pill" style={{ background: signal }} />
    </span>
  );
};

/**
 * First run.
 *
 * Two questions, then the app: what to call you, and which theme to use.
 * The previous flow walked new users through feature tours, goal setup and a
 * 30-day protocol explanation before they saw anything — which is a lot to
 * ask of someone who has not yet decided the app is worth their time.
 *
 * The theme applies the instant it is tapped rather than on Continue, so the
 * screen around the choice becomes the preview.
 */
export const WelcomeScreen: React.FC<Props> = ({ suggested, dark = true, onTheme, onDone }) => {
  const [name, setName] = useState(suggested?.split(' ')[0] || '');
  const [step, setStep] = useState<'name' | 'theme'>('name');
  const [saving, setSaving] = useState(false);

  const next = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStep('theme');
  };

  const finish = () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    onDone(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex items-center justify-center p-6 overflow-y-auto">
      {/* Soft accent wash, matching the rest of the app. */}
      <div
        className="pointer-events-none absolute -top-32 -left-20 w-[28rem] h-80 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'var(--signal)' }}
      />

      <div className="relative w-full max-w-sm py-6">
        <p className="t-eyebrow">EliteLife</p>

        {step === 'name' ? (
          <>
            <h1 className="t-display mt-3">Welcome</h1>
            <p className="t-sub mt-3 leading-relaxed">
              Plan your day, do the work, and see what actually moved.
            </p>

            <div className="mt-10">
              <label htmlFor="welcome-name" className="t-section block">
                What should I call you?
              </label>

              <input
                id="welcome-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && next()}
                placeholder="Your name"
                maxLength={40}
                autoComplete="given-name"
                className="w-full mt-4 bg-[var(--surface)] border border-[var(--rule)] focus:border-[var(--signal)] rounded-xl px-5 py-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none transition-colors"
              />

              <button onClick={next} disabled={!name.trim()} className="btn-lg w-full mt-4">
                Continue
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="t-display mt-3">Pick your look</h1>
            <p className="t-sub mt-3 leading-relaxed">
              Tap either one to try it. You can change it any time from the menu.
            </p>

            <div className="theme-grid mt-8">
              {[
                { value: true, label: 'Dark', hint: 'Easy at night', Icon: Moon },
                { value: false, label: 'Light', hint: 'Bright and clear', Icon: Sun },
              ].map(({ value, label, hint, Icon }) => {
                const active = dark === value;

                return (
                  <button
                    key={label}
                    onClick={() => onTheme(value)}
                    className="theme-card"
                    data-active={active ? 'true' : 'false'}
                    aria-pressed={active}
                  >
                    <ThemePreview dark={value} />

                    <span className="theme-card-foot">
                      <span className="theme-radio" data-active={active ? 'true' : 'false'}>
                        {active && <Check className="w-3 h-3 shrink-0 stroke-[3]" />}
                      </span>

                      <span className="min-w-0 flex-1 text-left">
                        <span className="theme-card-name">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {label}
                        </span>
                        <span className="t-meta block mt-0.5 truncate">{hint}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button onClick={finish} disabled={saving} className="btn-lg w-full mt-8">
              {saving ? 'Setting up…' : `Start, ${name.trim().split(' ')[0]}`}
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="flex justify-center mt-2">
              <button onClick={() => setStep('name')} className="btn-text">
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
