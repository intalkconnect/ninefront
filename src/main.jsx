// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import './index.css';
import App from './App';
import { isJwtExpired, msUntilExpiry } from './utils/auth';

const LOGIN_URL = (import.meta.env.VITE_APP_LOGIN_URL || '').trim();

// agenda um redirect automático quando o JWT estiver para expirar
function scheduleAutoRedirect(token) {
  // limpa um timer antigo se existir
  if (window.__NC_TOKEN_TIMER) {
    clearTimeout(window.__NC_TOKEN_TIMER);
    window.__NC_TOKEN_TIMER = null;
  }
  const msLeft = msUntilExpiry(token, 2000); // 2s de folga
  if (msLeft > 0 && LOGIN_URL) {
    window.__NC_TOKEN_TIMER = setTimeout(() => {
      try { localStorage.removeItem('token'); } catch {}
      try { sessionStorage.removeItem('token'); } catch {}
      window.location.replace(LOGIN_URL);
    }, msLeft);
  }
}

function ensureAuthOrRedirect() {
  const qs = new URLSearchParams(window.location.search);
  const qsToken = qs.get('token');
  if (qsToken) {
    // persiste o token vindo por query
    try { localStorage.setItem('token', qsToken); } catch {}
    // limpa a query da URL (mantém hash/rota)
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  const token =
    qsToken ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token'));

  // sem token → volta pro portal
  if (!token) {
    if (!LOGIN_URL) {
      console.error('VITE_APP_LOGIN_URL não configurada no .env');
    } else {
      window.location.replace(LOGIN_URL);
    }
    return false;
  }

  // token presente mas expirado → limpa e volta pro portal
  if (isJwtExpired(token)) {
    try { localStorage.removeItem('token'); } catch {}
    try { sessionStorage.removeItem('token'); } catch {}
    if (LOGIN_URL) window.location.replace(LOGIN_URL);
    return false;
  }

  // válido: agenda auto-redirect quando expirar
  scheduleAutoRedirect(token);
  return true;
}

if (ensureAuthOrRedirect()) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </React.StrictMode>
  );
}
