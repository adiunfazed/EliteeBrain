import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showSubtext?: boolean;
  className?: string;
}

/**
 * The EliteLife mark.
 *
 * Served as a transparent PNG at three sizes so a header badge doesn't download
 * a 512px asset. The source art was on a black plate; alpha is derived from
 * luminance so the purple glow fades out instead of showing a hard rectangle.
 */
export const EliteLifeLogo: React.FC<Props> = ({
  size = 'md',
  showSubtext = true,
  className = '',
}) => {
  const sizeMap = {
    sm: { symbol: 'h-8', text: 'text-[10px]', gap: 'gap-1', src: '/brand/elitelife-logo-96.png' },
    md: { symbol: 'h-11', text: 'text-xs', gap: 'gap-1.5', src: '/brand/elitelife-logo-96.png' },
    lg: { symbol: 'h-16', text: 'text-sm', gap: 'gap-2', src: '/brand/elitelife-logo-192.png' },
    xl: { symbol: 'h-24', text: 'text-base', gap: 'gap-2.5', src: '/brand/elitelife-logo-192.png' },
    hero: {
      symbol: 'h-32 sm:h-40',
      text: 'text-xl sm:text-2xl',
      gap: 'gap-3.5',
      src: '/brand/elitelife-logo.png',
    },
  };

  const current = sizeMap[size];

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${current.gap} ${className}`}
    >
      <img
        src={current.src}
        alt="EliteLife"
        draggable={false}
        className={`${current.symbol} w-auto object-contain transition-transform duration-300 hover:scale-105 drop-shadow-[0_6px_20px_rgba(147,51,234,0.35)]`}
      />

      {showSubtext && (
        <div className="flex flex-col items-center leading-none">
          <span
            className={`${current.text} font-mono font-black tracking-[0.2em] text-[var(--ink)] uppercase`}
          >
            Elite<span className="text-[#A855F7]">Life</span>
          </span>
        </div>
      )}
    </div>
  );
};
