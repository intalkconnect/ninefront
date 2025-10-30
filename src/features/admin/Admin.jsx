// File: Admin.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import {
  LayoutDashboard,
  Bot,
  Users,
  MessageCircle,
  Settings as SettingsIcon,
  SquareActivity,
  CircleHelp,
  Route as RouteIcon,
  GraduationCap,
  Folder,
  Megaphone,
  FileText,
  Send,
  ChevronDown,
  LogOut,
  Headset,
  User,
  ListTree,
  Gauge,
  Clock,
  Plug,
  Shield,
  Code2,
  Contact,
  UserPen,
  MessageSquareReply,
  WalletCards,
  SearchCheck,
  Workflow
} from "lucide-react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import FlowHub from "./flow/FlowHub";
import Builder from "./flow/Builder";
import FlowChannels from "./flow/FlowChannels";
import Dashboard from "./dashboard/Dashboard";
import LogoutButton from "../../components/common/LogoutButton";
import styles from "./styles/Admin.module.css";
import { parseJwt } from "../../app/utils/auth";
import { stringToColor } from "../../app/utils/color";
import { apiGet, setActorContext } from "../../shared/apiClient";

import Preferences from "./preferences/settings/Settings";
import ClientsMonitor from "./monitoring/clientsMonitor/ClientsMonitor";
import AgentsMonitor from "./monitoring/agentsMonitor/AgentsMonitor";
import JourneyTracker from "./monitoring/journeyTracker/JourneyTracker";
import JourneyBeholder from "./monitoring/journeyTracker/JourneyBeholder";
import Queues from "./management/queue/Queues";
import QueueForm from "./management/queue/QueueForm";
import QueueHours from "./management/queue/QueueHours";
import QuickReplies from "./management/quickReplies/QuickReplies";
import Templates from "./campaigns/template/Templates";
import TemplateCreate from "./campaigns/template/TemplateCreate";

import UsersPage from "./management/users/Users";
import UserForm from "./management/users/UserForm";

import Clientes from "./management/clientes/Clientes";
import History from "./atendimento/history/TicketsHistory";
import Campaigns from "./campaigns/campaign/Campaigns";
import CampaignCreate from "./campaigns/campaign/CampaignCreate";
import BillingExtrato from "./analytics/billing/BillingExtrato";
import Quality from "./analytics/quality/Quality";
import TicketDetail from "./atendimento/history/TicketDetail";
import WhatsAppProfile from "./flow/channels/whatsapp/WhatsAppProfile";
import TelegramConnect from "./flow/channels/telegram/TelegramConnect";
import TokensSecurity from "./preferences/security/Tokens";
import AuditLogs from "./preferences/logs/AuditLogs";

document.title = "NineChat - Gestão";

function RequireRole({ allow, children }) {
  console.log("🔐 RequireRole - Permissão:", allow);
  if (!allow) {
    console.log("🚫 Acesso negado - Redirecionando para /");
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const jwt = token ? parseJwt(token) : {};
  const { email } = jwt || {};
  const [userData, setUserData] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef(null);
  const navRef = useRef(null);
  const closeAllMenus = () => {
    setOpenDropdown(null);
    setProfileOpen(false);
    setHelpOpen(false);
    setMobileMenuOpen(false);
  };

  // DEBUG: Log da rota atual
  useEffect(() => {
    console.log("📍 ROTA ATUAL:", location.pathname);
    console.log("🔍 Location object:", location);
  }, [location]);

  useEffect(() => {
    // (1) Define um ator inicial a partir do JWT, antes de QUALQUER request
    if (jwt?.sub || email) {
      setActorContext({
        id: jwt?.sub || email,
        name: jwt?.name || email,
        email: email || jwt?.email || "",
      });
    }
    let mounted = true;
    const fetchAdminInfo = async () => {
      setAuthLoading(true);
      try {
        if (email) {
          console.log("👤 Buscando dados do usuário:", email);
          const res = await apiGet(`/users/${email}`);
          if (mounted) setUserData(res);
          setActorContext({
            id: res?.id || res?.userId || res?.email || email,
            name: res?.name || res?.nome || res?.email || email,
            email: res?.email || email,
          });
          console.log("✅ Dados do usuário carregados:", res);
        } else {
          if (mounted) setUserData(null);
          console.log("❌ Email não encontrado no token");
        }
      } catch (err) {
        console.error("Erro ao buscar dados do admin:", err);
        if (mounted) setUserData(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    fetchAdminInfo();
    return () => {
      mounted = false;
    };
  }, [email]);

  // fecha mega menu e drawer ao trocar de rota
  useEffect(() => {
    console.log("🔄 Fechando menus devido à mudança de rota");
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    setProfileOpen(false);
    setHelpOpen(false);
  }, [location.pathname]);

  // Clique fora
  useEffect(() => {
    const onDocDown = (e) => {
      const target = e.target;
      if (navRef.current && !navRef.current.contains(target))
        setOpenDropdown(null);
      if (profileRef.current && !profileRef.current.contains(target))
        setProfileOpen(false);
      if (helpRef.current && !helpRef.current.contains(target))
        setHelpOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

  // ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenDropdown(null);
        setProfileOpen(false);
        setHelpOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const DASHBOARD_PATH = "/";

  /* ===== Permissões ===== */
  const role =
    userData?.role || userData?.perfil || userData?.profile || "user";

  const isAdmin = role?.toLowerCase() === "admin";
  const isSupervisor = role?.toLowerCase() === "supervisor";

  console.log("🎭 Permissões detectadas:", { role, isAdmin, isSupervisor });

  const filterMenusByRole = (items) => {
    console.log("📋 Filtrando menus por role:", role);
    if (!isSupervisor) return items;
    return items
      .filter((m) => !["development", "settings"].includes(m.key))
      .map((m) => {
        if (m.key !== "monitoring") return m;
        const cloned = {
          ...m,
          children: m.children?.map((g) => ({ ...g })),
        };
        cloned.children = cloned.children?.map((grp) => {
          if (grp.key !== "monitoring-analysis") return grp;
          return {
            ...grp,
            children: (grp.children || []).filter(
              (leaf) => leaf.to !== "analytics/sessions"
            ),
          };
        });
        return cloned;
      });
  };

  const menus = useMemo(() => {
    const filtered = filterMenusByRole([
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
            children: [
              {
                to: "monitoring/realtime/queues",
                icon: <ListTree size={16} />,
                label: "Filas",
              },
              {
                to: "monitoring/realtime/agents",
                icon: <Headset size={16} />,
                label: "Agentes",
              },
            ],
          },
          {
            key: "monitoring-analysis",
            label: "Análise",
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
            key: "mgmt-cadastros",
            label: "Cadastros",
            children: [
              {
                to: "management/users",
                icon: <UserPen size={16} />,
                label: "Usuários",
              },
              {
                to: "management/queues",
                icon: <Folder size={16} />,
                label: "Filas",
              },
              {
                to: "management/quick-replies",
                icon: <MessageSquareReply size={16} />,
                label: "Respostas Rápidas",
              },
            ],
          },
          {
            key: "mgmt-operacao",
            label: "Operação",
            children: [
              {
                to: "management/history",
                icon: <WalletCards size={16} />,
                label: "Histórico de Ticket",
              },
              {
                to: "management/clientes",
                icon: <Contact size={16} />,
                label: "Clientes",
              },
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
              {
                to: "campaigns/templates",
                icon: <FileText size={16} />,
                label: "Templates",
              },
            ],
          },
          {
            key: "camp-disparo",
            label: "Mensagens Ativas",
            children: [
              {
                to: "campaigns/campaigns",
                icon: <Send size={16} />,
                label: "Disparo Ativo",
              },
            ],
          },
        ],
      },

      {
        key: "development",
        label: "Desenvolvimento",
        icon: <Code2 size={18} />,
        children: [
          {
            key: "dev-tools",
            label: "Ferramentas",
            children: [
              {
                to: "development/flowhub",
                icon: <Workflow size={16} />,
                label: "Flow Hub",
              },
              {
                to: "development/tracker",
                icon: <RouteIcon size={16} />,
                label: "Flow Tracker",
              },
            ],
          },
        ],
      },
      {
        key: "settings",
        label: "Configurações",
        icon: <SettingsIcon size={18} />,
        children: [
          {
            key: "settings-geral",
            label: "Geral",
            children: [
              {
                to: "settings/preferences",
                icon: <SettingsIcon size={16} />,
                label: "Preferências",
              },
            ],
          },
          {
            key: "settings-seguranca",
            label: "Segurança",
            children: [
              {
                to: "settings/security",
                icon: <Shield size={16} />,
                label: "Segurança",
              },
              {
                to: "settings/logs",
                icon: <SearchCheck size={16} />,
                label: "Logs",
              },
            ],
          },
        ],
      },
    ]);

    console.log("📁 Menus filtrados:", filtered);
    return filtered;
  }, [isSupervisor]);

  const isGroup = (n) => Array.isArray(n?.children) && n.children.length > 0;
  const handleTopClick = (key) => {
    console.log("🖱️ Clicado no menu:", key);
    setOpenDropdown((cur) => (cur === key ? null : key));
  };

  // ✅ FUNÇÃO CORRIGIDA DE NAVEGAÇÃO
  const handleNavigation = (path) => {
    const targetPath = path.startsWith("/") ? path : `/${path}`;
    console.log("🔄 Navegando para:", {
      pathOriginal: path,
      targetPath: targetPath,
      currentPath: location.pathname,
    });

    navigate(targetPath);
  };

  if (authLoading) {
    console.log("⏳ Carregando auth...");
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg, #0b0f1a)",
          color: "var(--fg, #e5e7eb)",
        }}
      >
        <div style={{ display: "grid", gap: 12, placeItems: "center" }}>
          <img
            src="/logo.png"
            alt="NineChat"
            style={{ width: 56, height: 56, opacity: 0.9 }}
          />
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            Carregando seu workspace…
          </div>
          <div
            aria-label="Carregando"
            role="status"
            style={{
              width: 160,
              height: 6,
              borderRadius: 999,
              overflow: "hidden",
              background: "rgba(255,255,255,0.08)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "40%",
                borderRadius: 999,
                background: "rgba(255,255,255,0.35)",
                animation: "nc-shimmer 1.2s infinite",
              }}
            />
            <style>
              {`@keyframes nc-shimmer {
                0% { transform: translateX(-40%); }
                50% { transform: translateX(80%); }
                100% { transform: translateX(160%); }
              }`}
            </style>
          </div>
        </div>
      </div>
    );
  }

  console.log("🎬 Renderizando Admin...");

  return (
    <div className={styles.wrapper}>
      {/* Top Navbar */}
      <header className={styles.topbar}>
        <div className={styles.brandArea}>
          <button
            className={styles.burger}
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen((v) => !v)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>

          {/* Logo */}
          <NavLink
            to={DASHBOARD_PATH}
            className={styles.brand}
            onClick={(e) => {
              e.preventDefault();
              console.log("🏠 Logo clicado - Navegando para dashboard");
              navigate("/", { replace: true });
            }}
          >
            <img src="/logo-front.png" alt="NineChat" />
          </NavLink>
        </div>

        {/* Help + Profile */}
        <div className={styles.profileArea}>
          {/* Help button */}
          <div ref={helpRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={styles.userButton}
              onClick={() => {
                setHelpOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Abrir ajuda"
              aria-haspopup="menu"
              aria-expanded={isHelpOpen}
              title="Ajuda"
            >
              <CircleHelp size={18} />
            </button>
            {isHelpOpen && (
              <div
                className={styles.profileDropdown}
                role="menu"
                aria-label="Ajuda"
              >
                <ul className={styles.pdList}>
                  {isAdmin && (
                    <li className={styles.pdItem}>
                      <a
                        href="https://docs.ninechat.com.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setHelpOpen(false)}
                      >
                        <span className={styles.pdIcon}>
                          <FileText size={16} />
                        </span>
                        NineDocs
                      </a>
                    </li>
                  )}
                  <li className={styles.pdItem}>
                    <a
                      href="#"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setHelpOpen(false)}
                    >
                      <span className={styles.pdIcon}>
                        <GraduationCap size={16} />
                      </span>
                      Nine Academy
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <span className={styles.toolbarDivider} aria-hidden="true" />

          {/* Profile */}
          <div ref={profileRef}>
            {userData && (
              <>
                <button
                  type="button"
                  className={`${styles.userButton} ${
                    isProfileOpen ? styles.isOpen : ""
                  }`}
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
                  <ChevronDown
                    size={14}
                    className={styles.userChevron}
                    aria-hidden="true"
                  />
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
                          to="settings/preferences"
                          onClick={(e) => {
                            e.preventDefault();
                            console.log("👤 Edit profile clicked");
                            setProfileOpen(false);
                            handleNavigation("settings/preferences");
                          }}
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
        </div>
      </header>

      {/* ===== MENUBAR ===== */}
      <div className={styles.menubar}>
        <div className={styles.menubarInner}>
          <nav ref={navRef} className={styles.hnav} aria-label="Menu principal">
            {menus.map((m) => {
              const dropdown = isGroup(m);
              console.log("📦 Renderizando menu item:", m.key, {
                dropdown,
                hasTo: !!m.to,
              });

              return (
                <div
                  key={m.key}
                  className={
                    dropdown
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
                      onClick={(e) => {
                        e.preventDefault();
                        console.log("🔗 Menu link clicado:", m.key, m.to);
                        handleNavigation(m.to);
                      }}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      className={styles.hlink}
                      onClick={() =>
                        dropdown ? handleTopClick(m.key) : undefined
                      }
                    >
                      {m.icon}
                      <span>{m.label}</span>
                      {dropdown && <ChevronDown size={16} />}
                    </button>
                  )}

                  {dropdown && (
                    <div className={styles.megamenu} role="menu">
                      <div className={styles.megagrid}>
                        {m.children.map((grp) => (
                          <div
                            className={styles.megagroup}
                            key={grp.key || grp.label}
                          >
                            <div className={styles.megahdr}>{grp.label}</div>
                            <ul className={styles.megasublist}>
                              {grp.children.map((leaf) => (
                                <li
                                  key={leaf.to}
                                  className={styles.megaitem}
                                  role="none"
                                >
                                  <NavLink
                                    to={leaf.to}
                                    className={({ isActive }) =>
                                      `${styles.megalink} ${
                                        isActive ? styles.active : ""
                                      }`
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      console.log(
                                        "🍂 Submenu clicado:",
                                        leaf.to,
                                        leaf.label
                                      );
                                      setOpenDropdown(null);
                                      handleNavigation(leaf.to);
                                    }}
                                    role="menuitem"
                                  >
                                    {leaf.icon && (
                                      <span className={styles.megaicon}>
                                        {leaf.icon}
                                      </span>
                                    )}
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
        </div>
      </div>

      {/* ===== MOBILE DRAWER ===== */}
      <aside
        className={`${styles.mobileDrawer} ${
          isMobileMenuOpen ? styles.open : ""
        }`}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Menu</span>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
            }}
            aria-label="Fechar menu"
          >
            ×
          </button>
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

                  {m.children.map((grp) => (
                    <div key={`g-${grp.key || grp.label}`}>
                      <div className={styles.drawerGroupHdr}>{grp.label}</div>
                      <ul className={styles.drawerSubList}>
                        {grp.children.map((leaf) => (
                          <li key={`i-${leaf.to}`}>
                            <NavLink
                              to={leaf.to}
                              className={({ isActive }) =>
                                isActive ? styles.active : undefined
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                console.log("📱 Mobile menu clicado:", leaf.to);
                                setMobileMenuOpen(false);
                                handleNavigation(leaf.to);
                              }}
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
                <NavLink
                  end={m.exact}
                  to={m.to}
                  className={({ isActive }) =>
                    isActive ? styles.active : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    console.log("📱 Mobile menu principal clicado:", m.to);
                    setMobileMenuOpen(false);
                    handleNavigation(m.to);
                  }}
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
      <main className={styles.content} onPointerDownCapture={closeAllMenus}>
        <Routes>
          <Route index element={<Dashboard />} />

          {/* monitoring */}
          <Route
            path="monitoring/realtime/agents"
            element={<AgentsMonitor />}
          />
          <Route
            path="monitoring/realtime/queues"
            element={<ClientsMonitor />}
          />

          {/* analytics */}
          <Route path="analytics/quality" element={<Quality />} />
          <Route
            path="analytics/sessions"
            element={
              <RequireRole allow={isAdmin}>
                <BillingExtrato />
              </RequireRole>
            }
          />

          {/* management */}
          <Route
            path="management/users"
            element={<UsersPage canCreateAdmin={isAdmin} />}
          />
          <Route path="management/users/new" element={<UserForm />} />
          <Route path="management/users/:userId/edit" element={<UserForm />} />

          <Route path="management/queues" element={<Queues />} />
          <Route path="management/queues/new" element={<QueueForm />} />
          <Route path="management/queues/:id" element={<QueueForm />} />
          <Route
            path="management/queues/:name/hours"
            element={<QueueHours />}
          />
          <Route path="management/quick-replies" element={<QuickReplies />} />
          <Route path="management/history" element={<History />} />
          <Route path="management/history/:id" element={<TicketDetail />} />
          <Route path="management/clientes" element={<Clientes />} />

          {/* campaigns */}
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="campaigns/templates/new" element={<TemplateCreate />} />
          <Route path="campaigns/campaigns" element={<Campaigns />} />
          <Route path="campaigns/campaigns/new" element={<CampaignCreate />} />

          {/* ✅ CORREÇÃO: Rotas de settings com paths absolutos */}
          <Route
            path="/settings/preferences"
            element={
              <RequireRole allow={isAdmin}>
                <Preferences />
              </RequireRole>
            }
          />
          <Route
            path="/settings/security"
            element={
              <RequireRole allow={isAdmin}>
                <TokensSecurity />
              </RequireRole>
            }
          />
          <Route
            path="/settings/logs"
            element={
              <RequireRole allow={isAdmin}>
                <AuditLogs />
              </RequireRole>
            }
          />

          {/* channels */}
          <Route path="channels/whatsapp" element={<WhatsAppProfile />} />
          <Route path="channels/telegram" element={<TelegramConnect />} />

          {/* development – admin only */}
<Route
    path="development/flowhub"               // <- agora abre a GALERIA
    element={
      <RequireRole allow={isAdmin}>
        <FlowHub />
      </RequireRole>
    }
  />
<Route
  path="development/flowhub/:flowId/channels" // << página de canais por flow
  element={
    <RequireRole allow={isAdmin}>
      <FlowChannels />
    </RequireRole>
  }
/>
  <Route
    path="development/studio/:flowId"       // <- rota para o Builder em si
    element={
      <RequireRole allow={isAdmin}>
        <Builder />
      </RequireRole>
    }
  />
          <Route
            path="development/tracker"
            element={
              <RequireRole allow={isAdmin}>
                <JourneyTracker />
              </RequireRole>
            }
          />
          <Route
            path="/development/tracker/:userId"
            element={
              <RequireRole allow={isAdmin}>
                <JourneyBeholder />
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
