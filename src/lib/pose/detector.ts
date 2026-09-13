import { Landmark } from './landmarks';

/**
 * The pose detector.
 *
 * Loaded on demand — the model is several megabytes and most sessions never
 * open the camera, so none of this may sit in the startup bundle.
 *
 * Wrapped behind a small interface so both Body Training and, later, the Wake
 * Challenge use the same engine rather than growing a second implementation.
 */

export type DetectorState =
  | 'idle'
  | 'starting-camera'
  | 'loading-model'
  | 'ready'
  | 'error';

export interface PoseDetector {
  /** Landmarks for the current video frame, or null when nobody is found. */
  detect(video: HTMLVideoElement, timestampMs: number): Landmark[] | null;
  close(): void;
}

let cachedResolver: any = null;

/**
 * Create a landmarker.
 *
 * The WASM bundle and model are fetched from a CDN on first use. Both are
 * cached by the browser afterwards, so the wait happens once.
 */
export async function createPoseDetector(): Promise<PoseDetector> {
  const vision = await import('@mediapipe/tasks-vision');

  if (!cachedResolver) {
    cachedResolver = await vision.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
    );
  }

  const landmarker = await vision.PoseLandmarker.createFromOptions(cachedResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      // GPU where available; the CPU path is far too slow for live counting.
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    // Raised from the defaults: a weak detection produces jittery landmarks,
    // which is worse for counting than no detection at all.
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  return {
    detect(video, timestampMs) {
      try {
        const result = landmarker.detectForVideo(video, timestampMs);
        const pose = result?.landmarks?.[0];
        if (!pose || pose.length < 33) return null;

        return pose.map((p: any) => ({
          x: p.x,
          y: p.y,
          z: p.z ?? 0,
          visibility: p.visibility ?? 0,
        }));
      } catch {
        // A dropped frame must not end the session.
        return null;
      }
    },

    close() {
      try {
        landmarker.close();
      } catch {
        /* already closed */
      }
    },
  };
}
