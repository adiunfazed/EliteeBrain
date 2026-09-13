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
    minRepMs: 700,
  },

  // Knee angle. 90 is a deep squat; 160 is standing.
  squats: {
    left: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
    right: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
    presence: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee],
    framingHint: 'Step back so your hips and knees are both in frame.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 110,
    upAngle: 160,
    minConfidence: 0.6,
    minRepMs: 800,
  },

  // Front knee, same joints as a squat but a shallower bottom, since a lunge
  // rarely reaches squat depth on the tracked leg.
  lunges: {
    left: [LM.leftHip, LM.leftKnee, LM.leftAnkle],
    right: [LM.rightHip, LM.rightKnee, LM.rightAnkle],
    presence: [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee],
    framingHint: 'Turn side-on to the camera so the front knee is visible.',
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 120,
    upAngle: 160,
    minConfidence: 0.55,
    minRepMs: 900,
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
    minRepMs: 800,
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
    minRepMs: 600,
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
}

/**
 * A rep counter for one exercise.
 *
 * Stateful and deliberately not a React hook, so the render loop can feed it
 * every frame without causing re-renders on frames that change nothing.
 */
export function createRepEngine(exercise: PoseExerciseId) {
  const def = DEFINITIONS[exercise] || DEFINITIONS.squats;
  const inverted = INVERTED.includes(exercise);

  let count = 0;
  let phase: 'top' | 'bottom' = 'top';
  let lastRepAt = 0;
  /** Frames spent below the confidence floor, used to report lost tracking. */
  let lowFrames = 0;
  /** Consecutive frames a threshold has been satisfied. */
  let heldFrames = 0;
  /** When the bottom of the current rep was reached. */
  let bottomAt = 0;
  /** The extreme angle reached during the current rep. */
  let deepest = 180;
  /** Small rolling window, so one bad frame cannot flip the phase. */
  const window: number[] = [];

  return {
    /** Feed one frame of landmarks. */
    push(landmarks: Landmark[] | null, now = Date.now()): RepReading {
      if (!landmarks || landmarks.length < 33) {
        lowFrames++;
        return {
          count,
          status: 'no-body',
          confidence: 0,
          angle: 180,
          phase,
          reason: 'No body found. Step back so more of you is in frame.',
        };
      }

      const side = betterSide(landmarks, def.left, def.right);

      // Presence measured against what THIS exercise needs.
      const bodyConfidence = confidenceOf(landmarks, def.presence);

      if (bodyConfidence < 0.4) {
        lowFrames++;
        return {
          count,
          status: 'partial',
          confidence: bodyConfidence,
          angle: 180,
          phase,
          reason: def.framingHint,
        };
      }

      if (side.confidence < def.minConfidence) {
        lowFrames++;
        // Counting is paused rather than guessed at. Inventing a rep here is
        // exactly what makes a counter untrustworthy.
        return {
          count,
          status: 'low-confidence',
          confidence: side.confidence,
          angle: 180,
          phase,
          // Presence is fine but the tracked joints are unclear, which is
          // almost always the angle rather than the distance.
          reason: 'The tracked joints are partly hidden. Turn more side-on to the camera.',
        };
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
        }
      } else if (phase === 'bottom' && atTop) {
        heldFrames++;
        if (heldFrames >= HOLD_FRAMES) {
          const elapsed = now - lastRepAt;
          // How far the body actually travelled this cycle, which separates a
          // genuine rep from a small movement that happened to cross a line.
          const travelled = inverted
            ? Math.abs(deepest - def.downAngle)
            : Math.abs(def.upAngle - deepest);

          const deepEnough = travelled >= MIN_TRAVEL_DEGREES;
          const slowEnough = elapsed >= def.minRepMs;
          // A bottom position held for a plausible moment. Passing straight
          // through in two frames is a tracking glitch, not a repetition.
          const realPause = now - bottomAt >= MIN_BOTTOM_MS;

          if (deepEnough && slowEnough && realPause) {
            count++;
            lastRepAt = now;
          }

          phase = 'top';
          heldFrames = 0;
        }
      } else {
        // Moved away from the threshold before it was confirmed.
        heldFrames = 0;
        if (phase === 'bottom') {
          // Track the extreme actually reached while down.
          deepest = inverted ? Math.max(deepest, angle) : Math.min(deepest, angle);
        }
      }

      return { count, status: 'tracking', confidence: side.confidence, angle, phase };
    },

    /** Manual correction, for the cases detection cannot cover. */
    adjust(delta: number): number {
      count = Math.max(0, count + delta);
      return count;
    },

    reset(): void {
      count = 0;
      phase = 'top';
      lastRepAt = 0;
      heldFrames = 0;
      bottomAt = 0;
      deepest = 180;
      window.length = 0;
    },

    get value(): number {
      return count;
    },
  };
}

export type RepEngine = ReturnType<typeof createRepEngine>;
