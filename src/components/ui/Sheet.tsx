import React from 'react';

interface SheetProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  sunk?: boolean;
}

export const Sheet: React.FC<SheetProps> = ({
  children,
  className = '',
  onClick,
  sunk = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`${
        sunk ? 'bg-surface-sunk' : 'bg-surface'
      } border border-rule rounded-[2px] transition-colors ${
        onClick ? 'cursor-pointer hover:bg-surface-sunk' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
