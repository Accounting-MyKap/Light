import type { ReactNode } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';
import { SettingsEffects } from './SettingsEffects';
import { TodayScreen } from '../screens/TodayScreen';
import { GamesScreen } from '../screens/GamesScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayScreen } from '../screens/PlayScreen';

/** One error boundary per visit: a new location starts with a fresh boundary, so leaving a crashed screen recovers. */
function Guard({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  return <ErrorBoundary key={key}>{children}</ErrorBoundary>;
}

const guard = (screen: ReactNode) => <Guard>{screen}</Guard>;

export function AppRoutes() {
  return (
    <>
      <SettingsEffects />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={guard(<TodayScreen />)} />
          <Route path="games" element={guard(<GamesScreen />)} />
          <Route path="progress" element={guard(<ProgressScreen />)} />
          <Route path="settings" element={guard(<SettingsScreen />)} />
          <Route path="play/:gameId" element={guard(<PlayScreen />)} />
        </Route>
      </Routes>
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
