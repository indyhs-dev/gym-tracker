interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Optional choices can be cleared by tapping the chosen chip again. */
  optional?: boolean;
}

/** A wrapping row of pill chips; pick one. */
export default function ChoiceChips<T extends string>({ label, options, value, onChange, optional = false }: Props<T>) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip-hit"
          aria-pressed={value === o.value}
          onClick={() => onChange(optional && value === o.value ? null : o.value)}
        >
          <span className="chip">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
