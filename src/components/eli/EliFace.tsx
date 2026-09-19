import React from 'react';

interface Props {
  size?: number;
  /** Eyes brighten when ELI has something to say. */
  alert?: boolean;
  className?: string;
}

/**
 * ELI's face: a small box robot.
 *
 * Drawn rather than taken from an icon set, so it is ELI's own mark and stays
 * sharp at every size. Everything uses currentColor except the eyes, which
 * carry the one accent — so the face reads as a face at 20px, where detail
 * is gone and only the eyes are left.
 */
export const EliFace: React.FC<Props> = ({ size = 24, alert = false, className }) => (
  <svg
    viewBox="0 0 32 32"
    width={size}
    height={size}
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {/* Antenna */}
    <line x1="16" y1="3.5" x2="16" y2="7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="3.2" r="1.9" fill={alert ? 'var(--signal-ink)' : 'currentColor'} />

    {/* Ears */}
    <rect x="2.5" y="14" width="3" height="7" rx="1.4" fill="currentColor" opacity="0.7" />
    <rect x="26.5" y="14" width="3" height="7" rx="1.4" fill="currentColor" opacity="0.7" />

    {/* Head — the box */}
    <rect x="5.5" y="8" width="21" height="19" rx="5.5" stroke="currentColor" strokeWidth="2.2" />

    {/* Visor */}
    <rect x="9" y="12" width="14" height="8" rx="3.2" fill="currentColor" opacity="0.14" />

    {/* Eyes */}
    <rect x="11.2" y="14.2" width="3.2" height="3.8" rx="1.6" fill={alert ? 'var(--signal-ink)' : 'currentColor'} />
    <rect x="17.6" y="14.2" width="3.2" height="3.8" rx="1.6" fill={alert ? 'var(--signal-ink)' : 'currentColor'} />

    {/* Mouth */}
    <path d="M12.8 23h6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
