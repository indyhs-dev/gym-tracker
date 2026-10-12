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
  autoFocus?: boolean;
}

/** Search box + matching exercises + "Add “…”" when the typed name is new. */
export default function ExerciseSearch({ exercises, query, onQueryChange, onSelect, onCreate, autoFocus }: Props) {
  const typed = cleanName(query);
  const matches = filterExercises(exercises, query);
  const canCreate = typed !== '' && !findByName(exercises, typed);

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

      {matches.length > 0 ? (
        <ul className="list">
          {matches.map((e) => (
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
      ) : (
        !canCreate && <p className="empty">No exercises yet.</p>
      )}
    </div>
  );
}
