import { Home, Bot, Users, Settings } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import styles from './styles/Admin.module.css';

import LogoutButton from '../../../components/LogoutButton';

document.title = 'HubHMG - Gestão';

export default function Admin() {
  return (
    <div className={styles['admin-wrapper']}>
      <header className={styles['admin-header']}>
        <h2 className={styles['admin-logo']}>Painel Admin</h2>

        <div className={styles['admin-header-right']}>
          <nav className={styles['admin-nav']}>
            <MenuItem to="" label="Início" icon={<Home size={18} />} />
            <MenuItem to="chatbot" label="Chatbot" icon={<Bot size={18} />} />
            <MenuItem to="users" label="Usuários" icon={<Users size={18} />} />
            <MenuItem to="configuracoes" label="Configurações" icon={<Settings size={18} />} />
          </nav>

          <LogoutButton />
        </div>
      </header>

      <main className={styles['admin-main']}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="configuracoes" element={<div className={styles['admin-page']}>Página de Configurações</div>} />
          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </main>
    </div>
  );
}

const MenuItem = ({ to, label, icon }) => (
  <NavLink
    to={to}
    end={to === ''}
    className={({ isActive }) =>
      `${styles['admin-menu-item']} ${isActive ? styles.active : ''}`
    }
  >
    {icon}
    {label}
  </NavLink>
);
