import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Atendimento from '../module/Atendimento/Atendimento';
import Admin from '../module/Admin/Admin';
import { parseJwt } from '../utils/auth';

const LOGIN_URL = (import.meta.env.VITE_APP_LOGIN_URL || '').trim();

function redirectToLogin() {
  if (!LOGIN_URL) {
    // evita loop silencioso quando env não está setado
    console.error('VITE_APP_LOGIN_URL não configurada');
    return;
  }
  window.location.replace(LOGIN_URL);
}

// Guard global: envolve TODA a aplicação
function AuthGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 1) token via querystring?
    const qs = new URLSearchParams(window.location.search);
    const qsToken = qs.get('token');

    let token = qsToken
      || localStorage.getItem('token')
      || sessionStorage.getItem('token');

    // se veio na URL, persiste e limpa a query
    if (qsToken) {
      localStorage.setItem('token', qsToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      token = qsToken;
    }

    // 2) sem qualquer token -> portal
    if (!token) {
      redirectToLogin();
      return;
    }

    // 3) valida minimamente o JWT (exp) se existir
    try {
      const decoded = parseJwt(token);
      const now = Math.floor(Date.now() / 1000);
      if (!decoded || (decoded.exp && decoded.exp < now)) {
        // expirado/ inválido
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        redirectToLogin();
        return;
      }
      setReady(true);
    } catch (e) {
      redirectToLogin();
    }
  }, []);

  // opcional: manter UX simples
  if (!ready) return <div>Verificando sessão...</div>;
  return children;
}

const AppRoutes = () => {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return; // AuthGate já redireciona

    try {
      const decoded = parseJwt(token);
      if (decoded?.profile) setRole(decoded.profile);
    } catch {}
  }, []);

  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          {role === 'admin' && (
            <Route path="/*" element={<ReactFlowProvider><Admin /></ReactFlowProvider>} />
          )}
          {role === 'atendente' && (
            <Route path="/*" element={<Atendimento />} />
          )}
          {/* Se a role não bate com nenhuma rota, o AuthGate já garante que há sessão.
              Aqui você pode escolher um default, ex.: Atendimento */}
          <Route path="/*" element={<Atendimento />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
};

export default AppRoutes;
