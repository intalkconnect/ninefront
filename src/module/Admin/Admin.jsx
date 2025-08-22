import { useEffect, useState } from 'react';
import { 
  Home, 
  Bot, 
  Users, 
  MessageCircle, 
  Settings, 
  Activity,
  UserCheck,
  Folder,
  Zap,
  Megaphone,
  FileText,
  Send,
  ChevronDown, 
  ChevronRight,
  LogOut 
} from 'lucide-react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import Builder from './chatbot/Builder';
import Dashboard from './dashboard/Dashboard';
import UsersPage from './users/Users';
import LogoutButton from './components/LogoutButton';
import styles from './styles/Admin.module.css';
import { parseJwt } from '../../utils/auth';
import { stringToColor } from '../../utils/color';
import { apiGet } from "../../shared/apiClient";

import Preferences from './preferences/Preferences';
import Channels from './preferences/Channels';
import ClientsMonitor from './monitoring/ClientsMonitor';
import Queues from './atendimento/Queues';
import QuickReplies from './atendimento/QuickReplies';

// Componentes temporários para novas rotas
const AgentsMonitor = () => <div>Monitor de Atendentes</div>;
const Templates = () => <div>Templates de Campanhas</div>;
const Broadcast = () => <div>Disparo de Mensagens</div>;
const General = () => <div>Configurações Gerais</div>;
const Integrations = () => <div>Integrações</div>;
const Security = () => <div>Segurança</div>;

document.title = 'NineChat - Gestão';

export default function Admin() {
  const token = localStorage.getItem('token');
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState({
    monitoring: false,
    attendance: false,
    campaigns: false,
    config: false
  });

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

  const toggleMenu = (menuKey) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const MenuSection = ({ title, children }) => (
    <div className={styles['menu-section']}>
      <h3 className={styles['section-title']}>{title}</h3>
      <div className={styles['section-items']}>
        {children}
      </div>
    </div>
  );

  const MenuIcon = ({ to, icon, label, end = false, badge = null, isDevelopment = false }) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${styles['menu-icon']} ${isActive ? styles.active : ''} ${isDevelopment ? styles.development : ''}`}
    >
      {icon}
      <span className={styles['menu-label']}>
        {label}
        {isDevelopment && (
          <span className={styles['dev-badge']}>Em desenvolvimento</span>
        )}
      </span>
      {badge && <span className={styles['notification-badge']}>{badge}</span>}
    </NavLink>
  );

  const DropdownMenu = ({ 
    menuKey, 
    icon, 
    label, 
    children, 
    badge = null 
  }) => {
    const isExpanded = expandedMenus[menuKey];
    
    return (
      <div className={styles.dropdown}>
        <button
          className={styles['dropdown-toggle']}
          onClick={() => toggleMenu(menuKey)}
        >
          {icon}
          <span className={styles['menu-label']}>{label}</span>
          {badge && <span className={styles['notification-badge']}>{badge}</span>}
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isExpanded && (
          <div className={styles['dropdown-menu']}>
            {children}
          </div>
        )}
      </div>
    );
  };

  const DropdownLink = ({ to, icon, label }) => (
    <NavLink 
      to={to} 
      className={styles['dropdown-link']}
      onClick={() => setExpandedMenus(prev => ({ ...prev }))}
    >
      {icon && <span className={styles['dropdown-icon']}>{icon}</span>}
      {label}
    </NavLink>
  );

  return (
    <div className={styles['layout-wrapper']}>
      <aside className={styles['sidebar']}>
        <div>
          <div className={styles.logo}>
            <MessageCircle className={styles['logo-icon']} />
            <div>
              <div className={styles['logo-title']}>NineChat</div>
              <div className={styles['logo-subtitle']}>Painel Administrativo</div>
            </div>
          </div>

          <nav className={styles['sidebar-nav']}>
            {/* Análise */}
            <MenuSection title="Análise">
              <MenuIcon 
                to="" 
                icon={<Home size={18} />} 
                label="Dashboard" 
                end={true}
              />
              
              <DropdownMenu
                menuKey="monitoring"
                icon={<Activity size={18} />}
                label="Acompanhamento"
              >
                <DropdownLink 
                  to="monitoring/agents" 
                  icon={<UserCheck size={16} />}
                  label="Monitor de Atendentes" 
                  isDevelopment={true}
                />
                <DropdownLink 
                  to="monitoring/clients" 
                  icon={<Users size={16} />}
                  label="Monitor de Clientes" 
                />
              </DropdownMenu>
            </MenuSection>

            <div className={styles.divider} />

            {/* Gestão */}
            <MenuSection title="Gestão">
              <MenuIcon 
                to="users" 
                icon={<Users size={18} />} 
                label="Usuários" 
                isDevelopment={true}
              />

              <DropdownMenu
                menuKey="attendance"
                icon={<MessageCircle size={18} />}
                label="Atendimento"
                badge={3}
              >
                <DropdownLink 
                  to="atendimento/queues" 
                  icon={<Folder size={16} />}
                  label="Filas" 
                />
                <DropdownLink 
                  to="atendimento/quick-replies" 
                  icon={<Zap size={16} />}
                  label="Respostas Rápidas" 
                />
              </DropdownMenu>

              <DropdownMenu
                menuKey="campaigns"
                icon={<Megaphone size={18} />}
                label="Campanhas"
                isDevelopment={true}
              >
                <DropdownLink 
                  to="campaigns/templates" 
                  icon={<FileText size={16} />}
                  label="Templates" 
                />
                <DropdownLink 
                  to="campaigns/broadcast" 
                  icon={<Send size={16} />}
                  label="Disparo de Mensagens" 
                />
              </DropdownMenu>
            </MenuSection>

            <div className={styles.divider} />

            {/* Desenvolvimento */}
            <MenuSection title="Desenvolvimento">
              <MenuIcon 
                to="builder" 
                icon={<Bot size={18} />} 
                label="Builder"
              />
            </MenuSection>

            <div className={styles.divider} />

            {/* Sistema */}
            <MenuSection title="Sistema">
              <DropdownMenu
                menuKey="config"
                icon={<Settings size={18} />}
                label="Configurações"
              >
                <DropdownLink 
                  to="preferences" 
                  label="Preferências" 
                />
                <DropdownLink 
                  to="channels" 
                  label="Canais" 
                />
                <DropdownLink 
                  to="config/integrations" 
                  label="Integrações" 
                />
                <DropdownLink 
                  to="config/security" 
                  label="Segurança" 
                />
              </DropdownMenu>
            </MenuSection>
          </nav>
        </div>

        <div className={styles['sidebar-footer']}>
          {userData && (
            <div className={styles.profileContainer}>
              <div className={styles['profile-info']}>
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
              <LogoutButton className={styles['logout-button']}>
                <LogOut size={16} />
              </LogoutButton>
            </div>
          )}
        </div>
      </aside>

      <main className={styles['main-content']}>
        <Routes>
          <Route index element={<Dashboard />} />
          
          {/* Análise */}
          <Route path="monitoring/agents" element={<AgentsMonitor />} />
          <Route path="monitoring/clients" element={<ClientsMonitor />} />
          
          {/* Gestão */}
          <Route path="users" element={<UsersPage />} />
          <Route path="atendimento/queues" element={<Queues />} />
          <Route path="atendimento/quick-replies" element={<QuickReplies />} />
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="campaigns/broadcast" element={<Broadcast />} />
          
          {/* Desenvolvimento */}
          <Route path="builder" element={<Builder />} />
          
          {/* Sistema */}
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
