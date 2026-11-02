import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const splash = document.getElementById('ryan-splash');
if (splash) {
  const openedAt = performance.now();
  const dismiss = () => {
    const wait = Math.max(0, 1200 - (performance.now() - openedAt));
    window.setTimeout(() => {
      splash.classList.add('is-out');
      window.setTimeout(() => splash.remove(), 560);
    }, wait);
  };
  requestAnimationFrame(() => requestAnimationFrame(dismiss));
}
