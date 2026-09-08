import React from 'react';

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}

export const Eyebrow: React.FC<EyebrowProps> = ({ children, className = '', mono = true }) => {
  return (
    <span
      className={`text-[11px] font-bold uppercase text-ink-muted tracking-[0.09em] ${
        mono ? 'font-mono' : 'font-sans'
      } ${className}`}
    >
      {children}
    </span>
  );
};
