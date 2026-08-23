import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, X, Smartphone, Check } from 'lucide-react';
import {
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

  useEffect(() => {
    if (!isOpen) return;
    setPrefs(loadPrefs());
    setSupport(notificationSupport());
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
      className="w-full flex items-start gap-3 p-3 rounded-xl bg-[#171B22] border border-[#2A313C] hover:border-[#3A424F] text-left transition-colors"
    >
      <span
        className={`shrink-0 w-10 h-6 rounded-full p-0.5 flex items-center transition-colors ${
          checked ? 'bg-[#8B5CF6] justify-end' : 'bg-[#2A313C] justify-start'
        }`}
      >
        <motion.span layout className="w-5 h-5 shrink-0 rounded-full bg-white shadow" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-[#F4F6F8]">{label}</span>
        <span className="block text-[10px] text-[#98A2B3] mt-0.5 leading-relaxed">{hint}</span>
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
          className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-[#0E1116] border border-[#2A313C] rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-4"
        >
          <div className="sm:hidden w-10 h-1 rounded-full bg-[#2A313C] mx-auto" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-black font-mono text-[#F4F6F8] flex items-center gap-2">
                <Bell className="w-4 h-4 shrink-0 text-[#A78BFA]" />
                Notifications
              </h3>
              <p className="text-[11px] text-[#98A2B3] mt-1 leading-relaxed">
                Reminders built from your own routine, habits and tasks.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-10 h-10 rounded-xl hover:bg-[#171B22] text-[#98A2B3] flex items-center justify-center"
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
              <p className="text-[11px] text-[#98A2B3] mt-1.5 leading-relaxed">
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
              <p className="text-[11px] text-[#98A2B3] mt-1.5 leading-relaxed">
                Notifications were declined for this site. Re-allow them in your browser's site
                settings, then come back here.
              </p>
            </div>
          )}

          {support === 'unsupported' && (
            <p className="text-[11px] text-[#98A2B3] leading-relaxed">
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

                  <div className="p-3 rounded-xl bg-[#171B22] border border-[#2A313C]">
                    <p className="text-xs font-bold text-[#F4F6F8]">Remind me this early</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {[0, 5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          onClick={() => update({ leadMinutes: m })}
                          className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-full border ${
                            prefs.leadMinutes === m
                              ? 'eb-chip-active'
                              : 'text-[#7E8899] border-[#2A313C]'
                          }`}
                        >
                          {m === 0 ? 'On time' : `${m} min`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#171B22] border border-[#2A313C]">
                    <p className="text-xs font-bold text-[#F4F6F8]">Evening check-in</p>
                    <p className="text-[10px] text-[#98A2B3] mt-0.5 mb-2">
                      Only sent if something is still open.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={prefs.dailySummaryAt}
                        onChange={(e) => update({ dailySummaryAt: e.target.value })}
                        className="bg-[#0E1116] border border-[#2A313C] rounded-lg px-2 py-1.5 text-[11px] text-[#F4F6F8] outline-none"
                      />
                      {prefs.dailySummaryAt && (
                        <button
                          onClick={() => update({ dailySummaryAt: '' })}
                          className="text-[10px] font-mono text-[#7E8899] hover:eb-danger"
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

          <p className="text-[10px] text-[#7E8899] leading-relaxed">
            Reminders are scheduled by the app while it's open or running in the background. If
            you fully close it, some may not arrive.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
