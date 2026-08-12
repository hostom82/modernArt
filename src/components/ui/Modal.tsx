import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** 宽度档位 */
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div
        className={`panel relative z-10 flex max-h-[86vh] w-full ${SIZES[size]} flex-col animate-popIn`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-3.5">
            <h2 className="brush-title text-lg font-semibold text-cream">{title}</h2>
            <button
              className="rounded-md px-2 py-1 text-muted transition hover:bg-slate2 hover:text-cream"
              onClick={onClose}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        )}
        <div className="scroll-soft flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line/70 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
