import React from 'react';

interface MeterProps {
  level: number; // 0 - 10 or higher
  maxLevel?: number;
  domainColor?: string;
  className?: string;
}

export const Meter: React.FC<MeterProps> = ({
  level,
  maxLevel = 10,
  domainColor,
  className = '',
}) => {
  const steps = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {steps.map((step) => {
        const isFilled = step <= level;
        return (
          <div
            key={step}
            className="w-2.5 h-3 rounded-[1px] transition-colors duration-140"
            style={{
              backgroundColor: isFilled
                ? domainColor || 'var(--ink)'
                : 'var(--surface-sunk)',
              border: '1px solid var(--rule)',
            }}
          />
        );
      })}
    </div>
  );
};
