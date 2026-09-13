import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Check, Camera, CameraOff } from 'lucide-react';
import { Exercise, Difficulty } from '../../lib/bodyTraining';
import { createRepCounter, loadDetector, RepExercise } from '../../lib/repCounter';
import { soundFx } from '../../utils/audio';

interface Props {
  exercise: Exercise;
  difficulty: Difficulty;
  onClose: () => void;
  onComplete: (setsDone: number) => void;
}

type Phase = 'ready' | 'working' | 'resting' | 'done';

/**
 * Running a single exercise.
 *
 * Counting is manual by default and the camera is opt-in. A counter that
 * miscounts is worse than no counter, so the tap control is always present
 * even while the camera is running.
 */
export const ExerciseRunner: React.FC<Props> = ({
  exercise,
  difficulty,
  onClose,
  onComplete,
}) => {
  const target = exercise.targets[difficulty];

  const [phase, setPhase] = useState<Phase>('ready');
  const [setsDone, setSetsDone] = useState(0);
  const [reps, setReps] = useState(0);
  const [restLeft, setRestLeft] = useState(0);
  const [heldSeconds, setHeldSeconds] = useState(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'loading' | 'live' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const counterRef = useRef<ReturnType<typeof createRepCounter> | null>(null);
  const detectorRef = useRef<any>(null);

  /** Hold exercises count seconds rather than reps. */
  useEffect(() => {
    if (phase !== 'working' || exercise.metric !== 'hold') return;

    const id = window.setInterval(() => {
      setHeldSeconds((s) => {
        if (s + 1 >= target) {
          soundFx.playSuccess();
          finishSet();
          return 0;
        }
        return s + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
    // finishSet is stable for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exercise.metric, target]);

  /** Rest countdown between sets. */
  useEffect(() => {
    if (phase !== 'resting') return;

    const id = window.setInterval(() => {
      setRestLeft((s) => {
        if (s <= 1) {
          soundFx.playClick();
          setPhase('working');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [phase]);

  /** Release the camera on unmount — a live stream keeps the light on. */
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const finishSet = () => {
    const next = setsDone + 1;
    setSetsDone(next);
    setReps(0);
    setHeldSeconds(0);
    counterRef.current?.reset();

    // Three sets is a reasonable session; more is the user's choice via
    // another round rather than an endless default.
    if (next >= 3) {
      setPhase('done');
      soundFx.playSuccess();
      return;
    }

    setRestLeft(exercise.restSeconds);
    setPhase('resting');
  };

  const startCamera = async () => {
    setCameraState('loading');
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Several megabytes, so this is where the wait happens.
      detectorRef.current = await loadDetector();
      counterRef.current = createRepCounter(exercise.id as RepExercise);

      setCameraState('live');
      setCameraOn(true);
      loop();
    } catch (err: any) {
      console.error('Camera failed:', err);
      streamRef.current?.getTracks().forEach((t) => t.stop());

      setCameraState('error');
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was declined. Counting by tap still works.'
          : 'Could not start the camera. Counting by tap still works.'
      );
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setCameraState('idle');
  };

  const loop = () => {
    const run = async () => {
      if (!detectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(run);
        return;
      }

      try {
        const poses = await detectorRef.current.estimatePoses(videoRef.current);
        if (poses?.[0]?.keypoints && counterRef.current) {
          const state = counterRef.current.push(poses[0].keypoints);
          setReps((prev) => {
            if (state.count > prev) soundFx.playClick();
            return state.count;
          });
        }
      } catch {
        /* a dropped frame is not worth stopping the session for */
      }

      rafRef.current = requestAnimationFrame(run);
    };

    rafRef.current = requestAnimationFrame(run);
  };

  const progress = exercise.metric === 'hold' ? heldSeconds / target : reps / target;

  return (
    <div className="fixed inset-0 z-[95] bg-[var(--ground)] flex flex-col">
      <div className="flex items-center gap-3 p-3 border-b border-[var(--rule)]">
        <button onClick={onClose} aria-label="Stop workout" className="icon-btn shrink-0">
          <X className="w-4 h-4 shrink-0" />
        </button>
        <p className="t-section min-w-0 flex-1 truncate">{exercise.name}</p>
        <span className="t-meta shrink-0">Set {Math.min(setsDone + 1, 3)} of 3</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {phase === 'ready' && (
          <div className="max-w-sm mx-auto text-center">
            <p className="t-sub leading-relaxed">{exercise.how}</p>
            <p className="t-meta mt-3 leading-relaxed">{exercise.cue}</p>

            <p className="t-figure mt-7" style={{ fontSize: 40 }}>
              {target}
            </p>
            <p className="t-meta mt-1">
              {exercise.metric === 'hold' ? 'seconds per set' : 'reps per set'}
            </p>

            <button onClick={() => setPhase('working')} className="btn-lg w-full mt-7">
              Start
            </button>
            <button onClick={onClose} className="btn-text mt-3">
              Not now
            </button>
          </div>
        )}

        {phase === 'working' && (
          <div className="max-w-sm mx-auto text-center">
            {cameraOn && (
              <div
                className="relative rounded-xl overflow-hidden mb-5"
                style={{ border: '1px solid var(--rule)' }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full"
                  style={{ transform: 'scaleX(-1)', maxHeight: 220, objectFit: 'cover' }}
                />
                <span
                  className="absolute top-2 left-2 t-meta px-2 py-0.5 rounded"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                >
                  Counting
                </span>
              </div>
            )}

            <p className="t-figure" style={{ fontSize: 64, lineHeight: 1 }}>
              {exercise.metric === 'hold' ? target - heldSeconds : reps}
            </p>
            <p className="t-meta mt-2">
              {exercise.metric === 'hold' ? 'seconds left' : `of ${target} reps`}
            </p>

            <div
              className="h-1.5 rounded-full overflow-hidden mt-5"
              style={{ background: 'var(--surface-sunk)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, progress * 100)}%`,
                  background: 'var(--done)',
                }}
              />
            </div>

            {exercise.metric === 'reps' && (
              <>
                <div className="flex items-center justify-center gap-3 mt-7">
                  <button
                    onClick={() => {
                      counterRef.current?.adjust(-1);
                      setReps((r) => Math.max(0, r - 1));
                    }}
                    aria-label="One fewer"
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
                  >
                    <Minus className="w-5 h-5 shrink-0" />
                  </button>

                  <button
                    onClick={() => {
                      soundFx.playClick();
                      counterRef.current?.adjust(1);
                      setReps((r) => r + 1);
                    }}
                    className="flex-1 h-14 rounded-xl text-[15px] font-semibold"
                    style={{
                      background: 'color-mix(in oklab, var(--signal) 20%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--signal) 45%, var(--rule))',
                      color: 'var(--signal-ink)',
                    }}
                  >
                    <Plus className="w-5 h-5 shrink-0 inline mr-1.5" />
                    Count one
                  </button>
                </div>

                {/* Camera is opt-in and never replaces the tap control. */}
                <button
                  onClick={cameraOn ? stopCamera : startCamera}
                  disabled={cameraState === 'loading'}
                  className="btn-text mt-4 flex items-center gap-1.5 mx-auto"
                >
                  {cameraOn ? (
                    <CameraOff className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {cameraState === 'loading'
                    ? 'Starting camera…'
                    : cameraOn
                      ? 'Turn off camera'
                      : 'Count with camera'}
                </button>

                {cameraError && <p className="t-meta eb-warn mt-2">{cameraError}</p>}

                {!cameraOn && cameraState === 'idle' && (
                  <p className="t-meta mt-2">Runs on your phone. Nothing is uploaded.</p>
                )}
              </>
            )}

            <button onClick={finishSet} className="btn-quiet w-full mt-5">
              <Check className="w-4 h-4 shrink-0 inline mr-1.5" />
              Set done
            </button>
          </div>
        )}

        {phase === 'resting' && (
          <div className="max-w-sm mx-auto text-center pt-10">
            <p className="t-meta">Rest</p>
            <p className="t-figure mt-2" style={{ fontSize: 64, lineHeight: 1 }}>
              {restLeft}
            </p>
            <p className="t-meta mt-2">seconds</p>

            <button onClick={() => setPhase('working')} className="btn-quiet w-full mt-8">
              Skip rest
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="max-w-sm mx-auto text-center pt-10">
            <Check className="w-12 h-12 shrink-0 mx-auto" style={{ color: 'var(--done)' }} />
            <p className="t-title mt-4">Done</p>
            <p className="t-sub mt-2">
              {setsDone} sets of {exercise.name.toLowerCase()}.
            </p>

            <button
              onClick={() => {
                stopCamera();
                onComplete(setsDone);
              }}
              className="btn-lg w-full mt-8"
            >
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
