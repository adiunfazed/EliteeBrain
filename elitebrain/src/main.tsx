import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/martian-mono/400.css';
import '@fontsource/martian-mono/600.css';
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

