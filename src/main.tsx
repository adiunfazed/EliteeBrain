import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// Manrope for headings: rounder terminals and open counters make large text
// friendlier than Inter without losing precision. Inter stays for body copy,
// where its narrower forms fit more words per line legibly.
import '@fontsource-variable/manrope';

// Inter for everything readable: drawn for screens, legible at the small
// sizes this interface uses.
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

