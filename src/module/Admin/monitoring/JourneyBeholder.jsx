// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ChevronLeft, Clock, User, MessageCircle, AlertTriangle, Activity, RefreshCw, BarChart3, MapPin, FileText } from "lucide-react";
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

// CSS Module: retorna a classe de borda pelo tipo
const toneClass = (rawType) => {
  const t = String(rawType || "").toLowerCase();
  if (t === "text")         return styles.bText;
  if (t === "media")        return styles.bMedia;
  if (t === "location")     return styles.bLocation;
  if (t === "interactive")  return styles.bInteractive;
  if (t === "human")        return styles.bHuman;
  if (t === "api_call")     return styles.bApiCall;
  if (t === "document")     return styles.bDocument;
  if (t === "end")          return styles.bEnd;
  if (t === "script")       return styles.bScript;
  if (t === "system_reset") return styles.bSystemReset;
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

  // expansão de logs por etapa
  const [expandedKey, setExpandedKey] = useState(null);
  const [logsByKey, setLogsByKey] = useState({}); // { key: { loading, items } }

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

  // lazy-load de logs da etapa (intervalo entered_at..left_at)
  const fetchStageLog = useCallback(async (key, st) => {
    if (!detail?.user_id) return;
    if (logsByKey[key]?.items) return;

    setLogsByKey(prev => ({ ...prev, [key]: { loading: true, items: [] } }));
    try {
      const qs = new URLSearchParams({
        entered_at: st.entered_at,
        stage: st.stage,
        limit: "200",
      });
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(detail.user_id)}/stage-log?${qs.toString()}`);
      const items = resp?.data ?? resp;
      setLogsByKey(prev => ({ ...prev, [key]: { loading: false, items: Array.isArray(items) ? items : [] } }));
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar logs da etapa");
      setLogsByKey(prev => ({ ...prev, [key]: { loading: false, items: [] } }));
    }
  }, [detail?.user_id, logsByKey]);

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
          <button type="button" className={styles.backBtn} onClick={() => (onBack ? onBack() : navigate(-1))}>
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
                {lane.map((st, i) => {
                  const key = `${st.stage}|${st.entered_at}`;
                  return (
                    <div className={styles.blockWrap} key={`${st.stage}-${idx}-${i}`}>
                      {/* Card da etapa */}
                      <div className={[styles.block, toneClass(st.type)].join(" ")}> 
                        <div className={styles.topRow}>
                          <div className={styles.leftBadges}>
                            <span className={styles.icon}>{typeIcon(st.type)}</span>
                            {Number(st.visits ?? 1) > 1 && (
                              <span className={[styles.badge, styles.badgeVisits].join(" ")}>{st.visits}x</span>
                            )}
                            {st?.has_error && (
                              <span className={[styles.badge, styles.badgeError].join(" ")}>Erro</span>
                            )}
                          </div>
                          <span className={styles.time}>{fmtTime(st.duration_sec)}</span>
                        </div>

                        <div className={styles.blockTitle}>{labelize(st.stage)}</div>
                        <div className={styles.started}>
                          {st.entered_at ? new Date(st.entered_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                        </div>

                        {/* Preview (últimas mensagens no intervalo) */}
                        <div className={styles.preview}>
                          {st.last_incoming && (
                            <span className={styles.pvItem}><span className={styles.pvLabel}>Usuário:</span> {st.last_incoming}</span>
                          )}
                          {st.last_outgoing && (
                            <span className={styles.pvItem}><span className={styles.pvLabel}>Bot:</span> {st.last_outgoing}</span>
                          )}
                        </div>

                        {/* Toggle logs */}
                        <button
                          className={styles.expBtn}
                          onClick={async () => {
                            const willExpand = expandedKey !== key;
                            setExpandedKey(willExpand ? key : null);
                            if (willExpand) await fetchStageLog(key, st);
                          }}
                        >
                          {expandedKey === key ? "Ocultar logs" : "Ver logs"}
                        </button>

                        {expandedKey === key && (
                          <div className={styles.logsPanel}>
                            {logsByKey[key]?.loading ? (
                              <div className={styles.logItem}>Carregando…</div>
                            ) : logsByKey[key]?.items?.length ? (
                              <ul>
                                {logsByKey[key].items.map((lg, idx2) => (
                                  <li key={idx2} className={styles.logItem}>
                                    <div className={styles.logHead}>
                                      <span>
                                        {lg.direction === "incoming" ? "Usuário" : lg.direction === "outgoing" ? "Bot" : "Sistema"}
                                      </span>
                                      <span className={styles.logTs}>{new Date(lg.ts).toLocaleTimeString("pt-BR")}</span>
                                    </div>
                                    <div className={`${styles.logBody} ${lg.is_error ? styles.logBodyError : ""}`}>{lg.content}</div>
                                    {lg.is_error && <div className={styles.logErr}>erro detectado</div>}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className={styles.logItem}>Sem mensagens neste intervalo.</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Seta descolada */}
                      {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {/* Resumo da etapa atual */}
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
                <span className={styles.dv}>{detail.dwell.entered_at ? new Date(detail.dwell.entered_at).toLocaleString("pt-BR") : "—"}</span>
              </div>
              <div>
                <span className={styles.dt}>Duração</span>
                <span className={styles.dv}>{fmtTime(detail.dwell.duration_sec)}</span>
              </div>
              <div>
                <span className={styles.dt}>Msgs Bot</span>
                <span className={styles.dv}>{detail.dwell.bot_msgs ?? 0}</span>
              </div>
              <div>
                <span className={styles.dt}>Msgs Usuário</span>
                <span className={styles.dv}>{detail.dwell.user_msgs ?? 0}</span>
              </div>
              <div>
                <span className={styles.dt}>Falhas Validação</span>
                <span className={styles.dv}>{detail.dwell.validation_fails ?? 0}</span>
              </div>
              <div>
                <span className={styles.dt}>Maior gap (usuário)</span>
                <span className={styles.dv}>{fmtTime(detail.dwell.max_user_response_gap_sec ?? 0)}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
