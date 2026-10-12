interface Props {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Toggle({ label, hint, checked, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle-row"
      onClick={() => onChange(!checked)}
    >
      <span className="row-text">
        <span className="row-title">{label}</span>
        {hint && <span className="row-meta">{hint}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}
