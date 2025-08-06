import { useEffect, useState } from 'react';
import { Home, Bot, Users, Settings, ChevronDown, LogOut } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from '../components/LogoutButton';
import styles from './styles/Admin.module.css';
import { parseJwt } from '../../utils/auth';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../services/apiClient';

document.title = 'HubHMG - Gestão';

export default function Admin() {
  const token = localStorage.getItem('token');
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!email) return;
      try {
        const res = await apiGet(`/atendentes/${email}`);
        setUserData(res);
      } catch (err) {
        console.error('Erro ao buscar dados do admin:', err);
      }
    };

    fetchAdminInfo();
  }, [email]);

  return (
    <div className={styles['layout-wrapper']}>
      <aside className={styles['sidebar']}>
        <div>
          <div className={styles.logo}>HubHMG</div>
          <nav className={styles['sidebar-nav']}>
            <MenuIcon to="" icon={<Home size={18} />} label="Dashboard" />
            <MenuIcon to="chatbot" icon={<Bot size={18} />} label="Chatbot" />
            <MenuIcon to="users" icon={<Users size={18} />} label="Usuários" />
            <div className={styles.dropdown}>
              <button
                className={styles['dropdown-toggle']}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Settings size={18} />
                Configurações
                <ChevronDown size={14} />
              </button>
              {showDropdown && (
                <div className={styles['dropdown-menu']}>
                  <div>Preferências</div>
                  <div>Segurança</div>
                  <div>Integrações</div>
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className={styles['sidebar-footer']}>
          {userData && (
            <div className={styles.profileContainer}>
              <div
                className={styles.avatar}
                style={{ backgroundColor: stringToColor(userData.email) }}
              >
                {userData.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {userData.name?.split(' ')[0] || 'Usuário'}
                </div>
                <div className={styles.userEmail}>{userData.email}</div>
              </div>
            </div>
          )}
          <LogoutButton className={styles['logout-button']}>
  <LogOut size={16} style={{ marginRight: '6px' }} />
  Sair
</LogoutButton>

        </div>
      </aside>

      <main className={styles['main-content']}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="configuracoes" element={<div>Página de Configurações</div>} />
          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </main>
    </div>
  );
}

const MenuIcon = ({ to, icon, label }) => (
  <NavLink
    to={to}
    end={to === ''}
    className={({ isActive }) =>
      `${styles['menu-icon']} ${isActive ? styles.active : ''}`
    }
  >
    {icon}
    {label}
  </NavLink>
);
