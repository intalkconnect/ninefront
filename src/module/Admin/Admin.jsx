import { Home, Bot, Users, Settings } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from '../components/LogoutButton';
import styles from './styles/Admin.module.css';

document.title = 'HubHMG - Gestão';

export default function Admin() {
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
          <LogoutButton className={styles['logout-button']} />
        </div>
      </aside>

      <main className={styles['main-content']}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="users" element={<UsersPage />} />
          <Route
            path="configuracoes"
            element={<div>Página de Configurações</div>}
          />
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
