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

  /* ====== navegação por flow (sempre usando f.id) ====== */

  const openStudio = (f) =>
    navigate(`/development/studio/${f.id}`, {
      state: { meta: { flowId: f.id, name: f.name } },
    });

  const openChannels = (f) =>
    navigate(`/development/flowhub/${f.id}/channels`, {
      state: { from: "/development/flowhub" },
    });

  const openQueues = (f) =>
    navigate(`/development/flowhub/${f.id}/queues`, {
      state: { from: "/development/flowhub", meta: { flowId: f.id } },
    });

  const openAgents = (f) =>
    navigate(`/development/flowhub/${f.id}/agents`, {
      state: { from: "/development/flowhub", meta: { flowId: f.id } },
    });

  const openCustomers = (f) =>
    navigate(`/development/flowhub/${f.id}/customers`, {
      state: { from: "/development/flowhub", meta: { flowId: f.id } },
    });

  const openTicketHistory = (f) =>
    navigate(`/development/flowhub/${f.id}/ticket-history`, {
      state: { from: "/development/flowhub", meta: { flowId: f.id } },
    });

  const openQuickReplies = (f) =>
    navigate(`/development/flowhub/${f.id}/quick-replies`, {
      state: { from: "/development/flowhub", meta: { flowId: f.id } },
    });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.title}>Workflow Hub</span>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className={styles.btnPrimary}
        >
          + Novo Flow
        </button>
      </div>

      {loading ? (
        <LogoLoader full size={56} src="/logo.svg" />
      ) : rows.length === 0 ? (
        <div className={styles.emptyHint}>
          Nenhum flow ainda. Crie o primeiro!
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((f) => (
            <div key={f.id} className={styles.card}>
              {/* Cabeçalho do card: ações por flow */}
              <div className={styles.cardHead}>
                <div className={styles.cardHeadActions}>
                  <IconButton
                    title="Canais"
                    onClick={() => openChannels(f)}
                    variant="channels"
                  >
                    <PlugZap size={16} />
                  </IconButton>

                  <IconButton
                    title="Studio"
                    onClick={() => openStudio(f)}
                    variant="studio"
                  >
                    <Bot size={16} />
                  </IconButton>

                  <IconButton
                    title="Filas"
                    onClick={() => openQueues(f)}
                    variant="queues"
                  >
                    <ListChecks size={16} />
                  </IconButton>

                  <IconButton
                    title="Atendentes"
                    onClick={() => openAgents(f)}
                    variant="agents"
                  >
                    <Headphones size={16} />
                  </IconButton>

                  <IconButton
                    title="Respostas rápidas"
                    onClick={() => openQuickReplies(f)}
                    variant="quick"
                  >
                    <MessageSquare size={16} />
                  </IconButton>

                  <IconButton
                    title="Histórico de ticket"
                    onClick={() => openTicketHistory(f)}
                    variant="history"
                  >
                    <History size={16} />
                  </IconButton>

                  <IconButton
                    title="Clientes"
                    onClick={() => openCustomers(f)}
                    variant="customer"
                  >
                    <IdCard size={16} />
                  </IconButton>
                </div>
              </div>

              {/* Título / descrição */}
              <div
                className={styles.cardTitle}
                title={f.name || "Sem nome"}
              >
                {f.name || "Sem nome"}
              </div>

              <div
                className={
                  f.description ? styles.cardDesc : styles.cardDescMuted
                }
                title={f.description ? f.description : "Sem descrição"}
              >
                {f.description ? f.description : "Sem descrição"}
              </div>

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

function IconButton({ title, onClick, children, variant }) {
  const classes = [styles.iconButton];
  if (variant && styles[`iconButton_${variant}`]) {
    classes.push(styles[`iconButton_${variant}`]);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={classes.join(" ")}
    >
      {children}
    </button>
  );
}

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
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <strong>Novo Flow</strong>
          <button onClick={onClose} className={styles.linkBtn}>
            Fechar
          </button>
        </div>

        <div className={styles.modalBody}>
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

          <label className={styles.label} htmlFor="flow-desc">
            Descrição (opcional)
          </label>
          <textarea
            id="flow-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="breve descrição"
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.modalFoot}>
          <button onClick={onClose} className={styles.btnGhost}>
            Cancelar</button>
          <button
            disabled={!canSave}
            onClick={submit}
            className={`${styles.btnPrimary} ${
              !canSave ? styles.btnDisabled : ""
            }`}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
