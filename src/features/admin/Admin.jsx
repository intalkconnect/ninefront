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
import CampaignWizardPage from "./campaigns/campaign/CampaignWizard";
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
 * HOME ESTILO DASHBOARD (igual ao print – boas vindas + cards)
 */
function HomeDashboard({ user }) {
  const navigate = useNavigate();

  const firstName =
    user?.name?.split(" ")[0] ||
    user?.nome?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "NineChatter");

  // mocks apenas para visual, pode ligar em métricas reais depois
  const stats = [
    {
      key: "done",
      label: "Concluídas",
      value: 3,
      helper: "Soluções implementadas com sucesso",
      percent: 14,
    },
    {
      key: "in-progress",
      label: "Em Progresso",
      value: 13,
      helper: "Implementações em andamento",
      percent: 59,
    },
    {
      key: "available",
      label: "Disponíveis",
      value: 22,
      helper: "Total de soluções na plataforma",
      percent: 82,
    },
  ];

  const projects = [
    {
      key: "proj-1",
      title: "SDR Automático no WhatsApp Plug and Play com Typebot",
      tag: "Automação de vendas",
    },
    {
      key: "proj-2",
      title: "Criando um Board Estratégico com IA para a sua Empresa",
      tag: "Gestão & estratégia",
    },
    {
      key: "proj-3",
      title: "Como Gerar Métricas nos grupos de WhatsApp",
      tag: "Análises e métricas",
    },
  ];

  return (
    <div className={styles.home}>
      {/* HERO / BOAS-VINDAS */}
      <section className={styles.welcomeHero}>
        <div className={styles.welcomeContent}>
          <span className={styles.welcomeTag}>Bem-vindo de volta</span>
          <h1 className={styles.welcomeTitle}>
            Bom dia, {firstName}!{" "}
            <span className={styles.welcomeEmoji}>👋</span>
          </h1>
          <p className={styles.welcomeSubtitle}>
            Continue sua jornada de crescimento. Explore novas soluções e
            desenvolva seu negócio com o NineChat.
          </p>

          <div className={styles.welcomeActions}>
            <button
              type="button"
              className={styles.welcomeCta}
              onClick={() => navigate("/workflows/hub")}
            >
              Explorar soluções
            </button>
            <p className={styles.welcomeNote}>
              Dica: use o Hub de Workflows para centralizar suas jornadas e
              canais.
            </p>
          </div>
        </div>
      </section>

      {/* CARDS DE MÉTRICAS – 3 COLUNAS */}
      <section className={styles.homeStatsSection}>
        {stats.map((stat) => (
          <article key={stat.key} className={styles.homeStatCard}>
            <header className={styles.homeStatHeader}>
              <span className={styles.homeStatIconWrapper}>
                {/* só um círculo decorativo como no print */}
                <span className={styles.homeStatIconDot} />
              </span>
              <div className={styles.homeStatHeaderText}>
                <span className={styles.homeStatLabel}>{stat.label}</span>
                <span className={styles.homeStatValue}>{stat.value}</span>
              </div>
            </header>

            <p className={styles.homeStatHelper}>{stat.helper}</p>

            <div className={styles.homeStatFooter}>
              <div className={styles.homeStatProgressBar}>
                <div
                  className={styles.homeStatProgressInner}
                  style={{ width: `${stat.percent}%` }}
                />
              </div>
              <span className={styles.homeStatPercent}>
                {stat.percent.toString().padStart(2, "0")}%
              </span>
            </div>
          </article>
        ))}
      </section>

      {/* PROJETOS EM ANDAMENTO */}
      <section className={styles.homeProjects}>
        <header className={styles.homeProjectsHeader}>
          <div>
            <h2 className={styles.homeProjectsTitle}>Projetos em andamento</h2>
            <p className={styles.homeProjectsSubtitle}>
              Continue implementando esses projetos em seu negócio.
            </p>
          </div>
        </header>

        <div className={styles.homeProjectsScroller}>
          {projects.map((proj) => (
            <article key={proj.key} className={styles.homeProjectCard}>
              <div className={styles.homeProjectGlow} />
              <div className={styles.homeProjectBody}>
                <span className={styles.homeProjectTag}>{proj.tag}</span>
                <h3 className={styles.homeProjectTitle}>{proj.title}</h3>
                <button
                  type="button"
                  className={styles.homeProjectButton}
                  onClick={() => navigate("/workflows/hub")}
                >
                  Continuar projeto
                </button>
              </div>
            </article>
          ))}
        </div>
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
        label: "Dashboard",
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
            key: "camp-disparo",
            children: [
              {
                to: "campaigns",
                icon: <Send size={16} />,
                label: "Disparo ativo",
              },
            ],
          },
          {
            key: "camp-modelos",
            children: [
              {
                to: "campaigns/templates",
                icon: <FileText size={16} />,
                label: "Templates",
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

      {
        key: "workflows",
        label: "Workflows",
        icon: <Workflow size={18} />,
        children: [
          {
            key: "workflows-main",
            children: [
              {
                to: "workflows/hub",
                icon: <Workflow size={16} />,
                label: "Hub",
              },
            ],
          },
        ],
      },
    ];

    // aplica regras de permissão
    const filtered = filterMenusByRole(base);

    // 1) top-level em ordem alfabética, mantendo "Dashboard" primeiro
    const dashboard = filtered.find((m) => m.key === "dashboard");
    const others = filtered
      .filter((m) => m.key !== "dashboard")
      .sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || ""), "pt-BR", {
          sensitivity: "base",
        })
      );

    // 2) filhos em ordem alfabética dentro de cada seção
    others.forEach((menu) => {
      if (!menu.children) return;
      menu.children.forEach((grp) => {
        if (Array.isArray(grp.children)) {
          grp.children.sort((a, b) =>
            String(a.label || "").localeCompare(
              String(b.label || ""),
              "pt-BR",
              { sensitivity: "base" }
            )
          );
        }
      });
    });

    return dashboard ? [dashboard, ...others] : others;
  }, [isSupervisor]);

  const handleNavigation = (path) => {
    const targetPath = path.startsWith("/") ? path : `/${path}`;
    navigate(targetPath);
  };

  // normaliza paths removendo barra final
  const normalizePath = (p = "") =>
    (p.startsWith("/") ? p : `/${p}`).replace(/\/+$/, "");

  const isMenuActive = (menu) => {
    const current = normalizePath(location.pathname);

    // menu de rota direta (Dashboard)
    if (menu.to) {
      const target = normalizePath(menu.to);
      return current === target || current.startsWith(`${target}/`);
    }

    if (!menu.children) {
      return current === normalizePath(DASHBOARD_PATH);
    }

    // ativo se QUALQUER leaf daquele grupo estiver ativa
    return menu.children.some((grp) =>
      (grp.children || []).some((leaf) => isLeafActive(leaf.to))
    );
  };

  const isLeafActive = (leafTo) => {
    const current = normalizePath(location.pathname);
    const leafPath = normalizePath(leafTo);

    // regra especial: não deixar "Disparo ativo" ("/campaigns")
    // ficar ativo quando estamos em "/campaigns/templates*"
    if (
      leafPath === "/campaigns" &&
      current.startsWith("/campaigns/templates")
    ) {
      return false;
    }

    // "Templates" deve ficar ativo tanto em /campaigns/templates
    // quanto em /campaigns/templates/new
    if (leafPath === "/campaigns/templates") {
      return (
        current === "/campaigns/templates" ||
        current.startsWith("/campaigns/templates/")
      );
    }

    // padrão: ativo se for a rota exata ou algum subcaminho direto
    return current === leafPath || current.startsWith(`${leafPath}/`);
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
      {/* TOPBAR ESCURA COM DESTAQUE */}
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

                // Dashboard – botão principal
                if (menu.key === "dashboard") {
                  return (
                    <button
                      key={menu.key}
                      type="button"
                      className={`${styles.menuPrimaryButton} ${
                        activeMenu ? styles.menuPrimaryActive : ""
                      }`}
                      onClick={() => handleNavigation(menu.to)}
                    >
                      <span className={styles.menuLeafIcon}>{menu.icon}</span>
                      <span className={styles.menuLeafLabel}>{menu.label}</span>
                    </button>
                  );
                }

                const leafItems =
                  menu.children?.reduce((all, grp) => {
                    if (Array.isArray(grp.children)) {
                      return all.concat(grp.children);
                    }
                    return all;
                  }, []) || [];

                return (
                  <section key={menu.key} className={styles.menuSection}>
                    <div
                      className={`${styles.menuSectionHeader} ${
                        activeMenu ? styles.menuSectionHeaderActive : ""
                      }`}
                    >
                      <span className={styles.menuSectionIcon}>
                        {menu.icon}
                      </span>
                      <span className={styles.menuSectionLabel}>
                        {menu.label}
                      </span>
                    </div>

                    <ul className={styles.menuGroupList}>
                      {leafItems.map((leaf) => {
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
                  </section>
                );
              })}
            </nav>
          </aside>

          {/* Conteúdo principal – ÚNICO lugar com scroll vertical */}
          <main className={styles.main}>
            <div className={styles.content}>
              <Routes>
                {/* HOME ESTILO DASHBOARD */}
                <Route index element={<HomeDashboard user={userData} />} />

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
                <Route path="campaigns" element={<Campaigns />} />
                <Route
                  path="campaigns/new"
                  element={<CampaignWizardPage />}
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
