import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface Props {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

type Stage = 'starting' | 'live' | 'review' | 'error';

/**
 * Live photo capture.
 *
 * Runs in the app rather than handing off to the native camera, so the shot
 * can be reviewed and retaken before it is sent. A native handoff returns
 * whatever was taken with no chance to check it, which matters when the
 * answer depends on the photo being readable.
 *
 * Falls back to the system camera if getUserMedia is unavailable — some
 * in-app browsers block it outright.
 */
export const PhotoCapture: React.FC<Props> = ({ onCapture, onCancel }) => {
  const [stage, setStage] = useState<Stage>('starting');
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /** Stop the stream, or the camera light stays on after leaving. */
  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => stop, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setStage('starting');
      setError(null);
      stop();

      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        setStage('live');
      } catch (err: any) {
        if (cancelled) return;
        stop();
        setStage('error');
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was declined.'
            : err?.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Could not open the camera.'
        );
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  const take = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    soundFx.playClick();

    setShot(canvas.toDataURL('image/jpeg', 0.9));
    setStage('review');
    // The stream is released here: a frozen frame is already captured, and
    // holding the camera open through review wastes battery.
    stop();
  };

  const use = () => {
    if (!shot) return;

    // Back to a File so it goes through exactly the same path as a gallery
    // pick — one code path for both sources.
    const binary = atob(shot.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    onCapture(
      new File([bytes], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
    );
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      <div className="flex items-center gap-3 p-3 shrink-0">
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          aria-label="Cancel"
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        >
          <X className="w-4 h-4 shrink-0" />
        </button>

        <p className="text-[15px] font-bold min-w-0 flex-1" style={{ color: '#fff' }}>
          {stage === 'review' ? 'Use this photo?' : 'Take a photo'}
        </p>

        {stage === 'live' && (
          <button
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            aria-label="Switch camera"
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative flex items-center justify-center">
        {stage === 'review' && shot ? (
          <img src={shot} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-w-full max-h-full object-contain"
            style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
          />
        )}

        {stage === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff' }}
            />
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Starting camera…
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-8 h-8 shrink-0" style={{ color: '#FFB020' }} />
            <p className="text-[15px] font-semibold" style={{ color: '#fff' }}>
              {error}
            </p>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              You can pick a photo from your gallery instead.
            </p>
            <button
              onClick={() => {
                stop();
                onCancel();
              }}
              className="mt-2 px-4 min-h-[42px] rounded-xl text-[14px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            >
              Go back
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 p-6 flex items-center justify-center gap-4">
        {stage === 'live' && (
          <button
            onClick={take}
            aria-label="Take photo"
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{ background: '#fff', border: '4px solid rgba(255,255,255,0.35)' }}
          >
            <Camera className="w-7 h-7 shrink-0" style={{ color: '#111' }} />
          </button>
        )}

        {stage === 'review' && (
          <>
            <button
              onClick={() => {
                setShot(null);
                setFacing((f) => f); // re-triggers the effect and restarts the stream
                setStage('starting');
                void (async () => {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: facing },
                    audio: false,
                  });
                  streamRef.current = stream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                  }
                  setStage('live');
                })().catch(() => setStage('error'));
              }}
              className="px-5 min-h-[50px] rounded-xl text-[15px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}
            >
              Retake
            </button>

            <button
              onClick={use}
              className="px-6 min-h-[50px] rounded-xl text-[15px] font-bold flex items-center gap-2"
              style={{ background: 'var(--signal)', color: '#fff' }}
            >
              <Check className="w-4 h-4 shrink-0" />
              Use photo
            </button>
          </>
        )}
      </div>
    </div>
  );
};
