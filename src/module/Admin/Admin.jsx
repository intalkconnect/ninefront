import { Home, Bot, Users, Settings } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from '../components/LogoutButton';
import styles from './styles/Admin.module.css';
import { parseJwt } from '../../utils/auth';
import { stringToColor } from '../../utils/color';


document.title = 'HubHMG - Gestão';

export default function Admin() {
  
const token = localStorage.getItem('token');
const { email } = token ? parseJwt(token) : {};
  
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
{email && (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  }}>
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      backgroundColor: stringToColor(email),
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1rem',
      fontWeight: 'bold',
      userSelect: 'none',
    }}>
      {email.charAt(0).toUpperCase()}
    </div>
    <div style={{
      color: '#aaa',
      fontSize: '0.65rem',
      textAlign: 'center',
      wordBreak: 'break-word',
      maxWidth: '56px',
    }}>
      {email}
    </div>
  </div>
)}
<LogoutButton className={styles['logout-button']} />


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
