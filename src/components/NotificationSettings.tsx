import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, X, Smartphone, Check } from 'lucide-react';
import {
  subscribeToPush,
  isPushSubscribed,
  DEFAULT_PREFS,
  NotificationPrefs,
  notificationSupport,
  loadPrefs,
  registerServiceWorker,
  requestPermission,
  savePrefs,
  showNotification,
} from '../lib/notifications';
import { soundFx } from '../utils/audio';
import { getIdToken } from '../lib/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Notification controls.
 *
 * States the platform limits plainly rather than offering a toggle that
 * silently does nothing — on iOS a browser tab genuinely cannot receive
 * notifications until the app is added to the Home Screen.
 */
export const NotificationSettings: React.FC<Props> = ({ isOpen, onClose }) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [support, setSupport] = useState(notificationSupport());
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPrefs(loadPrefs());
    setSupport(notificationSupport());
    isPushSubscribed().then(setPushOn);
  }, [isOpen]);

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const enable = async () => {
    setBusy(true);
    soundFx.playClick();
    try {
      const granted = await requestPermission();
      setSupport(notificationSupport());
      if (granted) {
        await registerServiceWorker();
        update({ enabled: true });

        // Register this device for server-sent push. Without this step the
        // app can only notify while it is open.
        const result = await subscribeToPush(getIdToken);
        if (!result.ok) {
          setPushError(result.reason || 'Could not enable push on this device.');
        } else {
          setPushError(null);
        }

        await showNotification(
          'Notifications on',
          "You'll get a nudge before routine blocks and a check-in if things are still open.",
          'welcome'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const Row: React.FC<{
    label: string;
    hint: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }> = ({ label, hint, checked, onChange }) => (
    <button
      onClick={() => {
        soundFx.playClick();
        onChange(!checked);
      }}
      className="w-full flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-sunk)] border border-[var(--rule)] hover:border-[var(--rule-strong)] text-left transition-colors"
    >
      <span
        className={`shrink-0 w-10 h-6 rounded-full p-0.5 flex items-center transition-colors ${
          checked ? 'bg-[#8B5CF6] justify-end' : 'bg-[var(--rule)] justify-start'
        }`}
      >
        <motion.span layout className="w-5 h-5 shrink-0 rounded-full bg-white shadow" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[var(--ink)]">{label}</span>
        <span className="block text-[10px] text-[var(--ink-muted)] mt-0.5 leading-relaxed">{hint}</span>
      </span>
    </button>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-[var(--ground)] border border-[var(--rule)] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-4"
        >
          <div className="sm:hidden w-10 h-1 rounded-full bg-[var(--rule)] mx-auto" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-black font-mono text-[var(--ink)] flex items-center gap-2">
                <Bell className="w-4 h-4 shrink-0 text-[#A78BFA]" />
                Notifications
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1 leading-relaxed">
                Reminders built from your own routine, habits and tasks.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 rounded-xl hover:bg-[var(--surface-sunk)] text-[var(--ink-muted)] flex items-center justify-center"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* iOS install requirement */}
          {support === 'ios_needs_install' && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
              <p className="text-xs font-bold eb-warn flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                Add to Home Screen first
              </p>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1.5 leading-relaxed">
                On iPhone and iPad, Apple only allows notifications for apps added to the Home
                Screen. In Safari: tap Share, then <strong>Add to Home Screen</strong>, and open
                EliteLife from the new icon.
              </p>
            </div>
          )}

          {support === 'denied' && (
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-3.5">
              <p className="text-xs font-bold eb-danger flex items-center gap-1.5">
                <BellOff className="w-3.5 h-3.5 shrink-0" />
                Blocked in your browser
              </p>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1.5 leading-relaxed">
                Notifications were declined for this site. Re-allow them in your browser's site
                settings, then come back here.
              </p>
            </div>
          )}

          {support === 'unsupported' && (
            <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
              This browser doesn't support notifications.
            </p>
          )}

          {support === 'needs_permission' && (
            <button
              onClick={enable}
              disabled={busy}
              className="eb-btn-primary eb-shine w-full py-3.5 rounded-xl text-sm font-mono font-black flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {busy ? 'Waiting…' : 'Turn on notifications'}
            </button>
          )}

          {support === 'ready' && (
            <>
              <Row
                label="Notifications"
                hint="Master switch. Turning this off stops everything below."
                checked={prefs.enabled}
                onChange={(v) => update({ enabled: v })}
              />

              {prefs.enabled && (
                <>
                  <div className="flex items-start gap-2.5 py-3 border-t border-[var(--rule)]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: pushOn ? 'var(--done)' : 'var(--warn)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">
                        {pushOn ? 'This device is registered' : 'This device is not registered'}
                      </p>
                      <p className="t-sub mt-0.5 leading-snug">
                        {pushOn
                          ? 'You will get reminders even when the app is closed.'
                          : pushError || 'Reminders will only appear while the app is open.'}
                      </p>
                      {!pushOn && (
                        <button
                          onClick={async () => {
                            setBusy(true);
                            const r = await subscribeToPush(getIdToken);
                            setPushError(r.ok ? null : r.reason || 'Could not register.');
                            setPushOn(await isPushSubscribed());
                            setBusy(false);
                          }}
                          disabled={busy}
                          className="btn-quiet mt-3 text-[13px]"
                        >
                          Register this device
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {prefs.enabled && (
                <div className="space-y-2">
                  <Row
                    label="Routine reminders"
                    hint="A nudge shortly before each time block you haven't ticked."
                    checked={prefs.routine}
                    onChange={(v) => update({ routine: v })}
                  />
                  <Row
                    label="Habit check-in"
                    hint="Included in the evening summary when habits are still open."
                    checked={prefs.habits}
                    onChange={(v) => update({ habits: v })}
                  />
                  <Row
                    label="Task check-in"
                    hint="Included in the evening summary when tasks are still open."
                    checked={prefs.tasks}
                    onChange={(v) => update({ tasks: v })}
                  />

                  <div className="p-3 rounded-xl bg-[var(--surface-sunk)] border border-[var(--rule)]">
                    <p className="text-xs font-bold text-[var(--ink)]">Remind me this early</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {[0, 5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          onClick={() => update({ leadMinutes: m })}
                          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border ${
                            prefs.leadMinutes === m
                              ? 'eb-chip-active'
                              : 'text-[var(--ink-dim)] border-[var(--rule)]'
                          }`}
                        >
                          {m === 0 ? 'On time' : `${m} min`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-sunk)] border border-[var(--rule)]">
                    <p className="text-xs font-bold text-[var(--ink)]">Evening check-in</p>
                    <p className="text-[10px] text-[var(--ink-muted)] mt-0.5 mb-2">
                      Only sent if something is still open.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={prefs.dailySummaryAt}
                        onChange={(e) => update({ dailySummaryAt: e.target.value })}
                        className="bg-[var(--ground)] border border-[var(--rule)] rounded-lg px-2 py-1.5 text-[11px] text-[var(--ink)] outline-none"
                      />
                      {prefs.dailySummaryAt && (
                        <button
                          onClick={() => update({ dailySummaryAt: '' })}
                          className="text-[10px] font-mono text-[var(--ink-dim)] hover:eb-danger"
                        >
                          turn off
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      showNotification(
                        'Test notification',
                        'This is how your reminders will look.',
                        'test'
                      )
                    }
                    className="eb-btn-ghost w-full py-3 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Send a test
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-[var(--ink-dim)] leading-relaxed">
            Reminders are scheduled by the app while it's open or running in the background. If
            you fully close it, some may not arrive.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
