import { useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

/** Multi-line note that saves as you type and grows with its content. */
export default function NoteField({ value, onChange, placeholder, label }: Props) {
  const [text, setText] = useState(value);
  return (
    <textarea
      className="input note-field"
      aria-label={label}
      placeholder={placeholder}
      rows={1}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}
