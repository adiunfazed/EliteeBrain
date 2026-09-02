import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface Props {
  /** Suggested name from the sign-in provider, if any. */
  suggested?: string;
  onDone: (name: string) => void;
}

/**
 * First run.
 *
 * One question, then the app. The previous flow walked new users through
 * feature tours, goal setup and a 30-day protocol explanation before they saw
 * anything — which is a lot to ask of someone who has not yet decided the app
 * is worth their time. People learn a product by using it.
 */
export const WelcomeScreen: React.FC<Props> = ({ suggested, onDone }) => {
  const [name, setName] = useState(suggested?.split(' ')[0] || '');
  const [saving, setSaving] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    onDone(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex items-center justify-center p-6">
      {/* Soft accent wash, matching the rest of the app. */}
      <div
        className="pointer-events-none absolute -top-32 -left-20 w-[28rem] h-80 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: 'var(--signal)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        <p className="t-eyebrow">EliteLife</p>
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
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Your name"
            maxLength={40}
            autoComplete="given-name"
            className="w-full mt-4 bg-[var(--surface)] border border-[var(--rule)] focus:border-[var(--signal)] rounded-2xl px-5 py-4 text-base text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none transition-colors"
          />

          <button onClick={submit} disabled={!name.trim() || saving} className="btn-lg w-full mt-4">
            {saving ? 'Setting up…' : 'Continue'}
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
