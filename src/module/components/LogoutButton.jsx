import React, { useState } from 'react';
import './LogoutModal.css'; // Vamos criar isso

export default function LogoutButton() {
  const [showConfirm, setShowConfirm] = useState(false);

  const confirmLogout = () => {
    localStorage.removeItem('token');
    const loginUrl = import.meta.env.VITE_APP_LOGIN_URL;
    window.location.href = loginUrl || '/';
  };

  return (
    <>
<button
  onClick={() => setShowConfirm(true)}
  className="admin-menu-item logout-button"
>
  Sair
</button>


      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Deseja realmente sair?</h3>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="confirm-btn" onClick={confirmLogout}>Sair</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
