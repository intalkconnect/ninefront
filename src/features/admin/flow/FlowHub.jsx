import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../../../shared/apiClient";
import { Bot, Workflow, Wifi } from "lucide-react";
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
      const data = await apiGet(`/flows/meta${tenant ? `?subdomain=${tenant}` : ""}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar flows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant]);

  const openStudio = (f) =>
    navigate(`/development/studio/${f.id}`, { state: { meta: { flowId: f.id, name: f.name } } });

  const openChannels = (f) =>
    navigate(`/development/flowhub/${f.id}/channels`, { state: { from: "/development/flowhub" } });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.titleStrong}>FlowHub</span>
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
        <div className={styles.emptyHint}>Nenhum flow ainda. Crie o primeiro!</div>
      ) : (
        <div className={styles.grid}>
          {rows.map((f) => (
            <div key={f.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.tagFlow}>
                  <Workflow size={14} /> flow
                </span>
                <div className={styles.cardHeadActions}>
                  <IconButton title="Canais" onClick={() => openChannels(f)}>
                    <Wifi size={16} />
                  </IconButton>
                  <IconButton title="Studio" onClick={() => openStudio(f)}>
                    <Bot size={16} />
                  </IconButton>
                </div>
              </div>

              {/* Título + descrição melhorados */}
              <div className={styles.cardTitle} title={f.name || "Sem nome"}>
                {f.name || "Sem nome"}
              </div>

              <div
                className={f.description ? styles.cardDesc : styles.cardDescMuted}
                title={f.description ? f.description : "Sem descrição"}
              >
                {f.description ? f.description : "Sem descrição"}
              </div>

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
                  <span className={styles.noChannels}>Nenhum canal vinculado</span>
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
            try {
              const created = await apiPost("/flows", {
                name: form.name,
                description: form.description || null,
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

function IconButton({ title, onClick, children }) {
  return (
    <button onClick={onClick} title={title} className={styles.iconButton}>
      {children}
    </button>
  );
}

function NewFlowModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canSave = name.trim().length > 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <strong>Novo Flow</strong>
          <button onClick={onClose} className={styles.linkBtn}>Fechar</button>
        </div>

        <div className={styles.modalBody}>
          <label className={styles.label}>Nome</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex.: Atendimento"
            className={styles.input}
          />
          <label className={styles.label}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="breve descrição"
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.modalFoot}>
          <button onClick={onClose} className={styles.btnGhost}>Cancelar</button>
          <button
            disabled={!canSave}
            onClick={() => onCreate({ name: name.trim(), description: description.trim() || "" })}
            className={`${styles.btnPrimary} ${!canSave ? styles.btnDisabled : ""}`}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
