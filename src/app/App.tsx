import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';
import { SettingsEffects } from './SettingsEffects';
import { TodayScreen } from '../screens/TodayScreen';
import { GamesScreen } from '../screens/GamesScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayScreen } from '../screens/PlayScreen';

const guard = (screen: ReactNode) => <ErrorBoundary>{screen}</ErrorBoundary>;

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
