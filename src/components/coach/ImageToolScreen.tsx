import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Image as ImageIcon, RotateCcw, AlertTriangle } from 'lucide-react';
import { getIdToken } from '../../lib/firebase';
import { soundFx } from '../../utils/audio';
import { CoachTool } from './CoachTools';

interface Props {
  tool: CoachTool;
  onBack: () => void;
}

/** Largest image the server accepts. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Shared screen for the photo-based Coach tools.
 *
 * One component for all four: the flow is identical and only the prompt
 * differs, so four near-copies would be four places for a bug to hide.
 *
 * The camera is requested only when the user taps the camera button — never
 * on mount, and never for the gallery option. A permission prompt that
 * appears before the user has asked for anything is the fastest way to get
 * permanently denied.
 */
export const ImageToolScreen: React.FC<Props> = ({ tool, onBack }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /**
   * Downscale before upload.
   *
   * A modern phone photo is 3–8MB, which is slow on Indian mobile data and
   * larger than the model needs. 1280px is ample for this kind of analysis.
   */
  const shrink = (file: File): Promise<{ base64: string; mime: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not read that image'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image'));
      };

      img.src = url;
    });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setError(null);
    setResult(null);

    if (file.size > MAX_BYTES * 4) {
      setError('That photo is very large. Try a different one.');
      return;
    }

    setBusy(true);

    try {
      const { base64, mime } = await shrink(file);
      setPreview(`data:${mime};base64,${base64}`);

      const token = await getIdToken();
      if (!token) {
        setError('Sign in to use Coach tools.');
        setBusy(false);
        return;
      }

      const res = await fetch('/api/coach/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tool: tool.id, image: base64, mimeType: mime }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could not analyse that photo.');
        setBusy(false);
        return;
      }

      setResult(data.text);
      soundFx.playSuccess();
    } catch (err) {
      console.error('Image tool failed:', err);
      setError('Something went wrong reading that photo.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const Icon = tool.icon;

  return (
    <div className="max-w-lg mx-auto pb-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back" className="icon-btn">
          <ArrowLeft className="w-4 h-4 shrink-0" />
        </button>
        <span className="t-meta flex-1 min-w-0">Coach</span>
      </div>

      <div className="flex items-center gap-3.5 mt-6">
        <span
          className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${tool.accent} 16%, transparent)` }}
        >
          <Icon className="w-6 h-6 shrink-0" style={{ color: tool.accent }} />
        </span>
        <div className="min-w-0">
          <h1 className="t-title">{tool.name}</h1>
        </div>
      </div>

      <p className="t-sub mt-3 leading-relaxed">{tool.blurb}</p>

      {/* What makes a usable photo. A bad angle is the commonest reason these
          come back with nothing worth reading. */}
      {!result && !busy && (
        <p className="t-meta mt-3 leading-relaxed">
          {tool.id === 'food'
            ? 'Shoot from above, with the whole plate in frame and good light.'
            : tool.id === 'physique'
              ? 'Stand side-on or front-on, full body in frame, fitted clothing.'
              : 'Full length, straight on, in good light.'}
        </p>
      )}

      {/* Preview */}
      {preview && (
        <motion.img
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          src={preview}
          alt=""
          className="w-full rounded-2xl mt-6 max-h-[300px] object-cover"
          style={{ border: '1px solid var(--rule)' }}
        />
      )}

      {busy && (
        <div className="flex items-center gap-3 mt-6">
          <span
            className="w-5 h-5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: 'var(--rule)', borderTopColor: tool.accent }}
          />
          <p className="t-sub">Looking at it…</p>
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl p-4 mt-6 flex items-start gap-3"
          style={{
            background: 'color-mix(in oklab, var(--warn) 10%, transparent)',
            border: '1px solid color-mix(in oklab, var(--warn) 35%, var(--rule))',
          }}
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 eb-warn mt-0.5" />
          <p className="t-sub flex-1 min-w-0">{error}</p>
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 mt-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
        >
          <p className="t-body whitespace-pre-wrap leading-relaxed">{result}</p>
          <p className="t-meta mt-4">
            A photo shows limited information. Treat this as a starting point, not a verdict.
          </p>
        </motion.div>
      )}

      {/* Inputs. `capture` opens the camera directly; without it the same
          control offers the gallery — so permission is only ever requested
          when the user chose the camera specifically. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-2.5 mt-7">
        {result ? (
          <button onClick={reset} className="btn-quiet flex-1">
            <RotateCcw className="w-4 h-4 shrink-0" />
            Try another
          </button>
        ) : (
          <>
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="btn-lg flex-1"
            >
              <Camera className="w-4 h-4 shrink-0" />
              Take photo
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              disabled={busy}
              className="btn-quiet flex-1"
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              Choose
            </button>
          </>
        )}
      </div>

      <p className="t-sub text-center mt-5 leading-relaxed">
        Photos are analysed and discarded. Nothing is stored.
      </p>
    </div>
  );
};
