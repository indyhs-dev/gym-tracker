import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import History from './screens/history/History';
import SectionHeader from './components/SectionHeader';
import SessionDetail from './screens/history/SessionDetail';
import Backup from './screens/settings/Backup';
import ExerciseEditor from './screens/settings/ExerciseEditor';
import Exercises from './screens/settings/Exercises';
import RestGuidance from './screens/settings/RestGuidance';
import Settings from './screens/settings/Settings';
import SlotEditor from './screens/settings/SlotEditor';
import TemplateEditor from './screens/settings/TemplateEditor';
import Templates from './screens/settings/Templates';
import TrainingBlock from './screens/settings/TrainingBlock';
import Today from './screens/today/Today';
import WorkoutScreen from './screens/workout/WorkoutScreen';

// Charts are the heaviest code; load them only when the Progress screen opens.
const Progress = lazy(() => import('./screens/progress/Progress'));

export default function App() {
  return (
    <>
      <main className="app">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route
            path="/progress"
            element={
              <Suspense fallback={<SectionHeader />}>
                <Progress />
              </Suspense>
            }
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/exercises" element={<Exercises />} />
          <Route path="/settings/exercises/new" element={<ExerciseEditor />} />
          <Route path="/settings/exercises/:id" element={<ExerciseEditor />} />
          <Route path="/settings/rest" element={<RestGuidance />} />
          <Route path="/settings/backup" element={<Backup />} />
          <Route path="/settings/block" element={<TrainingBlock />} />
          <Route path="/settings/templates" element={<Templates />} />
          <Route path="/settings/templates/:id" element={<TemplateEditor />} />
          <Route path="/settings/templates/:id/slots/:slotId" element={<SlotEditor />} />
          <Route path="/workout/:id" element={<WorkoutScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
