// File: Admin.jsx
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Settings as SettingsIcon,
  SquareActivity,
  CircleHelp,
  GraduationCap,
  Megaphone,
  FileText,
  Send,
  ChevronRight,
  LogOut,
  Headset,
  User,
  ListTree,
  Gauge,
  Clock,
  Shield,
  SearchCheck,
  Workflow,
  MessageSquare,
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
import Builder from "./flow/studio/Builder";
import FlowChannels from "./flow/channels/FlowChannels";
import Queues from "./flow/queue/Queues";
import QueueForm from "./flow/queue/QueueForm";
import QueueHours from "./flow/queue/QueueHours";
import Dashboard from "./dashboard/Dashboard";
import LogoutButton from "../../components/common/LogoutButton";
import styles from "./styles/Admin.module.css";
import { parseJwt } from "../../app/utils/auth";
import { stringToColor } from "../../app/utils/color";
import { apiGet, setActorContext } from "../../shared/apiClient";

import Preferences from "./preferences/settings/Settings";
import ClientsMonitor from "./monitoring/clientsMonitor/ClientsMonitor";
import AgentsMonitor from "./monitoring/agentsMonitor/AgentsMonitor";
import JourneyTracker from "./flow/journeyTracker/JourneyTracker";
import JourneyBeholder from "./flow/journeyTracker/JourneyBeholder";

import QuickReplies from "./flow/quickReplies/QuickReplies";
import Templates from "./campaigns/template/Templates";
import TemplateCreate from "./campaigns/template/TemplateCreate";

import UsersPage from "./management/users/Users";
import UserForm from "./management/users/UserForm";

import Agents from "./flow/agents/Agents";
import AgentsForm from "./flow/agents/AgentsForm";

import Customers from "./flow/customers/Customers";
import TicketsHistory from "./flow/history/TicketsHistory";
import TicketDetail from "./flow/history/TicketDetail";
import Campaigns from "./campaigns/campaign/Campaigns";
import CampaignCreate from "./campaigns/campaign/CampaignCreate";
import BillingExtrato from "./analytics/billing/BillingExtrato";
import Quality from "./analytics/quality/Quality";

import WhatsAppProfile from "./flow/channels/whatsapp/WhatsAppProfile";
import TelegramConnect from "./flow/channels/telegram/TelegramConnect";
import TokensSecurity from "./preferences/security/Tokens";
import AuditLogs from "./preferences/logs/AuditLogs";

document.title = "NineChat - Gestão";

function RequireRole({ allow, children }) {
  if (!allow) {
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

  // estado do layout novo
  const [openSubmenuKey, setOpenSubmenuKey] = useState(null);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);

  const closeAllPanels = () => {
    setOpenSubmenuKey(null);
    setProfileOpen(false);
    setHelpOpen(false);
  };

  useEffect(() => {
    // define contexto de ator
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
          const res = await apiGet(`/users/${email}`);
          if (mounted) setUserData(res);
          setActorContext({
            id: res?.id || res?.userId || res?.email || email,
            name: res?.name || res?.nome || res?.email || email,
            email: res?.email || email,
          });
        } else {
          if (mounted) setUserData(null);
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

  // fecha painéis ao trocar de rota
  useEffect(() => {
    closeAllPanels();
  }, [location.pathname]);

  // ESC fecha painéis
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeAllPanels();
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

  const filterMenusByRole = (items) => {
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
    const base = [
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
                icon: <User size={16} />,
                label: "Usuários",
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
        key: "workflows",
        label: "Workflows",
        icon: <Workflow size={18} />,
        to: "workflows/hub",
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
    ];

    return filterMenusByRole(base);
  }, [isSupervisor]);

  const isGroup = (n) => Array.isArray(n?.children) && n.children.length > 0;

  const handleNavigation = (path) => {
    const targetPath = path.startsWith("/") ? path : `/${path}`;
    navigate(targetPath);
  };

  const isMenuActive = (menu) => {
    const current = location.pathname;
    if (menu.to) {
      const target = menu.to.startsWith("/") ? menu.to : `/${menu.to}`;
      return current.startsWith(target);
    }
    if (!menu.children) return false;
    return menu.children.some((grp) =>
      (grp.children || []).some((leaf) => {
        const leafPath = leaf.to.startsWith("/") ? leaf.to : `/${leaf.to}`;
        return current.startsWith(leafPath);
      })
    );
  };

  if (authLoading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingInner}>
          <img
            src="/logo.png"
            alt="NineChat"
            className={styles.loadingLogo}
          />
          <div className={styles.loadingText}>Carregando seu workspace…</div>
          <div className={styles.loadingBar} aria-label="Carregando" role="status">
            <div className={styles.loadingBarInner} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Sidebar fixa no estilo do layout novo */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          {/* Brand */}
          <div className={styles.brandRow}>
            <div className={styles.brandMark}>
              <MessageSquare className={styles.brandIcon} />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandName}>NineChat</div>
              <div className={styles.brandTag}>OMNICHANNEL</div>
            </div>
          </div>

          {/* Menu principal */}
          <nav className={styles.nav}>
            {menus.map((item, index) => {
              const active = isMenuActive(item);
              const hasSub = isGroup(item);
              const isOpen = openSubmenuKey === item.key;

              const handleClick = () => {
                if (hasSub) {
                  setOpenSubmenuKey((cur) => (cur === item.key ? null : item.key));
                } else if (item.to) {
                  handleNavigation(item.to);
                }
              };

              return (
                <div key={item.key} className={styles.navItem}>
                  <button
                    type="button"
                    onClick={handleClick}
                    className={`${styles.navButton} ${
                      active ? styles.navButtonActive : ""
                    }`}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {hasSub && (
                      <ChevronRight
                        className={`${styles.navChevron} ${
                          isOpen ? styles.navChevronOpen : ""
                        }`}
                      />
                    )}
                  </button>

                  {hasSub && isOpen && (
                    <div
                      className={styles.submenuPanel}
                      style={{ top: 80 + index * 52 }}
                    >
                      <div className={styles.submenuContent}>
                        {item.children.map((grp) => (
                          <div key={grp.key || grp.label}>
                            <div className={styles.submenuHeader}>
                              {grp.label}
                            </div>
                            <ul className={styles.submenuList}>
                              {grp.children?.map((leaf) => {
                                const leafPath = leaf.to.startsWith("/")
                                  ? leaf.to
                                  : `/${leaf.to}`;
                                const leafActive = location.pathname.startsWith(
                                  leafPath
                                );
                                return (
                                  <li key={leaf.to} className={styles.submenuItem}>
                                    <button
                                      type="button"
                                      className={`${styles.submenuItemLink} ${
                                        leafActive ? styles.submenuItemActive : ""
                                      }`}
                                      onClick={() => {
                                        handleNavigation(leaf.to);
                                        closeAllPanels();
                                      }}
                                    >
                                      {leaf.icon && (
                                        <span className={styles.submenuItemIcon}>
                                          {leaf.icon}
                                        </span>
                                      )}
                                      <span>{leaf.label}</span>
                                    </button>
                                  </li>
                                );
                              })}
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

        {/* Rodapé da sidebar: ajuda + perfil */}
        <div className={styles.sidebarFooter}>
          {/* Ajuda */}
          <div className={styles.footerItem}>
            <button
              type="button"
              className={styles.helpBtn}
              onClick={() => {
                setHelpOpen((v) => !v);
                setProfileOpen(false);
              }}
            >
              <div className={styles.helpAvatar}>?</div>
              <span className={styles.helpLabel}>Ajuda</span>
            </button>

            {isHelpOpen && (
              <div className={styles.helpPanel}>
                <button
                  type="button"
                  className={styles.panelItem}
                  onClick={() => {
                    window.open("https://docs.ninechat.com.br", "_blank");
                    setHelpOpen(false);
                  }}
                >
                  <FileText className={styles.panelIcon} size={14} />
                  <span>NineDocs</span>
                </button>
                <button
                  type="button"
                  className={styles.panelItem}
                  onClick={() => {
                    // placeholder academy
                    setHelpOpen(false);
                  }}
                >
                  <GraduationCap className={styles.panelIcon} size={14} />
                  <span>Nine Academy</span>
                </button>
              </div>
            )}
          </div>

          {/* Perfil */}
          {userData && (
            <div className={styles.footerItem}>
              <button
                type="button"
                className={styles.profileBtn}
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setHelpOpen(false);
                }}
              >
                <div
                  className={styles.avatar}
                  style={{ backgroundColor: stringToColor(userData.email) }}
                >
                  {userData.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>
                    {userData.name || "Usuário"}
                  </div>
                  <div className={styles.profileEmail}>{userData.email}</div>
                </div>
              </button>

              {isProfileOpen && (
                <div className={styles.profilePanel}>
                  <div className={styles.profileHeader}>
                    <div
                      className={styles.avatar}
                      style={{
                        backgroundColor: stringToColor(userData.email),
                      }}
                    >
                      {userData.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className={styles.profileName}>
                        {userData.name || "Usuário"}
                      </div>
                      <div className={styles.profileEmail}>
                        {userData.email}
                      </div>
                    </div>
                  </div>

                  <div className={styles.panelList}>
                    <button
                      type="button"
                      className={styles.panelItem}
                      onClick={() => {
                        handleNavigation("settings/preferences");
                        closeAllPanels();
                      }}
                    >
                      <User className={styles.panelIcon} size={14} />
                      <span>Editar perfil</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.panelItem} ${styles.logoutBtn}`}
                    >
                      <LogoutButton
                        className={styles.logoutInner}
                        onClick={closeAllPanels}
                      >
                        <LogOut className={styles.panelIcon} size={14} />
                        <span>Logout</span>
                      </LogoutButton>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Overlay para fechar menus ao clicar fora */}
      {(openSubmenuKey || isHelpOpen || isProfileOpen) && (
        <div className={styles.overlay} onClick={closeAllPanels} />
      )}

      {/* Conteúdo principal */}
      <div className={styles.main}>
        <main className={styles.content}>
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

            {/* campaigns */}
            <Route path="campaigns/templates" element={<Templates />} />
            <Route
              path="campaigns/templates/new"
              element={<TemplateCreate />}
            />
            <Route path="campaigns/campaigns" element={<Campaigns />} />
            <Route
              path="campaigns/campaigns/new"
              element={<CampaignCreate />}
            />

            {/* settings (paths absolutos) */}
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
            <Route
              path="workflows/hub/channels/whatsapp"
              element={<WhatsAppProfile />}
            />
            <Route
              path="workflows/hub/channels/telegram"
              element={<TelegramConnect />}
            />

            {/* workflows hub */}
            <Route
              path="workflows/hub"
              element={
                <RequireRole allow={isAdmin}>
                  <FlowHub />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/:flowId/channels"
              element={
                <RequireRole allow={isAdmin}>
                  <FlowChannels />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/:flowId/quick-replies"
              element={<QuickReplies />}
            />
            <Route
              path="workflows/hub/studio/:flowId"
              element={
                <RequireRole allow={isAdmin}>
                  <Builder />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/:flowId/queues"
              element={
                <RequireRole allow={isAdmin}>
                  <Queues />
                </RequireRole>
              }
            />

            {/* queues (new / edit / hours) */}
            <Route
              path="workflows/hub/queues/new"
              element={
                <RequireRole allow={isAdmin}>
                  <QueueForm />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/queues/:id"
              element={
                <RequireRole allow={isAdmin}>
                  <QueueForm />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/queues/:name/hours"
              element={
                <RequireRole allow={isAdmin}>
                  <QueueHours />
                </RequireRole>
              }
            />

            <Route path="workflows/hub/:flowId/agents" element={<Agents />} />
            <Route
              path="workflows/hub/:flowId/agents/new"
              element={<AgentsForm />}
            />
            <Route
              path="workflows/hub/:flowId/agents/:userId/edit"
              element={<AgentsForm />}
            />

            <Route
              path="workflows/hub/:flowId/ticket-history"
              element={<TicketsHistory />}
            />
            <Route
              path="workflows/hub/:flowId/ticket-history/:id"
              element={<TicketDetail />}
            />

            <Route
              path="workflows/hub/:flowId/customers"
              element={<Customers />}
            />

            <Route
              path="workflows/hub/:flowId/tracker"
              element={
                <RequireRole allow={isAdmin}>
                  <JourneyTracker />
                </RequireRole>
              }
            />
            <Route
              path="workflows/hub/:flowId/tracker/:userId"
              element={
                <RequireRole allow={isAdmin}>
                  <JourneyBeholder />
                </RequireRole>
              }
            />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
