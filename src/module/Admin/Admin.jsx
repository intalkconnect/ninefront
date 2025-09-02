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
  ChevronRight,
  LogOut,
  FolderClock,
  Headset,
  User,
  Activity,
  ListTree,
  BarChart2,
  Gauge,
  Clock,
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
  const [openDropdown, setOpenDropdown] = useState(null); // chave do menu aberto
  const location = useLocation();

  // Perfil
  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Nav (para clique fora)
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

  // fecha mega menu e drawer ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setProfileOpen(false);
  }, [location.pathname]);

  // Fecha menus no clique fora
  useEffect(() => {
    const onDocDown = (e) => {
      const target = e.target;
      if (navRef.current && !navRef.current.contains(target)) setOpenDropdown(null);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Fecha menus com ESC
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

  // caminho fixo do Dashboard; ajuste para "/admin" se sua app estiver montada em /admin
  const DASHBOARD_PATH = "/"; // <- troque para "/admin" se necessário

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
          // ===== Tempo real =====
          {
            key: "monitoring-realtime",
            label: "Tempo real",
            icon: <Activity size={16} />,
            children: [
              {
                to: "monitoring/realtime/queues",
                icon: <ListTree size={16} />,
                label: "Filas (ao vivo)",
              },
              {
                to: "monitoring/realtime/agents",
                icon: <Headset size={16} />,
                label: "Agentes (ao vivo)",
              },
            ],
          },

          // ===== Análise =====
          {
            key: "monitoring-analysis",
            label: "Análise",
            icon: <BarChart2 size={16} />,
            children: [
              {
                to: "analytics/quality",
                icon: <Gauge size={16} />,
                label: "Qualidade",
              },
              {
                to: "analytics/sessions",
                icon: <Clock size={16} />,
                label: "Sessões",
              },
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
            to: "management/users",
            icon: <Users size={16} />,
            label: "Usuários",
          },
          {
            to: "management/queues",
            icon: <Folder size={16} />,
            label: "Filas",
          },
          {
            to: "management/quick-replies",
            icon: <Zap size={16} />,
            label: "Respostas Rápidas",
          },
          {
            to: "management/history",
            icon: <FolderClock size={16} />,
            label: "Histórico de Ticket",
          },
          {
            to: "management/clientes",
            icon: <FolderClock size={16} />,
            label: "Clientes",
          },
        ],
      },
      {
        key: "campaigns",
        label: "Campanhas",
        icon: <Megaphone size={18} />,
        children: [
          {
            to: "campaigns/templates",
            icon: <FileText size={16} />,
            label: "Templates",
          },
          {
            to: "campaigns/campaigns",
            icon: <Send size={16} />,
            label: "Disparo de Mensagens",
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
          { to: "settings/preferences", label: "Preferências" },
          { to: "settings/channels", label: "Canais" },
          { to: "settings/integrations", label: "Integrações" },
          { to: "settings/security", label: "Segurança" },
        ],
      },
    ],
    []
  );

  const isDropdown = (m) => !!m.children?.length;
  const handleTopClick = (key) => setOpenDropdown((cur) => (cur === key ? null : key));

  // --- helpers para submenu de 2 níveis ---
  const renderMenuChildren = (nodes = []) => (
    <ul className={styles.megagrid}>
      {nodes.map((c) => {
        const isGroup = Array.isArray(c.children) && c.children.length > 0;
        if (isGroup) {
          return (
            <li key={c.key} className={`${styles.megaitem} ${styles.megagroup}`} role="none">
              <div className={styles.megahdr}>
                {c.icon && <span className={styles.megaicon}>{c.icon}</span>}
                <span>{c.label}</span>
              </div>
              <ul className={styles.megasublist}>
                {c.children.map((s) => (
                  <li key={s.to || s.key} className={styles.megasubitem} role="none">
                    <NavLink
                      to={s.to}
                      className={({ isActive }) => `${styles.megalink} ${isActive ? styles.active : ""}`}
                      onClick={() => setOpenDropdown(null)}
                      role="menuitem"
                    >
                      {s.icon && <span className={styles.megaicon}>{s.icon}</span>}
                      <span>{s.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          );
        }
        // folha
        return (
          <li key={c.to || c.key} className={styles.megaitem} role="none">
            <NavLink
              to={c.to}
              className={({ isActive }) => `${styles.megalink} ${isActive ? styles.active : ""}`}
              onClick={() => setOpenDropdown(null)}
              role="menuitem"
            >
              {c.icon && <span className={styles.megaicon}>{c.icon}</span>}
              <span>{c.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );

  const renderMobileChildren = (nodes = []) => (
    <ul className={styles.drawerSubList}>
      {nodes.map((c) => {
        const isGroup = Array.isArray(c.children) && c.children.length > 0;
        if (isGroup) {
          return (
            <li key={`g-${c.key}`}>
              <details>
                <summary>
                  {c.icon}
                  <span>{c.label}</span>
                  <ChevronDown size={16} />
                </summary>
                {renderMobileChildren(c.children)}
              </details>
            </li>
          );
        }
        return (
          <li key={`i-${c.to || c.key}`}>
            <NavLink
              to={c.to}
              className={({ isActive }) => (isActive ? styles.active : undefined)}
              onClick={() => setMobileMenuOpen(false)}
            >
              {c.icon}
              <span>{c.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );

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

        <nav ref={navRef} className={styles.hnav} aria-label="Menu principal">
          {menus.map((m) => (
            <div
              key={m.key}
              className={
                isDropdown(m)
                  ? `${styles.hitem} ${styles.hasChildren} ${openDropdown === m.key ? styles.open : ""}`
                  : styles.hitem
              }
            >
              {m.to ? (
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) => `${styles.hlink} ${isActive ? styles.active : ""}`}
                  onClick={() => (isDropdown(m) ? handleTopClick(m.key) : undefined)}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </NavLink>
              ) : (
                <button
                  className={styles.hlink}
                  onClick={() => (isDropdown(m) ? handleTopClick(m.key) : undefined)}
                >
                  {m.icon}
                  <span>{m.label}</span>
                  {isDropdown(m) && <ChevronDown size={16} />}
                </button>
              )}

              {isDropdown(m) && (
                <div className={styles.megamenu} role="menu">
                  {renderMenuChildren(m.children)}
                </div>
              )}
            </div>
          ))}
        </nav>

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

      {/* Mobile Drawer */}
      <aside className={`${styles.mobileDrawer} ${isMobileMenuOpen ? styles.open : ""}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button className={styles.drawerClose} onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">×</button>
        </div>
        <ul className={styles.drawerList}>
          {menus.map((m) => (
            <li key={`m-${m.key}`} className={styles.drawerItem}>
              {isDropdown(m) ? (
                <details
                  open={openDropdown === m.key}
                  onToggle={(e) =>
                    e.currentTarget.open ? setOpenDropdown(m.key) : setOpenDropdown(null)
                  }
                >
                  <summary>
                    {m.icon}
                    <span>{m.label}</span>
                    <ChevronDown size={16} />
                  </summary>
                  {renderMobileChildren(m.children)}
                </details>
              ) : (
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                  onClick={() => setMobileMenuOpen(false)}
                >
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
          <Route path="monitoring/realtime/agents" element={<AgentsMonitor />} />
          <Route path="monitoring/realtime/queues" element={<ClientsMonitor />} />
          <Route path="management/users" element={<UsersPage />} />
          <Route path="analytics/quality" element={<Quality />} />
          <Route path="analytics/sessions" element={<BillingExtrato />} />
          <Route path="management/queues" element={<Queues />} />
          <Route path="management/quick-replies" element={<QuickReplies />} />
          <Route path="management/history" element={<History />} />
          <Route path="management/clientes" element={<Clientes />} />
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="campaigns/campaigns" element={<Campaigns />} />
          <Route path="development/builder" element={<Builder />} />
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
