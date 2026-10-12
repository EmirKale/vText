import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Prevent closing via Esc / backdrop (e.g. while generating) */
  locked?: boolean;
  bodyClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  icon,
  width = 560,
  footer,
  children,
  locked = false,
  bodyClassName = 'px-6 py-5'
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locked, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <header className="flex items-start gap-3 px-6 pt-5 pb-4">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-ui text-muted">{description}</p>}
          </div>
          <button onClick={onClose} disabled={locked} className="icon-btn -mr-2 -mt-1" aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-line bg-chrome/60">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

/** Pill-style option chips used for small enumerations (tone, length, style). */
export function Chips<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; hint?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`h-8 px-3 rounded-full border text-ui transition-colors ${
              active
                ? 'border-accent bg-accent/[0.1] text-accent font-medium'
                : 'border-line text-ink hover:border-ink/30'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
