import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertTriangle, Hand } from 'lucide-react';
import { createPoseDetector, PoseDetector } from '../../lib/pose/detector';
import {
  createRepEngine,
  CueTone,
  PoseExerciseId,
  RepEvent,
  TrackingStatus,
} from '../../lib/pose/repEngine';
import { drawSkeleton } from '../../lib/pose/drawSkeleton';
import { soundFx } from '../../utils/audio';

interface Props {
  exercise: PoseExerciseId;
  /**
   * Reps to reach. The engine stops counting here, so a 30-rep set can never
   * read 31 however many extra movements the camera sees.
   */
  target?: number;
  /** Fired when the engine counts a rep. */
  onRep: (count: number) => void;
  /** Fired once per accepted or rejected movement. */
  onFeedback?: (event: RepEvent) => void;
  /** Fired when the user gives up on the camera. */
  onManualMode: () => void;
  /**
   * Counting only happens while this is true.
   *
   * The stream and the model stay alive when it is false, so resting between
   * sets does not cost a second camera permission prompt and a second model
   * load — but movements during rest are not counted toward anything.
   */
  active?: boolean;
  /** Change this to start a fresh set. The count returns to zero. */
  resetKey?: number | string;
}

/**
 * How long a coaching line keeps its place, in milliseconds.
 *
 * Long enough to read while moving. Anything shorter and the text simply
 * flickers, which is what made the feedback useless rather than helpful.
 */
const CUE_HOLD_MS = 1400;

/** How long a green or red rep verdict stays up. */
const VERDICT_HOLD_MS = 1600;

const CUE_COLOR: Record<CueTone, string> = {
  good: '#6EE7B7',
  warn: '#FFB020',
  bad: '#FF6B7E',
  dim: '#CFCAD9',
};

type Stage = 'idle' | 'starting' | 'loading-model' | 'live' | 'error';

/** What the user is told, per detection status. */
const STATUS_TEXT: Record<TrackingStatus, { label: string; tone: 'good' | 'warn' | 'dim' }> = {
  'no-body': { label: 'Position yourself in frame', tone: 'dim' },
  partial: { label: 'Move into frame', tone: 'warn' },
  'low-confidence': { label: 'Low confidence — counting paused', tone: 'warn' },
  ready: { label: 'Ready', tone: 'good' },
  tracking: { label: 'Body detected', tone: 'good' },
};

/**
 * Camera rep counting.
 *
 * Permission is requested only after an explicit tap, and "counting" is never
 * claimed until the feed is live, the model has loaded and a body is actually
 * detected. Showing a counting state while detection is dead is the specific
 * behaviour that made the previous version untrustworthy.
 */
export const CameraView: React.FC<Props> = ({
  exercise,
  target = 0,
  onRep,
  onFeedback,
  onManualMode,
  active = true,
  resetKey,
}) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [status, setStatus] = useState<TrackingStatus>('no-body');
  const [confidence, setConfidence] = useState(0);
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cue, setCue] = useState<{ text: string; tone: CueTone } | null>(null);
  /** A green or red wash over the preview after each movement. */
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  /** How far through the steady hold that arms the counter. */
  const [arming, setArming] = useState<{ state: string; progress: number }>({
    state: 'finding',
    progress: 0,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const engineRef = useRef<ReturnType<typeof createRepEngine> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCountRef = useRef(0);
  /**
   * Last time the status strip was refreshed.
   *
   * The detector runs at the display refresh rate. Pushing confidence — a
   * float that changes every single frame — into React state at 60Hz meant a
   * full re-render per frame, which is what made the skeleton stutter. The
   * numbers are read by a human, so a few updates a second is plenty.
   */
  const lastUiAt = useRef(0);
  const flashTimer = useRef<number | null>(null);
  /**
   * Until when the message on screen must not be replaced.
   *
   * The engine produces a reading every frame, and simply showing the newest
   * one meant the text changed several times a second — unreadable, and it is
   * why the coaching felt like noise. A cue now holds its place long enough
   * to actually be read, and a rep verdict outranks ordinary coaching.
   */
  const cueHeldUntil = useRef(0);
  /** Props the render loop reads. Refs, because the loop starts once. */
  const onRepRef = useRef(onRep);
  const onFeedbackRef = useRef(onFeedback);
  const activeRef = useRef(active);
  onRepRef.current = onRep;
  onFeedbackRef.current = onFeedback;
  activeRef.current = active;

  /** Release everything. A live stream leaves the camera light on. */
  const teardown = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    detectorRef.current?.close();
    detectorRef.current = null;
  };

  useEffect(() => teardown, []);

  /**
   * A new set starts from zero.
   *
   * The engine is reset rather than rebuilt, so the camera, the model and the
   * skeleton carry on uninterrupted between sets — the user grants permission
   * and waits for the model exactly once per exercise.
   */
  useEffect(() => {
    if (resetKey === undefined) return;
    engineRef.current?.reset();
    lastCountRef.current = 0;
    setCue(null);
    setFlash(null);
  }, [resetKey]);

  const start = async () => {
    setStage('starting');
    setError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          // Enough resolution for landmarks without taxing a mid-range phone.
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('NO_VIDEO');

      video.srcObject = stream;
      await video.play();

      // Wait for real dimensions, or the first frames are detected against a
      // zero-sized video and nothing is ever found.
      if (video.videoWidth === 0) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady);
        });
      }

      setStage('loading-model');
      detectorRef.current = await createPoseDetector();
      engineRef.current = createRepEngine(exercise, target);
      lastCountRef.current = 0;
      lastUiAt.current = 0;

      setStage('live');
      loop();
    } catch (err: any) {
      console.error('Camera start failed:', err);
      teardown();
      setStage('error');

      const name = err?.name || err?.message;
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was declined.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : name === 'UNSUPPORTED'
              ? 'This browser does not support camera access.'
              : 'Could not start the camera.'
      );
    }
  };

  const loop = () => {
    const run = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;
      const engine = engineRef.current;

      if (!video || !canvas || !detector || !engine || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(run);
        return;
      }

      // Match the canvas to the video, or the overlay drifts from the body.
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Resting: the stream and the model stay loaded, but pose inference is
      // the expensive part and nothing is being counted, so it is skipped
      // rather than run against a hidden canvas.
      if (!activeRef.current) {
        rafRef.current = requestAnimationFrame(run);
        return;
      }

      const landmarks = detector.detect(video, performance.now());
      const reading = engine.push(landmarks);

      // Throttled: a human reads these, and a re-render per frame is what
      // made the overlay stutter.
      const now = performance.now();
      if (now - lastUiAt.current > 150) {
        lastUiAt.current = now;
        setStatus(reading.status);
        setConfidence(reading.confidence);
        setReason(reading.reason ?? null);
        setArming({ state: reading.armState, progress: reading.armProgress });

        // Ordinary coaching only replaces what is on screen once the previous
        // message has had its time.
        if (reading.cue && now >= cueHeldUntil.current) {
          setCue(reading.cue);
          cueHeldUntil.current = now + CUE_HOLD_MS;
        }
      }

      // A movement was judged. Reported exactly once, whichever way it went.
      if (reading.event) {
        const good = reading.event.kind === 'rep';

        if (good) {
          lastCountRef.current = reading.count;
          soundFx.playClick();
          onRepRef.current(reading.count);
        }

        // A judged movement always shows, throttle or not, and outranks the
        // hold on whatever coaching line was up — this is the one message
        // that must never be swallowed.
        if (reading.cue) {
          setCue(reading.cue);
          cueHeldUntil.current = now + VERDICT_HOLD_MS;
        }

        setFlash(good ? 'good' : 'bad');
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), VERDICT_HOLD_MS);

        onFeedbackRef.current?.(reading.event);
      } else if (reading.count !== lastCountRef.current) {
        // Belt and braces: the count is the source of truth even if an event
        // were ever missed.
        lastCountRef.current = reading.count;
        onRepRef.current(reading.count);
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawSkeleton(
          ctx,
          landmarks,
          canvas.width,
          canvas.height,
          reading.status === 'tracking'
        );
      }

      rafRef.current = requestAnimationFrame(run);
    };

    rafRef.current = requestAnimationFrame(run);
  };

  const statusInfo = STATUS_TEXT[status];

  return (
    <div className="w-full">
      {/* The preview is always mounted: attaching a stream to a video that
          does not exist yet is a common way for the feed never to appear. */}
      <div
        className="relative rounded-xl overflow-hidden w-full"
        style={{
          background: 'var(--surface-sunk)',
          border: '1px solid var(--rule)',
          aspectRatio: '4 / 3',
          display: stage === 'live' ? 'block' : stage === 'idle' ? 'none' : 'block',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Rep verdict: a brief wash of colour and a matching ring. Subtle
            enough to read at the edge of vision without pulling the eye off
            the movement. */}
        {stage === 'live' && flash && (
          <span
            key={flash + lastCountRef.current}
            className="absolute inset-0 pointer-events-none rounded-xl cam-flash"
            data-tone={flash}
          />
        )}

        {/* The live assistant. Sits at the bottom of the frame so it never
            covers the body being tracked. */}
        {stage === 'live' && cue && (
          <span
            key={cue.text}
            className="absolute bottom-2.5 left-2.5 right-2.5 px-3 py-2 rounded-xl text-[14px] font-bold text-center cam-cue"
            style={{ background: 'rgba(0,0,0,0.72)', color: CUE_COLOR[cue.tone] }}
          >
            {cue.text}
          </span>
        )}

        {/* Arming. Shown as a ring filling up, so waiting for the counter to
            start reads as progress rather than as nothing happening. */}
        {stage === 'live' && arming.state === 'holding' && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 48 48" style={{ width: 62, height: 62 }}>
              <circle
                cx="24"
                cy="24"
                r="21"
                fill="rgba(0,0,0,0.45)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="3"
              />
              <circle
                cx="24"
                cy="24"
                r="21"
                fill="none"
                stroke="#6EE7B7"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 21}
                strokeDashoffset={2 * Math.PI * 21 * (1 - arming.progress)}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dashoffset 140ms linear' }}
              />
            </svg>
          </span>
        )}

        {stage === 'live' && (
          <span
            className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold"
            style={{
              background: 'rgba(0,0,0,0.62)',
              color:
                statusInfo.tone === 'good'
                  ? '#6EE7B7'
                  : statusInfo.tone === 'warn'
                    ? '#FFB020'
                    : '#CFCAD9',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  statusInfo.tone === 'good'
                    ? '#6EE7B7'
                    : statusInfo.tone === 'warn'
                      ? '#FFB020'
                      : '#CFCAD9',
              }}
            />
            {statusInfo.label}
          </span>
        )}

        {(stage === 'starting' || stage === 'loading-model') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                border: '2px solid var(--rule)',
                borderTopColor: 'var(--signal)',
              }}
            />
            <p className="t-meta">
              {stage === 'starting' ? 'Starting camera…' : 'Loading pose model…'}
            </p>
          </div>
        )}
      </div>

      {stage === 'idle' && (
        <button
          onClick={start}
          className="w-full min-h-[58px] rounded-xl flex items-center justify-center gap-2.5 text-[16px] font-bold"
          style={{
            background:
              'linear-gradient(160deg, color-mix(in oklab, var(--signal) 45%, var(--surface)), color-mix(in oklab, var(--signal) 20%, var(--surface)))',
            border: '1px solid color-mix(in oklab, var(--signal) 55%, var(--rule))',
            color: '#fff',
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.12) inset',
          }}
        >
          <Camera className="w-5 h-5 shrink-0" />
          Count reps with camera
        </button>
      )}

      {stage === 'idle' && (
        <p className="t-meta mt-2 text-center">
          Runs entirely on your phone. Nothing is uploaded.
        </p>
      )}

      {stage === 'error' && (
        <div
          className="rounded-xl p-3.5 mt-3"
          style={{
            background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))',
            border: '1px solid color-mix(in oklab, var(--warn) 35%, var(--rule))',
          }}
        >
          <p className="text-[14px] font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 eb-warn" />
            Detection unavailable
          </p>
          <p className="t-meta mt-1">{error}</p>

          <div className="flex items-center gap-2 mt-3">
            <button onClick={start} className="btn-quiet flex-1">
              Try again
            </button>
            <button onClick={onManualMode} className="btn-lg flex-1">
              <Hand className="w-4 h-4 shrink-0 inline mr-1.5" />
              Count manually
            </button>
          </div>
        </div>
      )}

      {/* The actual problem, not just that there is one. */}
      {stage === 'live' && reason && status !== 'tracking' && (
        <p className="t-meta mt-2.5 leading-relaxed" style={{ color: 'var(--warn)' }}>
          {reason}
        </p>
      )}

      {stage === 'live' && (
        <div className="flex items-center gap-2 mt-3">
          <div
            className="h-1 rounded-full overflow-hidden flex-1"
            style={{ background: 'var(--surface-sunk)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.round(confidence * 100)}%`,
                background: confidence > 0.6 ? 'var(--done)' : 'var(--warn)',
              }}
            />
          </div>
          <button onClick={onManualMode} className="btn-text shrink-0">
            Count manually
          </button>
        </div>
      )}
    </div>
  );
};
