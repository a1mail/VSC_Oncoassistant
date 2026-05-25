import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeEmbeddedHtmlState } from './lib/embeddedHtmlState';
import App from './App.tsx';
import './index.css';

initializeEmbeddedHtmlState();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
