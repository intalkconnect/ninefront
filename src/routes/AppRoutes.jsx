import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Atendimento from '../module/Atendimento/Atendimento';
import Admin from '../module/Admin/Admin';
import { parseJwt } from '../utils/auth';


const AppRoutes = () => {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.history.replaceState({}, document.title, '/');
    } else {
      token = localStorage.getItem('token');
    }

    const decoded = parseJwt(token);
    if (decoded?.profile ) {
      setRole(decoded.profile );
    }
  }, []);

  if (!role) return <div>Verificando perfil...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {role === 'admin' && <Route path="/*" element={<ReactFlowProvider><Admin /></ReactFlowProvider>} />}
        {role === 'atendente' && <Route path="/*" element={<Atendimento />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
