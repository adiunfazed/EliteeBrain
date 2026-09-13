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
    measure: (lm, s) => angleAt(lm[s[0]], lm[s[1]], lm[s[2]]),
    downAngle: 125,
    upAngle: 160,
    minConfidence: 0.55,
    minRepMs: 800,
  },

  // Ankle travel is too small for a reliable angle, so this one uses the
  // vertical rise of the heel above the foot instead.
  'calf-raises': {
    left: [LM.leftHeel, LM.leftFootIndex, LM.leftAnkle],
    right: [LM.rightHeel, LM.rightFootIndex, LM.rightAnkle],
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
  /** Small rolling window, so one bad frame cannot flip the phase. */
  const window: number[] = [];

  return {
    /** Feed one frame of landmarks. */
    push(landmarks: Landmark[] | null, now = Date.now()): RepReading {
      if (!landmarks || landmarks.length < 33) {
        lowFrames++;
        return { count, status: 'no-body', confidence: 0, angle: 180, phase };
      }

      const side = betterSide(landmarks, def.left, def.right);

      // Whole-body presence, separate from the exercise-specific joints: a
      // person half out of frame should be told to move, not that their form
      // is poor.
      const bodyConfidence = confidenceOf(landmarks, [
        LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip,
      ]);

      if (bodyConfidence < 0.4) {
        lowFrames++;
        return { count, status: 'partial', confidence: bodyConfidence, angle: 180, phase };
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

      if (phase === 'top' && atBottom) {
        phase = 'bottom';
      } else if (phase === 'bottom' && atTop) {
        // Debounce: a full cycle faster than this is a tracking artefact
        // rather than a repetition anyone actually performed.
        if (now - lastRepAt >= def.minRepMs) {
          count++;
          lastRepAt = now;
        }
        phase = 'top';
      }

      return {
        count,
        status: 'tracking',
        confidence: side.confidence,
        angle,
        phase,
      };
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
      window.length = 0;
    },

    get value(): number {
      return count;
    },
  };
}

export type RepEngine = ReturnType<typeof createRepEngine>;
