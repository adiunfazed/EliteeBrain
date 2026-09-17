/**
 * Rep engine simulation.
 *
 * Feeds synthetic landmark frames through the real state machine so the
 * counting rules can be checked without a camera, a body, or a person doing
 * three hundred squats to find out whether the counter is honest.
 *
 * Run: npx esbuild scripts/repEngine.test.ts --bundle --platform=node --outfile=/tmp/rt.cjs && node /tmp/rt.cjs
 */

import { LM, Landmark } from '../src/lib/pose/landmarks';
import { createRepEngine, PoseExerciseId } from '../src/lib/pose/repEngine';

/** 33 landmarks, all invisible, as a starting point. */
function blank(): Landmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
}

function put(lm: Landmark[], index: number, x: number, y: number, visibility = 0.95): void {
  lm[index] = { x, y, z: 0, visibility };
}

/**
 * A body whose knees are bent to `knee` degrees.
 *
 * Both legs identical, torso upright — a textbook squat, so the shape checks
 * pass and only the counting rules are under test.
 */
function squatFrame(knee: number): Landmark[] {
  const lm = blank();
  const rad = (knee * Math.PI) / 180;

  for (const [hipI, kneeI, ankleI, shoulderI, dx] of [
    [LM.leftHip, LM.leftKnee, LM.leftAnkle, LM.leftShoulder, -0.05],
    [LM.rightHip, LM.rightKnee, LM.rightAnkle, LM.rightShoulder, 0.05],
  ] as const) {
    const kx = 0.5 + dx;
    const ky = 0.6;
    put(lm, kneeI, kx, ky);
    // Thigh points straight up from the knee.
    put(lm, hipI, kx, ky - 0.2);
    // Shin opens to the measured angle.
    put(lm, ankleI, kx + 0.2 * Math.sin(rad), ky - 0.2 * Math.cos(rad));
    // Torso above the hip, so the posture check sees an upright trunk.
    put(lm, shoulderI, kx, ky - 0.45);
  }

  return lm;
}

interface SimOptions {
  exercise?: PoseExerciseId;
  target?: number;
  /** Degrees at the bottom of each rep. */
  bottom?: number;
  /** Degrees at the top of each rep. */
  top?: number;
  /** Milliseconds for one full top-bottom-top cycle. */
  cycleMs?: number;
  /** Milliseconds held at the bottom. */
  pauseMs?: number;
  frameMs?: number;
}

/**
 * Run `reps` movements through the engine and report what it counted.
 */
function simulate(reps: number, opts: SimOptions = {}) {
  const {
    exercise = 'squats',
    target = 0,
    bottom = 95,
    top = 170,
    cycleMs = 1400,
    pauseMs = 300,
    frameMs = 33,
  } = opts;

  const engine = createRepEngine(exercise, target);
  let now = 0;
  const events: string[] = [];

  const feed = (angle: number) => {
    const r = engine.push(squatFrame(angle), now);
    if (r.event) events.push(`${r.event.kind}:${r.event.reason ?? ''}`);
    now += frameMs;
    return r;
  };

  // Settle at the top so the engine calibrates.
  for (let i = 0; i < 10; i++) feed(top);

  const half = Math.max(1, Math.round((cycleMs - pauseMs) / 2 / frameMs));
  const pauseFrames = Math.max(1, Math.round(pauseMs / frameMs));

  for (let rep = 0; rep < reps; rep++) {
    for (let i = 1; i <= half; i++) feed(top + ((bottom - top) * i) / half);
    for (let i = 0; i < pauseFrames; i++) feed(bottom);
    for (let i = 1; i <= half; i++) feed(bottom + ((top - bottom) * i) / half);
    // A beat at the top, as a real person has between reps.
    feed(top);
  }

  // The engine smooths over a three-frame window, so the last rep needs a
  // few more frames at the top to be confirmed — exactly as it would get
  // from a live camera that keeps running after the set.
  for (let i = 0; i < 5; i++) feed(top);

  return { count: engine.value, locked: engine.reachedTarget, events };
}

/* ---------------- assertions ---------------- */

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

console.log('--- counting ---');

check('10 clean reps count 10', simulate(10).count, 10);
check('30 clean reps count 30', simulate(30).count, 30);

// The bug the brief describes: a fast pace must not strand the counter.
const brisk = simulate(30, { cycleMs: 800, pauseMs: 220 });
check('30 brisk reps count 30', brisk.count, 30);

const verybrisk = simulate(20, { cycleMs: 700, pauseMs: 210 });
check('20 very brisk reps count 20', verybrisk.count, 20);

console.log('\n--- target lock ---');

const locked = simulate(35, { target: 30 });
check('35 movements with target 30 stop at 30', locked.count, 30);
check('target 30 reports locked', locked.locked, true);

const exact = simulate(30, { target: 30 });
check('exactly 30 with target 30 reaches 30', exact.count, 30);
check('exactly 30 locks immediately', exact.locked, true);

const brisk30 = simulate(40, { target: 30, cycleMs: 800, pauseMs: 220 });
check('brisk 40 movements with target 30 stop at 30', brisk30.count, 30);

console.log('\n--- rejection ---');

// Shallow: a real attempt that never reaches the 110-degree bottom threshold.
const shallow = simulate(10, { bottom: 125 });
check('shallow movements count 0', shallow.count, 0);
check('shallow movements are reported', shallow.events.some((e) => e.startsWith('rejected')), true);

// No pause at the bottom, and too fast to be a real rep.
const flicked = simulate(10, { cycleMs: 300, pauseMs: 33 });
check('flicked movements count 0', flicked.count, 0);

// The behaviour behind "stuck at 29": under the old rule a rejected rep left
// the clock running, so the NEXT identical movement passed and the one after
// failed, counting every other rep and stranding the total. The same movement
// must now always get the same verdict.
const tooFast = simulate(12, { cycleMs: 520, pauseMs: 200 });
check('too-fast reps are rejected consistently, never alternating', tooFast.count, 0);
check(
  'every rejected movement is explained',
  tooFast.events.filter((e) => e.startsWith('rejected')).length >= 10,
  true
);

console.log('\n--- manual adjust ---');

const manual = createRepEngine('squats', 30);
for (let i = 0; i < 40; i++) manual.adjust(1);
check('manual taps stop at the target', manual.value, 30);
check('manual taps set the lock', manual.reachedTarget, true);
manual.adjust(-1);
check('manual decrement clears the lock', manual.reachedTarget, false);
check('manual decrement lowers the count', manual.value, 29);

const floor = createRepEngine('squats', 30);
floor.adjust(-5);
check('manual decrement cannot go negative', floor.value, 0);

console.log('\n--- no double counting ---');

const once = simulate(12, { pauseMs: 900 });
check('a long pause at the bottom still counts once per rep', once.count, 12);

const repEvents = simulate(15).events.filter((e) => e.startsWith('rep:')).length;
check('one rep event per counted rep', repEvents, 15);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
