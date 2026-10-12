import React from 'react';

interface VTextLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textSize?: string;
}

/**
 * vText mark: an ink "v" written over a highlighter stroke —
 * the document (ink) and the assistant (highlighter) in one glyph.
 */
export const VTextLogo: React.FC<VTextLogoProps> = ({
  className = '',
  size = 20,
  showText = false,
  textSize = 'text-sm'
}) => {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" className="fill-ink" />
        <path d="M6 21.5 L26 18.5 L26.6 23 L6.6 26 Z" className="fill-marker" />
        <path
          d="M9 8.5 L15.2 22.5 C15.5 23.2 16.5 23.2 16.8 22.5 L23 8.5"
          className="stroke-paper"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showText && (
        <span className={`font-semibold tracking-[-0.02em] text-ink ${textSize}`}>vText</span>
      )}
    </div>
  );
};
