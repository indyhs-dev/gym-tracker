import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router';
import TrendChart, { type Series } from '../../components/charts/TrendChart';
import WeeklyBars from '../../components/charts/WeeklyBars';
import Segmented from '../../components/Segmented';
import { db } from '../../db/db';
import type { Exercise, Session } from '../../db/types';
import { formatKg } from '../../lib/format';
import {
  exerciseHistory,
  exercisePRs,
  minuteTicks,
  sessionDurations,
  trainedExercises,
  weeklyWorkingSets,
  type ExercisePoint,
} from '../../lib/progress';
import { weightText } from '../../lib/setText';
import { formatDate, formatDuration } from '../../lib/time';
import { CHART } from '../../styles/chartColors';

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function Progress() {
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('finished').toArray(), []);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const [params, setParams] = useSearchParams();

  if (!sessions || !exercises) return <h1 className="screen-title">Progress</h1>;

  const trained = trainedExercises(sessions).filter((id) => exercises.has(id));
  if (trained.length === 0) {
    return (
      <>
        <h1 className="screen-title">Progress</h1>
        <p className="empty">Charts appear here after your first finished workout.</p>
      </>
    );
  }

  const view = params.get('view') === 'overall' ? 'overall' : 'exercise';
  const selectedId = trained.includes(params.get('exercise') ?? '') ? params.get('exercise')! : trained[0];
  const exercise = exercises.get(selectedId)!;
  const history = exerciseHistory(sessions, selectedId);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <h1 className="screen-title">Progress</h1>

      <div className="field">
        <Segmented
          label="View"
          options={[
            { value: 'exercise', label: 'By exercise' },
            { value: 'overall', label: 'Overall' },
          ]}
          value={view}
          onChange={(v) => setParam('view', v)}
        />
      </div>

      {view === 'overall' ? (
        <Overall sessions={sessions} />
      ) : (
        <>
          <label className="field">
            <span className="field-label">Exercise</span>
            <select
              className="input select"
              value={selectedId}
              onChange={(e) => setParam('exercise', e.target.value)}
            >
              {trained.map((id) => (
                <option key={id} value={id}>
                  {exercises.get(id)!.name}
                </option>
              ))}
            </select>
          </label>

          {exercise.bodyweight ? (
            <BodyweightCharts history={history} />
          ) : (
            <WeightChart history={history} exercise={exercise} />
          )}

          <Records sessions={sessions} exercise={exercise} />
          <HistoryTable history={history} exercise={exercise} />
        </>
      )}
    </>
  );
}

function Records({ sessions, exercise }: { sessions: Session[]; exercise: Exercise }) {
  const { heaviest, repsAtWeight } = exercisePRs(sessions, exercise.id);
  if (!heaviest) return null;
  const unit = exercise.bodyweight ? '' : exercise.perHand ? ' kg each' : ' kg';
  return (
    <section className="card">
      <h2 className="card-title">Personal records</h2>
      <div className="pr-hero">
        <span className="pr-hero-value">
          {weightText(heaviest.weight, exercise)}
          {heaviest.weight > 0 || !exercise.bodyweight ? unit : ''} × {heaviest.reps}
        </span>
        <span className="row-meta">
          {exercise.bodyweight ? 'Heaviest added weight' : 'Heaviest set'} · {formatDate(heaviest.startedAt)}
        </span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Weight</th>
            <th scope="col">Best reps</th>
            <th scope="col">First done</th>
          </tr>
        </thead>
        <tbody>
          {repsAtWeight.slice(0, 10).map((r) => (
            <tr key={r.weight}>
              <td>{weightText(r.weight, exercise)}</td>
              <td>{r.reps}</td>
              <td>{formatDate(r.startedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Overall({ sessions }: { sessions: Session[] }) {
  const weeks = weeklyWorkingSets(sessions, Date.now());
  const durations = sessionDurations(sessions);
  const thisWeek = weeks.at(-1)!;
  const average = durations.length ? durations.reduce((n, d) => n + d.minutes, 0) / durations.length : 0;
  return (
    <>
      <section className="card chart-card">
        <h2 className="chart-title">Working sets per week</h2>
        <p className="chart-subtitle">
          Last 12 weeks · this week {thisWeek.sets} {thisWeek.sets === 1 ? 'set' : 'sets'}
        </p>
        <WeeklyBars
          data={weeks.map((w) => ({ x: w.weekStart, value: w.sets }))}
          format={(v) => `${v} working ${v === 1 ? 'set' : 'sets'}`}
          label="Working sets per week, last 12 weeks"
        />
        <details className="chart-table">
          <summary>Show as table</summary>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Working sets</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.weekStart}>
                  <td>{formatDate(w.weekStart)}</td>
                  <td>{w.sets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {durations.length > 0 && (
        <section className="card chart-card">
          <h2 className="chart-title">Gym time per session</h2>
          <p className="chart-subtitle">
            Last {durations.length} {durations.length === 1 ? 'session' : 'sessions'} · average{' '}
            {formatDuration(average * 60000)}
          </p>
          <TrendChart
            data={durations.map((d) => ({ x: d.startedAt, minutes: d.minutes }))}
            series={[
              { key: 'minutes', label: 'Gym time', color: CHART.accent, format: (v) => formatDuration(v * 60000) },
            ]}
            yTick={(v) => `${v}m`}
            yTicks={minuteTicks(durations.map((d) => d.minutes))}
            label="Gym time per session"
            height={180}
          />
          <details className="chart-table">
            <summary>Show as table</summary>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Gym time</th>
                </tr>
              </thead>
              <tbody>
                {[...durations].reverse().map((d) => (
                  <tr key={d.sessionId}>
                    <td>{formatDate(d.startedAt)}</td>
                    <td>{formatDuration(d.minutes * 60000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
    </>
  );
}

function WeightChart({ history, exercise }: { history: ExercisePoint[]; exercise: Exercise }) {
  const unit = exercise.perHand ? 'kg each' : 'kg';
  const series: Series[] = [
    { key: 'e1rm', label: 'Est. 1RM', color: CHART.accent, format: (v) => `${formatKg(v)} ${unit}` },
    {
      key: 'top',
      label: 'Top set',
      color: CHART.text,
      format: (v, p) => `${formatKg(v)} × ${p.topReps}`,
    },
  ];
  const data = history.map((p) => ({ x: p.startedAt, e1rm: p.e1rm === null ? null : round1(p.e1rm), top: p.topWeight, topReps: p.topReps }));
  return (
    <section className="card chart-card">
      <h2 className="chart-title">Top set and estimated 1RM</h2>
      <p className="chart-subtitle">{unit} · Epley, from sets of 12 reps or fewer</p>
      <TrendChart data={data} series={series} yTick={(v) => formatKg(round1(v))} label={`Top set weight and estimated one-rep max for ${exercise.name}`} />
    </section>
  );
}

function BodyweightCharts({ history }: { history: ExercisePoint[] }) {
  const added = history.map((p) => ({ x: p.startedAt, added: p.topWeight }));
  const reps = history.map((p) => ({ x: p.startedAt, reps: p.mostReps }));
  return (
    <>
      <section className="card chart-card">
        <h2 className="chart-title">Most reps</h2>
        <p className="chart-subtitle">Best working set each session</p>
        <TrendChart
          data={reps}
          series={[{ key: 'reps', label: 'Most reps', color: CHART.accent, format: (v) => `${v} reps` }]}
          label="Most reps per session"
          height={180}
        />
      </section>
      {history.some((p) => p.topWeight > 0) && (
        <section className="card chart-card">
          <h2 className="chart-title">Added weight</h2>
          <p className="chart-subtitle">Heaviest working set (kg on top of bodyweight)</p>
          <TrendChart
            data={added}
            series={[{ key: 'added', label: 'Added weight', color: CHART.accent, format: (v) => `+${formatKg(v)} kg` }]}
            yTick={formatKg}
            label="Added weight per session"
            height={180}
          />
        </section>
      )}
    </>
  );
}

/** The chart's numbers as a table (newest first): readable without the chart. */
function HistoryTable({ history, exercise }: { history: ExercisePoint[]; exercise: Exercise }) {
  return (
    <section className="card">
      <h2 className="card-title">Sessions</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Top set</th>
            <th scope="col">{exercise.bodyweight ? 'Most reps' : 'Est. 1RM'}</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((p) => (
            <tr key={p.sessionId}>
              <td>{formatDate(p.startedAt)}</td>
              <td>
                {weightText(p.topWeight, exercise)} × {p.topReps}
              </td>
              <td>{exercise.bodyweight ? p.mostReps : p.e1rm === null ? '–' : formatKg(round1(p.e1rm))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
