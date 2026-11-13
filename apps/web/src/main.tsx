import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
// Cyrillic subsets for the Russian UI (loaded by the browser only when needed)
import '@fontsource/pixelify-sans/cyrillic-500.css';
import '@fontsource/pixelify-sans/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-600.css';
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import { App } from './App';
import './styles.css';
import './layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
