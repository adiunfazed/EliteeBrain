import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'var(--ink)',
  width = 70,
  height = 20,
}) => {
  if (!data || data.length === 0) {
    return <div className="text-[10px] font-mono text-ink-muted">No data</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1 || 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(' ');

  const lastPoint = data[data.length - 1];
  const lastX = width - 2;
  const lastY = height - 2 - ((lastPoint - min) / range) * (height - 4);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
};
