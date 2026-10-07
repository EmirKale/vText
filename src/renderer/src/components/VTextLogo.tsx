import React from 'react';

interface VTextLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textSize?: string;
}

export const VTextLogo: React.FC<VTextLogoProps> = ({
  className = '',
  size = 20,
  showText = false,
  textSize = 'text-sm'
}) => {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        <defs>
          <linearGradient id="vTextGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="0.5" stopColor="#6366F1" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="vTextBgGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.2" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* Rounded badge background */}
        <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#vTextBgGrad)" stroke="url(#vTextGrad)" strokeWidth="1.2" strokeOpacity="0.4" />

        {/* Document subtle lines */}
        <line x1="18" y1="14" x2="30" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-30" />
        <line x1="18" y1="19" x2="26" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-30" />

        {/* Dynamic Stylized 'V' */}
        <path
          d="M13 16L22.6 33.8C23.2 34.9 24.8 34.9 25.4 33.8L35 16"
          stroke="url(#vTextGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glowing tip accent */}
        <circle cx="35" cy="16" r="2.2" fill="#38BDF8" />
      </svg>

      {showText && (
        <span className={`font-semibold tracking-tight ${textSize} text-content-light dark:text-content-dark`}>
          <span className="text-accent font-bold">v</span>Text
        </span>
      )}
    </div>
  );
};
