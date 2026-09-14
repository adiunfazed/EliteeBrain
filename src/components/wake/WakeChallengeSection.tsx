import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { Plus, Pencil, Trash2, Check, X, ChevronLeft, Clock } from 'lucide-react';
import { AlarmComposer } from './AlarmComposer';
import { AlarmRingScreen } from './AlarmRingScreen';
import {
  Alarm,
  AlarmLog,
  ALARM_XP,
  challengeById,
  dueNow,
  nextOccurrence,
} from '../../lib/wakeChallenge';
import {
  subscribeAlarms,
  subscribeAlarmLogs,
  saveAlarm,
  patchAlarm,
  removeAlarm,
  saveAlarmLog,
} from '../../lib/trainingStore';
import { soundFx } from '../../utils/audio';
import { useXp } from '../XpToast';
import { SetupChecklist } from './SetupChecklist';

interface Props {
  userId: string | null;
  /** Present when shown as a full screen rather than inline. */
  onBack?: () => void;
  /** From the app's existing entitlement, not a local guess. */
  isPro?: boolean;
  entitlementStatus?: string;
  onUpgrade?: () => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Human-readable time until an alarm, or null if it never fires. */
function untilText(alarm: Alarm): string | null {
  const next = nextOccurrence(alarm);
  if (!next) return null;

  const mins = Math.round((next.getTime() - Date.now()) / 60000);
  if (mins < 60) return `in ${mins} min`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

/**
 * Wake Challenge.
 *
 * The schedule check runs while the app is open. A browser cannot fire an
 * alarm when the app is fully closed — there is no API for it — so this is
 * honest about that rather than appearing to work and then failing silently
 * at 6am, which is the worst possible time to discover a limitation.
 */
export const WakeChallengeSection: React.FC<Props> = ({
  userId,
  onBack,
  isPro = false,
  entitlementStatus,
  onUpgrade,
}) => {
  const { awardXp } = useXp();

  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [logs, setLogs] = useState<AlarmLog[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Alarm | null>(null);
  const [ringing, setRinging] = useState<Alarm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupReady, setSetupReady] = useState(false);

  useEffect(() => subscribeAlarms(userId, setAlarms), [userId]);
  useEffect(() => subscribeAlarmLogs(userId, setLogs), [userId]);

  /**
   * Check every twenty seconds. A tab in the background gets throttled, which
   * is why dueNow accepts a window rather than demanding an exact match.
   */
  useEffect(() => {
    if (ringing) return;

    const check = () => {
      const due = dueNow(alarms, logs);
      if (due) {
        setRinging(due);
        soundFx.playClick();
      }
    };

    check();
    const id = window.setInterval(check, 20000);
    return () => window.clearInterval(id);
  }, [alarms, logs, ringing]);

  const handleResolved = async (
    outcome: 'completed' | 'skipped' | 'dismissed',
    seconds: number
  ) => {
    const alarm = ringing;
    setRinging(null);
    if (!alarm) return;

    const xp = outcome === 'completed' ? ALARM_XP : 0;

    const log: AlarmLog = {
      id: `alog_${Date.now()}`,
      alarmId: alarm.id,
      date: todayKey(),
      firedAt: new Date().toISOString(),
      outcome,
      tookSeconds: seconds,
      xpAwarded: xp,
    };

    setLogs((prev) => [log, ...prev]);
    if (xp > 0) awardXp(xp, 'Wake Challenge');

    try {
      await saveAlarmLog(userId, log);
    } catch (err) {
      console.error('Could not record alarm:', err);
    }
  };

  const history = useMemo(() => logs.slice(0, 5), [logs]);

  const upsert = async (alarm: Alarm) => {
    setAlarms((prev) => [alarm, ...prev.filter((a) => a.id !== alarm.id)]);
    setEditing(null);
    try {
      await saveAlarm(userId, alarm);
      setError(null);
    } catch (err) {
      console.error('Could not save alarm:', err);
      setError('Saved on this device. It will sync when you reconnect.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Screen header. Back on the left, add on the right — the same shape
          as every other full screen in the app. */}
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

        {isPro && (
          <button
            onClick={() => {
              soundFx.playClick();
              setEditing(null);
              setComposerOpen(true);
            }}
            aria-label="New alarm"
            className="icon-btn shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>

      {/* Why this is not live yet, stated plainly. A browser cannot wake a
          sleeping phone: the OS defers or drops background delivery, and iOS
          restricts it further. Shipping it anyway would mean failing at 6am,
          which is the worst possible time to discover a limitation. */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))',
          border: '1px solid color-mix(in oklab, var(--warn) 35%, var(--rule))',
        }}
      >
        <p className="text-[15px] font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 shrink-0 eb-warn" />
          Coming with the Android app
        </p>
        <p className="t-sub mt-2 leading-relaxed">
          A web browser cannot reliably ring an alarm once your phone is asleep — the
          system delays or drops the notification. Rather than have it fail when you
          actually need it, Wake Challenge ships with the Android app, where it can use
          a real system alarm.
        </p>
        <p className="t-meta mt-2.5">
          Everything else in Body Training works now.
        </p>
      </div>

      {/* Free users get the upgrade path and nothing else. The alarm UI is
          not merely hidden — the server refuses these calls regardless. */}
      {!isPro ? (
        <div className="panel-sm text-center py-6">
          <p className="t-section">Pro feature</p>
          <p className="t-sub mt-2 leading-relaxed">
            {entitlementStatus === 'expired'
              ? 'Your Pro access has ended. Reactivate to use Wake Challenge again — your alarms are still saved.'
              : 'Wake Challenge alarms are part of Pro. Your free month includes them.'}
          </p>
          <button onClick={onUpgrade} className="btn-lg mt-5">
            {entitlementStatus === 'expired' ? 'Reactivate Pro' : 'See Pro'}
          </button>
        </div>
      ) : (
        <>
          {/* Stays until every required step genuinely passes. */}
          {!setupReady && (
            <SetupChecklist userId={userId} onReady={() => setSetupReady(true)} />
          )}

          {error && <p className="t-meta eb-warn">{error}</p>}
        </>
      )}

      {isPro && (alarms.length === 0 ? (
        <div className="panel-sm text-center py-6">
          <p className="t-sub">No alarms yet.</p>
          <p className="t-meta mt-1.5 leading-relaxed">
            Set one and finish a short challenge before it stops.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setComposerOpen(true);
            }}
            className="btn-lg mt-5"
          >
            Create your first alarm
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {alarms
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((alarm) => {
              const spec = challengeById(alarm.challenge);
              const Icon = spec ? (Icons as any)[spec.icon] || Icons.Dumbbell : Icons.Dumbbell;
              const until = alarm.enabled ? untilText(alarm) : null;

              return (
                <div
                  key={alarm.id}
                  className="rounded-xl eb-card p-3"
                  style={{ opacity: alarm.enabled ? 1 : 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="t-figure tabular-nums shrink-0" style={{ fontSize: 26, fontWeight: 800 }}>
                      {alarm.time}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold truncate">{alarm.label}</p>
                      <p className="t-meta mt-0.5 flex items-center gap-1 truncate">
                        <Icon className="w-3 h-3 shrink-0" />
                        {spec?.name}
                        {until ? ` · ${until}` : ''}
                      </p>
                    </div>

                    {/* Enable toggle, which is the control used most. */}
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setAlarms((prev) =>
                          prev.map((a) =>
                            a.id === alarm.id ? { ...a, enabled: !a.enabled } : a
                          )
                        );
                        void patchAlarm(userId, alarm.id, { enabled: !alarm.enabled });
                      }}
                      aria-label={alarm.enabled ? 'Disable alarm' : 'Enable alarm'}
                      className="shrink-0 w-9 h-5 rounded-full relative transition-colors"
                      style={{
                        background: alarm.enabled
                          ? 'var(--done)'
                          : 'var(--surface-sunk)',
                        border: '1px solid var(--rule)',
                      }}
                    >
                      <span
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white transition-[left] shadow-sm"
                        style={{ left: alarm.enabled ? 18 : 2 }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {DAY_LABELS.map((d, i) => {
                        const on =
                          !alarm.weekdays || alarm.weekdays.length === 0
                            ? true
                            : alarm.weekdays.includes(i);
                        return (
                          <span
                            key={i}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{
                              background: on
                                ? 'color-mix(in oklab, var(--signal) 20%, transparent)'
                                : 'transparent',
                              color: on ? 'var(--signal-ink)' : 'var(--ink-dim)',
                            }}
                          >
                            {d}
                          </span>
                        );
                      })}
                    </div>

                    <span className="flex-1" />

                    <button
                      onClick={() => {
                        setEditing(alarm);
                        setComposerOpen(true);
                      }}
                      aria-label="Edit alarm"
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: 'var(--ink-dim)' }}
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" />
                    </button>

                    <button
                      onClick={() => {
                        soundFx.playClick();
                        setAlarms((prev) => prev.filter((a) => a.id !== alarm.id));
                        void removeAlarm(userId, alarm.id);
                      }}
                      aria-label="Delete alarm"
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ color: 'var(--ink-dim)' }}
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      ))}

      {isPro && history.length > 0 && (
        <div className="panel-sm">
          <div className="panel-head">
            <span className="panel-title">Alarm history</span>
          </div>

          {history.map((log) => (
            <div key={log.id} className="panel-row">
              {log.outcome === 'completed' ? (
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--done)' }} />
              ) : (
                <X className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ink-dim)' }} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] truncate">
                  {challengeById(alarms.find((a) => a.id === log.alarmId)?.challenge || '')
                    ?.name || 'Challenge'}
                </span>
                <span className="t-meta block mt-0.5">
                  {log.date} · {log.outcome}
                  {log.tookSeconds ? ` · ${log.tookSeconds}s` : ''}
                </span>
              </span>
              {log.xpAwarded > 0 && (
                <span className="t-meta shrink-0" style={{ color: 'var(--signal-ink)' }}>
                  +{log.xpAwarded} XP
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stated plainly rather than discovered at 6am. */}
      <p className="t-meta leading-relaxed">
        Alarms ring while EliteLife is open or in the background. A browser cannot
        wake a fully closed app — for that, an Android build is needed.
      </p>

      {composerOpen && (
        <AlarmComposer
          open={composerOpen}
          alarm={editing}
          onClose={() => {
            setComposerOpen(false);
            setEditing(null);
          }}
          onSave={upsert}
        />
      )}

      {ringing && <AlarmRingScreen alarm={ringing} onResolved={handleResolved} />}
    </div>
  );
};
