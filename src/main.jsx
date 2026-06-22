import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Aktifkan MSW hanya di dev (atau bila VITE_USE_MOCKS=true) supaya
// gampang dimatikan di FASE 2 — lihat docs/CLAUDE.md.
async function enableMocking() {
  const useMocks = import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'true';
  if (!useMocks) return;
  const { worker } = await import('./mocks/browser.js');
  return worker.start({
    onUnhandledRequest: 'bypass',
  });
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
});
