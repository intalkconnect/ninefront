import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ChevronLeft, Clock, User, MessageCircle, AlertTriangle,
  Activity, RefreshCw, BarChart3, MapPin, FileText, X
} from "lucide-react";
import { apiGet } from "../../../shared/apiClient";
import styles from "./styles/JourneyBeholder.module.css";

/* ---------- helpers ---------- */
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

/* borda por tipo; fundo é fixo (azul claro) */
const typeClass = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "text")        return styles.bText;
  if (t === "media")       return styles.bMedia;
  if (t === "location")    return styles.bLocation;
  if (t === "interactive") return styles.bInteractive;
  if (t === "human")       return styles.bHuman;
  if (t === "api_call")    return styles.bApiCall;
  if (t === "document")    return styles.bDocument;
  if (t === "end")         return styles.bEnd;
  if (t === "script")      return styles.bScript;
  if (t === "system_reset")return styles.bSystemReset;
  return styles.bNeutral;
};

const typeIcon = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "text")        return <MessageCircle size={16} />;
  if (t === "interactive") return <BarChart3 size={16} />;
  if (t === "system_reset")return <RefreshCw size={16} />;
  if (t === "human")       return <User size={16} />;
  if (t === "api_call")    return <Activity size={16} />;
  if (t === "document")    return <FileText size={16} />;
  if (t === "end")         return <AlertTriangle size={16} />;
  if (t === "location")    return <MapPin size={16} />;
  return <Clock size={16} />;
};

/* ---------- page ---------- */
export default function JourneyBeholder({ userId: propUserId, onBack }) {
  const { userId: routeUserId } = useParams();
  const userId = propUserId ?? routeUserId;
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("vars"); // vars | preview
  const [selectedStage, setSelectedStage] = useState(null); // objeto da journey

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
      console.error(e);
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

  const openStageModal = (st) => {
    setSelectedStage(st);
    setModalTab("vars");
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
                      onClick={() => openStageModal(st)}
                      title="Clique para ver detalhes"
                    >
                      <div className={styles.blockTop}>
                        <div className={styles.typeLeft}>
                          {typeIcon(st.type)}
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

                      {/* nada de “última do bot/usuário” aqui */}
                    </button>

                    {/* seta entre cartões */}
                    {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {/* resumo opcional */}
        {detail?.dwell && (
          <section className={styles.dwellCard}>
            <div className={styles.dwellHead}>Visão da etapa atual</div>
            <div className={styles.dwellGrid}>
              <div>
                <span className={styles.dt}>Etapa</span>
                <span className={styles.dv}>{labelize(detail.dwell.block)}</span>
              </div>
              <div>
                <span className={styles.dt}>Desde</span>
                <span className={styles.dv}>
                  {detail.dwell.entered_at ? new Date(detail.dwell.entered_at).toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              <div>
                <span className={styles.dt}>Duração</span>
                <span className={styles.dv}>{fmtTime(detail.dwell.duration_sec)}</span>
              </div>
              <div>
                <span className={styles.dt}>Msgs Bot</span>
                <span className={styles.dv}>{detail?.dwell?.bot_msgs ?? 0}</span>
              </div>
              <div>
                <span className={styles.dt}>Msgs Usuário</span>
                <span className={styles.dv}>{detail?.dwell?.user_msgs ?? 0}</span>
              </div>
              <div>
                <span className={styles.dt}>Falhas Validação</span>
                <span className={styles.dv}>{detail?.dwell?.validation_fails ?? 0}</span>
              </div>
              <div className={styles.span2}>
                <span className={styles.dt}>Maior gap (usuário)</span>
                <span className={styles.dv}>{fmtTime(detail?.dwell?.max_user_response_gap_sec ?? 0)}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && selectedStage && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  {typeIcon(selectedStage.type)}
                  <span>{labelize(selectedStage.stage)}</span>
                </div>
                <div className={styles.modalSub}>
                  {selectedStage.entered_at
                    ? new Date(selectedStage.entered_at).toLocaleString("pt-BR")
                    : "—"}{" "}
                  · {fmtTime(selectedStage.duration_sec)}
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setModalOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalTabs}>
              <button
                className={`${styles.tabBtn} ${modalTab === "vars" ? styles.tabActive : ""}`}
                onClick={() => setModalTab("vars")}
              >
                Variáveis
              </button>
              <button
                className={`${styles.tabBtn} ${modalTab === "preview" ? styles.tabActive : ""}`}
                onClick={() => setModalTab("preview")}
              >
                Prévia (opcional)
              </button>
            </div>

            <div className={styles.modalBody}>
              {modalTab === "vars" ? (
                <div className={styles.varsGrid}>
                  <div className={styles.varsCard}>
                    <div className={styles.varsHead}>Variáveis do bloco</div>
                    <div className={styles.varsScroll}>
                      {selectedStage?.vars && Object.keys(selectedStage.vars).length ? (
                        <table className={styles.kvTable}>
                          <tbody>
                            {Object.entries(selectedStage.vars).map(([k, v]) => (
                              <tr key={k}>
                                <td className={styles.kCell}>{k}</td>
                                <td className={styles.vCell}>
                                  {typeof v === "object" ? (
                                    <pre className={styles.code}>{JSON.stringify(v, null, 2)}</pre>
                                  ) : (
                                    String(v)
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.emptySmall}>Sem variáveis registradas neste bloco.</div>
                      )}
                    </div>
                  </div>

                  <div className={styles.varsCard}>
                    <div className={styles.varsHead}>Variáveis da sessão</div>
                    <div className={styles.varsScroll}>
                      {detail?.session_vars && Object.keys(detail.session_vars).length ? (
                        <table className={styles.kvTable}>
                          <tbody>
                            {Object.entries(detail.session_vars).map(([k, v]) => (
                              <tr key={k}>
                                <td className={styles.kCell}>{k}</td>
                                <td className={styles.vCell}>
                                  {typeof v === "object" ? (
                                    <pre className={styles.code}>{JSON.stringify(v, null, 2)}</pre>
                                  ) : (
                                    String(v)
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className={styles.emptySmall}>Sem variáveis de sessão.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.previewWrap}>
                  <div className={styles.pLine}>
                    <span className={styles.pLabel}>Último do usuário:</span>
                    <pre className={styles.pCode}>
{selectedStage?.last_incoming ? String(selectedStage.last_incoming) : "—"}
                    </pre>
                  </div>
                  <div className={styles.pLine}>
                    <span className={styles.pLabel}>Último do bot:</span>
                    <pre className={styles.pCode}>
{selectedStage?.last_outgoing ? String(selectedStage.last_outgoing) : "—"}
                    </pre>
                  </div>
                  <div className={styles.pHint}>
                    Observação: esta é apenas uma prévia rápida. Logs completos por intervalo não estão habilitados.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
