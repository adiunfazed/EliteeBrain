import React, { useEffect, useState, useRef } from 'react';

interface StatNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  duration?: number; // ms
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const StatNumber: React.FC<StatNumberProps> = ({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  className = '',
  duration = 420, // default slow duration
  size = 'md',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    if (startValue === endValue) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const sizeClasses = {
    sm: 'text-sm font-mono',
    md: 'text-lg font-mono font-bold',
    lg: 'text-2xl font-mono font-bold',
    hero: 'text-5.5rem font-display font-extrabold tracking-tight text-ink leading-none',
  }[size];

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <span className={`tabular-nums inline-block font-mono ${sizeClasses} ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
