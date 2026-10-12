import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { createExercise } from '../db/exercises';
import type { Exercise } from '../db/types';
import ExerciseForm, { draftFrom } from './ExerciseForm';
import ExerciseSearch from './ExerciseSearch';
import Sheet from './Sheet';

interface Props {
  title: string;
  /** Exercises not offered (e.g. already in this slot). */
  excludeIds?: string[];
  /** Shown first, under "This slot" (e.g. the slot's default and alternatives). */
  suggested?: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/**
 * Pick any saved exercise, or type a new name: it's saved to the library
 * and picked in one go. Render it only while open.
 */
export default function ExercisePicker({ title, excludeIds, suggested, onPick, onClose }: Props) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState<string | null>(null);

  return (
    <Sheet title={newName === null ? title : 'New exercise'} onClose={onClose}>
      {newName === null ? (
        exercises && (
          <ExerciseSearch
            exercises={exercises}
            excludeIds={excludeIds}
            suggested={suggested}
            query={query}
            onQueryChange={setQuery}
            onSelect={onPick}
            onCreate={setNewName}
          />
        )
      ) : (
        <ExerciseForm
          initial={draftFrom(undefined, newName)}
          submitLabel="Add to library and use"
          onSubmit={async (input) => onPick(await createExercise(input))}
        >
          <button type="button" className="btn btn-block btn-quiet" onClick={() => setNewName(null)}>
            Back to search
          </button>
        </ExerciseForm>
      )}
    </Sheet>
  );
}
