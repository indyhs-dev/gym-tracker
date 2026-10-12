import { cleanName, filterExercises, findByName } from '../db/exercises';
import type { Exercise } from '../db/types';
import { exerciseMeta } from '../lib/labels';

interface Props {
  exercises: Exercise[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (exercise: Exercise) => void;
  /** Called with the typed name when it isn't in the library yet. */
  onCreate: (name: string) => void;
  /** Hidden from the results (e.g. already chosen), but still count as existing names. */
  excludeIds?: string[];
  /** Shown above everything else while the search box is empty. */
  suggested?: Exercise[];
  autoFocus?: boolean;
}

/** Search box + matching exercises + "Add “…”" when the typed name is new. */
export default function ExerciseSearch({
  exercises,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  excludeIds = [],
  suggested = [],
  autoFocus,
}: Props) {
  const typed = cleanName(query);
  const matches = filterExercises(exercises, query).filter((e) => !excludeIds.includes(e.id));
  const canCreate = typed !== '' && !findByName(exercises, typed);
  const showSuggested = typed === '' && suggested.length > 0;

  return (
    <div className="exercise-search">
      <input
        className="input"
        type="search"
        placeholder="Search or add exercise"
        aria-label="Search or add exercise"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoFocus={autoFocus}
        autoCapitalize="words"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
      />

      {canCreate && (
        <button type="button" className="create-row" onClick={() => onCreate(typed)}>
          + Add “{typed}”
        </button>
      )}

      {showSuggested && (
        <>
          <span className="field-label">This slot</span>
          <ExerciseList exercises={suggested} onSelect={onSelect} />
          <span className="field-label">All exercises</span>
        </>
      )}

      {matches.length > 0 ? (
        <ExerciseList exercises={matches} onSelect={onSelect} />
      ) : (
        !canCreate && <p className="empty">{exercises.length === 0 ? 'No exercises yet.' : 'No matches.'}</p>
      )}
    </div>
  );
}

function ExerciseList({ exercises, onSelect }: { exercises: Exercise[]; onSelect: (e: Exercise) => void }) {
  return (
    <ul className="list">
      {exercises.map((e) => (
        <li key={e.id}>
          <button type="button" className="list-row" onClick={() => onSelect(e)}>
            <span className="row-text">
              <span className="row-title">{e.name}</span>
              <span className="row-meta">{exerciseMeta(e)}</span>
            </span>
            <span className="chevron" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
