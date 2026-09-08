import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-sans font-semibold rounded-[2px] transition-all duration-140 cursor-pointer select-none touch-manipulation active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs md:text-sm px-4 py-2.5 gap-2',
    lg: 'text-sm md:text-base px-6 py-3.5 gap-2.5',
  }[size];

  const variants = {
    primary: 'bg-signal text-white hover:brightness-110 active:bg-signal/90 shadow-none border border-signal',
    secondary: 'bg-surface text-ink hover:bg-surface-sunk border border-rule',
    outline: 'bg-transparent text-ink border border-ink hover:bg-surface-sunk',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600',
    ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-sunk border border-transparent',
  }[variant];

  return (
    <button
      className={`${base} ${sizes} ${variants} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
