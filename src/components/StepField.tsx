import NumberField from './NumberField';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  decimal?: boolean;
  placeholder?: string;
  /** Small label inside the field, shown only on very narrow screens (where column headings are hidden). */
  unit?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** [−] number [+]. From empty, + gives one step and − gives 0. Never below 0. */
export default function StepField({ label, value, onChange, step, decimal, placeholder, unit }: Props) {
  const bump = (dir: 1 | -1) => {
    if (value === null) onChange(dir > 0 ? step : 0);
    else onChange(Math.max(0, round2(value + dir * step)));
  };
  return (
    <div className="step-field" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label}`} onClick={() => bump(-1)}>
        −
      </button>
      <span className="step-input">
        <NumberField label={label} value={value} onChange={onChange} decimal={decimal} placeholder={placeholder} />
        {unit && (
          <span className="step-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </span>
      <button type="button" aria-label={`More ${label}`} onClick={() => bump(1)}>
        +
      </button>
    </div>
  );
}
