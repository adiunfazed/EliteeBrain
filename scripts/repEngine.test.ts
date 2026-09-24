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
 * A body in a push-up position, elbows bent to `elbow` degrees.
 *
 * Torso horizontal, which is what tells the engine this is a plank and not a
 * person standing in front of the phone.
 */
function pushupFrame(elbow: number, standing = false): Landmark[] {
  const lm = blank();
  const rad = (elbow * Math.PI) / 180;

  for (const [shoulderI, elbowI, wristI, hipI, ankleI, dy] of [
    [LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftHip, LM.leftAnkle, -0.02],
    [LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightHip, LM.rightAnkle, 0.02],
  ] as const) {
    const sx = 0.35;
    const sy = 0.5 + dy;
    put(lm, shoulderI, sx, sy);

    if (standing) {
      // Upright: the hip is BELOW the shoulder, so the torso reads vertical.
      put(lm, hipI, sx, sy + 0.25);
      put(lm, ankleI, sx, sy + 0.5);
    } else {
      // Plank: the hip is to the SIDE of the shoulder, so it reads horizontal.
      put(lm, hipI, sx + 0.25, sy);
      put(lm, ankleI, sx + 0.5, sy);
    }

    // Upper arm straight down from the shoulder, forearm opening to `elbow`.
    const ex = sx;
    const ey = sy + 0.12;
    put(lm, elbowI, ex, ey);
    put(lm, wristI, ex + 0.12 * Math.sin(rad), ey - 0.12 * Math.cos(rad));
  }

  return lm;
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

  // Settle in the starting position long enough to arm the counter, exactly
  // as a person does before beginning a set.
  const settleFrames = Math.ceil(1400 / frameMs);
  for (let i = 0; i < settleFrames; i++) feed(top);

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

console.log('\n--- arming: getting into position is not a rep ---');

/**
 * The exact sequence that used to hand out a free rep.
 *
 * The user stands in front of the phone with straight arms — which satisfies
 * the push-up "top" perfectly — then kneels down, plants their hands, and
 * presses up into a plank. Under the old single-frame gate that arc armed the
 * counter and then read itself as repetition one.
 */
function pushupStartup(opts: { holdBeforeStarting?: number } = {}) {
  const engine = createRepEngine('pushups', 0);
  let now = 0;
  const feed = (lm: Landmark[]) => {
    const r = engine.push(lm, now);
    now += 33;
    return r;
  };

  // Standing in front of the camera, arms straight at the side.
  for (let i = 0; i < 20; i++) feed(pushupFrame(170, true));
  const afterStanding = engine.value;

  // Kneeling down and planting the hands: the elbow bends deeply.
  for (let i = 0; i < 10; i++) feed(pushupFrame(95, true));
  // Pressing up into the plank position.
  for (let i = 0; i < 10; i++) feed(pushupFrame(170, false));
  const afterGettingIntoPosition = engine.value;

  // Now actually settling in position before starting.
  const hold = opts.holdBeforeStarting ?? 40;
  let last = feed(pushupFrame(170, false));
  for (let i = 0; i < hold; i++) last = feed(pushupFrame(170, false));

  return {
    afterStanding,
    afterGettingIntoPosition,
    armState: last.armState,
    engine,
    feed,
  };
}

const startup = pushupStartup();
check('standing in front of the camera counts nothing', startup.afterStanding, 0);
check(
  'getting down into position counts nothing',
  startup.afterGettingIntoPosition,
  0
);
check('holding the position arms the counter', startup.armState, 'counting');

// And from there, real push-ups do count.
{
  const { engine, feed } = pushupStartup();
  for (let rep = 0; rep < 5; rep++) {
    for (let i = 0; i < 10; i++) feed(pushupFrame(170 - (75 * (i + 1)) / 10, false));
    for (let i = 0; i < 8; i++) feed(pushupFrame(95, false));
    for (let i = 0; i < 10; i++) feed(pushupFrame(95 + (75 * (i + 1)) / 10, false));
    for (let i = 0; i < 4; i++) feed(pushupFrame(170, false));
  }
  check('five real push-ups after arming count five', engine.value, 5);
}

// A short glance at the position does not arm it either.
{
  const engine = createRepEngine('pushups', 0);
  let now = 0;
  const feed = (lm: Landmark[]) => {
    const r = engine.push(lm, now);
    now += 33;
    return r;
  };
  // In position for only ~200ms, well short of the hold.
  let last = feed(pushupFrame(170, false));
  for (let i = 0; i < 5; i++) last = feed(pushupFrame(170, false));
  check('a brief glance at the position does not arm', last.armState, 'holding');
  check('and nothing is counted', engine.value, 0);
}

// Losing the body disarms, so a rep cannot straddle a dropout.
{
  const { engine, feed } = pushupStartup();
  const lost = engine.push(null, 9_000);
  check('losing the body disarms the counter', lost.armState, 'finding');
  check('and the count is preserved, not reset', lost.count, engine.value);
}

console.log('\n--- squats arm from standing, not from walking past ---');

{
  const engine = createRepEngine('squats', 0);
  let now = 0;
  const feed = (knee: number) => {
    const r = engine.push(squatFrame(knee), now);
    now += 33;
    return r;
  };
  // Walking into frame: the knee swings through the squat range repeatedly
  // without ever settling at the top.
  for (let step = 0; step < 6; step++) {
    for (const a of [170, 140, 115, 100, 115, 140]) feed(a);
  }
  check('walking into frame counts nothing', engine.value, 0);
}


console.log('\n--- a body the camera reads a few degrees short still counts ---');

{
  // Someone whose knees never read straighter than 150 (a low phone, a
  // rotated hip, or simply no full extension). The old fixed top of 160
  // meant they could never arm and never got a single rep.
  const shortRange = simulate(5, { top: 150, bottom: 88 });
  check('their reps are counted', shortRange.count, 5);

  // But the range of motion required does not shrink with them: the bottom
  // moves by the same amount as the top, so a shallow rep is still shallow.
  const shortAndShallow = simulate(5, { top: 150, bottom: 125 });
  check('a shallow rep is still refused', shortAndShallow.count, 0);
  check(
    'and they are told it was shallow',
    shortAndShallow.events.every((e) => e.startsWith('rejected')),
    true
  );
}

check(
  'a top far below anything anatomical never arms',
  simulate(4, { top: 128, bottom: 95 }).count,
  0
);

console.log('\n--- one mistracked frame is not a rep ---');

{
  const engine = createRepEngine('squats', 0);
  let now = 0;
  const feed = (angle: number) => {
    const r = engine.push(squatFrame(angle), now);
    now += 33;
    return r;
  };

  for (let i = 0; i < 45; i++) feed(170);

  // A single frame where the knee is mistracked to the floor, then straight
  // back. The median window throws it away; a mean would carry a third of it.
  feed(60);
  for (let i = 0; i < 20; i++) feed(170);
  check('a one-frame glitch counts nothing', engine.value, 0);

  // Two glitched frames in a row are still not a rep, because a rep needs a
  // pause at the bottom and a plausible duration.
  feed(60);
  feed(60);
  for (let i = 0; i < 20; i++) feed(170);
  check('nor do two', engine.value, 0);
}

console.log('\n--- alternating lunges keep counting ---');

{
  // The clearer leg swaps every rep, which is what alternating lunges do to
  // a camera. The tracked side is locked while armed, so the measured angle
  // does not jump between legs mid-rep.
  const lungeFrame = (front: number, back: number, leftIsFront: boolean) => {
    const lm = blank();
    const legs = [
      [LM.leftHip, LM.leftKnee, LM.leftAnkle, leftIsFront ? front : back, leftIsFront ? 0.1 : -0.1],
      [LM.rightHip, LM.rightKnee, LM.rightAnkle, leftIsFront ? back : front, leftIsFront ? -0.1 : 0.1],
    ] as const;

    for (const [hipI, kneeI, ankleI, knee, dx] of legs) {
      const rad = (knee * Math.PI) / 180;
      const kx = 0.5 + dx;
      const ky = 0.6;
      // The front leg is clearly visible, the back one less so — which is
      // exactly what makes the side swap between reps.
      const vis = knee === front ? 0.95 : 0.6;
      put(lm, kneeI, kx, ky, vis);
      put(lm, hipI, kx, ky - 0.2, vis);
      put(lm, ankleI, kx + 0.2 * Math.sin(rad), ky - 0.2 * Math.cos(rad), vis);
    }

    put(lm, LM.leftShoulder, 0.5, 0.15);
    put(lm, LM.rightShoulder, 0.5, 0.15);
    return lm;
  };

  const engine = createRepEngine('lunges', 0);
  let now = 0;
  const feed = (front: number, back: number, leftFront: boolean) => {
    engine.push(lungeFrame(front, back, leftFront), now);
    now += 33;
  };

  // Stand still to arm, feet together.
  for (let i = 0; i < 50; i++) feed(172, 172, true);

  for (let rep = 0; rep < 4; rep++) {
    const leftFront = rep % 2 === 0;
    for (let i = 0; i < 12; i++) feed(172 - (72 * i) / 12, 172, leftFront);
    for (let i = 0; i < 10; i++) feed(100, 172, leftFront);
    for (let i = 0; i < 12; i++) feed(100 + (72 * i) / 12, 172, leftFront);
    for (let i = 0; i < 6; i++) feed(172, 172, leftFront);
  }

  check('every alternating rep is counted', engine.value, 4);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
