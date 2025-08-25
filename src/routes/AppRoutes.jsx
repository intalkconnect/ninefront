// src/routes/AppRoutes.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Atendimento from '../module/Atendimento/Atendimento';
import Admin from '../module/Admin/Admin';
import { parseJwt } from '../utils/auth';

const AppRoutes = () => {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    try {
      const decoded = token ? parseJwt(token) : null;
      if (decoded?.profile) setRole(decoded.profile);
    } catch {}
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {role === 'admin' && (
          <Route path="/*" element={<ReactFlowProvider><Admin /></ReactFlowProvider>} />
        )}
        {role === 'atendente' && (
          <Route path="/*" element={<Atendimento />} />
        )}
        {/* default/fallback dentro da SPA */}
        <Route path="/*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
