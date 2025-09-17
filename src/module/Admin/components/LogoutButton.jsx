// File: ./components/LogoutButton.jsx
import React, { useState } from 'react';

function normalizeOrigin(s) {
  return String(s || '').replace(/\/+$/, '');
}
function isLocalHost() {
  const h = window.location.hostname;
  return /^(localhost|127\.0\.0\.1|\[::1\])$|\.local$/.test(h);
}

// 1) Origem do AUTH (onde vive /api/logout)
// Preferência: VITE_APP_AUTH_ORIGIN; fallback: VITE_APP_LOGIN_BACKEND_URL; senão, heurística
const ENV_AUTH =
  import.meta.env?.VITE_APP_AUTH_ORIGIN ||
  import.meta.env?.VITE_APP_LOGIN_BACKEND_URL ||
  '';
let AUTH_ORIGIN = normalizeOrigin(ENV_AUTH);
if (!AUTH_ORIGIN) {
  AUTH_ORIGIN = isLocalHost() ? 'http://localhost:4000' : 'https://srv-auth.ninechat.com.br';
}

// 2) URL do PORTAL para onde vamos após logout
// Preferência: VITE_APP_PORTAL_URL; senão, heurística
let PORTAL_URL = normalizeOrigin(import.meta.env?.VITE_APP_PORTAL_URL || '');
if (!PORTAL_URL) {
  PORTAL_URL = isLocalHost() ? 'http://localhost:5173' : 'https://portal.ninechat.com.br';
}

export default function LogoutButton({ className, children, onClick }) {
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);

    // Tenta invalidar sessão no AUTH (cookies SameSite=None exigem credentials)
    try {
      await fetch(`${AUTH_ORIGIN}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignora erro de rede para não travar a saída
    }

    // Limpa client-side
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('rememberedEmail');
      sessionStorage.removeItem('token');

      const u = new URL(window.location.href);
      u.searchParams.delete('token');
      u.searchParams.delete('redirect');
      window.history.replaceState({}, '', u.toString());
    } catch {}

    // Fecha dropdown se o pai passou handler
    onClick?.();

    // Vai para o portal/login (hard redirect)
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
