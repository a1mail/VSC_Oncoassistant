import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeEmbeddedHtmlState } from './lib/embeddedHtmlState';
import { initializeAppStorage } from './lib/appStorage';
import './index.css';

initializeAppStorage();
try {
  initializeEmbeddedHtmlState();
} catch (error) {
  alert(error instanceof Error ? error.message : 'Не удалось восстановить встроенные настройки.');
}

// Provider singletons must initialize after portable profiles have been restored into memory.
void import('./App.tsx').then(({ default: App }) => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Application root missing');
  createRoot(root).render(<StrictMode><App /></StrictMode>);
});
