import React from 'react';

export default function LogoutButton() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = process.env.VITE_APP_LOGIN_URL;
    
  };

  return (
    <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>
      Sair
    </button>
  );
}
