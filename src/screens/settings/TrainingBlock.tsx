import ScreenHeader from '../../components/ScreenHeader';
import Stepper from '../../components/Stepper';
import { updateSettings, useSettings } from '../../db/settings';
import type { TrainingBlock as Block } from '../../db/types';
import { blockStatus } from '../../lib/block';
import { formatDate, toDateInput } from '../../lib/time';

export default function TrainingBlock() {
  const settings = useSettings();
  if (!settings) return <ScreenHeader title="Training block" back="/settings" backLabel="Settings" />;
  const block = settings.block;
  const status = blockStatus(block, Date.now());
  const save = (patch: Partial<Block>) => updateSettings({ block: { ...block, ...patch } });
  const today = toDateInput(Date.now());

  return (
    <>
      <ScreenHeader title="Training block" back="/settings" backLabel="Settings" />
      <p className="muted intro">Shows “Week X” on Today. Weeks 1–2 are break-in weeks.</p>

      {status && (
        <div className="card block-status">
          <span className="stat-value">{status.week > 0 ? `Week ${status.week}` : 'Not started'}</span>
          <span className="row-meta">
            {status.week === 0
              ? `Starts in ${status.startsIn} ${status.startsIn === 1 ? 'day' : 'days'}`
              : status.weekOffDue
                ? 'Time for a week off'
                : status.breakIn
                  ? 'Break-in'
                  : `Week off after week ${block.weekOffAfter}`}
          </span>
        </div>
      )}

      <label className="field">
        <span className="field-label">Block started</span>
        <input
          className="input"
          type="date"
          value={block.startDate ?? ''}
          onChange={(e) => save({ startDate: e.target.value || null })}
        />
        {block.startDate && <span className="row-meta">{formatDate(new Date(`${block.startDate}T12:00`).getTime())}</span>}
      </label>

      <button type="button" className="btn btn-block" onClick={() => save({ startDate: today })}>
        Start a new block today
      </button>
      {block.startDate && (
        <button type="button" className="btn btn-block btn-quiet" onClick={() => save({ startDate: null })}>
          Stop tracking
        </button>
      )}

      <div className="field block-weeks">
        <span className="field-label">Week off reminder</span>
        <div className="stepper-row">
          <span className="row-text">
            <span className="row-title">After week</span>
            <span className="row-meta">Usually 12–16</span>
          </span>
          <Stepper
            label="weeks before a week off"
            value={block.weekOffAfter}
            min={1}
            max={52}
            onChange={(weekOffAfter) => save({ weekOffAfter })}
          />
        </div>
      </div>
    </>
  );
}
