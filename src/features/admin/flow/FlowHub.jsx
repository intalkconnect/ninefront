import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import {
  Bot,
  PlugZap,
  ListChecks,
  Headphones,
  MessageSquare,
  History,
  IdCard,
  Route as RouteIcon,
  MoreVertical,
} from "lucide-react";
import LogoLoader from "../../../components/common/LogoLoader";
import BrandIcon from "../icons/BrandIcon";
// Usa o AdminUI
import styles from "../styles/AdminUI.module.css";

/* ========= tenant util ========= */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

/* ========= helper para classe de canal ========= */
const CHANNEL_CLASS = {
  whatsapp: "ch_whatsapp",
  telegram: "ch_telegram",
  webchat: "ch_webchat",
  instagram: "ch_instagram",
  facebook: "ch_facebook",
};

function classForChannel(type) {
  const key = String(type || "").toLowerCase();
  return CHANNEL_CLASS[key] || "ch_default";
}

export default function FlowHub() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiGet(
        `/flows/meta${tenant ? `?subdomain=${tenant}` : ""}`
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenant]);

  // fecha dropdown clicando fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-role='flowhub-dropdown']")) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ====== navegação por flow (sempre usando f.id) ====== */

  const openStudio = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/studio/${f.id}`, {
      state: { meta: { flowId: f.id, name: f.name } },
    });
  };

  const openChannels = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/channels`, {
      state: { from: "/workflows/hub" },
    });
  };

  const openQueues = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/queues`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const openAgents = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/agents`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const openCustomers = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/customers`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const openTicketHistory = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/ticket-history`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const openQuickReplies = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/quick-replies`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const openTracker = (f) => {
    setOpenDropdown(null);
    navigate(`/workflows/hub/${f.id}/tracker`, {
      state: { from: "/workflows/hub", meta: { flowId: f.id } },
    });
  };

  const toggleDropdown = (flowId) => {
    setOpenDropdown(openDropdown === flowId ? null : flowId);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER NO PADRÃO ADMINUI */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Hub de Workflows</h1>
            <p className={styles.subtitle}>
              Organize seus fluxos, canais e times de atendimento em um só
              lugar.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={() => setShowNewModal(true)}
              className={styles.btnPrimary}
              type="button"
            >
              + Novo flow
            </button>
          </div>
        </header>

        {loading ? (
          <LogoLoader full size={56} src="/logo.svg" />
        ) : rows.length === 0 ? (
          <div className={styles.empty}>
            Nenhum flow ainda. Crie o primeiro.
          </div>
        ) : (
          // GRID DE CARDS REAPROVEITANDO O .cardGroup DO ADMINUI
          <div className={styles.cardGroup}>
            {rows.map((f) => (
              <div
                key={f.id}
                className={`${styles.card} ${styles.flowCard}`}
              >
                {/* Cabeçalho do card: título + botão de ações */}
                <div
                  className={styles.cardHead}
                  style={{ alignItems: "center", gap: 8 }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      className={styles.cardTitle}
                      title={f.name || "Sem nome"}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.name || "Sem nome"}
                    </div>
                    {f.description && (
                      <p
                        className={styles.cardDesc}
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "#9ca3af",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={f.description}
                      >
                        {f.description}
                      </p>
                    )}
                  </div>

                  {/* Dropdown de ações do flow */}
                  <div
                    data-role="flowhub-dropdown"
                    style={{ position: "relative" }}
                  >
                    <button
                      type="button"
                      className={styles.iconCircle}
                      onClick={() => toggleDropdown(f.id)}
                      title="Ações do flow"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openDropdown === f.id && (
                      <div className={styles.flowDropdownMenu}>
                        <DropdownItem onClick={() => openChannels(f)}>
                          <PlugZap size={16} />
                          <span>Canais</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openStudio(f)}>
                          <Bot size={16} />
                          <span>Studio</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openTracker(f)}>
                          <RouteIcon size={16} />
                          <span>Tracker</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openQueues(f)}>
                          <ListChecks size={16} />
                          <span>Filas</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openAgents(f)}>
                          <Headphones size={16} />
                          <span>Atendentes</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openQuickReplies(f)}>
                          <MessageSquare size={16} />
                          <span>Respostas rápidas</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openTicketHistory(f)}>
                          <History size={16} />
                          <span>Histórico de ticket</span>
                        </DropdownItem>

                        <DropdownItem onClick={() => openCustomers(f)}>
                          <IdCard size={16} />
                          <span>Clientes</span>
                        </DropdownItem>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corpo do card: descrição (se não veio em cima) + canais */}
                <div className={styles.cardBody}>
                  {!f.description && (
                    <p
                      className={styles.cardDesc}
                      style={{ marginTop: 0, marginBottom: 8 }}
                      title="Sem descrição"
                    >
                      Sem descrição
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: 6,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    {Array.isArray(f.channels) &&
                    f.channels.filter((c) => c?.is_active).length ? (
                      f.channels
                        .filter((c) => c?.is_active)
                        .slice(0, 8)
                        .map((c, i) => (
                          <span
                            key={`${c.channel_type}-${i}`}
                            title={c.display_name || c.channel_type}
                            className={`${styles.channelPill} ${
                              styles[classForChannel(c.channel_type)]
                            }`}
                          >
                            <BrandIcon type={c.channel_type} />
                          </span>
                        ))
                    ) : (
                      <span className={styles.muted}>
                        Nenhum canal vinculado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showNewModal && (
          <NewFlowModal
            onClose={() => setShowNewModal(false)}
            onCreate={async (form) => {
              if (!form.name || !form.name.trim()) {
                toast.warn("Informe um nome para o flow.");
                return;
              }
              try {
                const created = await apiPost("/flows", {
                  name: form.name.trim(),
                  description: form.description?.trim() || null,
                });
                toast.success(`Flow "${created?.name}" criado!`);
                setShowNewModal(false);
                await load();
              } catch {
                toast.error("Erro ao criar flow");
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Dropdown item reusável ---------- */

function DropdownItem({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        color: "#e5e7eb",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#111827";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Modal de novo flow (padrão AdminUI) ---------- */

function NewFlowModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [touchedName, setTouchedName] = useState(false);

  const trimmed = name.trim();
  const nameError =
    touchedName && trimmed.length === 0
      ? "Informe um nome para o flow."
      : "";
  const canSave = trimmed.length > 0;

  const submit = () => {
    if (!canSave) {
      setTouchedName(true);
      return;
    }
    onCreate({ name: trimmed, description });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={styles.card}
        style={{
          maxWidth: 480,
          width: "96vw",
          boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
        }}
      >
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Novo flow</div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.group}>
            <label className={styles.label} htmlFor="flow-name">
              Nome{" "}
              <span style={{ color: "#f97373", fontWeight: 700 }}>*</span>
            </label>
            <input
              id="flow-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouchedName(true)}
              placeholder="ex.: Atendimento"
              aria-invalid={!!nameError}
              className={styles.input}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {nameError ? (
              <div
                className={styles.helperInline}
                style={{ color: "#fecaca" }}
              >
                {nameError}
              </div>
            ) : null}
          </div>

          <div className={styles.group}>
            <label className={styles.label} htmlFor="flow-desc">
              Descrição (opcional)
            </label>
            <textarea
              id="flow-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do fluxo"
              className={styles.textarea}
            />
          </div>
        </div>

        <div
          style={{
            padding: "10px 16px 14px",
            borderTop: "1px solid #1f2937",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: "#020617",
          }}
        >
          <button
            onClick={onClose}
            className={styles.btnGhost}
            type="button"
          >
            Cancelar
          </button>
          <button
            disabled={!canSave}
            onClick={submit}
            className={styles.btnPrimary}
            type="button"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
