import { Navigate, Route, Routes } from 'react-router';
import TabBar from './components/TabBar';
import History from './screens/history/History';
import Progress from './screens/progress/Progress';
import Settings from './screens/settings/Settings';
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  );
}
