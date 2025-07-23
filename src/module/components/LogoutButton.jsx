import React from 'react';

export default function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = import.meta.env.VITE_APP_LOGIN_URL;
    
  };

  return (
    <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>
      Sair
    </button>
  );
}
