/**
 * Landmark indices and geometry helpers.
 *
 * MediaPipe returns 33 landmarks by position in an array, so the names live
 * here rather than as magic numbers scattered through the state machines.
 */

export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** MediaPipe's per-landmark visibility, 0–1. */
  visibility?: number;
}

/** Body connections worth drawing. Face and hands add noise, not information. */
export const SKELETON: [number, number][] = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
];

/** Joints drawn as points, matching the connections above. */
export const JOINTS = [
  LM.leftShoulder, LM.rightShoulder,
  LM.leftElbow, LM.rightElbow,
  LM.leftWrist, LM.rightWrist,
  LM.leftHip, LM.rightHip,
  LM.leftKnee, LM.rightKnee,
  LM.leftAnkle, LM.rightAnkle,
];

/**
 * The angle at point B formed by A-B-C, in degrees.
 *
 * Angles rather than raw positions are what make rep detection robust: an
 * elbow bent to 80 degrees is a push-up whether the camera is close, far,
 * high or low, while a pixel distance means nothing without knowing the scale.
 */
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot = abx * cbx + aby * cby;
  const magA = Math.hypot(abx, aby);
  const magC = Math.hypot(cbx, cby);

  if (magA === 0 || magC === 0) return 180;

  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Average visibility across the landmarks an exercise depends on. */
export function confidenceOf(landmarks: Landmark[], needed: number[]): number {
  if (!landmarks || landmarks.length === 0) return 0;

  let total = 0;
  for (const i of needed) {
    total += landmarks[i]?.visibility ?? 0;
  }
  return total / needed.length;
}

/**
 * Prefer whichever side is more visible.
 *
 * Filming from an angle means one side is often partly hidden, and averaging
 * a clear joint with an occluded one produces a worse number than simply
 * using the clear one.
 */
export function betterSide(
  landmarks: Landmark[],
  left: number[],
  right: number[]
): { indices: number[]; confidence: number } {
  const l = confidenceOf(landmarks, left);
  const r = confidenceOf(landmarks, right);
  return l >= r ? { indices: left, confidence: l } : { indices: right, confidence: r };
}
