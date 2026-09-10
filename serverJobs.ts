/**
 * Job store for image analysis.
 *
 * A plain request/response cannot report progress: the connection simply
 * hangs until the work finishes, so the client can only guess. Accepting the
 * job, returning an id and letting the client poll means the queue position
 * and stage are real figures rather than an animation.
 *
 * Held in memory. The app runs as a single instance, and a job is meaningless
 * after a minute or two, so persisting it would add failure modes for no gain.
 */

export type JobStage = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  uid: string;
  stage: JobStage;
  /** 1-based place in the queue while waiting; 0 once running. */
  position: number;
  result: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/** How long a finished job stays readable before being dropped. */
const KEEP_MS = 5 * 60 * 1000;

/** Hard ceiling on stored jobs, so a burst cannot exhaust memory. */
const MAX_JOBS = 200;

const jobs = new Map<string, Job>();

function sweep(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const age = now - (job.finishedAt ?? job.createdAt);
    if ((job.stage === 'done' || job.stage === 'failed') && age > KEEP_MS) {
      jobs.delete(id);
    }
  }

  // If still over the ceiling, drop the oldest finished jobs first.
  if (jobs.size > MAX_JOBS) {
    const finished = [...jobs.values()]
      .filter((j) => j.stage === 'done' || j.stage === 'failed')
      .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
    for (const job of finished) {
      if (jobs.size <= MAX_JOBS) break;
      jobs.delete(job.id);
    }
  }
}

export function createJob(uid: string): Job {
  sweep();

  const job: Job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    uid,
    stage: 'queued',
    position: waitingCount() + 1,
    result: null,
    error: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };

  jobs.set(job.id, job);
  return job;
}

/** Jobs still waiting to start. */
export function waitingCount(): number {
  let n = 0;
  for (const job of jobs.values()) if (job.stage === 'queued') n++;
  return n;
}

/**
 * A job, but only for the user who created it.
 *
 * These are analyses of someone's body, meals and clothing — another
 * account must never be able to read one by guessing an id.
 */
export function getJob(id: string, uid: string): Job | null {
  const job = jobs.get(id);
  if (!job || job.uid !== uid) return null;
  return job;
}

export function markRunning(id: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.stage = 'running';
  job.position = 0;
  job.startedAt = Date.now();
  renumber();
}

export function markDone(id: string, result: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.stage = 'done';
  job.result = result;
  job.finishedAt = Date.now();
  renumber();
}

export function markFailed(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.stage = 'failed';
  job.error = error;
  job.finishedAt = Date.now();
  renumber();
}

/** Keep queue positions contiguous as jobs start, so the figure shown is true. */
function renumber(): void {
  let n = 1;
  for (const job of jobs.values()) {
    if (job.stage === 'queued') job.position = n++;
  }
}
