import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

const STYLES = {
  error: 'border-red-500/50 bg-red-950/85 text-red-100',
  info: 'border-line bg-charcoal/95 text-cream',
  success: 'border-gold/50 bg-[#2a2415]/95 text-goldsoft',
};

const ICONS = { error: '⚠', info: 'ℹ', success: '✓' };

export function ToastHost() {
  const toast = useGameStore((s) => s.toast);
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 2600);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        key={toast.id}
        className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border px-4 py-2.5 text-sm shadow-2xl animate-fadeUp ${STYLES[toast.kind]}`}
        role="status"
      >
        <span className="mt-px shrink-0 text-base leading-none">{ICONS[toast.kind]}</span>
        <span className="leading-snug">{toast.text}</span>
        <button className="ml-1 shrink-0 opacity-60 transition hover:opacity-100" onClick={dismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}
