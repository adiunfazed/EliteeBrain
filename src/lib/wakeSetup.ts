/**
 * Wake Challenge setup state.
 *
 * Every check reads the live browser state rather than a stored flag. A user
 * can revoke notification permission in site settings at any time, and a
 * checklist that trusts its own memory would show "Ready" for an alarm that
 * can no longer be delivered — the worst possible thing to be wrong about.
 */

export type StepId = 'notifications' | 'push' | 'install' | 'test';

export type StepState = 'complete' | 'needed' | 'blocked' | 'unsupported';

export interface SetupStep {
  id: StepId;
  title: string;
  detail: string;
  action: string;
  state: StepState;
  /** Shown when blocked, since the browser prompt will not reappear. */
  recovery?: string;
  /** Steps that are not required still show, but do not hold back readiness. */
  required: boolean;
}

const TEST_KEY = 'elitelife_wake_test_sent_v1';

/** Whether the app is running as an installed PWA. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS uses a non-standard property rather than the media query.
    (window.navigator as any).standalone === true
  );
}

/** Whether this browser can support push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Whether a push subscription currently exists for this device. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  // Delegates to the app's existing reader rather than duplicating it.
  const { isPushSubscribed } = await import('./notifications');
  return isPushSubscribed();
}

/**
 * Read the current state of every step.
 *
 * Async because the push subscription can only be read from the service
 * worker registration, which is a promise.
 */
export async function readSetupState(): Promise<SetupStep[]> {
  const supported = pushSupported();
  const permission = supported ? Notification.permission : 'denied';
  const subscribed = await hasPushSubscription();
  const installed = isInstalled();
  const tested = typeof window !== 'undefined' && localStorage.getItem(TEST_KEY) === '1';

  const steps: SetupStep[] = [];

  if (!supported) {
    // One honest step rather than four that cannot be completed.
    return [
      {
        id: 'notifications',
        title: 'Not supported on this browser',
        detail:
          'This browser cannot receive background notifications. Alarms will only ring while EliteLife is open.',
        action: '',
        state: 'unsupported',
        required: false,
      },
    ];
  }

  steps.push({
    id: 'notifications',
    title: 'Allow notifications',
    detail: 'EliteLife needs notifications to alert you when your Wake Challenge is due.',
    action: 'Allow notifications',
    state:
      permission === 'granted' ? 'complete' : permission === 'denied' ? 'blocked' : 'needed',
    recovery:
      permission === 'denied'
        ? 'Notifications are blocked. Open your browser’s site settings for EliteLife and set Notifications to Allow.'
        : undefined,
    required: true,
  });

  steps.push({
    id: 'push',
    title: 'Enable background delivery',
    detail:
      'Lets EliteLife send your Wake Challenge notification even when the app is not open.',
    action: 'Enable',
    // Cannot be attempted before permission exists, so it reads as needed
    // rather than failed.
    state: subscribed ? 'complete' : 'needed',
    required: true,
  });

  steps.push({
    id: 'install',
    title: 'Install EliteLife',
    detail: 'Installing makes alarms more reliable and opens the app full screen.',
    action: 'Install app',
    state: installed ? 'complete' : 'needed',
    // Recommended rather than required: on several browsers there is no
    // install prompt at all, and blocking setup on it would strand the user.
    required: false,
  });

  steps.push({
    id: 'test',
    title: 'Send a test',
    detail: 'Check that a notification actually reaches this device.',
    action: 'Send test',
    state: tested ? 'complete' : 'needed',
    required: true,
  });

  return steps;
}

export function markTested(): void {
  try {
    localStorage.setItem(TEST_KEY, '1');
  } catch {
    /* private mode — the step simply stays unticked */
  }
}

export function clearTested(): void {
  try {
    localStorage.removeItem(TEST_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Ready only when every required step genuinely passes. */
export function isReady(steps: SetupStep[]): boolean {
  return steps.filter((s) => s.required).every((s) => s.state === 'complete');
}
