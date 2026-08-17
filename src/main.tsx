import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// Inter for everything readable: it was drawn for screens and stays legible
// at the small sizes this interface actually uses. Clash Display was a display
// face — its tight tracking collapsed words like "done today" at 11px.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

// JetBrains Mono for numbers, timers and labels — true monospace keeps digits
// aligned so a countdown doesn't jitter as it ticks.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

