import { useGoBack } from '../lib/nav';

interface Props {
  title: string;
  /** Where "back" goes if there's no history (screen opened directly). */
  back: string;
  backLabel: string;
}

export default function ScreenHeader({ title, back, backLabel }: Props) {
  const goBack = useGoBack(back);
  return (
    <header className="screen-header">
      <button type="button" className="back" onClick={goBack}>
        ‹ {backLabel}
      </button>
      <h1 className="screen-title">{title}</h1>
    </header>
  );
}
