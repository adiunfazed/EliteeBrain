import { Landmark, SKELETON, JOINTS } from './landmarks';

/**
 * Draw the skeleton over the video.
 *
 * White joints with a thin purple rim and purple connecting lines, per the
 * design. The glow is applied only while tracking is reliable, so the overlay
 * itself communicates whether detection is working — a skeleton that looks
 * identical when confidence has collapsed would be misleading.
 */

const PURPLE = '#7A63E0';
const PURPLE_BRIGHT = '#AC9BEE';

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[] | null,
  width: number,
  height: number,
  tracking: boolean
): void {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks || landmarks.length < 33) return;

  const px = (lm: Landmark) => ({ x: lm.x * width, y: lm.y * height });

  // Only draw what is actually visible. Drawing a low-visibility landmark
  // produces a limb flailing at the edge of frame, which reads as a bug.
  const visible = (i: number) => (landmarks[i]?.visibility ?? 0) > 0.5;

  ctx.save();

  if (tracking) {
    ctx.shadowColor = PURPLE;
    ctx.shadowBlur = 8;
  }

  // Connections first, so joints sit on top of the lines.
  ctx.strokeStyle = tracking ? PURPLE_BRIGHT : 'rgba(172,155,238,0.35)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (const [a, b] of SKELETON) {
    if (!visible(a) || !visible(b)) continue;

    const p1 = px(landmarks[a]);
    const p2 = px(landmarks[b]);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Joints: white fill, thin purple rim.
  ctx.shadowBlur = tracking ? 6 : 0;

  for (const i of JOINTS) {
    if (!visible(i)) continue;

    const p = px(landmarks[i]);

    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = tracking ? '#FFFFFF' : 'rgba(255,255,255,0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
