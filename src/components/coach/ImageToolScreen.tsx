import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Image as ImageIcon, RotateCcw, AlertTriangle } from 'lucide-react';
import { authedFetch } from '../../lib/authedFetch';
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
 * Split the model's reply into its headed sections.
 *
 * The prompts ask for ALL-CAPS headings, so anything matching that on its own
 * line starts a section. Text before the first heading is kept as an
 * unheaded block rather than dropped, in case the model ignores the format.
 */
function parseSections(text: string): { heading: string | null; body: string }[] {
  const lines = text.split('\n');
  const out: { heading: string | null; body: string }[] = [];
  let current: { heading: string | null; body: string[] } = { heading: null, body: [] };

  const isHeading = (line: string) =>
    /^[A-Z][A-Z\s]{2,40}$/.test(line.trim()) && line.trim().length > 2;

  for (const line of lines) {
    if (isHeading(line)) {
      if (current.heading || current.body.join('').trim()) {
        out.push({ heading: current.heading, body: current.body.join('\n').trim() });
      }
      current = { heading: line.trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }

  if (current.heading || current.body.join('').trim()) {
    out.push({ heading: current.heading, body: current.body.join('\n').trim() });
  }

  return out.filter((s) => s.body || s.heading);
}

interface JobUpdate {
  stage: 'queued' | 'running' | 'done' | 'failed';
  waitingAhead: number;
  result?: string | null;
  error?: string | null;
}

/**
 * Poll a job until it settles.
 *
 * Polls every second — often enough to feel live, rarely enough to be
 * negligible. Gives up after three minutes so a lost job cannot hang the
 * screen indefinitely.
 */
async function pollJob(
  jobId: string,
  token: string,
  onUpdate: (u: JobUpdate) => void
): Promise<{ result?: string | null; error?: string | null }> {
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));

    try {
      const res = await authedFetch(`/api/coach/vision/${jobId}`);

      if (!res.ok) {
        // A transient poll failure is not a job failure; keep waiting.
        if (res.status >= 500) continue;
        return { error: 'Lost track of that analysis. Please try again.' };
      }

      const data = (await res.json()) as JobUpdate;
      onUpdate(data);

      if (data.stage === 'done') return { result: data.result };
      if (data.stage === 'failed') return { error: data.error || 'That did not work.' };
    } catch {
      // Network blip mid-poll — try again on the next tick.
    }
  }

  return { error: 'This is taking unusually long. Please try again.' };
}

/** Pull "7/10" out of a rating line. */
function extractScore(body: string): number | null {
  const m = /(\d{1,2})\s*\/\s*10/.exec(body);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 10 ? n : null;
}

/** The rating line without its score, since the score is shown separately. */
function stripScore(body: string): string {
  return body.replace(/^\s*\d{1,2}\s*\/\s*10\s*[—–-]?\s*/, '').trim();
}

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
  const [elapsed, setElapsed] = useState(0);
  const [ahead, setAhead] = useState(0);
  const [stage, setStage] = useState<'queued' | 'running' | 'done' | 'failed'>('queued');
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /**
   * Downscale before upload.
   *
   * A modern phone photo is 3–8MB, which is slow on Indian mobile data and
   * larger than the model needs. 1280px is ample for this kind of analysis.
   */
  /**
   * Progress as a real figure.
   *
   * Upload is the first 15%; queueing crawls from there so a long wait still
   * visibly moves; analysis climbs to 95. It only reaches 100 when the result
   * is in hand — a bar that hits 100 and then keeps spinning is worse than
   * no bar at all.
   */
  const progressPct = (() => {
    if (stage === 'done') return 100;
    if (stage === 'queued') {
      const base = ahead > 0 ? 15 : 25;
      return Math.min(45, base + elapsed);
    }
    // Running: climb toward 95 over roughly fifteen seconds.
    return Math.min(95, 50 + elapsed * 3);
  })();

  // Elapsed counter, so a slow analysis is visibly progressing.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      setAhead(0);
      setStage('queued');
      return;
    }
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const shrink = (file: File): Promise<{ base64: string; mime: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not read that image'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
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

      const res = await authedFetch('/api/coach/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: tool.id, image: base64, mimeType: mime }),
      });

      const accepted = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(accepted?.error || `Request failed (${res.status}). Please try again.`);
        setBusy(false);
        return;
      }

      // Poll until it finishes. Progress and queue position come from the
      // server, so the bar reflects real work rather than a timer.
      const data = await pollJob(accepted.jobId, token, (update) => {
        setAhead(update.waitingAhead);
        setStage(update.stage);
      });

      if (data.error) {
        setError(data.error);
        setBusy(false);
        return;
      }

      setResult(data.result || '');
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
        <div
          className="rounded-2xl p-5 mt-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-body min-w-0">
              {stage === 'queued' && ahead > 0
                ? `You are number ${ahead + 1} in line`
                : stage === 'queued'
                  ? 'Getting in line…'
                  : 'Analysing your photo'}
            </p>
            <p className="t-figure shrink-0" style={{ fontSize: 22, color: tool.accent }}>
              {progressPct}%
            </p>
          </div>

          <div
            className="h-2 rounded-full overflow-hidden mt-3"
            style={{ background: 'var(--surface-sunk)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: tool.accent }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <p className="t-meta mt-2.5">
            {stage === 'queued' && ahead > 0
              ? `About ${Math.max(5, (ahead + 1) * 4)} seconds. Nobody is skipped — everyone gets a turn.`
              : elapsed < 12
                ? 'This usually takes a few seconds.'
                : 'Nearly there — the model is still writing.'}
          </p>
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
          className="mt-6 space-y-2.5"
        >
          {parseSections(result).map((section, i) => {
            // A rating line gets its own treatment: it is the answer people
            // came for, and burying it in a paragraph wastes it.
            const score = section.heading === 'RATING' ? extractScore(section.body) : null;

            return (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{
                  background: score !== null
                    ? `linear-gradient(150deg, color-mix(in oklab, ${tool.accent} 16%, var(--surface)), var(--surface))`
                    : 'var(--surface)',
                  border: `1px solid ${
                    score !== null
                      ? `color-mix(in oklab, ${tool.accent} 40%, var(--rule))`
                      : 'var(--rule)'
                  }`,
                }}
              >
                {section.heading && (
                  <p className="eb-label" style={score !== null ? { color: tool.accent } : undefined}>
                    {section.heading}
                  </p>
                )}

                {score !== null && (
                  <p className="t-figure mt-1.5" style={{ fontSize: 40, color: tool.accent }}>
                    {score}
                    <span className="text-[var(--ink-dim)] text-2xl">/10</span>
                  </p>
                )}

                <p className={`t-body leading-relaxed ${section.heading ? 'mt-2' : ''}`}>
                  {score !== null ? stripScore(section.body) : section.body}
                </p>
              </div>
            );
          })}

          <p className="t-meta pt-1 leading-relaxed">
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
