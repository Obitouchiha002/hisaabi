import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

/* Bhaari fonts (emoji, poora Devanagari) app dikhne ke baad. Pehle inhe
   seedha load karte the aur launch me ~30 second lag jate the. */
function loadHeavyFonts(): void {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./fonts/fonts-heavy.css', document.baseURI).href;
  document.head.appendChild(link);
}

if (document.readyState === 'complete') setTimeout(loadHeavyFonts, 400);
else window.addEventListener('load', () => setTimeout(loadHeavyFonts, 400), { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
