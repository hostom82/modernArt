import { useState, type ReactNode } from 'react';

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export function Accordion({ title, children, defaultOpen = false, badge }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-line/70 bg-slate2/40">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate2/70"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-cream">
          {title}
          {badge}
        </span>
        <span
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
      </button>
      {open && (
        <div className="border-t border-line/60 px-4 py-3.5 text-sm leading-relaxed text-cream/80 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
}
