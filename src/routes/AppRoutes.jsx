import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Atendimento from '../module/Atendimento/Atendimento';
import Admin from '../module/Admin/Admin';
import { parseJwt } from '../utils/auth';

// pega a url do portal do .env (Vite expõe em import.meta.env)
const PORTAL_URL = import.meta.env.VITE_APP_LOGIN_URL;

const AppRoutes = () => {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, '/');
    } else {
      token = localStorage.getItem('token');
    }

    if (!token) {
      window.location.href = PORTAL_URL; // sem token -> portal
      return;
    }

    const decoded = parseJwt(token);
    if (decoded?.profile) {
      setRole(decoded.profile);
    } else {
      window.location.href = PORTAL_URL; // token inválido -> portal
    }
    setLoading(false);
  }, []);

  if (loading) return <div>Verificando perfil...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {role === 'admin' && (
          <Route
            path="/*"
            element={<ReactFlowProvider><Admin /></ReactFlowProvider>}
          />
        )}
        {role === 'atendente' && (
          <Route path="/*" element={<Atendimento />} />
        )}

        {/* fallback: qualquer rota inválida -> portal */}
        <Route path="*" element={<Navigate to={PORTAL_URL} replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
