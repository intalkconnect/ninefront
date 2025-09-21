import React, { useState } from 'react';
import { useConfirm } from '../../../app/provider/ConfirmProvider';

function normalizeOrigin(s) {
  return String(s || '').replace(/\/+$/, '');
}

const isLocalHost = () => /^(localhost|127\.0\.0\.1|\[::1\])$|\.local$/.test(window.location.hostname);

const ENV_AUTH =
  import.meta.env?.VITE_APP_AUTH_ORIGIN ||
  import.meta.env?.VITE_APP_LOGIN_BACKEND_URL ||
  '';
let AUTH_ORIGIN = normalizeOrigin(ENV_AUTH) || 'https://srv-auth.ninechat.com.br';

let PORTAL_URL = normalizeOrigin(import.meta.env?.VITE_APP_PORTAL_URL || '') || 'https://portal.ninechat.com.br';

export default function LogoutButton({ className, children, onClick }) {
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm(); // <- AQUI: hook do provider

  const handle = async (e) => {
    e?.preventDefault?.();
    if (busy) return;

    const ok = await confirm({
      title: "Encerrar sessão?",
      description: "Tem certeza que deseja sair da sua conta?",
      confirmText: "Sim, sair",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!ok) return;

    setBusy(true);

    try {
      await fetch(`${AUTH_ORIGIN}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignora erro de rede para não travar a saída
    }

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('rememberedEmail');
      sessionStorage.removeItem('token');

      const u = new URL(window.location.href);
      u.searchParams.delete('token');
      u.searchParams.delete('redirect');
      window.history.replaceState({}, '', u.toString());
    } catch {}

    onClick?.();

    window.location.replace(`${PORTAL_URL}`);
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
