import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showSubtext?: boolean;
  className?: string;
}

export const EliteBrainLogo: React.FC<Props> = ({
  size = 'md',
  showSubtext = true,
  className = '',
}) => {
  const sizeMap = {
    sm: { symbol: 'h-8 w-auto', text: 'text-[10px]', gap: 'gap-1' },
    md: { symbol: 'h-11 w-auto', text: 'text-xs', gap: 'gap-1.5' },
    lg: { symbol: 'h-16 w-auto', text: 'text-sm', gap: 'gap-2' },
    xl: { symbol: 'h-24 w-auto', text: 'text-base', gap: 'gap-2.5' },
    hero: { symbol: 'h-32 sm:h-40 w-auto', text: 'text-xl sm:text-2xl', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex flex-col items-center select-none ${currentSize.gap} ${className}`}>
      {/* Official EB Brain Logo SVG matching reference image with smooth curved edges */}
      <div className="relative flex items-center justify-center">
        <svg
          className={`${currentSize.symbol} transition-transform duration-300 hover:scale-105 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]`}
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Soft White Metallic Silver Gradient for E and B outer frame */}
            <linearGradient id="eb_metallic_white" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            {/* Indigo Dark Fill for Left Brain Hemisphere */}
            <linearGradient id="eb_indigo_brain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#312E81" />
              <stop offset="50%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            {/* Glowing Circuit Lines Gradient */}
            <linearGradient id="eb_circuit_glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#5C6CF2" />
            </linearGradient>

            {/* Drop Shadow Filter for Depth */}
            <filter id="eb_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#5C6CF2" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* LEFT "E" ENCLOSURE FRAME - Smooth Curvy Edges & Rounded Corner Joints */}
          <path
            d="M 85 20
               H 165
               C 178 20 188 28 193 40
               C 196 48 192 56 182 56
               H 112
               C 98 56 88 66 88 80
               V 90
               C 88 98 94 104 102 104
               H 162
               C 172 104 178 112 178 120
               C 178 128 172 136 162 136
               H 102
               C 94 136 88 142 88 150
               V 160
               C 88 174 98 184 112 184
               H 182
               C 192 184 196 192 193 200
               C 188 212 178 220 165 220
               H 85
               C 45 220 20 195 20 155
               V 85
               C 20 45 45 20 85 20 Z"
            fill="url(#eb_metallic_white)"
          />

          {/* RIGHT "B" ENCLOSURE FRAME - Smooth Curved Lobe Curves & Soft Corners */}
          <path
            d="M 235 20
               H 315
               C 355 20 380 45 380 82
               C 380 102 368 116 350 120
               C 370 125 382 142 382 165
               C 382 202 355 220 315 220
               H 235
               C 222 220 212 212 207 200
               C 204 192 208 184 218 184
               H 288
               C 302 184 312 174 312 160
               C 312 146 302 136 288 136
               H 238
               C 228 136 222 128 222 120
               C 222 112 228 104 238 104
               H 288
               C 302 104 312 94 312 80
               C 312 66 302 56 288 56
               H 218
               C 208 56 204 48 207 40
               C 212 28 222 20 235 20 Z"
            fill="url(#eb_metallic_white)"
          />

          {/* CENTER GAP: HYBRID BRAIN EMBLEM */}
          <g filter="url(#eb_glow)">
            {/* Vertical Center Separator Line */}
            <line x1="200" y1="36" x2="200" y2="204" stroke="#5C6CF2" strokeWidth="3" strokeLinecap="round" />

            {/* LEFT HEMISPHERE (Digital Circuit Brain) */}
            <path
              d="M 198 42 
                 C 174 42 152 58 150 82 
                 C 140 94 140 114 150 126 
                 C 142 140 150 162 168 174 
                 C 184 184 198 184 198 184 Z"
              fill="url(#eb_indigo_brain)"
              stroke="#5C6CF2"
              strokeWidth="3"
            />
            {/* Circuit Traces */}
            <path
              d="M 198 64 H 176 L 162 78 H 152 
                 M 198 94 H 168 L 156 106 H 144 
                 M 198 124 H 170 L 158 136 H 148 
                 M 198 154 H 178 L 166 166 H 156"
              fill="none"
              stroke="url(#eb_circuit_glow)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Glowing Circuit Node Dots */}
            <circle cx="152" cy="78" r="4.5" fill="#A5B4FC" />
            <circle cx="144" cy="106" r="4.5" fill="#818CF8" />
            <circle cx="148" cy="136" r="4.5" fill="#5C6CF2" />
            <circle cx="156" cy="166" r="4" fill="#818CF8" />
            <circle cx="176" cy="64" r="3.5" fill="#A5B4FC" />
            <circle cx="170" cy="124" r="3.5" fill="#818CF8" />

            {/* RIGHT HEMISPHERE (Organic White Brain Folds) */}
            <path
              d="M 202 42 
                 C 226 42 248 58 250 82 
                 C 260 94 260 114 250 126 
                 C 258 140 250 162 232 174 
                 C 216 184 202 184 202 184 Z"
              fill="none"
              stroke="#F8FAFC"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Inner Brain Lobe Folds */}
            <path
              d="M 202 68 C 224 68 236 82 224 96 
                 M 202 100 C 232 100 240 118 226 134 
                 M 202 138 C 228 138 234 156 216 168"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {/* TYPOGRAPHY MATCHING REFERENCE LOGO */}
      {showSubtext && (
        <div className="flex items-center tracking-[0.4em] font-mono font-black uppercase text-xs sm:text-sm">
          <span className="text-[#F4F6F8]">ELITE</span>
          <span className="w-3 sm:w-4 inline-block" />
          <span className="text-[#5C6CF2] flex items-center">
            BR<span className="inline-block px-[1px]">Λ</span>IN
          </span>
        </div>
      )}
    </div>
  );
};

