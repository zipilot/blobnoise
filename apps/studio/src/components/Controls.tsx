import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";

export function NumberField({ label, value, min, max, step = 0.01, onChange, disabled = false, suffix, compact = false }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (value: number) => void; disabled?: boolean; suffix?: string; compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => { setText(String(Number(value.toFixed(5)))); setError(""); }, [value]);
  const commit = () => {
    const next = Number(text);
    if (text.trim() === "" || !Number.isFinite(next) || next < min || next > max || (step === 1 && !Number.isInteger(next))) {
      setError(`Use ${step === 1 ? "a whole number" : "a number"} from ${min} to ${max}.`);
      return;
    }
    try {
      onChange(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This value is not valid.");
    }
  };
  return (
    <div className={`number-field ${compact ? "compact-field" : ""}`}>
      <div className="field-heading">
        <label htmlFor={`${id}-number`}>{label}</label>
        <div className="number-entry">
          <input id={`${id}-number`} type="number" min={min} max={max} step={step} value={text}
            disabled={disabled} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={event => setText(event.target.value)} onBlur={commit}
            onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          {suffix && <span aria-hidden="true">{suffix}</span>}
        </div>
      </div>
      {!compact && <input className="range" type="range" min={min} max={max} step={step} value={value}
        disabled={disabled} aria-label={`${label} slider`}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={event => {
          try { onChange(Number(event.target.value)); setError(""); }
          catch (reason) { setError(reason instanceof Error ? reason.message : "This value is not valid."); }
        }} />}
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
    </div>
  );
}

export function ColorField({ label, value, onChange, onValidityChange }: {
  label: string; value: string; onChange: (color: string) => void; onValidityChange?: (valid: boolean) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [error, setError] = useState("");
  useEffect(() => { setText(value); setError(""); onValidityChange?.(true); }, [value, onValidityChange]);
  const commit = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(text)) {
      setError("Use a six-digit hex color, like #B6A5DA.");
      onValidityChange?.(false);
      return;
    }
    try { onChange(text.toUpperCase()); setError(""); onValidityChange?.(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid color."); }
  };
  return (
    <div className="color-field">
      <label className="color-well" style={{ backgroundColor: value }}>
        <span className="sr-only">{label} picker</span>
        <input type="color" value={value} onChange={event => onChange(event.target.value)} />
      </label>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} className="hex-input" value={text} spellCheck={false} maxLength={20}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        onChange={event => {
          setText(event.target.value);
          onValidityChange?.(/^#[0-9a-fA-F]{6}$/.test(event.target.value));
        }} onBlur={commit}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void; description?: string;
}) {
  return (
    <label className="toggle-row">
      <span>{label}{description && <small>{description}</small>}</span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

export function Section({ title, children, defaultOpen = true, trailing }: {
  title: string; children: ReactNode; defaultOpen?: boolean; trailing?: ReactNode;
}) {
  return (
    <details className="inspector-section" open={defaultOpen}>
      <summary><span>{title}</span><span className="section-trailing">{trailing}<Icon name="chevron" size={13} /></span></summary>
      <div className="section-content">{children}</div>
    </details>
  );
}

export function LockButton({ name, locked, onChange }: { name: string; locked: boolean; onChange: () => void }) {
  return <button className={`lock-button ${locked ? "is-locked" : ""}`} type="button"
    aria-label={`${name} lock`} aria-pressed={locked} title={`${locked ? "Unlock" : "Lock"} ${name.toLowerCase()} when shuffling`}
    onClick={onChange}><Icon name={locked ? "lock" : "unlock"} size={13} />{locked ? "Locked" : "Unlocked"}</button>;
}
