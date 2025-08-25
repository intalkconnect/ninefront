// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import './index.css';
import App from './App';

const LOGIN_URL = (import.meta.env.VITE_APP_LOGIN_URL || '').trim();

function ensureAuthOrRedirect() {
  // 1) token via querystring? salva e limpa a URL
  const qs = new URLSearchParams(window.location.search);
  const qsToken = qs.get('token');
  if (qsToken) {
    localStorage.setItem('token', qsToken);
    // limpa ?token= mas preserva o hash, se houver
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  // 2) tenta sessão/token local
  const token =
    qsToken ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token');

  // 3) sem token/sessão -> redireciona para o portal e NÃO monta a SPA
  if (!token) {
    if (!LOGIN_URL) {
      console.error('VITE_APP_LOGIN_URL não configurada no .env');
    } else {
      window.location.replace(LOGIN_URL);
    }
    return false; // bloqueia o boot
  }

  return true; // ok pra montar
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
