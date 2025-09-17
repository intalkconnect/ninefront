// File: ./components/LogoutButton.jsx
import React, { useState } from 'react';

const RAW_BACKEND = (import.meta.env?.VITE_APP_LOGIN_BACKEND_URL || '').trim();
const API_BASE = (RAW_BACKEND.startsWith('http') ? RAW_BACKEND : `https://${RAW_BACKEND}`)
  .replace(/\/+$/, '');
const apiUrl = (p = '') => `${API_BASE}/${String(p).replace(/^\/+/, '')}`;

const PORTAL_URL = (import.meta.env?.VITE_APP_PORTAL_URL || 'https://portal.ninechat.com.br')
  .replace(/\/+$/, '');

export default function LogoutButton({ className, children, onClick }) {
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);

    try {
      await fetch(apiUrl('/api/logout'), {
        method: 'POST',
        credentials: 'include', // envia cookies SameSite=None
      });
    } catch {
      // não bloqueia o fluxo de saída em caso de rede falhando
    }

    try {
      // Limpa credenciais e estados locais
      localStorage.removeItem('token');
      localStorage.removeItem('rememberedEmail');
      sessionStorage.removeItem('token');

      // Remove ?token e ?redirect da URL atual para evitar loops
      const here = new URL(window.location.href);
      here.searchParams.delete('token');
      here.searchParams.delete('redirect');
      window.history.replaceState({}, '', here.toString());
    } catch {}

    // Fecha o dropdown do perfil, se o pai passou handler
    onClick?.();

    // Vai para o portal/login (hard redirect, sem manter estado SPA)
    window.location.replace(`${PORTAL_URL}/login`);
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handle}
      aria-busy={busy}
      disabled={busy}
      title="Encerrar sessão"
    >
      {children || 'Logout'}
    </button>
  );
}
