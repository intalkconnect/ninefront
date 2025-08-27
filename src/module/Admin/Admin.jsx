// File: Admin.jsx
import { useEffect, useMemo, useState, useRef } from "react";
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
  Headset,
  User,
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

// Temporários (mantidos)
const AgentsMonitor = () => <div>Monitor de Atendentes</div>;
const Integrations = () => <div>Integrações</div>;
const Security = () => <div>Segurança</div>;

document.title = "NineChat - Gestão";

export default function Admin() {
  const token = localStorage.getItem("token");
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // chave do menu aberto (mobile) / hover (desktop)
  const location = useLocation();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

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

  // fecha o mega menu ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [location.pathname]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // descobre o caminho base (ex: /admin)
  const basePath = useMemo(() => {
    const root = location.pathname.split("/")[1] || "";
    return root ? `/${root}` : "/";
  }, [location.pathname]);

  const menus = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        to: basePath,
        icon: <Home size={18} />,
        exact: true,
      },
      {
        key: "monitoring",
        label: "Acompanhamento",
        icon: <Activity size={18} />,
        children: [
          {
            to: "monitoring/agents",
            icon: <Headset size={16} />,
            label: "Monitor de Atendentes",
          },
          {
            to: "monitoring/clients",
            icon: <Users size={16} />,
            label: "Monitor de Clientes",
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
            to: "atendimento/queues",
            icon: <Folder size={16} />,
            label: "Filas",
          },
          {
            to: "atendimento/quick-replies",
            icon: <Zap size={16} />,
            label: "Respostas Rápidas",
          },
          {
            to: "atendimento/history",
            icon: <FolderClock size={16} />,
            label: "Histórico de Ticket",
          },
          {
            to: "atendimento/clientes",
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
            to: "campaigns/broadcast",
            icon: <Send size={16} />,
            label: "Disparo de Mensagens",
          },
        ],
      },
      {
        key: "builder",
        label: "Builder",
        to: "builder",
        icon: <Bot size={18} />,
      },
      {
        key: "settings",
        label: "Configurações",
        icon: <Settings size={18} />,
        children: [
          { to: "preferences", label: "Preferências" },
          { to: "channels", label: "Canais" },
          { to: "config/integrations", label: "Integrações" },
          { to: "config/security", label: "Segurança" },
        ],
      },
    ],
    []
  );

  const isDropdown = (m) => !!m.children?.length;
  const handleTopClick = (key) =>
    setOpenDropdown((cur) => (cur === key ? null : key));

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
                  ? `${styles.hitem} ${styles.hasChildren} ${
                      openDropdown === m.key ? styles.open : ""
                    }`
                  : styles.hitem
              }
            >
              {m.to ? (
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) =>
                    `${styles.hlink} ${isActive ? styles.active : ""}`
                  }
                  onClick={() =>
                    isDropdown(m) ? handleTopClick(m.key) : undefined
                  }
                >
                  {m.icon}
                  <span>{m.label}</span>
                </NavLink>
              ) : (
                <button
                  className={styles.hlink}
                  onClick={() =>
                    isDropdown(m) ? handleTopClick(m.key) : undefined
                  }
                >
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
                        <NavLink
                          to={c.to}
                          className={({ isActive }) =>
                            `${styles.megalink} ${
                              isActive ? styles.active : ""
                            }`
                          }
                          role="menuitem"
                        >
                          {c.icon && (
                            <span className={styles.megaicon}>{c.icon}</span>
                          )}
                          <span>{c.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
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
                  <span className={styles.statusDot} aria-hidden />
                </div>
                <span className={styles.userNameTop}>
                  {userData.name?.split(" ")[0] || "Usuário"}
                </span>
              </button>

              {isProfileOpen && (
                <div className={styles.profileDropdown} role="menu">
                  <div className={styles.pdHeader}>
                    <div
                      className={styles.avatar}
                      style={{
                        backgroundColor: stringToColor(userData.email),
                        width: 36,
                        height: 36,
                      }}
                    >
                      {userData.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className={styles.pdName}>
                        {userData.name || "Usuário"}
                      </div>
                      <div className={styles.pdEmail}>{userData.email}</div>
                    </div>
                  </div>

                  <ul className={styles.pdList}>
                    <li className={styles.pdItem}>
                      <NavLink
                        to="preferences"
                        onClick={() => setProfileOpen(false)}
                      >
                        <span className={styles.pdIcon}>
                          <User size={16} />
                        </span>
                        Editar perfil
                      </NavLink>
                    </li>

                    <li className={styles.pdSeparator} role="separator" />

                    <li className={styles.pdItem}>
                      <LogoutButton
                        className={styles.pdAction}
                        onClick={() => setProfileOpen(false)}
                      >
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
      <aside
        className={`${styles.mobileDrawer} ${
          isMobileMenuOpen ? styles.open : ""
        }`}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button
            className={styles.drawerClose}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>
        <ul className={styles.drawerList}>
          {menus.map((m) => (
            <li key={`m-${m.key}`} className={styles.drawerItem}>
              {isDropdown(m) ? (
                <details
                  open={openDropdown === m.key}
                  onToggle={(e) =>
                    e.currentTarget.open
                      ? setOpenDropdown(m.key)
                      : setOpenDropdown(null)
                  }
                >
                  <summary>
                    {m.icon}
                    <span>{m.label}</span>
                    <ChevronDown size={16} />
                  </summary>
                  <ul>
                    {m.children.map((c) => (
                      <li key={`c-${c.to}`}>
                        <NavLink
                          to={c.to}
                          className={({ isActive }) =>
                            isActive ? styles.active : undefined
                          }
                        >
                          {c.icon}
                          <span>{c.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) =>
                    isActive ? styles.active : undefined
                  }
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
