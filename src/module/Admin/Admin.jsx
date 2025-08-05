import { useEffect, useState } from 'react';
import { Home, Bot, Users, Settings, LogOut } from 'lucide-react';
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
      <aside className={styles.sidebar}>
        <div>
          <div className={styles.logo}>HubHMG</div>

          <nav className={styles.nav}>
            <MenuIcon to="" icon={<Home size={20} />} label="Dashboard" />
            <MenuIcon to="chatbot" icon={<Bot size={20} />} label="Chatbot" />
            <MenuIcon to="users" icon={<Users size={20} />} label="Usuários" />

            <div className={styles.dropdown}>
              <div
                className={styles.dropdownToggle}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Settings size={20} />
                <span>Configurações</span>
              </div>
              {showDropdown && (
                <div className={styles.dropdownMenu}>
                  <NavLink to="configuracoes">Preferências</NavLink>
                  <NavLink to="configuracoes">Aparência</NavLink>
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className={styles.profile}>
          {userData && (
            <>
              <div className={styles.avatar} style={{ backgroundColor: stringToColor(userData.email) }}>
                {userData.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <div className={styles.userName}>{userData.name}</div>
                <div className={styles.userEmail}>{userData.email}</div>
              </div>
            </>
          )}
          <LogoutButton className={styles.logout}>
            <LogOut size={16} />
            <span>Sair</span>
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
      `${styles.menuItem} ${isActive ? styles.active : ''}`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);
