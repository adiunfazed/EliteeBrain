import { LM, Landmark, angleAt, betterSide, confidenceOf } from './landmarks';

/**
 * Rep detection.
 *
 * One state machine per exercise, driven by joint angles rather than pixel
 * positions. Each defines the angle that identifies the movement, the
 * thresholds that separate the top from the bottom of a rep, and which
 * landmarks must be visible for the reading to be trusted.
 *
 * A rep only counts on a complete top → bottom → top cycle, so a person
 * hovering at the bottom cannot accumulate reps by twitching.
 */

export type PoseExerciseId =
  | 'pushups'
  | 'squats'
  | 'lunges'
  | 'glute-bridge'
  | 'calf-raises';

export type TrackingStatus =
  | 'no-body'
  | 'partial'
  | 'low-confidence'
  | 'ready'
  | 'tracking';

interface ExerciseDefinition {
  /** Landmarks that must be visible, per side. */
  left: number[];
  right: number[];
  /**
   * Landmarks that prove a body is present for THIS exercise.
   *
   * Whole-torso presence is wrong for a lower-body exercise filmed from the
   * knees down: the movement is perfectly readable, but demanding shoulders
   * refuses to count it.
   */
  presence: number[];
  /** Shown when tracking fails, naming the likely cause. */
  framingHint: string;
  /**
   * The measured angle, given the three landmarks of the chosen side.
   * Returns degrees.
   */
  measure: (lm: Landmark[], side: number[]) => number;
  /** At or below this angle the body is at the bottom of the rep. */
  downAngle: number;
  /** At or above this angle the body has returned to the top. */
  upAngle: number;
  /** Minimum average visibility to trust a reading. */
  minConfidence: number;
  /** Shortest believable rep, in milliseconds. Anything faster is noise. */
  minRepMs: number;
  /**
   * Optional shape check.
   *
   * Some exercises share a measured angle — a squat and a lunge both bend the
   * knee through the same range — so the angle alone cannot tell them apart.
   * This rejects a movement that is the right depth but the wrong shape.
   */
  formCheck?: (lm: Landmark[]) => boolean;
  /** Shown when the form check rejects the movement. */
  formHint?: string;
  /**
   * Live posture check, run every tracked frame.
   *
   * Separate from `formCheck`: that one decides whether a rep counts, this one
   * only coaches. Returns a short message when something is wrong, or null
   * when the posture is fine. Never guesses — if the landmarks it needs are
   * not visible it returns null rather than inventing a correction.
   */
  posture?: (lm: Landmark[]) => string | null;
  /** How far from the bottom counts as "nearly there", in degrees. */
  nearBottom?: number;
}

/** The angle at B for A-B-C, or null when any point is too faint to trust. */
function safeAngle(
  lm: Landmark[],
  a: number,
  b: number,
  c: number,
  minVisibility = 0.5
): number | null {
  const pa = lm[a];
  const pb = lm[b];
  const pc = lm[c];
  if (!pa || !pb || !pc) return null;
  if (
    (pa.visibility ?? 0) < minVisibility ||
    (pb.visibility ?? 0) < minVisibility ||
    (pc.visibility ?? 0) < minVisibility
  ) {
    return null;
  }
  return angleAt(pa, pb, pc);
}

/** The more visible of a pair of landmarks, or null if neither is reliable. */
function clearer(lm: Landmark[], a: number, b: number, min = 0.5): Landmark | null {
  const pa = lm[a];
  const pb = lm[b];
  const va = pa?.visibility ?? 0;
  const vb = pb?.visibility ?? 0;
  if (va < min && vb < min) return null;
  return va >= vb ? pa : pb;
}

/**
 * How far the hips sit off the straight shoulder-to-ankle line.
 *
 * Returned as a fraction of body length, signed: positive means the hips hang
 * below the line (a sagging push-up or plank), negative means they ride above
 * it (piking). Scale-free, so it holds at any distance from the camera.
 *
 * An unsigned joint angle cannot tell sag from pike — both read as "less than
 * straight" — which is why this measures the offset rather than the angle.
 */
function hipDeviation(lm: Landmark[]): number | null {
  const shoulder = clearer(lm, LM.leftShoulder, LM.rightShoulder);
  const hip = clearer(lm, LM.leftHip, LM.rightHip);
  const ankle = clearer(lm, LM.leftAnkle, LM.rightAnkle);
  if (!shoulder || !hip || !ankle) return null;

  const dx = ankle.x - shoulder.x;
  const dy = ankle.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  // Too short to measure against: the body is end-on to the camera.
  if (length < 0.15) return null;

  // Signed perpendicular distance from the hip to the shoulder-ankle line.
  // Screen y grows downward, so a positive cross product puts the hip below.
  const cross = (hip.x - shoulder.x) * dy - (hip.y - shoulder.y) * dx;
  return -cross / (length * length);
}

const DEFINITIONS: Record<PoseExerciseId, ExerciseDefinition> = {
  // Elbow angle: straight at the top, deeply bent at the bottom.
  pushups: {
    left: [LM.leftShoulder, LM.leftElbow, LM.leftWrist],
    right: [LM.rightShoulder, LM.rightElbow, LM.rightWrist],
    presence: [LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow],
    framingHint: 'Place the phone to your side so an arm is visible from shoulder to wrist.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 100,
    upAngle: 155,
    minConfidence: 0.6,
    minRepMs: 550,
    nearBottom: 22,
    // A push-up fails at the hips long before it fails at the elbows.
    posture: (lm) => {
      const dev = hipDeviation(lm);
      if (dev === null) return null;
      if (dev > 0.07) return 'Keep your back straight';
      if (dev < -0.09) return 'Lower your hips';
      return null;
    },
  },

  // Knee angle. 90 is a deep squat; 160 is standing.
  squats: {
    left: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
    right: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
    presence: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee],
    framingHint: 'Step back so your hips and knees are both in frame.',
    // The mirror of the lunge check: a squat should be symmetric.
    formCheck: (lm) => {
      const leftKnee = angleAt(lm[LM.leftHip], lm[LM.leftKnee], lm[LM.leftAnkle]);
      const rightKnee = angleAt(lm[LM.rightHip], lm[LM.rightKnee], lm[LM.rightAnkle]);
      return Math.abs(leftKnee - rightKnee) < 30;
    },
    formHint: 'One leg is much lower than the other. Keep both knees level for a squat.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 110,
    upAngle: 160,
    minConfidence: 0.6,
    minRepMs: 600,
    nearBottom: 25,
    // Torso lean, measured as the angle at the hip between shoulder and knee.
    // Folding forward turns a squat into a good-morning.
    posture: (lm) => {
      const left = safeAngle(lm, LM.leftShoulder, LM.leftHip, LM.leftKnee);
      const right = safeAngle(lm, LM.rightShoulder, LM.rightHip, LM.rightKnee);
      const torso = left !== null && right !== null ? (left + right) / 2 : (left ?? right);
      if (torso === null) return null;
      if (torso < 55) return 'Chest up — you are folding forward';
      return null;
    },
  },

  // Front knee, same joints as a squat but a shallower bottom, since a lunge
  // rarely reaches squat depth on the tracked leg.
  lunges: {
    left: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
    right: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
    presence: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee],
    framingHint: 'Turn side-on to the camera so the front knee is visible.',
    // A lunge splits the feet and bends one knee far more than the other. A
    // squat keeps them level and symmetric, which is why squats were being
    // counted as lunges.
    formCheck: (lm) => {
      const la = lm[LM.leftAnkle];
      const ra = lm[LM.rightAnkle];
      if (!la || !ra) return false;

      const leftKnee = angleAt(lm[LM.leftHip], lm[LM.leftKnee], lm[LM.leftAnkle]);
      const rightKnee = angleAt(lm[LM.rightHip], lm[LM.rightKnee], lm[LM.rightAnkle]);

      // One leg clearly more bent than the other.
      const asymmetric = Math.abs(leftKnee - rightKnee) > 15;

      // Feet split rather than side by side. Measured against hip width so it
      // holds at any distance from the camera.
      const hipWidth = Math.abs(lm[LM.leftHip].x - lm[LM.rightHip].x) || 0.1;
      const split =
        Math.abs(la.x - ra.x) > hipWidth * 1.4 ||
        Math.abs(la.y - ra.y) > hipWidth * 0.8;

      return asymmetric || split;
    },
    formHint: 'That looked like a squat. Step one foot forward for a lunge.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 120,
    upAngle: 160,
    minConfidence: 0.55,
    minRepMs: 650,
    nearBottom: 20,
    posture: (lm) => {
      const left = safeAngle(lm, LM.leftShoulder, LM.leftHip, LM.leftKnee);
      const right = safeAngle(lm, LM.rightShoulder, LM.rightHip, LM.rightKnee);
      const torso = left !== null && right !== null ? Math.max(left, right) : (left ?? right);
      if (torso === null) return null;
      if (torso < 60) return 'Keep your torso upright';
      return null;
    },
  },

  // Hip angle: bent lying flat, straight at the top of the bridge. The
  // direction is inverted relative to the others, handled below.
  'glute-bridge': {
    left: [LM.leftShoulder, LM.leftHip, LM.leftKnee],
    right: [LM.rightShoulder, LM.rightHip, LM.rightKnee],
    presence: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee],
    framingHint: 'Put the phone on the floor to your side, level with your hips.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 125,
    upAngle: 160,
    minConfidence: 0.55,
    minRepMs: 600,
    nearBottom: 18,
  },

  // Ankle travel is too small for a reliable angle, so this one uses the
  // vertical rise of the heel above the foot instead.
  'calf-raises': {
    // Feet only. Demanding the torso made this unusable when the phone sits
    // on the floor, which is exactly where it has to be to see the heels.
    left: [LM.leftHeel, LM.leftFootIndex, LM.leftAnkle],
    right: [LM.rightHeel, LM.rightFootIndex, LM.rightAnkle],
    presence: [LM.leftAnkle, LM.rightAnkle],
    framingHint: 'Point the camera at your feet from the side, about a metre away.',
    measure: (lm, s) => {
      // Expressed as an angle-like number so one state machine serves all
      // exercises: larger means the heel is down, smaller means raised.
      const heel = lm[s[0]];
      const toe = lm[s[1]];
      const rise = (toe.y - heel.y) * 1000;
      return 150 - Math.max(0, Math.min(60, rise));
    },
    downAngle: 120,
    upAngle: 145,
    minConfidence: 0.5,
    minRepMs: 450,
    nearBottom: 12,
  },
};

/** Frames a threshold must hold before the phase changes. */
const HOLD_FRAMES = 2;

/** Minimum angular travel for a rep to be considered real. */
const MIN_TRAVEL_DEGREES = 25;

/** Minimum time spent at the bottom, in milliseconds. */
const MIN_BOTTOM_MS = 200;

/** Exercises measured by a raised position rather than a bent one. */
const INVERTED: PoseExerciseId[] = ['glute-bridge'];

/** How a coaching line should be read. */
export type CueTone = 'good' | 'warn' | 'bad' | 'dim';

export interface RepCue {
  text: string;
  tone: CueTone;
}

/**
 * Something that just happened, reported on exactly one frame.
 *
 * The UI uses it to flash green or red once, rather than having to diff the
 * count itself and guess why a movement did not register.
 */
export interface RepEvent {
  kind: 'rep' | 'rejected';
  /** Why a movement did not count. Always set on a rejection. */
  reason?: string;
  /** The count after this event. */
  count: number;
}

export interface RepReading {
  count: number;
  status: TrackingStatus;
  /** 0–1, for showing the user how reliable tracking currently is. */
  confidence: number;
  /** The measured angle, useful for a progress arc. */
  angle: number;
  /** Where in the cycle the body is. */
  phase: 'top' | 'bottom';
  /** Plain-language cause when tracking is not working. */
  reason?: string;
  /** Live coaching line. Only ever set when the pose is trusted. */
  cue?: RepCue;
  /** Fires on a single frame. See RepEvent. */
  event?: RepEvent;
  /** True once the configured target has been reached. */
  targetReached: boolean;
}

/**
 * A rep counter for one exercise.
 *
 * Stateful and deliberately not a React hook, so the render loop can feed it
 * every frame without causing re-renders on frames that change nothing.
 */
export function createRepEngine(exercise: PoseExerciseId, target = 0) {
  const def = DEFINITIONS[exercise] || DEFINITIONS.squats;
  const inverted = INVERTED.includes(exercise);

  let count = 0;
  let phase: 'top' | 'bottom' = 'top';
  /**
   * Whether the starting position has been seen.
   *
   * Until it has, the body may already be at the bottom, and treating that
   * as the top of a rep produces a phantom count on the first movement.
   */
  let calibrated = false;
  /**
   * When the body last left the top of a rep.
   *
   * This is what a rep's duration is measured against. The previous version
   * measured the gap since the last COUNTED rep, which meant one rejected rep
   * made the next one look slow enough to reject as well — the counter would
   * sit at 29 and only move after several extra movements. Timing the actual
   * cycle removes that feedback loop entirely.
   */
  let cycleStartedAt = 0;
  /** Frames spent below the confidence floor, used to report lost tracking. */
  let lowFrames = 0;
  /** Consecutive frames a threshold has been satisfied. */
  let heldFrames = 0;
  /** When the bottom of the current rep was reached. */
  let bottomAt = 0;
  /** The extreme angle reached during the current rep. */
  let deepest = 180;
  /** Whether the bottom of the current rep had the right shape. */
  let bottomFormOk = true;
  /** Deepest point reached while descending but before the bottom was met. */
  let attemptDeepest = 180;
  /** True once the target has been hit, after which counting stops. */
  let locked = false;
  /** Small rolling window, so one bad frame cannot flip the phase. */
  const window: number[] = [];

  /** How far past the top the body currently is, in degrees. */
  const travelFrom = (angle: number) =>
    inverted ? Math.abs(angle - def.downAngle) : Math.abs(def.upAngle - angle);

  /** The full range of one rep, in degrees. */
  const fullTravel = Math.abs(def.upAngle - def.downAngle) || 1;

  const idle = (over: Partial<RepReading>): RepReading => ({
    count,
    status: 'tracking',
    confidence: 0,
    angle: 180,
    phase,
    targetReached: locked,
    ...over,
  });

  return {
    /** Feed one frame of landmarks. */
    push(landmarks: Landmark[] | null, now = Date.now()): RepReading {
      if (!landmarks || landmarks.length < 33) {
        lowFrames++;
        return idle({
          status: 'no-body',
          reason: 'No body found. Step back so more of you is in frame.',
          cue: { text: 'Get into position', tone: 'dim' },
        });
      }

      const side = betterSide(landmarks, def.left, def.right);

      // Presence measured against what THIS exercise needs.
      const bodyConfidence = confidenceOf(landmarks, def.presence);

      if (bodyConfidence < 0.4) {
        lowFrames++;
        return idle({
          status: 'partial',
          confidence: bodyConfidence,
          reason: def.framingHint,
          cue: { text: 'Get into position', tone: 'dim' },
        });
      }

      if (side.confidence < def.minConfidence) {
        lowFrames++;
        // Counting is paused rather than guessed at. Inventing a rep here is
        // exactly what makes a counter untrustworthy — and it is why no cue
        // above 'dim' is ever produced from a pose this unclear.
        return idle({
          status: 'low-confidence',
          confidence: side.confidence,
          // Presence is fine but the tracked joints are unclear, which is
          // almost always the angle rather than the distance.
          reason: 'The tracked joints are partly hidden. Turn more side-on to the camera.',
          cue: { text: 'Get into position', tone: 'dim' },
        });
      }

      lowFrames = 0;

      const raw = def.measure(landmarks, side.indices);
      window.push(raw);
      if (window.length > 3) window.shift();
      const angle = window.reduce((a, b) => a + b, 0) / window.length;

      // For an inverted exercise the "down" position is the straight one, so
      // the comparisons flip rather than duplicating the state machine.
      const atBottom = inverted ? angle >= def.upAngle : angle <= def.downAngle;
      const atTop = inverted ? angle <= def.downAngle : angle >= def.upAngle;

      // Posture coaching is computed from the same trusted frame, and is
      // deliberately null whenever the landmarks it needs are unclear.
      const postureWarning = def.posture ? def.posture(landmarks) : null;

      // Wait for a clean top position before counting anything.
      if (!calibrated) {
        if (atTop) {
          calibrated = true;
          phase = 'top';
          heldFrames = 0;
          cycleStartedAt = now;
        }
        return idle({
          confidence: side.confidence,
          angle,
          reason: 'Get into the starting position to begin.',
          cue: { text: 'Get into position', tone: 'dim' },
        });
      }

      // Target met: hold the number exactly where it is. Extra movements
      // after the last rep must never push a 30-rep set to 31.
      if (locked) {
        return idle({
          confidence: side.confidence,
          angle,
          cue: { text: 'Set complete', tone: 'good' },
        });
      }

      // A threshold must be held for consecutive frames before the phase
      // changes. One stray frame at the boundary was enough to register a
      // rep that never happened.
      if (phase === 'top' && atBottom) {
        heldFrames++;
        if (heldFrames >= HOLD_FRAMES) {
          phase = 'bottom';
          heldFrames = 0;
          bottomAt = now;
          deepest = angle;
          // Judged here, at the deepest point, where a lunge and a squat
          // actually look different.
          bottomFormOk = !def.formCheck || def.formCheck(landmarks);
        }
      } else if (phase === 'bottom' && atTop) {
        heldFrames++;
        if (heldFrames >= HOLD_FRAMES) {
          // How far the body actually travelled this cycle, which separates a
          // genuine rep from a small movement that happened to cross a line.
          const travelled = travelFrom(deepest);

          const deepEnough = travelled >= MIN_TRAVEL_DEGREES;
          // The duration of THIS rep, top to top — not the gap since the last
          // one that happened to be accepted.
          const cycleMs = now - cycleStartedAt;
          const slowEnough = cycleMs >= def.minRepMs;
          // Right depth, wrong exercise: rejected rather than counted.
          const rightShape = !def.formCheck || bottomFormOk;
          // A bottom position held for a plausible moment. Passing straight
          // through in two frames is a tracking glitch, not a repetition.
          const realPause = now - bottomAt >= MIN_BOTTOM_MS;

          phase = 'top';
          heldFrames = 0;
          // The next rep is timed from here, whatever the verdict on this one.
          cycleStartedAt = now;
          attemptDeepest = angle;

          if (deepEnough && slowEnough && realPause && rightShape) {
            count++;
            if (target > 0 && count >= target) locked = true;

            return {
              count,
              status: 'tracking',
              confidence: side.confidence,
              angle,
              phase,
              targetReached: locked,
              cue: {
                text: locked ? 'Set complete' : postureWarning || 'Good rep',
                tone: postureWarning && !locked ? 'warn' : 'good',
              },
              event: { kind: 'rep', count },
            };
          }

          // Rejected. The user is told which of the four gates failed, in the
          // order that matters most, rather than being left to guess why the
          // number did not move.
          const why = !rightShape
            ? def.formHint || 'That was not the right movement'
            : !deepEnough
              ? 'Rep incomplete — go lower'
              : !realPause
                ? 'Move slower — pause at the bottom'
                : 'Move slower';

          return {
            count,
            status: 'tracking',
            confidence: side.confidence,
            angle,
            phase,
            targetReached: false,
            reason: !rightShape ? def.formHint : undefined,
            cue: { text: why, tone: 'bad' },
            event: { kind: 'rejected', reason: why, count },
          };
        }
      } else {
        // Moved away from the threshold before it was confirmed.
        heldFrames = 0;
        if (phase === 'bottom') {
          // Track the extreme actually reached while down.
          deepest = inverted ? Math.max(deepest, angle) : Math.min(deepest, angle);
        } else {
          // Descending but not yet deep enough. Remembering how far they got
          // is what makes "go lower" a fact rather than a guess.
          attemptDeepest = inverted
            ? Math.max(attemptDeepest, angle)
            : Math.min(attemptDeepest, angle);

          // Back at the top having dipped most of the way without ever
          // reaching depth: a genuine half rep, worth saying so. The bar is
          // set high enough that a wobble at the top cannot trigger it.
          if (atTop && travelFrom(attemptDeepest) >= fullTravel * 0.35) {
            attemptDeepest = angle;
            cycleStartedAt = now;
            return {
              count,
              status: 'tracking',
              confidence: side.confidence,
              angle,
              phase,
              targetReached: false,
              cue: { text: 'Rep incomplete — go lower', tone: 'bad' },
              event: { kind: 'rejected', reason: 'Go lower', count },
            };
          }

          if (atTop) {
            attemptDeepest = angle;
            cycleStartedAt = now;
          }
        }
      }

      /* ---- steady-state coaching ---- */

      let cue: RepCue;
      if (postureWarning) {
        cue = { text: postureWarning, tone: 'warn' };
      } else if (phase === 'bottom') {
        cue = { text: 'Now press back up', tone: 'good' };
      } else {
        // 0 at the top of the movement, 1 at full depth.
        const depth = travelFrom(angle) / fullTravel;
        cue =
          depth > 0.3
            ? { text: 'Go lower', tone: 'warn' }
            : { text: 'Good form', tone: 'good' };
      }

      return {
        count,
        status: 'tracking',
        confidence: side.confidence,
        angle,
        phase,
        targetReached: false,
        cue,
      };
    },

    /**
     * Manual correction, for the cases detection cannot cover.
     *
     * Respects the target the same way detection does, so tapping "Count one"
     * cannot push a 30-rep set to 31 either.
     */
    adjust(delta: number): number {
      const ceiling = target > 0 ? target : Number.MAX_SAFE_INTEGER;
      count = Math.max(0, Math.min(ceiling, count + delta));
      locked = target > 0 && count >= target;
      return count;
    },

    reset(): void {
      count = 0;
      phase = 'top';
      calibrated = false;
      cycleStartedAt = 0;
      heldFrames = 0;
      bottomAt = 0;
      deepest = 180;
      attemptDeepest = 180;
      locked = false;
      lowFrames = 0;
      window.length = 0;
    },

    get value(): number {
      return count;
    },

    get reachedTarget(): boolean {
      return locked;
    },
  };
}

export type RepEngine = ReturnType<typeof createRepEngine>;
