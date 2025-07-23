import React from 'react';
console.log('🔍 VITE_APP_LOGIN_URL:', import.meta.env.VITE_APP_LOGIN_URL);

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
