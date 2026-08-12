import { useEffect, useState } from 'react';
import { cx, money } from '@/utils/format';

interface Props {
  /** 允许的最小出价 */
  min: number;
  /** 允许的最大出价（通常是玩家现金） */
  max: number;
  /** 初始值 */
  initial?: number;
  /** 步进快捷键的基准 */
  steps?: number[];
  onSubmit: (amount: number) => void;
  submitLabel: string;
  /** 次要操作，例如「放弃」 */
  secondary?: { label: string; onClick: () => void; danger?: boolean };
  disabled?: boolean;
  /** 提示文案 */
  hint?: string;
}

export function BidControls({
  min,
  max,
  initial,
  steps = [1, 5, 10, 25],
  onSubmit,
  submitLabel,
  secondary,
  disabled,
  hint,
}: Props) {
  const start = Math.min(Math.max(initial ?? min, min), Math.max(min, max));
  const [value, setValue] = useState(start);
  const [text, setText] = useState(String(start));

  // 外部条件变化（例如别人加价了）时重置到新的最低价
  useEffect(() => {
    const v = Math.min(Math.max(initial ?? min, min), Math.max(min, max));
    setValue(v);
    setText(String(v));
  }, [min, max, initial]);

  const canBid = max >= min;
  const valid = canBid && value >= min && value <= max;

  function commit(v: number) {
    const clamped = Math.min(Math.max(Math.round(v), min), max);
    setValue(clamped);
    setText(String(clamped));
  }

  function onText(raw: string) {
    const cleaned = raw.replace(/[^\d]/g, '');
    setText(cleaned);
    const n = Number(cleaned);
    if (cleaned !== '' && Number.isFinite(n)) setValue(n);
  }

  return (
    <div className="space-y-2.5">
      {/* 数值区 */}
      <div className="flex items-center gap-2">
        <button
          className="btn-ghost h-10 w-10 shrink-0 !px-0 text-lg"
          onClick={() => commit(value - 1)}
          disabled={disabled || !canBid || value <= min}
          aria-label="减少 1"
        >
          −
        </button>

        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            €
          </span>
          <input
            value={text}
            onChange={(e) => onText(e.target.value)}
            onBlur={() => commit(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid && !disabled) onSubmit(value);
            }}
            inputMode="numeric"
            disabled={disabled || !canBid}
            className={cx(
              'h-10 w-full rounded-lg border bg-ink/70 px-7 text-center font-mono text-lg font-bold outline-none transition',
              valid ? 'border-line/70 text-gold focus:border-gold' : 'border-red-500/50 text-red-300',
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            k
          </span>
        </div>

        <button
          className="btn-ghost h-10 w-10 shrink-0 !px-0 text-lg"
          onClick={() => commit(value + 1)}
          disabled={disabled || !canBid || value >= max}
          aria-label="增加 1"
        >
          +
        </button>
      </div>

      {/* 快捷步进 */}
      <div className="flex gap-1.5">
        {steps.map((s) => (
          <button
            key={s}
            className="btn-ghost flex-1 !px-1 py-1 text-[11px]"
            onClick={() => commit(value + s)}
            disabled={disabled || !canBid || value + s > max}
          >
            +{s}
          </button>
        ))}
        <button
          className="btn-ghost flex-1 !px-1 py-1 text-[11px]"
          onClick={() => commit(max)}
          disabled={disabled || !canBid || value === max}
          title={`全部 ${money(max)}`}
        >
          全押
        </button>
      </div>

      {/* 提交 */}
      <div className="flex gap-2">
        {secondary && (
          <button
            className={cx(secondary.danger ? 'btn-danger' : 'btn-ghost', 'flex-1')}
            onClick={secondary.onClick}
            disabled={disabled}
          >
            {secondary.label}
          </button>
        )}
        <button
          className="btn-gold flex-[1.6]"
          onClick={() => onSubmit(value)}
          disabled={disabled || !valid}
        >
          {submitLabel} {valid ? money(value) : ''}
        </button>
      </div>

      {hint && <p className="text-center text-[11px] text-muted">{hint}</p>}
      {!canBid && (
        <p className="text-center text-[11px] text-red-400">
          现金不足，无法出到 {money(min)}
        </p>
      )}
    </div>
  );
}
