// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ChevronLeft, Clock, User, MessageCircle, AlertTriangle,
  Activity, RefreshCw, BarChart3, MapPin, FileText, X
} from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";
import styles from "./styles/JourneyBeholder.module.css";

/* helpers */
const fmtTime = (sec = 0) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};
const labelize = (s = "") =>
  String(s || "").replace(/_/g, " ").replace(/^\w/u, (c) => c.toUpperCase());
const splitEvery10 = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 10) out.push(arr.slice(i, i + 10));
  return out;
};
const typeClass = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "text") return styles.bText;
  if (t === "media") return styles.bMedia;
  if (t === "location") return styles.bLocation;
  if (t === "interactive") return styles.bInteractive;
  if (t === "human") return styles.bHuman;
  if (t === "api_call") return styles.bApiCall;
  if (t === "document") return styles.bDocument;
  if (t === "end") return styles.bEnd;
  if (t === "script") return styles.bScript;
  if (t === "system_reset") return styles.bSystemReset;
  return styles.bNeutral;
};
const typeIcon = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "text") return <MessageCircle size={16} />;
  if (t === "interactive") return <BarChart3 size={16} />;
  if (t === "system_reset") return <RefreshCw size={16} />;
  if (t === "human") return <User size={16} />;
  if (t === "api_call") return <Activity size={16} />;
  if (t === "document") return <FileText size={16} />;
  if (t === "end") return <AlertTriangle size={16} />;
  if (t === "location") return <MapPin size={16} />;
  return <Clock size={16} />;
};

// tenta pretty-print se for JSON válido
const prettyMaybeJson = (text) => {
  if (typeof text !== "string") return text;
  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj, null, 2);
  } catch {
    return text;
  }
};

/* ---------------- KV VIEWER (chave → valor) ---------------- */
const isPlainObject = (v) =>
  Object.prototype.toString.call(v) === "[object Object]";

const humanizeKey = (k = "") =>
  String(k)
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/u, (c) => c.toUpperCase());

const formatPrimitive = (v) => {
  if (v === null || v === undefined) return { text: "—", cls: styles.kvNull };
  if (typeof v === "boolean")
    return { text: v ? "true" : "false", cls: v ? styles.kvBoolTrue : styles.kvBoolFalse };
  if (typeof v === "number") return { text: String(v), cls: styles.kvNumber };
  if (v instanceof Date || /^\d{4}-\d{2}-\d{2}T/.test(String(v))) {
    try {
      const d = v instanceof Date ? v : new Date(String(v));
      if (!isNaN(d.getTime())) return { text: d.toLocaleString("pt-BR"), cls: styles.kvDate };
    } catch {}
  }
  return { text: String(v), cls: styles.kvString };
};

function KVNode({ k, v, depth = 0, path = "", maxEntries = 200 }) {
  const [open, setOpen] = useState(depth < 1); // abre 1º nível por padrão
  const keyLabel = k != null ? humanizeKey(k) : null;

  // Primitivo
  if (!isPlainObject(v) && !Array.isArray(v)) {
    const { text, cls } = formatPrimitive(v);
    return (
      <div className={styles.kvRow}>
        {keyLabel != null && <div className={styles.kvKey}>{keyLabel}</div>}
        <div className={`${styles.kvVal} ${cls}`}>{text}</div>
      </div>
    );
  }

  // Coleção (objeto/array)
  const entries = Array.isArray(v)
    ? v.map((item, i) => [i, item])
    : Object.entries(v || {});
  const overLimit = entries.length > maxEntries;
  const sliced = overLimit ? entries.slice(0, maxEntries) : entries;

  return (
    <div className={styles.kvGroup}>
      {keyLabel != null && (
        <button
          type="button"
          className={styles.kvToggle}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className={styles.kvCaret}>{open ? "▾" : "▸"}</span>
          <span className={styles.kvKey}>{keyLabel}</span>
          <span className={styles.kvType}>
            {Array.isArray(v) ? `Array(${entries.length})` : `Objeto (${entries.length})`}
          </span>
        </button>
      )}

      {open && (
        <div className={styles.kvChildren} data-depth={depth}>
          {sliced.length === 0 ? (
            <div className={styles.kvEmpty}>Vazio</div>
          ) : (
            sliced.map(([ck, cv]) => (
              <KVNode
                key={`${path}.${ck}`}
                k={ck}
                v={cv}
                depth={depth + 1}
                path={`${path}.${ck}`}
              />
            ))
          )}
          {overLimit && (
            <div className={styles.kvOverflow}>
              +{entries.length - maxEntries} itens ocultos
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KVViewer({ data }) {
  if (!data || (isPlainObject(data) && Object.keys(data).length === 0)) {
    return <div className={styles.logsEmpty}>Sem variáveis.</div>;
  }
  return (
    <div className={styles.kvRoot}>
      <KVNode v={data} depth={0} path="$" />
    </div>
  );
}
/* ---------------- FIM KV VIEWER ---------------- */

export default function JourneyBeholder({ userId: propUserId, onBack }) {
  const { userId: routeUserId } = useParams();
  const userId = propUserId ?? routeUserId;
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // MODAL
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("logs"); // logs | vars_stage | vars_session
  const [modalData, setModalData] = useState({
    stage: null,
    entered_at: null,
    type: null,
    last_incoming: null,
    last_outgoing: null,
    vars_stage: null,
    vars_session: null,
  });

  const fetchDetail = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(userId)}`);
      const det = resp?.data ?? resp;
      setDetail({
        user_id: det?.user_id || userId,
        name: det?.name || det?.user_id || userId,
        channel: det?.channel || null,
        current_stage: det?.current_stage,
        current_stage_type: det?.current_stage_type,
        stage_entered_at: det?.stage_entered_at,
        time_in_stage_sec: det?.time_in_stage_sec,
        loops_in_stage: det?.loops_in_stage ?? 1,
        journey: Array.isArray(det?.journey) ? det.journey : [],
        dwell: det?.dwell ?? null,
        session_vars: det?.session_vars ?? null,
      });
    } catch (e) {
      toast.error("Falha ao carregar jornada");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(fetchDetail, 5000);
    return () => clearInterval(id);
  }, [userId, fetchDetail]);

  const lanes = useMemo(() => splitEvery10(detail?.journey || []), [detail]);

  // Abre modal sem buscar nada extra (usa somente o payload da jornada)
  const openModalForStage = (st) => {
    setActiveTab("logs");
    setModalData({
      stage: st.stage,
      entered_at: st.entered_at,
      type: st.type || null,
      last_incoming: st.last_incoming || null,
      last_outgoing: st.last_outgoing || null,
      vars_stage: st.vars ?? null,
      vars_session: detail?.session_vars ?? null,
    });
    setModalOpen(true);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.breadcrumbs}>
            <span className={styles.bcLink} onClick={() => navigate("/development/tracker")}>Journey</span>
            <span className={styles.bcSep}>/</span>
            <span>{detail?.user_id || userId || "—"}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {refreshing && <span className={styles.dot} aria-label="Atualizando" />}
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => (onBack ? onBack() : navigate(-1))}
          >
            <ChevronLeft size={18} />
            Voltar
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Carregando…</div>
        ) : lanes.length === 0 ? (
          <div className={styles.empty}>Sem histórico de etapas para este usuário.</div>
        ) : (
          lanes.map((lane, idx) => (
            <section className={styles.lane} key={`lane-${idx}`}>
              <div className={styles.flow}>
                {lane.map((st, i) => (
                  <div className={styles.blockWrap} key={`${st.stage}-${idx}-${i}`}>
                    <button
                      type="button"
                      className={[styles.block, typeClass(st.type)].join(" ")}
                      onClick={() => openModalForStage(st)}
                      title="Clique para ver detalhes"
                    >
                      <div className={styles.blockTop}>
                        <div className={styles.typeLeft}>
                          {typeIcon(st.type)}
                          {Number(st.visits ?? 1) > 1 && (
                            <span className={`${styles.badge} ${styles.badgeVisits}`}>{st.visits}x</span>
                          )}
                          {st?.has_error && (
                            <span className={`${styles.badge} ${styles.badgeError}`} title="Erro detectado">
                              Erro
                            </span>
                          )}
                        </div>
                        <span className={styles.duration}>{fmtTime(st.duration_sec)}</span>
                      </div>

                      <div className={styles.blockTitle}>{labelize(st.stage)}</div>

                      <div className={styles.metaRow}>
                        <span className={styles.started}>
                          {st.entered_at
                            ? new Date(st.entered_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit", minute: "2-digit", second: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>
                      {/* Sem prévia inline de mensagens, conforme pedido */}
                    </button>

                    {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className={styles.modalStage}>{labelize(modalData.stage)}</span>
                <span className={styles.modalMeta}>
                  {modalData.entered_at ? new Date(modalData.entered_at).toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {/* Abas */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === "logs" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("logs")}
              >
                Logs (prévia)
              </button>
              <button
                className={`${styles.tab} ${activeTab === "vars_stage" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("vars_stage")}
              >
                Variáveis (etapa)
              </button>
              <button
                className={`${styles.tab} ${activeTab === "vars_session" ? styles.tabActive : ""}`}
                onClick={() => setActiveTab("vars_session")}
              >
                Variáveis (sessão)
              </button>
            </div>

            {/* Conteúdo das abas */}
            <div className={styles.tabContent}>
              {activeTab === "logs" && (
                <div className={styles.logsScroll}>
                  {!modalData.last_incoming && !modalData.last_outgoing ? (
                    <div className={styles.logsEmpty}>Sem prévia de mensagens para esta etapa.</div>
                  ) : (
                    <ul className={styles.logsList}>
                      {modalData.last_incoming && (
                        <li className={styles.logRow}>
                          <div className={styles.logHead}>
                            <span className={styles.dirIn}>Usuário</span>
                            <span className={styles.logTs}>
                              {modalData.entered_at ? new Date(modalData.entered_at).toLocaleString("pt-BR") : ""}
                            </span>
                          </div>
                          <pre className={styles.logBody}>{prettyMaybeJson(String(modalData.last_incoming).trim())}</pre>
                        </li>
                      )}
                      {modalData.last_outgoing && (
                        <li className={styles.logRow}>
                          <div className={styles.logHead}>
                            <span className={styles.dirOut}>Bot</span>
                            <span className={styles.logTs}>
                              {modalData.entered_at ? new Date(modalData.entered_at).toLocaleString("pt-BR") : ""}
                            </span>
                          </div>
                          <pre className={styles.logBody}>{prettyMaybeJson(String(modalData.last_outgoing).trim())}</pre>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {activeTab === "vars_stage" && (
                <div className={styles.varsBox}>
                  {modalData.vars_stage ? (
                    <KVViewer data={modalData.vars_stage} />
                  ) : (
                    <div className={styles.logsEmpty}>Sem variáveis registradas para esta etapa.</div>
                  )}
                </div>
              )}

              {activeTab === "vars_session" && (
                <div className={styles.varsBox}>
                  {modalData.vars_session ? (
                    <KVViewer data={modalData.vars_session} />
                  ) : (
                    <div className={styles.logsEmpty}>Sem variáveis na sessão.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
