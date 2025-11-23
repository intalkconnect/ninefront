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
import BrandIcon from "./BrandIcon";
import styles from "./styles/FlowHub.module.css";

/* ========= tenant util ========= */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
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

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(`.${styles.dropdownContainer}`)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      {/* Header no padrão do workspace */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Hub de Workflows</h1>
          <p className={styles.subtitle}>
            Organize seus fluxos, canais e times de atendimento em um só lugar.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className={styles.btnPrimary}
          type="button"
        >
          + Novo flow
        </button>
      </header>

      {loading ? (
        <LogoLoader full size={56} src="/logo.svg" />
      ) : rows.length === 0 ? (
        <div className={styles.emptyHint}>
          Nenhum flow ainda. Crie o primeiro.
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((f) => (
            <div key={f.id} className={styles.card}>
              {/* Cabeçalho do card: título e dropdown na mesma linha */}
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle} title={f.name || "Sem nome"}>
                  {f.name || "Sem nome"}
                </h3>

                <div className={styles.dropdownContainer}>
                  <button
                    className={styles.dropdownTrigger}
                    onClick={() => toggleDropdown(f.id)}
                    title="Ações"
                    type="button"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {openDropdown === f.id && (
                    <div className={styles.dropdownMenu}>
                      <button
                        className={styles.dropdownItem}
                        onClick={() => openChannels(f)}
                        type="button"
                      >
                        <PlugZap size={16} />
                        <span>Canais</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openStudio(f)}
                        type="button"
                      >
                        <Bot size={16} />
                        <span>Studio</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openTracker(f)}
                        type="button"
                      >
                        <RouteIcon size={16} />
                        <span>Tracker</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openQueues(f)}
                        type="button"
                      >
                        <ListChecks size={16} />
                        <span>Filas</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openAgents(f)}
                        type="button"
                      >
                        <Headphones size={16} />
                        <span>Atendentes</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openQuickReplies(f)}
                        type="button"
                      >
                        <MessageSquare size={16} />
                        <span>Respostas rápidas</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openTicketHistory(f)}
                        type="button"
                      >
                        <History size={16} />
                        <span>Histórico de ticket</span>
                      </button>

                      <button
                        className={styles.dropdownItem}
                        onClick={() => openCustomers(f)}
                        type="button"
                      >
                        <IdCard size={16} />
                        <span>Clientes</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p
                className={
                  f.description ? styles.cardDesc : styles.cardDescMuted
                }
                title={f.description ? f.description : "Sem descrição"}
              >
                {f.description ? f.description : "Sem descrição"}
              </p>

              {/* Rodapé: canais vinculados */}
              <div className={styles.cardFoot}>
                {Array.isArray(f.channels) && f.channels.length ? (
                  f.channels
                    .filter((c) => c?.is_active)
                    .slice(0, 8)
                    .map((c, i) => (
                      <span
                        key={`${c.channel_type}-${i}`}
                        title={c.display_name || c.channel_type}
                        className={styles.channelBadge}
                      >
                        <BrandIcon type={c.channel_type} />
                      </span>
                    ))
                ) : (
                  <span className={styles.noChannels}>
                    Nenhum canal vinculado
                  </span>
                )}
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
  );
}

/* ---------- Aux components ---------- */

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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <strong>Novo flow</strong>
          <button onClick={onClose} className={styles.linkBtn} type="button">
            Fechar
          </button>
        </div>

        <div className={styles.modalBody}>
          <div>
            <label className={styles.label} htmlFor="flow-name">
              Nome<span className={styles.reqStar}>*</span>
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
              className={`${styles.input} ${
                nameError ? styles.inputInvalid : ""
              }`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {nameError ? (
              <div className={styles.fieldError}>{nameError}</div>
            ) : null}
          </div>

          <div>
            <label className={styles.label} htmlFor="flow-desc">
              Descrição (opcional)
            </label>
            <textarea
              id="flow-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do fluxo"
              className={`${styles.input} ${styles.textarea}`}
            />
          </div>
        </div>

        <div className={styles.modalFoot}>
          <button onClick={onClose} className={styles.btnGhost} type="button">
            Cancelar
          </button>
          <button
            disabled={!canSave}
            onClick={submit}
            className={`${styles.btnPrimary} ${
              !canSave ? styles.btnDisabled : ""
            }`}
            type="button"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
