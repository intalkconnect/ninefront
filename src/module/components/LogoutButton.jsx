import React from 'react';

export default function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = import.meta.env.VITE_API_BASE_URL || '/';
  };

  return (
    <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>
      Sair
    </button>
  );
}
