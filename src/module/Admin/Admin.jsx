// File: Admin.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  LayoutDashboard,
  Bot,
  Users,
  MessageCircle,
  Settings,
  SquareActivity,
  Folder,
  Zap,
  Megaphone,
  FileText,
  Send,
  ChevronDown,
  LogOut,
  FolderClock,
  Headset,
  User,
  Activity,
  ListTree,
  BarChart2,
  Gauge,
  Clock,
  Plug,
  Shield,
} from "lucide-react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Builder from "./chatbot/Builder";
import Dashboard from "./dashboard/Dashboard";
import LogoutButton from "./components/LogoutButton";
import styles from "./styles/Admin.module.css";
import { parseJwt } from "../../utils/auth";
import { stringToColor } from "../../utils/color";
import { apiGet } from "../../shared/apiClient";

import Preferences from "./preferences/Preferences";
import Channels from "./preferences/Channels";
import ClientsMonitor from "./monitoring/ClientsMonitor";
import Queues from "./atendimento/Queues";
import QuickReplies from "./atendimento/QuickReplies";
import Templates from "./campanhas/Templates";
import UsersPage from "./management/Users";
import Clientes from "./management/clientes/Clientes";
import History from "./atendimento/history/TicketsHistory";
import Campaigns from "./campanhas/Campaigns";
import BillingExtrato from "./analytics/billing/BillingExtrato";

// Temporários (mantidos)
const Quality = () => <div>Qualidade</div>;
const AgentsMonitor = () => <div>Monitor de Atendentes</div>;
const Integrations = () => <div>Integrações</div>;
const Security = () => <div>Segurança</div>;

document.title = "NineChat - Gestão";

export default function Admin() {
  const token = localStorage.getItem("token");
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const location = useLocation();

  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!email) return;
      try {
        const res = await apiGet(`/users/${email}`);
        setUserData(res);
      } catch (err) {
        console.error("Erro ao buscar dados do admin:", err);
      }
    };
    fetchAdminInfo();
  }, [email]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDocDown = (e) => {
      const target = e.target;
      if (navRef.current && !navRef.current.contains(target)) setOpenDropdown(null);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setProfileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const DASHBOARD_PATH = "/";

  /* ===================== MENU (sem ícones nos GRUPOS) ===================== */
  const menus = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        to: DASHBOARD_PATH,
        icon: <LayoutDashboard size={18} />,
        exact: true,
      },

      {
        key: "monitoring",
        label: "Acompanhamento",
        icon: <SquareActivity size={18} />,
        children: [
          {
            key: "monitoring-realtime",
            label: "Tempo real",
            // sem icon aqui (evita duplicar)
            children: [
              { to: "monitoring/realtime/queues", icon: <ListTree size={16} />, label: "Filas (ao vivo)" },
              { to: "monitoring/realtime/agents", icon: <Headset size={16} />, label: "Agentes (ao vivo)" },
            ],
          },
          {
            key: "monitoring-analysis",
            label: "Análise",
            children: [
              { to: "analytics/quality",  icon: <Gauge size={16} />, label: "Qualidade" },
              { to: "analytics/sessions", icon: <Clock size={16} />, label: "Sessões"   },
            ],
          },
        ],
      },

      {
        key: "management",
        label: "Gestão",
        icon: <Users size={18} />,
        children: [
          {
            key: "mgmt-cadastros",
            label: "Cadastros",
            children: [
              { to: "management/users",         icon: <Users size={16} />,        label: "Usuários" },
              { to: "management/queues",        icon: <Folder size={16} />,       label: "Filas" },
              { to: "management/quick-replies", icon: <Zap size={16} />,          label: "Respostas Rápidas" },
              { to: "management/clientes",      icon: <FolderClock size={16} />,  label: "Clientes" },
            ],
          },
          {
            key: "mgmt-operacao",
            label: "Operação",
            children: [
              { to: "management/history", icon: <FolderClock size={16} />, label: "Histórico de Ticket" },
            ],
          },
        ],
      },

      {
        key: "campaigns",
        label: "Campanhas",
        icon: <Megaphone size={18} />,
        children: [
          {
            key: "camp-modelos",
            label: "Modelos",
            children: [
              { to: "campaigns/templates", icon: <FileText size={16} />, label: "Templates" },
            ],
          },
          {
            key: "camp-disparo",
            label: "Disparo",
            children: [
              { to: "campaigns/campaigns", icon: <Send size={16} />, label: "Disparo de Mensagens" },
            ],
          },
        ],
      },

      {
        key: "builder",
        label: "Builder",
        to: "development/builder",
        icon: <Bot size={18} />,
      },

      {
        key: "settings",
        label: "Configurações",
        icon: <Settings size={18} />,
        children: [
          {
            key: "settings-geral",
            label: "Geral",
            children: [
              { to: "settings/preferences", icon: <Settings size={16} />,     label: "Preferências" },
              { to: "settings/channels",    icon: <MessageCircle size={16} />, label: "Canais" },
            ],
          },
          {
            key: "settings-integracoes",
            label: "Integrações",
            children: [
              { to: "settings/integrations", icon: <Plug size={16} />, label: "Integrações" },
            ],
          },
          {
            key: "settings-seguranca",
            label: "Segurança",
            children: [
              { to: "settings/security", icon: <Shield size={16} />, label: "Segurança" },
            ],
          },
        ],
      },
    ],
    []
  );

  const isGroup = (n) => Array.isArray(n?.children) && n.children.length > 0;
  const handleTopClick = (key) => setOpenDropdown((cur) => (cur === key ? null : key));

  return (
    <div className={styles.wrapper}>
      {/* Top Navbar */}
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
          <NavLink to={DASHBOARD_PATH} className={styles.brand}>
            <img src="/logo.png" alt="NineChat" />
            <span>Admin</span>
          </NavLink>
        </div>

        {/* ===== DESKTOP NAV ===== */}
        <nav ref={navRef} className={styles.hnav} aria-label="Menu principal">
          {menus.map((m) => {
            const dropdown = isGroup(m);
            return (
              <div
                key={m.key}
                className={
                  dropdown
                    ? `${styles.hitem} ${styles.hasChildren} ${openDropdown === m.key ? styles.open : ""}`
                    : styles.hitem
                }
              >
                {m.to ? (
                  <NavLink
                    end={m.exact}
                    to={m.to}
                    className={({ isActive }) => `${styles.hlink} ${isActive ? styles.active : ""}`}
                    onClick={() => (dropdown ? handleTopClick(m.key) : undefined)}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </NavLink>
                ) : (
                  <button
                    className={styles.hlink}
                    onClick={() => (dropdown ? handleTopClick(m.key) : undefined)}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                    {dropdown && <ChevronDown size={16} />}
                  </button>
                )}

                {dropdown && (
                  <div className={styles.megamenu} role="menu">
                    {/* cada filho de m é um GRUPO */}
                    <div className={styles.megagrid}>
                      {m.children.map((grp) => (
                        <div className={styles.megagroup} key={grp.key || grp.label}>
                          <div className={styles.megahdr}>{grp.label}</div>
                          <ul className={styles.megasublist}>
                            {grp.children.map((leaf) => (
                              <li key={leaf.to} className={styles.megaitem} role="none">
                                <NavLink
                                  to={leaf.to}
                                  className={({ isActive }) => `${styles.megalink} ${isActive ? styles.active : ""}`}
                                  onClick={() => setOpenDropdown(null)}
                                  role="menuitem"
                                >
                                  {leaf.icon && <span className={styles.megaicon}>{leaf.icon}</span>}
                                  <span>{leaf.label}</span>
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Profile */}
        <div className={styles.profileArea} ref={profileRef}>
          {userData && (
            <>
              <button
                className={styles.userButton}
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
              >
                <div
                  className={styles.avatar}
                  style={{ backgroundColor: stringToColor(userData.email) }}
                  title={userData.email}
                >
                  {userData.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </button>

              {isProfileOpen && (
                <div className={styles.profileDropdown} role="menu">
                  <div className={styles.pdHeader}>
                    <div
                      className={styles.avatar}
                      style={{ backgroundColor: stringToColor(userData.email), width: 36, height: 36 }}
                    >
                      {userData.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className={styles.pdName}>{userData.name || "Usuário"}</div>
                      <div className={styles.pdEmail}>{userData.email}</div>
                    </div>
                  </div>

                  <ul className={styles.pdList}>
                    <li className={styles.pdItem}>
                      <NavLink to="settings/preferences" onClick={() => setProfileOpen(false)}>
                        <span className={styles.pdIcon}><User size={16} /></span>
                        Editar perfil
                      </NavLink>
                    </li>
                    <li className={styles.pdSeparator} role="separator" />
                    <li className={styles.pdItem}>
                      <LogoutButton className={styles.pdAction} onClick={() => setProfileOpen(false)}>
                        <LogOut size={16} />
                        Logout
                      </LogoutButton>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* ===== MOBILE DRAWER ===== */}
      <aside className={`${styles.mobileDrawer} ${isMobileMenuOpen ? styles.open : ""}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button className={styles.drawerClose} onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        <ul className={styles.drawerList}>
          {menus.map((m) => (
            <li key={`m-${m.key}`} className={styles.drawerItem}>
              {isGroup(m) ? (
                <details>
                  <summary>
                    {m.icon}
                    <span>{m.label}</span>
                    <ChevronDown size={16} />
                  </summary>

                  {/* grupos do menu m */}
                  {m.children.map((grp) => (
                    <div key={`g-${grp.key || grp.label}`}>
                      <div className={styles.drawerGroupHdr}>{grp.label}</div>
                      <ul className={styles.drawerSubList}>
                        {grp.children.map((leaf) => (
                          <li key={`i-${leaf.to}`}>
                            <NavLink
                              to={leaf.to}
                              className={({ isActive }) => (isActive ? styles.active : undefined)}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {leaf.icon}
                              <span>{leaf.label}</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </details>
              ) : (
                <NavLink end={m.exact} to={m.to} className={({ isActive }) => (isActive ? styles.active : undefined)} onClick={() => setMobileMenuOpen(false)}>
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

          {/* monitoring */}
          <Route path="monitoring/realtime/agents" element={<AgentsMonitor />} />
          <Route path="monitoring/realtime/queues" element={<ClientsMonitor />} />

          {/* analytics */}
          <Route path="analytics/quality" element={<Quality />} />
          <Route path="analytics/sessions" element={<BillingExtrato />} />

          {/* management */}
          <Route path="management/users" element={<UsersPage />} />
          <Route path="management/queues" element={<Queues />} />
          <Route path="management/quick-replies" element={<QuickReplies />} />
          <Route path="management/history" element={<History />} />
          <Route path="management/clientes" element={<Clientes />} />

          {/* campaigns */}
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="campaigns/campaigns" element={<Campaigns />} />

          {/* builder */}
          <Route path="development/builder" element={<Builder />} />

          {/* settings */}
          <Route path="settings/preferences" element={<Preferences />} />
          <Route path="settings/channels" element={<Channels />} />
          <Route path="settings/integrations" element={<Integrations />} />
          <Route path="settings/security" element={<Security />} />

          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </main>
    </div>
  );
}
