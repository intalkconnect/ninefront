import { Home, Bot, Users, Settings } from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Chatbot from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from '../components/LogoutButton';
import styles from './styles/Admin.module.css';

document.title = 'HubHMG - Gestão';

export default function Admin() {
  // Dados de exemplo baseados na imagem
  const items = [
    { id: 1, leftText: "X16-3440...", rightText: "Restaurant Versão", date: "31/07/2023, 18:36:00" },
    { id: 2, leftText: "YohMee...", rightText: "Restaurant Versão", date: "31/07/2023, 18:27:10" },
    { id: 3, leftText: "Y2MoMe...", rightText: "Restaurant Versão", date: "31/07/2023, 18:14:41" },
    { id: 4, leftText: "Y4Y1Y3...", rightText: "Restaurant Versão", date: "31/07/2023, 18:13:09" },
  ];

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
        <div className={styles['items-container']}>
          {items.map((item) => (
            <div key={item.id} className={styles['item-card']}>
              <div className={styles['item-left']}>
                <div className={styles['item-title']}>{item.leftText}</div>
                <div className={styles['item-date']}>{item.date}</div>
              </div>
              <div className={styles['item-right']}>
                <div className={styles['item-title']}>{item.rightText}</div>
                <div className={styles['item-date']}>{item.date}</div>
              </div>
            </div>
          ))}
        </div>
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
