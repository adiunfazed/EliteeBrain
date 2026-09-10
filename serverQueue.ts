/**
 * Request pacing for the AI endpoints.
 *
 * The Gemini free tier allows roughly 10-15 requests per minute per project.
 * Several people scanning photos at once burst straight past that and every
 * one of them gets a 429 — which is why the tools worked sometimes and not
 * others.
 *
 * Queueing serialises the bursts: requests wait their turn rather than
 * failing. A user waiting four seconds is a far better outcome than an error,
 * and the queue is what makes the tools behave under load rather than only
 * when one person happens to be using them.
 */

interface Job<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: any) => void;
  queuedAt: number;
}

/** Minimum gap between calls. 12 req/min sits inside every free-tier limit. */
const MIN_GAP_MS = 4000;

/** Longest a request may wait before it is rejected rather than left hanging. */
const MAX_WAIT_MS = 180_000;

/** Beyond this, new requests are refused immediately with an honest message. */
const MAX_QUEUE = 40;

const queue: Job<any>[] = [];
let draining = false;
let lastRunAt = 0;

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;

  while (queue.length > 0) {
    const job = queue.shift()!;

    // Drop anything that has waited too long rather than serving a response
    // the user has long since given up on.
    if (Date.now() - job.queuedAt > MAX_WAIT_MS) {
      job.reject(new Error('Waited too long in the queue. Please try again.'));
      continue;
    }

    const since = Date.now() - lastRunAt;
    if (since < MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, MIN_GAP_MS - since));
    }

    lastRunAt = Date.now();

    try {
      job.resolve(await job.run());
    } catch (err) {
      job.reject(err);
    }
  }

  draining = false;
}

/** How many requests are waiting, for telling the user what to expect. */
export function queueDepth(): number {
  return queue.length;
}

/** Rough wait in seconds for a request joining now. */
export function estimatedWaitSeconds(): number {
  return Math.round((queue.length * MIN_GAP_MS) / 1000);
}

/**
 * Run a job in turn.
 *
 * Rejects immediately when the queue is already long, since joining a
 * forty-second queue is worse than being told to come back.
 */
export function enqueue<T>(run: () => Promise<T>): Promise<T> {
  if (queue.length >= MAX_QUEUE) {
    return Promise.reject(
      new Error('Too many people are using this right now. Try again in a minute.')
    );
  }

  return new Promise<T>((resolve, reject) => {
    queue.push({ run, resolve, reject, queuedAt: Date.now() });
    void drain();
  });
}
