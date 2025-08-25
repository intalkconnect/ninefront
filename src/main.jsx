// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import './index.css';
import App from './App';

const LOGIN_URL = (import.meta.env.VITE_APP_LOGIN_URL || '').trim();

function ensureAuthOrRedirect() {
  const qs = new URLSearchParams(window.location.search);
  const qsToken = qs.get('token');
  if (qsToken) {
    localStorage.setItem('token', qsToken);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }

  const token = qsToken || localStorage.getItem('token') || sessionStorage.getItem('token');

  if (!token) {
    if (!LOGIN_URL) {
      console.error('VITE_APP_LOGIN_URL não configurada no .env');
    } else {
      window.location.replace(LOGIN_URL);
    }
    return false; // bloqueia o boot
  }
  return true;
}

if (ensureAuthOrRedirect()) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>

        <App />

    </React.StrictMode>
  );
}
