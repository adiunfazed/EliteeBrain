/**
 * Camera rep counting.
 *
 * Uses on-device pose detection — the video never leaves the phone, and no
 * frame is uploaded anywhere.
 *
 * Counting works on the vertical travel of one tracked joint rather than on
 * joint angles. Angles need both sides of a limb visible, which fails the
 * moment a phone is propped on the floor at an angle; vertical travel of the
 * shoulders or hips survives a bad camera position, which is the normal case.
 *
 * The model is large, so everything here loads on demand. Nothing is imported
 * at module scope.
 */

export type RepExercise = 'pushups' | 'squats' | 'lunges' | 'glute-bridge' | 'calf-raises';

/** Which joint to follow, and how far it must travel to count. */
interface Tracking {
  /** Keypoint names, tried in order until one is visible. */
  joints: string[];
  /**
   * Minimum travel as a fraction of body height. Too low counts a twitch,
   * too high misses a real but shallow rep.
   */
  threshold: number;
}

const TRACKING: Record<RepExercise, Tracking> = {
  // The shoulders drop furthest and stay visible from almost any angle.
  pushups: { joints: ['left_shoulder', 'right_shoulder'], threshold: 0.08 },
  // Hips travel most in a squat; shoulders move too but can be masked by lean.
  squats: { joints: ['left_hip', 'right_hip'], threshold: 0.1 },
  lunges: { joints: ['left_hip', 'right_hip'], threshold: 0.08 },
  'glute-bridge': { joints: ['left_hip', 'right_hip'], threshold: 0.06 },
  // Small movement, so a tighter threshold — and ankles are often cropped.
  'calf-raises': { joints: ['left_shoulder', 'right_shoulder'], threshold: 0.03 },
};

export interface RepState {
  count: number;
  /** 'up' or 'down', so a rep is only counted on a full cycle. */
  phase: 'up' | 'down';
  /** 0–1. Low means the pose is unclear and counting may be unreliable. */
  confidence: number;
}

/**
 * A stateful rep counter.
 *
 * Kept as a closure rather than a class so the calling component holds one
 * reference and never worries about re-binding.
 */
export function createRepCounter(exercise: RepExercise) {
  const config = TRACKING[exercise] || TRACKING.squats;

  let count = 0;
  let phase: 'up' | 'down' = 'up';
  // Highest and lowest positions seen, forming the movement envelope.
  let topY = Infinity;
  let bottomY = -Infinity;
  let lowConfidenceFrames = 0;

  /** Smoothed position, so a single noisy frame cannot trigger a rep. */
  const recent: number[] = [];

  return {
    /** Feed one detected pose. Returns the current state. */
    push(keypoints: any[]): RepState {
      const byName = new Map<string, any>();
      for (const k of keypoints || []) byName.set(k.name || k.part, k);

      // Average whichever tracked joints are visible.
      const found = config.joints
        .map((n) => byName.get(n))
        .filter((k) => k && (k.score ?? 0) > 0.3);

      if (found.length === 0) {
        lowConfidenceFrames++;
        return { count, phase, confidence: Math.max(0, 1 - lowConfidenceFrames / 30) };
      }

      lowConfidenceFrames = 0;
      const y = found.reduce((n, k) => n + k.y, 0) / found.length;

      // Body height, used to make the threshold independent of how far the
      // person is from the camera.
      const nose = byName.get('nose');
      const ankle = byName.get('left_ankle') || byName.get('right_ankle');
      const span =
        nose && ankle && (ankle.score ?? 0) > 0.2
          ? Math.abs(ankle.y - nose.y)
          : 300;

      recent.push(y);
      if (recent.length > 3) recent.shift();
      const smooth = recent.reduce((a, b) => a + b, 0) / recent.length;

      // Running envelope of the movement, so thresholds adapt to how deep
      // this person actually goes rather than assuming a textbook range.
      if (smooth < topY) topY = smooth;
      if (smooth > bottomY) bottomY = smooth;

      // Contract slowly toward the current position. Without this, one deep
      // rep at the start sets a range the person cannot reach once tired,
      // and the counter quietly stops.
      topY += (smooth - topY) * 0.01;
      bottomY += (smooth - bottomY) * 0.01;

      const range = bottomY - topY;
      const travel = config.threshold * span;

      // Nothing meaningful has happened yet.
      if (range < travel) {
        return { count, phase, confidence: 1 };
      }

      // Hysteresis: cross 70% of the way down to enter the bottom, and back
      // above 30% to complete. Two separate thresholds stop a joint hovering
      // near one line from counting repeatedly.
      const downLine = topY + range * 0.6;
      const upLine = topY + range * 0.3;

      if (phase === 'up' && smooth > downLine) {
        phase = 'down';
      } else if (phase === 'down' && smooth < upLine) {
        count++;
        phase = 'up';

        // Let the envelope decay toward the current position, so a set that
        // gets gradually shallower still counts rather than silently stopping.
        topY = topY * 0.8 + smooth * 0.2;
        bottomY = bottomY * 0.8 + smooth * 0.2;
      }

      return { count, phase, confidence: 1 };
    },

    /**
     * Manual correction.
     *
     * The envelope has to observe a new depth before it can adapt, so the
     * first rep after form changes noticeably — usually the first tired rep
     * of a set — can be missed. That is inherent to adaptive counting rather
     * than a defect, and this is the remedy.
     */
    adjust(delta: number): number {
      count = Math.max(0, count + delta);
      return count;
    },

    reset(): void {
      count = 0;
      phase = 'up';
      topY = Infinity;
      bottomY = -Infinity;
      recent.length = 0;
    },

    get value(): number {
      return count;
    },
  };
}

/**
 * Load the detector.
 *
 * Imported dynamically: the model is several megabytes and most sessions
 * never open the camera, so this must not sit in the main bundle.
 */
export async function loadDetector(): Promise<any> {
  const tf = await import('@tensorflow/tfjs');
  const poseDetection = await import('@tensorflow-models/pose-detection');

  await tf.ready();

  // Lightning over Thunder: roughly three times faster and accurate enough
  // for counting vertical travel, which matters on a mid-range phone.
  return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  });
}
