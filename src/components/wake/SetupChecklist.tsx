import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Circle, AlertTriangle, Loader2 } from 'lucide-react';
import {
  SetupStep,
  StepId,
  readSetupState,
  isReady,
  markTested,
  pushSupported,
} from '../../lib/wakeSetup';
import { subscribeToPush } from '../../lib/notifications';
import { getIdToken } from '../../lib/firebase';
import { soundFx } from '../../utils/audio';

interface Props {
  userId: string | null;
  /** Called once every required step passes. */
  onReady: () => void;
}

/**
 * First-run setup.
 *
 * A compact checklist rather than a tutorial page. It re-reads the real
 * browser state every time it mounts and after every action, because a stored
 * "setup done" flag goes stale the moment someone changes a site permission.
 */
export const SetupChecklist: React.FC<Props> = ({ userId, onReady }) => {
  const [steps, setSteps] = useState<SetupStep[] | null>(null);
  const [busy, setBusy] = useState<StepId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /** False once unmounted, so a late read cannot write to a dead component. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await readSetupState();
    if (!alive.current) return;

    setSteps(next);
    if (isReady(next)) onReady();
  }, [onReady]);

  useEffect(() => {
    void refresh();

    // Permissions can change while the app sits in the background, so the
    // state is re-read on return rather than trusted from before.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const runStep = async (id: StepId) => {
    setBusy(id);
    setFailure(null);
    setMessage(null);

    try {
      if (id === 'notifications') {
        // Only ever from a tap. Prompting automatically is how a browser
        // decides to block a site permanently.
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          setFailure(
            result === 'denied'
              ? 'Notifications were blocked. You can change this in your browser’s site settings.'
              : 'Permission was dismissed. Tap again when you are ready.'
          );
        }
      }

      if (id === 'push') {
        if (Notification.permission !== 'granted') {
          setFailure('Allow notifications first.');
        } else {
          const result = await subscribeToPush(() => getIdToken());
          if (!result.ok) {
            setFailure(result.reason || 'Could not register for background delivery.');
          }
        }
      }

      if (id === 'install') {
        const prompt = (window as any).__eliteInstallPrompt;
        if (prompt) {
          prompt.prompt();
          await prompt.userChoice;
          (window as any).__eliteInstallPrompt = null;
        } else {
          setFailure(
            'Your browser has no install button here. On iPhone use Share then Add to Home Screen.'
          );
        }
      }

      if (id === 'test') {
        if (Notification.permission !== 'granted') {
          setFailure('Allow notifications first.');
        } else {
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            setFailure('The service worker is not running. Reload the page and try again.');
          } else {
            // Shown through the service worker, which is the same path a real
            // alarm uses — a plain Notification would pass while push is broken.
            await reg.showNotification('EliteLife Wake Challenge', {
              body: 'Test notification. Your alarms can reach this device.',
              tag: 'wake-test',
            });
            markTested();
            setMessage('Test notification sent.');
          }
        }
      }
    } catch (err: any) {
      console.error('Setup step failed:', id, err);
      setFailure(err?.message || 'That did not work. Try again.');
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (!steps) {
    return (
      <div className="panel-sm">
        <div className="h-20 rounded animate-pulse" style={{ background: 'var(--surface-sunk)' }} />
      </div>
    );
  }

  const ready = isReady(steps);
  if (ready) return null;

  return (
    <div className="panel-sm">
      <div className="panel-head">
        <span className="panel-title">Set up alarms</span>
        <span className="t-meta shrink-0">
          {steps.filter((s) => s.state === 'complete').length}/{steps.length}
        </span>
      </div>

      {!pushSupported() && (
        <p className="t-meta leading-relaxed py-1">
          This browser cannot receive background notifications. Alarms will only ring
          while EliteLife is open.
        </p>
      )}

      <div className="space-y-1">
        {steps.map((step) => {
          const done = step.state === 'complete';
          const blocked = step.state === 'blocked';

          return (
            <div key={step.id} className="panel-row items-start">
              <span className="shrink-0 mt-0.5">
                {done ? (
                  <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--done)' }} />
                ) : blocked ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 eb-warn" />
                ) : (
                  <Circle className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-dim)' }} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className="block text-[14px] font-semibold"
                  style={{ color: done ? 'var(--ink-dim)' : 'var(--ink)' }}
                >
                  {step.title}
                  {!step.required && !done && (
                    <span className="t-meta ml-1.5 font-normal">optional</span>
                  )}
                </span>

                {!done && (
                  <span className="t-meta block mt-0.5 leading-relaxed">
                    {blocked ? step.recovery : step.detail}
                  </span>
                )}

                {!done && !blocked && step.action && (
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      void runStep(step.id);
                    }}
                    disabled={busy === step.id}
                    className="mt-2 px-3 min-h-[34px] rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5"
                    style={{
                      background: 'color-mix(in oklab, var(--signal) 18%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                      color: 'var(--signal-ink)',
                    }}
                  >
                    {busy === step.id && (
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                    )}
                    {step.action}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {message && (
        <p className="t-meta mt-2.5" style={{ color: 'var(--done)' }}>
          {message}
        </p>
      )}
      {failure && <p className="t-meta eb-warn mt-2.5 leading-relaxed">{failure}</p>}
    </div>
  );
};
