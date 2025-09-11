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
  WalletCards
} from "lucide-react";
 import {
   NavLink,
   Routes,
   Route,
   Navigate,
   useLocation,
   useNavigate,
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
import AgentsMonitor from "./monitoring/AgentsMonitor";
import Queues from "./atendimento/Queues";
import QuickReplies from "./atendimento/QuickReplies";
import Templates from "./campanhas/Templates";
import UsersPage from "./management/Users";
import Clientes from "./management/clientes/Clientes";
import History from "./atendimento/history/TicketsHistory";
import Campaigns from "./campanhas/Campaigns";
import BillingExtrato from "./analytics/billing/BillingExtrato";
import Quality from "./analytics/quality/Quality";
import TicketDetail from "./atendimento/history/TicketDetail";
import WhatsAppProfile from "./preferences/WhatsAppProfile";
import TelegramConnect from "./preferences/TelegramConnect";
import TokensSecurity from "./preferences/security/Tokens";


// Temporários (mantidos)
const Integrations = () => <div>Integrações</div>;

document.title = "NineChat - Gestão";

export default function Admin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const { email } = token ? parseJwt(token) : {};
  const [userData, setUserData] = useState(null);

  // 🔒 Carregamento do perfil para evitar "flash" de opções
  const [authLoading, setAuthLoading] = useState(true);

  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const location = useLocation();

  // Perfil
  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Nav (para clique fora)
  const navRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const fetchAdminInfo = async () => {
      // Enquanto não resolvemos, mantemos a splash
      setAuthLoading(true);
      try {
        if (email) {
          const res = await apiGet(`/users/${email}`);
          if (mounted) setUserData(res);
        } else {
          // sem email, trata como usuário comum (ou redirecione se necessário)
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
    return () => { mounted = false; };
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

  // caminho fixo do Dashboard
  const DASHBOARD_PATH = "/";

  /* ===================== CONTROLES DE PERMISSÃO ===================== */
  const role =
    userData?.role ||
    userData?.perfil ||
    userData?.profile ||
    "user";

  const isAdmin = role?.toLowerCase() === "admin";
  const isSupervisor = role?.toLowerCase() === "supervisor";

  // Guard simples para proteger rotas
  const RequireRole = ({ allow, children }) => {
    if (!allow) return <Navigate to={DASHBOARD_PATH} replace />;
    return children;
  };

  // Filtra itens do menu para o perfil Supervisor:
  // - Esconde "Desenvolvimento" e "Configurações"
  // - Remove "Sessões" em Acompanhamento > Análise
  const filterMenusByRole = (items) => {
    if (!isSupervisor) return items; // admin (ou outros) veem tudo

    return items
      .filter((m) => !["development", "settings"].includes(m.key))
      .map((m) => {
        if (m.key !== "monitoring") return m;

        const cloned = {
          ...m,
          children: m.children?.map((g) => ({ ...g }))
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

  /* ===================== MENU (grupos sem ícone) ===================== */
  const menus = useMemo(
    () =>
      filterMenusByRole([
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
                { to: "monitoring/realtime/queues", icon: <ListTree size={16} />, label: "Filas" },
                { to: "monitoring/realtime/agents", icon: <Headset size={16} />, label: "Agentes" },
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
                { to: "management/users",         icon: <UserPen size={16} />,  label: "Usuários" },
                { to: "management/queues",        icon: <Folder size={16} />,   label: "Filas" },
                { to: "management/quick-replies", icon: <MessageSquareReply size={16} />, label: "Respostas Rápidas" }
              ],
            },
            {
              key: "mgmt-operacao",
              label: "Operação",
              children: [
                { to: "management/history", icon: <WalletCards size={16} />, label: "Histórico de Ticket" },
                { to: "management/clientes", icon: <Contact size={16} />,    label: "Clientes" },
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
              label: "Mensagens Ativas",
              children: [
                { to: "campaigns/campaigns", icon: <Send size={16} />, label: "Disparo de Massa" },
              ],
            },
          ],
        },

        /* ========= Desenvolvimento ========= */
        {
          key: "development",
          label: "Desenvolvimento",
          icon: <Code2 size={18} />,
          children: [
            {
              key: "dev-tools",
              label: "Ferramentas",
              children: [
                { to: "development/builder", icon: <Bot size={16} />, label: "Builder" },
              ],
            },
          ],
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
      ]),
    // reavalia quando o perfil mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSupervisor]
  );

  const isGroup = (n) => Array.isArray(n?.children) && n.children.length > 0;
  const handleTopClick = (key) => setOpenDropdown((cur) => (cur === key ? null : key));

  /* ===================== SPLASH DE CARREGAMENTO ===================== */
  if (authLoading) {
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
          <img src="/logo.png" alt="NineChat" style={{ width: 56, height: 56, opacity: 0.9 }} />
          <div style={{ fontSize: 14, opacity: 0.8 }}>Carregando seu workspace…</div>
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

  /* ===================== UI PRINCIPAL ===================== */
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
                    onClick={(e) => {
                      // força navegação SPA e evita qualquer submit implícito
                      e.preventDefault();
                      if (dropdown) {
                        handleTopClick(m.key);
                        return;
                      }
                      navigate(m.to);
                    }}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </NavLink>
                ) : (
<button
   type="button"
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
                                   onClick={(e) => {
                                   e.preventDefault();
                                   setOpenDropdown(null);
                                   navigate(leaf.to);
                                 }}
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
 <button type="button" className={styles.userButton} onClick={() => setProfileOpen((v) => !v)} aria-haspopup="menu" aria-expanded={isProfileOpen}>

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
          <button type="button" className={styles.drawerClose}  onClick={(e) => {
                               e.preventDefault();
                               setMobileMenuOpen(false);
                               navigate(leaf.to);
                             }} aria-label="Fechar menu">×</button>
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

          {/* monitoring */}
          <Route path="monitoring/realtime/agents" element={<AgentsMonitor />} />
          <Route path="monitoring/realtime/queues" element={<ClientsMonitor />} />

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
          {/* Supervisor não pode criar admin; passamos a permissão para a página */}
          <Route path="management/users" element={<UsersPage canCreateAdmin={isAdmin} />} />
          <Route path="management/queues" element={<Queues />} />
          <Route path="management/quick-replies" element={<QuickReplies />} />
          <Route path="management/history" element={<History />} />
          <Route path="management/history/:id" element={<TicketDetail />} />
          <Route path="management/clientes" element={<Clientes />} />

          {/* campaigns */}
          <Route path="campaigns/templates" element={<Templates />} />
          <Route path="campaigns/campaigns" element={<Campaigns />} />
          <Route path="channels/whatsapp" element={<WhatsAppProfile />} />
          <Route path="channels/telegram" element={<TelegramConnect />} />

          {/* development – admin only */}
          <Route
            path="development/builder"
            element={
              <RequireRole allow={isAdmin}>
                <Builder />
              </RequireRole>
            }
          />

          {/* settings – admin only */}
          <Route
            path="settings/preferences"
            element={
              <RequireRole allow={isAdmin}>
                <Preferences />
              </RequireRole>
            }
          />
          <Route
            path="settings/channels"
            element={
              <RequireRole allow={isAdmin}>
                <Channels />
              </RequireRole>
            }
          />
          <Route
            path="settings/integrations"
            element={
              <RequireRole allow={isAdmin}>
                <Integrations />
              </RequireRole>
            }
          />
          <Route
            path="settings/security"
            element={
              <RequireRole allow={isAdmin}>
                <TokensSecurity />
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="" />} />
        </Routes>
      </main>
    </div>
  );
}
