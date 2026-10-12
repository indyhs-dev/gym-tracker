import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import ExerciseSearch from '../../components/ExerciseSearch';
import ScreenHeader from '../../components/ScreenHeader';
import { db } from '../../db/db';

export default function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const create = (name: string) => navigate('/settings/exercises/new', { state: { name } });

  return (
    <>
      <ScreenHeader title="Exercises" back="/settings" backLabel="Settings" />
      <button type="button" className="btn btn-block new-button" onClick={() => create('')}>
        + New exercise
      </button>
      {exercises && (
        <ExerciseSearch
          exercises={exercises}
          query={query}
          onQueryChange={setQuery}
          onSelect={(e) => navigate(`/settings/exercises/${e.id}`)}
          onCreate={create}
        />
      )}
    </>
  );
}
