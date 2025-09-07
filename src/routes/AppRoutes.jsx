// src/routes/AppRoutes.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Atendimento from '../module/Atendimento/Atendimento';
import Admin from '../module/Admin/Admin';
import { parseJwt } from '../utils/auth';

/** Lê token e resolve o perfil ANTES do primeiro render */
function getInitialRole() {
  try {
    const token =
      localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return null;
    const decoded = parseJwt(token) || {};
    // aceita tanto 'profile' quanto 'role' e normaliza
    const raw = decoded.profile || decoded.role || null;
    return raw ? String(raw).toLowerCase() : null;
  } catch {
    return null;
  }
}

/** helper para checar papel */
function isOneOf(role, list) {
  if (!role) return false;
  return list.map((r) => r.toLowerCase()).includes(String(role).toLowerCase());
}

const AppRoutes = () => {
  // já começa com o role resolvido, evitando "frame" inicial com null
  const [role] = React.useState(getInitialRole);

  // token presente?
  const hasToken = Boolean(
    localStorage.getItem('token') || sessionStorage.getItem('token')
  );

  // grupos de acesso
  const adminLike = ['admin', 'supervisor']; // << admin e supervisor juntos
  const atendenteLike = ['atendente'];

  const canAdmin = isOneOf(role, adminLike);
  const canAtendimento = isOneOf(role, atendenteLike);

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin & Supervisor compartilham o mesmo módulo */}
        {canAdmin && (
          <Route
            path="/*"
            element={
              <ReactFlowProvider>
                <Admin />
              </ReactFlowProvider>
            }
          />
        )}

        {canAtendimento && <Route path="/*" element={<Atendimento />} />}

        {/* Fallback apenas quando não autenticado ou role desconhecido */}
        {(!hasToken || (!canAdmin && !canAtendimento)) && (
          <Route path="/*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
