import { useLiveQuery } from 'dexie-react-hooks';
import ScreenHeader from '../../components/ScreenHeader';
import Stepper from '../../components/Stepper';
import { countSaunaSamples, removeSaunaSamples } from '../../db/sauna';
import { updateSettings, useSettings } from '../../db/settings';
import { plural } from '../../lib/format';

export default function SaunaSettings() {
  const settings = useSettings();
  const samples = useLiveQuery(countSaunaSamples, []);
  if (!settings) return <ScreenHeader title="Sauna" back="/settings" backLabel="Settings" />;
  const sauna = settings.sauna;

  function remove() {
    if (!window.confirm(`Remove the ${plural(samples ?? 0, 'sample session')}? Your own entries aren’t touched.`)) return;
    void removeSaunaSamples();
  }

  return (
    <>
      <ScreenHeader title="Sauna" back="/settings" backLabel="Settings" />
      <p className="muted intro">Weeks run Monday to Sunday, Brisbane time. Skipped days count towards the target.</p>

      <div className="field">
        <span className="field-label">Weekly target</span>
        <div className="stepper-row">
          <span className="row-text">
            <span className="row-title">Sessions per week</span>
            <span className="row-meta">Default 3</span>
          </span>
          <Stepper
            label="sauna sessions per week"
            value={sauna.weeklyTarget}
            min={1}
            max={7}
            onChange={(weeklyTarget) => updateSettings({ sauna: { ...sauna, weeklyTarget } })}
          />
        </div>
      </div>

      {samples !== undefined && samples > 0 && (
        <div className="field">
          <span className="field-label">Sample data</span>
          <button type="button" className="btn btn-block" onClick={remove}>
            Remove {plural(samples, 'sample session')}
          </button>
          <span className="row-meta">Added so you could try the charts. Your own entries aren’t touched.</span>
        </div>
      )}
    </>
  );
}
