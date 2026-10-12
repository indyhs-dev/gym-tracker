import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router';
import TrendChart, { type Series } from '../../components/charts/TrendChart';
import { db } from '../../db/db';
import type { Exercise } from '../../db/types';
import { formatKg } from '../../lib/format';
import { exerciseHistory, trainedExercises, type ExercisePoint } from '../../lib/progress';
import { weightText } from '../../lib/setText';
import { formatDate } from '../../lib/time';
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

  const selectedId = trained.includes(params.get('exercise') ?? '') ? params.get('exercise')! : trained[0];
  const exercise = exercises.get(selectedId)!;
  const history = exerciseHistory(sessions, selectedId);

  return (
    <>
      <h1 className="screen-title">Progress</h1>

      <label className="field">
        <span className="field-label">Exercise</span>
        <select
          className="input select"
          value={selectedId}
          onChange={(e) => setParams({ exercise: e.target.value }, { replace: true })}
        >
          {trained.map((id) => (
            <option key={id} value={id}>
              {exercises.get(id)!.name}
            </option>
          ))}
        </select>
      </label>

      {exercise.bodyweight ? <BodyweightCharts history={history} /> : <WeightChart history={history} exercise={exercise} />}

      <HistoryTable history={history} exercise={exercise} />
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
