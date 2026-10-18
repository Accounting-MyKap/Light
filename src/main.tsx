import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { detectLanguage, initI18n } from './i18n';
import './app/theme.css';
import './app/global.css';

async function start() {
  await initI18n(detectLanguage(null, navigator.languages));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
