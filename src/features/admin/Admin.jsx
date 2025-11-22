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
  LogOut,
  Headset,
  User,
  ListTree,
  Gauge,
  Clock,
  Shield,
  SearchCheck,
  Workflow,
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
// Dashboard antigo removido – usamos HomeUpdates
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

/**
 * PÁGINA INICIAL – INÍCIO / NOVIDADES & DICAS
 */
function HomeUpdates() {
  return (
    <div className={styles.home}>
      <header className={styles.homeHeader}>
        <div>
          <h1 className={styles.homeTitle}>Início do workspace</h1>
          <p className={styles.homeSubtitle}>
            Um resumo de novidades, boas práticas e atalhos para você tirar
            mais proveito do NineChat.
          </p>
        </div>
      </header>

      <section className={styles.homeGrid}>
        <article className={styles.homeCard}>
          <h2 className={styles.homeCardTitle}>O que há de novo</h2>
          <p className={styles.homeCardText}>
            • Novo módulo de <strong>Workflows</strong> para organizar seus
            fluxos omnichannel. <br />
            • Melhorias de performance no monitor de atendimento em tempo real.{" "}
            <br />
            • Ajustes de segurança e auditoria em{" "}
            <strong>Configurações &gt; Logs</strong>.
          </p>
          <p className={styles.homeCardHint}>
            Dica: use a área de Workflows para centralizar jornadas e canais em
            um único lugar.
          </p>
        </article>

        <article className={styles.homeCard}>
          <h2 className={styles.homeCardTitle}>Atalhos rápidos</h2>
          <ul className={styles.homeLinks}>
            <li>
              <button
                type="button"
                className={styles.homeLinkBtn}
                onClick={() => (window.location.href = "/workflows/hub")}
              >
                Abrir Workflows
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.homeLinkBtn}
                onClick={() =>
                  (window.location.href = "/monitoring/realtime/queues")
                }
              >
                Ver filas em tempo real
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.homeLinkBtn}
                onClick={() =>
                  (window.location.href = "/settings/preferences")
                }
              >
                Preferências do workspace
              </button>
            </li>
          </ul>
        </article>

        <article className={styles.homeCard}>
          <h2 className={styles.homeCardTitle}>Dicas rápidas</h2>
          <ul className={styles.homeList}>
            <li>
              Use <strong>Mensagens Ativas</strong> para campanhas pontuais
              e comunicações proativas com seus clientes.
            </li>
            <li>
              Configure horários de fila em{" "}
              <strong>Workflows &gt; Filas</strong> para evitar atendimentos
              fora do horário.
            </li>
            <li>
              Acompanhe a <strong>qualidade</strong> dos atendimentos em{" "}
              <strong>Analytics &gt; Qualidade</strong>.
            </li>
          </ul>
        </article>

        <article className={styles.homeCard}>
          <h2 className={styles.homeCardTitle}>Documentação & suporte</h2>
          <p className={styles.homeCardText}>
            Acesse nossa base de conhecimento com tutoriais passo a passo.
          </p>
          <button
            type="button"
            className={styles.homeLinkBtn}
            onClick={() =>
              window.open("https://docs.ninechat.com.br", "_blank")
            }
          >
            Abrir NineDocs
          </button>
        </article>
      </section>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const jwt = token ? parseJwt(token) : {};
  const { email } = jwt || {};
  const [userData, setUserData] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);

  const closeDropdowns = () => {
    setProfileOpen(false);
    setHelpOpen(false);
  };

  useEffect(() => {
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
  }, [email, jwt?.sub, jwt?.name, jwt?.email]);

  useEffect(() => {
    closeDropdowns();
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        closeDropdowns();
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
        label: "Início", // aparecerá em CAIXA ALTA via CSS
        to: DASHBOARD_PATH,
        icon: <LayoutDashboard size={18} />,
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

      // 🔹 Workflows volta a ser item principal clicável, sem submenu
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

  const isLeafActive = (leafTo) => {
    const current = location.pathname;
    const leafPath = leafTo.startsWith("/") ? leafTo : `/${leafTo}`;
    return current.startsWith(leafPath);
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
          <div
            className={styles.loadingBar}
            aria-label="Carregando"
            role="status"
          >
            <div className={styles.loadingBarInner} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* TOPBAR ESCURA COM MAIS DESTAQUE */}
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <NavLink
            to={DASHBOARD_PATH}
            className={styles.brand}
            onClick={(e) => {
              e.preventDefault();
              navigate("/", { replace: true });
            }}
          >
            <img
              src="/logo-front.png"
              alt="NineChat"
              className={styles.brandLogo}
            />
          </NavLink>

          <div className={styles.topbarRight}>
            {/* Ajuda */}
            <div className={styles.iconWrapper}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  setHelpOpen((v) => !v);
                  setProfileOpen(false);
                }}
                title="Ajuda"
                aria-label="Ajuda"
              >
                <CircleHelp size={18} />
              </button>
              {isHelpOpen && (
                <div className={styles.dropdown}>
                  <ul className={styles.dropdownList}>
                    {isAdmin && (
                      <li>
                        <button
                          type="button"
                          className={styles.dropdownItem}
                          onClick={() => {
                            window.open(
                              "https://docs.ninechat.com.br",
                              "_blank"
                            );
                            closeDropdowns();
                          }}
                        >
                          <span className={styles.dropdownIcon}>
                            <FileText size={14} />
                          </span>
                          <span>NineDocs</span>
                        </button>
                      </li>
                    )}
                    <li>
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={() => {
                          // placeholder Academy
                          closeDropdowns();
                        }}
                      >
                        <span className={styles.dropdownIcon}>
                          <GraduationCap size={14} />
                        </span>
                        <span>Nine Academy</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Perfil */}
            {userData && (
              <div className={styles.iconWrapper}>
                <button
                  type="button"
                  className={styles.profileButton}
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setHelpOpen(false);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                >
                  <div
                    className={styles.avatar}
                    style={{ backgroundColor: stringToColor(userData.email) }}
                  >
                    {userData.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                </button>

                {isProfileOpen && (
                  <div className={styles.dropdownProfile} role="menu">
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
                      </div>
                    </div>
                    <ul className={styles.dropdownList}>
                      <li>
                        <button
                          type="button"
                          className={styles.dropdownItem}
                          onClick={() => {
                            handleNavigation("settings/preferences");
                            closeDropdowns();
                          }}
                        >
                          <span className={styles.dropdownIcon}>
                            <User size={14} />
                          </span>
                          <span>Editar perfil</span>
                        </button>
                      </li>
                      <li className={styles.dropdownSeparator} />
                      <li>
                        <LogoutButton
                          className={`${styles.dropdownItem} ${styles.logout}`}
                          onClick={closeDropdowns}
                        >
                          <span className={styles.dropdownIcon}>
                            <LogOut size={14} />
                          </span>
                          <span>Logout</span>
                        </LogoutButton>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* BODY: menu à esquerda + conteúdo à direita */}
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          {/* Menu tipo “body”, não parece sidebar separada */}
          <aside className={styles.sidebar}>
            <nav className={styles.navRoot}>
              {menus.map((menu) => {
                const activeMenu = isMenuActive(menu);

                if (!menu.children) {
                  // INÍCIO e WORKFLOWS chegam aqui
                  return (
                    <button
                      key={menu.key}
                      type="button"
                      className={`${styles.menuLeafButton} ${
                        activeMenu ? styles.menuLeafActive : ""
                      }`}
                      onClick={() => handleNavigation(menu.to)}
                    >
                      <span className={styles.menuLeafIcon}>{menu.icon}</span>
                      <span className={styles.menuLeafLabel}>{menu.label}</span>
                    </button>
                  );
                }

                return (
                  <section key={menu.key} className={styles.menuSection}>
                    <div className={styles.menuSectionHeader}>
                      <span className={styles.menuSectionIcon}>
                        {menu.icon}
                      </span>
                      <span className={styles.menuSectionLabel}>
                        {menu.label}
                      </span>
                    </div>
                    {menu.children.map((grp) => (
                      <div
                        key={grp.key || grp.label}
                        className={styles.menuGroup}
                      >
                        {/* subtítulo (Tempo real, Análise...) foi removido */}
                        <ul className={styles.menuGroupList}>
                          {(grp.children || []).map((leaf) => {
                            const leafActive = isLeafActive(leaf.to);
                            return (
                              <li key={leaf.to}>
                                <button
                                  type="button"
                                  className={`${styles.menuLeafButton} ${
                                    leafActive ? styles.menuLeafActive : ""
                                  }`}
                                  onClick={() => handleNavigation(leaf.to)}
                                >
                                  {leaf.icon && (
                                    <span className={styles.menuLeafIcon}>
                                      {leaf.icon}
                                    </span>
                                  )}
                                  <span className={styles.menuLeafLabel}>
                                    {leaf.label}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              })}
            </nav>
          </aside>

          {/* Conteúdo principal */}
          <main className={styles.main}>
            <div className={styles.content}>
              <Routes>
                {/* HOME INICIAL */}
                <Route index element={<HomeUpdates />} />

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
                <Route
                  path="management/users/:userId/edit"
                  element={<UserForm />}
                />

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
            </div>
          </main>
        </div>
      </div>

      {(isHelpOpen || isProfileOpen) && (
        <div className={styles.overlay} onClick={closeDropdowns} />
      )}
    </div>
  );
}
