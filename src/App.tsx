import { Navigate, Route, Routes } from 'react-router';
import TabBar from './components/TabBar';
import History from './screens/history/History';
import Progress from './screens/progress/Progress';
import ExerciseEditor from './screens/settings/ExerciseEditor';
import Exercises from './screens/settings/Exercises';
import RestGuidance from './screens/settings/RestGuidance';
import Settings from './screens/settings/Settings';
import SlotEditor from './screens/settings/SlotEditor';
import TemplateEditor from './screens/settings/TemplateEditor';
import Templates from './screens/settings/Templates';
import Today from './screens/today/Today';

export default function App() {
  return (
    <>
      <main className="app">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/exercises" element={<Exercises />} />
          <Route path="/settings/exercises/new" element={<ExerciseEditor />} />
          <Route path="/settings/exercises/:id" element={<ExerciseEditor />} />
          <Route path="/settings/rest" element={<RestGuidance />} />
          <Route path="/settings/templates" element={<Templates />} />
          <Route path="/settings/templates/:id" element={<TemplateEditor />} />
          <Route path="/settings/templates/:id/slots/:slotId" element={<SlotEditor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
