import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import TabBar from './components/TabBar';
import History from './screens/history/History';
import SectionHeader from './components/SectionHeader';
import SessionDetail from './screens/history/SessionDetail';
import SaunaHistory from './screens/sauna/SaunaHistory';
import SaunaToday from './screens/sauna/SaunaToday';
import Backup from './screens/settings/Backup';
import ExerciseEditor from './screens/settings/ExerciseEditor';
import Exercises from './screens/settings/Exercises';
import RestGuidance from './screens/settings/RestGuidance';
import SaunaSettings from './screens/settings/SaunaSettings';
import Settings from './screens/settings/Settings';
import SlotEditor from './screens/settings/SlotEditor';
import TemplateEditor from './screens/settings/TemplateEditor';
import Templates from './screens/settings/Templates';
import TrainingBlock from './screens/settings/TrainingBlock';
import Today from './screens/today/Today';
import WorkoutScreen from './screens/workout/WorkoutScreen';

// Charts are the heaviest code; load them only when a Progress screen opens.
const Progress = lazy(() => import('./screens/progress/Progress'));
const SaunaProgress = lazy(() => import('./screens/sauna/SaunaProgress'));

export default function App() {
  // The workout screen is full-screen: no tab bar.
  const inWorkout = useLocation().pathname.startsWith('/workout/');
  return (
    <>
      <main className={inWorkout ? 'app app-full' : 'app'}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route
            path="/progress"
            element={
              <Suspense fallback={<SectionHeader section="gym" />}>
                <Progress />
              </Suspense>
            }
          />
          <Route path="/sauna" element={<SaunaToday />} />
          <Route path="/sauna/history" element={<SaunaHistory />} />
          <Route
            path="/sauna/progress"
            element={
              <Suspense fallback={<SectionHeader section="sauna" />}>
                <SaunaProgress />
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
          <Route path="/settings/sauna" element={<SaunaSettings />} />
          <Route path="/settings/templates" element={<Templates />} />
          <Route path="/settings/templates/:id" element={<TemplateEditor />} />
          <Route path="/settings/templates/:id/slots/:slotId" element={<SlotEditor />} />
          <Route path="/workout/:id" element={<WorkoutScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!inWorkout && <TabBar />}
    </>
  );
}
