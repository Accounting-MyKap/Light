import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyTheme } from './app/theme';
import { DEFAULT_SETTINGS, getSettings } from './data/settings';
import { detectLanguage, initI18n } from './i18n';
import './app/theme.css';
import './app/global.css';

async function start() {
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  applyTheme(settings.theme);
  await initI18n(detectLanguage(settings.language, navigator.languages));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
