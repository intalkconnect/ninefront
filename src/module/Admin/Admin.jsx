// File: Admin.jsx
import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  Bot,
  Users,
  MessageCircle,
  Settings,
  Activity,
  Folder,
  Zap,
  Megaphone,
  FileText,
  Send,
  ChevronDown,
  ChevronRight,
  LogOut,
  FolderClock,
  Headset
} from 'lucide-react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Builder from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import LogoutButton from './components/LogoutButton';
import styles from './styles/Admin.module.css';
import { parseJwt } from '../../utils/auth';
import { stringToColor } from '../../utils/color';
import { apiGet } from '../../shared/apiClient';

import Preferences from './preferences/Preferences';
import Channels from './preferences/Channels';
import ClientsMonitor from './monitoring/ClientsMonitor';
import Queues from './atendimento/Queues';
import QuickReplies from './atendimento/QuickReplies';
import Templates from './campanhas/Templates';
import UsersPage from './management/Users';
import Clientes from './management/clientes/Clientes';
import History from './atendimento/history/TicketsHistory';

// Temporários (mantidos)
const AgentsMonitor = () => <div>Monitor de Atendentes</div>;
const Integrations = () => <div>Integrações</div>;
const Security = () => <div>Segurança</div>;

document.title = 'NineChat - Gestão';

export default function Admin() {
  const token = localStorage.getItem('token');
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // chave do menu aberto (mobile) / hover (desktop)
  const location = useLocation();

  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!email) return;
      try {
        const res = await apiGet(`/users/${email}`);
        setUserData(res);
      } catch (err) {
        console.error('Erro ao buscar dados do admin:', err);
      }
    };
    fetchAdminInfo();
  }, [email]);

  // fecha o mega menu ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  // descobre o caminho base (ex: /admin)
  const basePath = useMemo(() => {
    const root = location.pathname.split('/')[1] || '';
    return root ? `/${root}` : '/';
  }, [location.pathname]);

  const menus = useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        to: basePath,
        icon: <Home size={18} />,
        exact: true
      },
      {
        key: 'monitoring',
        label: 'Acompanhamento',
        icon: <Activity size={18} />,
        children: [
          { to: 'monitoring/agents', icon: <Headset size={16} />, label: 'Monitor de Atendentes' },
          { to: 'monitoring/clients', icon: <Users size={16} />, label: 'Monitor de Clientes' }
        ]
      },
      {
        key: 'management',
        label: 'Gestão',
        icon: <Users size={18} />,
        children: [
          { to: 'management/users', icon: <Users size={16} />, label: 'Usuários' },
          { to: 'atendimento/queues', icon: <Folder size={16} />, label: 'Filas' },
          { to: 'atendimento/quick-replies', icon: <Zap size={16} />, label: 'Respostas Rápidas' },
          { to: 'atendimento/history', icon: <FolderClock size={16} />, label: 'Histórico de Ticket' },
          { to: 'atendimento/clientes', icon: <FolderClock size={16} />, label: 'Clientes' }
        ]
      },
      {
        key: 'campaigns',
        label: 'Campanhas',
        icon: <Megaphone size={18} />,
        children: [
          { to: 'campaigns/templates', icon: <FileText size={16} />, label: 'Templates' },
          { to: 'campaigns/broadcast', icon: <Send size={16} />, label: 'Disparo de Mensagens' }
        ]
      },
      {
        key: 'builder',
        label: 'Builder',
        to: 'builder',
        icon: <Bot size={18} />
      },
      {
        key: 'settings',
        label: 'Configurações',
        icon: <Settings size={18} />,
        children: [
          { to: 'preferences', label: 'Preferências' },
          { to: 'channels', label: 'Canais' },
          { to: 'config/integrations', label: 'Integrações' },
          { to: 'config/security', label: 'Segurança' }
        ]
      }
    ],
    []
  );

  const isDropdown = (m) => !!m.children?.length;
  const handleTopClick = (key) => setOpenDropdown((cur) => (cur === key ? null : key));

  return (
    <div className={styles.wrapper}>
      {/* Top Navbar (estilo Pixinvent) */}
      <header className={styles.topbar}>
        <div className={styles.brandArea}>
          <button
            className={styles.burger}
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <NavLink to={basePath} className={styles.brand}>
            <img src="/logo.png" alt="NineChat" />
            <span>Admin</span>
          </NavLink>
        </div>

        <nav className={styles.hnav} aria-label="Menu principal">
          {menus.map((m) => (
            <div
              key={m.key}
              className={
                isDropdown(m)
                  ? `${styles.hitem} ${styles.hasChildren} ${openDropdown === m.key ? styles.open : ''}`
                  : styles.hitem
              }
              
            >
              {m.to ? (
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) => `${styles.hlink} ${isActive ? styles.active : ''}`}
                  onClick={() => (isDropdown(m) ? handleTopClick(m.key) : undefined)}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </NavLink>
              ) : (
                <button className={styles.hlink} onClick={() => (isDropdown(m) ? handleTopClick(m.key) : undefined)}>
                  {m.icon}
                  <span>{m.label}</span>
                  {isDropdown(m) && <ChevronDown size={16} />}
                </button>
              )}

              {isDropdown(m) && (
                <div className={styles.megamenu} role="menu">
                  <ul className={styles.megagrid}>
                    {m.children.map((c) => (
                      <li key={c.to} className={styles.megaitem} role="none">
                        <NavLink to={c.to} className={({ isActive }) => `${styles.megalink} ${isActive ? styles.active : ''}`} role="menuitem">
                          {c.icon && <span className={styles.megaicon}>{c.icon}</span>}
                          <span>{c.label}</span>
                          <ChevronRight size={14} className={styles.chev} />
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.profileArea}>
          {userData && (
            <div className={styles.user}>
              <div
                className={styles.avatar}
                style={{ backgroundColor: stringToColor(userData.email) }}
                title={userData.email}
              >
                {userData.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{userData.name?.split(' ')[0] || 'Usuário'}</span>
                <span className={styles.userEmail}>{userData.email}</span>
              </div>
              <LogoutButton className={styles.logout} title="Sair">
                <LogOut size={16} />
              </LogoutButton>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      <aside className={`${styles.mobileDrawer} ${isMobileMenuOpen ? styles.open : ''}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button className={styles.drawerClose} onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        <ul className={styles.drawerList}>
          {menus.map((m) => (
            <li key={`m-${m.key}`} className={styles.drawerItem}>
              {isDropdown(m) ? (
                <details open={openDropdown === m.key} onToggle={(e) => e.currentTarget.open ? setOpenDropdown(m.key) : setOpenDropdown(null)}>
                  <summary>
                    {m.icon}
                    <span>{m.label}</span>
                    <ChevronDown size={16} />
                  </summary>
                  <ul>
                    {m.children.map((c) => (
                      <li key={`c-${c.to}`}>
                        <NavLink to={c.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                          {c.icon}
                          <span>{c.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <NavLink end={m.exact} to={m.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                  {m.icon}
                  <span>{m.label}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* Conteúdo */}
      <main className={styles.content}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="monitoring/agents" element={<AgentsMonitor />} />
          <Route path="monitoring/clients" element={<ClientsMonitor />} />
          <Route path="management/users" element={<UsersPage />} />
          <Route path="atendimento/queues" element={<Queues />} />
          <Route path="atendimento/quick-replies" element={<QuickReplies />} />
          <Route path="atendimento/history" element={<History />} />
          <Route path="atendimento/clientes" element={<Clientes />} />
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="builder" element={<Builder />} />
          <Route path="preferences" element={<Preferences />} />
          <Route path="channels" element={<Channels />} />
          <Route path="config/integrations" element={<Integrations />} />
          <Route path="config/security" element={<Security />} />
          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </main>
    </div>
  );
}
