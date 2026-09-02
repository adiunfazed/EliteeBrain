import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Download, X, Check } from 'lucide-react';
import { tierFor, tierLabel } from '../lib/tiers';

interface Props {
  displayName: string;
  careerXp: number;
  streakDays: number;
  tasksThisWeek: number;
  focusMinutesThisWeek: number;
  onClose: () => void;
}

/**
 * Weekly summary, made to be shared.
 *
 * Rendered to a canvas rather than screenshotted so the image is clean at any
 * screen size, and so nothing private (email, other users, real task names)
 * can leak into a picture someone posts publicly.
 */
export const ShareCard: React.FC<Props> = ({
  displayName,
  careerXp,
  streakDays,
  tasksThisWeek,
  focusMinutesThisWeek,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const tier = tierFor(careerXp);

  /** Draw the card at 2x for a crisp image on high-density screens. */
  const draw = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#12101C');
    bg.addColorStop(1, '#0B0D12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Accent wash
    const glow = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.7);
    glow.addColorStop(0, 'rgba(124, 92, 255, 0.30)');
    glow.addColorStop(1, 'rgba(124, 92, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'left';

    ctx.fillStyle = '#8A93A5';
    ctx.font = 'bold 30px Inter, system-ui, sans-serif';
    ctx.fillText('ELITELIFE · THIS WEEK', 90, 140);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 76px Manrope, Inter, system-ui, sans-serif';
    ctx.fillText(displayName.slice(0, 18), 90, 240);

    ctx.fillStyle = tier.color;
    ctx.font = 'bold 40px Inter, system-ui, sans-serif';
    ctx.fillText(tierLabel(tier), 90, 305);

    // Stats. Only aggregates — never task titles, which could be private.
    const stats: [string, string][] = [
      [String(streakDays), streakDays === 1 ? 'day streak' : 'day streak'],
      [String(tasksThisWeek), 'tasks done'],
      [`${Math.round(focusMinutesThisWeek / 60)}h`, 'focused'],
      [careerXp.toLocaleString('en-IN'), 'total XP'],
    ];

    let y = 430;
    for (const [value, label] of stats) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, 90, y, W - 180, 120, 24);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 60px Manrope, Inter, system-ui, sans-serif';
      ctx.fillText(value, 130, y + 80);

      ctx.fillStyle = '#8A93A5';
      ctx.font = '500 32px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, W - 130, y + 78);
      ctx.textAlign = 'left';

      y += 140;
    }

    ctx.fillStyle = '#6B7280';
    ctx.font = '500 28px Inter, system-ui, sans-serif';
    ctx.fillText('eliteebrain.onrender.com', 90, H - 70);

    return canvas;
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const share = async () => {
    setBusy(true);
    try {
      const canvas = draw();
      if (!canvas) return;

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) return;

      const file = new File([blob], 'elitelife-week.png', { type: 'image/png' });

      // Native share where available; download everywhere else, so this works
      // on desktop rather than failing silently.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My week on EliteLife' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'elitelife-week.png';
        a.click();
        URL.revokeObjectURL(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* the user cancelled the share sheet — not an error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="t-title">Your week</h2>
            <p className="t-sub mt-1">Share it, or keep it for yourself.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#7E8899] shrink-0"
          >
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* On-screen preview of what the image will contain. */}
        <div
          className="mt-5 rounded-2xl p-5 border"
          style={{
            background:
              'linear-gradient(145deg, color-mix(in oklab, var(--signal) 20%, #12101C), #0B0D12)',
            borderColor: 'color-mix(in oklab, var(--signal) 35%, var(--rule))',
          }}
        >
          <p className="text-[11px] font-bold tracking-widest text-[#8A93A5]">
            ELITELIFE · THIS WEEK
          </p>
          <p className="t-title mt-2 break-words">{displayName}</p>
          <p className="text-[13px] font-semibold mt-1" style={{ color: tier.color }}>
            {tierLabel(tier)}
          </p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              { v: streakDays, l: 'day streak' },
              { v: tasksThisWeek, l: 'tasks done' },
              { v: `${Math.round(focusMinutesThisWeek / 60)}h`, l: 'focused' },
              { v: careerXp.toLocaleString('en-IN'), l: 'total XP' },
            ].map(({ v, l }) => (
              <div key={l} className="rounded-xl bg-white/5 p-3">
                <p className="font-display font-extrabold text-xl tabular-nums leading-none">{v}</p>
                <p className="text-[11px] text-[#8A93A5] mt-1.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <button onClick={share} disabled={busy} className="btn-lg w-full mt-5">
          {copied ? (
            <>
              <Check className="w-4 h-4 shrink-0" /> Saved
            </>
          ) : (
            <>
              {navigator.canShare ? (
                <Share2 className="w-4 h-4 shrink-0" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              {busy ? 'Preparing…' : navigator.canShare ? 'Share' : 'Download'}
            </>
          )}
        </button>

        <p className="t-sub text-center mt-3">
          Only your totals are included — no task names or personal details.
        </p>

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </div>
  );
};
