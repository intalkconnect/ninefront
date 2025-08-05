import { useEffect, useState } from 'react';
import { Home, Bot, Users, Settings } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from '../components/LogoutButton';
import styles from './styles/Admin.module.css';
import { parseJwt } from '../../utils/auth';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../services/apiClient'; // ✅ Certifique-se que este está correto

document.title = 'HubHMG - Gestão';

export default function Admin() {
  const token = localStorage.getItem('token');
  const { email } = token ? parseJwt(token) : {};

  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!email) return;
      try {
        const res = await apiGet(`/atendentes/${email}`);
        setUserData(res); // name, lastname, email...
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
            <MenuIcon to="" icon={<Home size={20} />} />
            <MenuIcon to="chatbot" icon={<Bot size={20} />} />
            <MenuIcon to="users" icon={<Users size={20} />} />
            <MenuIcon to="configuracoes" icon={<Settings size={20} />} />
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
          <LogoutButton className={styles['logout-button']} />
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

const MenuIcon = ({ to, icon }) => (
  <NavLink
    to={to}
    end={to === ''}
    className={({ isActive }) =>
      `${styles['menu-icon']} ${isActive ? styles.active : ''}`
    }
  >
    {icon}
  </NavLink>
);
