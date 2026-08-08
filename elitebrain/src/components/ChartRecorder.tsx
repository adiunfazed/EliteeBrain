import React, { useEffect, useState, useRef } from 'react';
import { UserProfile } from '../types';

interface ChartRecorderProps {
  profile: UserProfile;
  className?: string;
}

export const ChartRecorder: React.FC<ChartRecorderProps> = ({ profile, className = '' }) => {
  const [animProgress, setAnimProgress] = useState(0); // 0 to 1
  const [labelsVisible, setLabelsVisible] = useState(false);

  // Compute domain levels from modules (scale 1 to 10+, max 15)
  const mods = profile.modules;

  // Domain 1: Memory (digit-span)
  const memoryVal = Math.min(1, Math.max(0.15, ((mods['digit-span']?.level || 1) / 10)));

  // Domain 2: Focus (stroop, stillness)
  const focusVal = Math.min(
    1,
    Math.max(0.15, (((mods['stroop']?.level || 1) + (mods['stillness']?.level || 1)) / 2) / 10)
  );

  // Domain 3: Reasoning (n-back, pattern-matrix)
  const reasonVal = Math.min(
    1,
    Math.max(0.15, (((mods['n-back']?.level || 1) + (mods['pattern-matrix']?.level || 1)) / 2) / 10)
  );

  // Domain 4: Speed & Control (reaction-inhibitor, cognitive-shift, visuospatial)
  const speedVal = Math.min(
    1,
    Math.max(
      0.15,
      (((mods['reaction-inhibitor']?.level || 1) +
        (mods['cognitive-shift']?.level || 1) +
        (mods['visuospatial']?.level || 1)) /
        3) /
        10
    )
  );

  // 7-day baseline values (ghost trace, e.g., 20% lower or prior data)
  const ghostMemory = Math.max(0.1, memoryVal * 0.75);
  const ghostFocus = Math.max(0.1, focusVal * 0.75);
  const ghostReason = Math.max(0.1, reasonVal * 0.75);
  const ghostSpeed = Math.max(0.1, speedVal * 0.75);

  const cx = 140;
  const cy = 135;
  const maxR = 90;

  // Angles: Top (-90°), Right (0°), Bottom (90°), Left (180°)
  const getPoint = (val: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const r = val * maxR;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const pMemory = getPoint(memoryVal, -90);
  const pFocus = getPoint(focusVal, 0);
  const pReason = getPoint(reasonVal, 90);
  const pSpeed = getPoint(speedVal, 180);

  const gMemory = getPoint(ghostMemory, -90);
  const gFocus = getPoint(ghostFocus, 0);
  const gReason = getPoint(ghostReason, 90);
  const gSpeed = getPoint(ghostSpeed, 180);

  // Closed polygon path for current profile
  const pathD = `M ${pMemory.x} ${pMemory.y} L ${pFocus.x} ${pFocus.y} L ${pReason.x} ${pReason.y} L ${pSpeed.x} ${pSpeed.y} Z`;
  const ghostD = `M ${gMemory.x} ${gMemory.y} L ${gFocus.x} ${gFocus.y} L ${gReason.x} ${gReason.y} L ${gSpeed.x} ${gSpeed.y} Z`;

  const pathRef = useRef<SVGPathElement>(null);
  const [totalLength, setTotalLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setTotalLength(len);
    }
  }, [pathD]);

  useEffect(() => {
    let start: number | null = null;
    let frameId: number;

    const animate = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      const progress = Math.min(elapsed / 1100, 1);

      // Ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(ease);

      if (progress > 0.4 && !labelsVisible) {
        setLabelsVisible(true);
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [profile]);

  // Pen point coordinate along path based on animProgress
  const currentDrawLength = totalLength * animProgress;
  let penPoint = { x: pMemory.x, y: pMemory.y };
  if (pathRef.current && totalLength > 0) {
    try {
      const pt = pathRef.current.getPointAtLength(currentDrawLength);
      penPoint = { x: pt.x, y: pt.y };
    } catch (e) {
      penPoint = { x: pMemory.x, y: pMemory.y };
    }
  }

  return (
    <div className={`relative flex flex-col items-center justify-center p-2 bg-surface border border-rule rounded-[2px] ${className}`}>
      {/* Eyebrow / Calibration header */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-rule text-[11px] font-mono text-ink-muted">
        <span>COGNITIVE PROFILE · PEN PLOTTER</span>
        <span className="text-signal font-bold">1100MS TRACE</span>
      </div>

      <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center my-2">
        <svg viewBox="0 0 280 270" className="w-full h-full overflow-visible">
          {/* Concentric Calibration Rings */}
          {[0.25, 0.5, 0.75, 1.0].map((scale) => (
            <polygon
              key={scale}
              points={`
                ${cx},${cy - maxR * scale} 
                ${cx + maxR * scale},${cy} 
                ${cx},${cy + maxR * scale} 
                ${cx - maxR * scale},${cy}
              `}
              fill="none"
              stroke="var(--rule)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          ))}

          {/* Cross Axes */}
          <line x1={cx} y1={cy - maxR - 8} x2={cx} y2={cy + maxR + 8} stroke="var(--rule)" strokeWidth="1" />
          <line x1={cx - maxR - 8} y1={cy} x2={cx + maxR + 8} y2={cy} stroke="var(--rule)" strokeWidth="1" />

          {/* Ghost baseline trace (7-day prior) */}
          <path
            d={ghostD}
            fill="none"
            stroke="var(--ink-muted)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.45"
          />

          {/* Active Profile Trace */}
          <path
            ref={pathRef}
            d={pathD}
            fill="var(--signal)"
            fillOpacity="0.08"
            stroke="var(--signal)"
            strokeWidth="1.75"
            strokeDasharray={totalLength || 1000}
            strokeDashoffset={totalLength ? totalLength * (1 - animProgress) : 0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Pen Dot */}
          {totalLength > 0 && animProgress < 1 && (
            <g>
              <circle cx={penPoint.x} cy={penPoint.y} r="5" fill="var(--signal)" opacity="0.4" className="animate-ping" />
              <circle cx={penPoint.x} cy={penPoint.y} r="3" fill="var(--signal)" />
            </g>
          )}

          {/* Cardinal Axis Points & Domain Labels */}
          {labelsVisible && (
            <g className="transition-opacity duration-300">
              {/* Top: Working Memory */}
              <g transform={`translate(${cx}, ${cy - maxR - 16})`}>
                <text textAnchor="middle" className="fill-dom-memory font-mono text-[10px] font-bold">
                  MEMORY
                </text>
                <text textAnchor="middle" y="10" className="fill-ink-muted font-mono text-[9px]">
                  Lv. {mods['digit-span']?.level || 1}
                </text>
              </g>

              {/* Right: Attention & Focus */}
              <g transform={`translate(${cx + maxR + 22}, ${cy + 3})`}>
                <text textAnchor="start" className="fill-dom-focus font-mono text-[10px] font-bold">
                  FOCUS
                </text>
                <text textAnchor="start" y="10" className="fill-ink-muted font-mono text-[9px]">
                  Lv. {mods['stroop']?.level || 1}
                </text>
              </g>

              {/* Bottom: Pattern Reasoning */}
              <g transform={`translate(${cx}, ${cy + maxR + 24})`}>
                <text textAnchor="middle" className="fill-dom-reason font-mono text-[10px] font-bold">
                  REASONING
                </text>
                <text textAnchor="middle" y="10" className="fill-ink-muted font-mono text-[9px]">
                  Lv. {mods['n-back']?.level || 1}
                </text>
              </g>

              {/* Left: Speed & Control */}
              <g transform={`translate(${cx - maxR - 22}, ${cy + 3})`}>
                <text textAnchor="end" className="fill-dom-speed font-mono text-[10px] font-bold">
                  SPEED
                </text>
                <text textAnchor="end" y="10" className="fill-ink-muted font-mono text-[9px]">
                  Lv. {mods['reaction-inhibitor']?.level || 1}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="w-full flex items-center justify-between pt-2 border-t border-rule text-[10px] font-mono text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-signal inline-block" />
          <span>CURRENT TRACE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 border-b border-dashed border-ink-muted inline-block" />
          <span>7D BASELINE GHOST</span>
        </div>
      </div>
    </div>
  );
};
