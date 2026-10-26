import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { seedIfNeeded } from './db/seed';
import { requestPersistentStorage } from './lib/storage';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';

void requestPersistentStorage();
seedIfNeeded().catch((err) => console.error('Seeding failed', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
