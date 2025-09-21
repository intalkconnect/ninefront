// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";
import { ChevronLeft, RefreshCw, Clock, User, MessageCircle, AlertTriangle, Activity, BarChart3, MessageSquare } from "lucide-react";
import styles from "./styles/JourneyBeholder.module.css";

/* utils */
const fmtTime = (sec = 0) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};
const labelize = (s = "") =>
  String(s || "").replace(/_/g, " ").replace(/^\w/u, (c) => c.toUpperCase());

const normalizeJourney = (det) =>
  (Array.isArray(det?.journey) ? det.journey : []).map((it) => ({
    stage: it.stage,
    type: String(it?.type || it?.stage_type || "").toLowerCase(),
    entered_at: it.entered_at,
    duration_sec: it.duration_sec,
    visits: it.visits ?? 1,
  }));

const splitEvery10 = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 10) out.push(arr.slice(i, i + 10));
  return out;
};

/* ícone por tipo (mesmo espírito do JSX de referência) */
const StageIcon = ({ type }) => {
  switch (type) {
    case "text": return <MessageCircle size={16} />;
    case "interactive": return <BarChart3 size={16} />;
    case "system_reset": return <RefreshCw size={16} />;
    case "human": return <User size={16} />;
    case "api_call": return <Activity size={16} />;
    case "document": return <MessageSquare size={16} />;
    case "end": return <AlertTriangle size={16} />;
    default: return <Clock size={16} />;
  }
};

/* mapeia APENAS a cor da BORDA (fundo é fixo claro) */
const toneClass = (type, visits = 1) => {
  const T = String(type || "").toLowerCase();
  const base = {
    text: styles.bText,
    media: styles.bMedia,
    location: styles.bLocation,
    interactive: styles.bInteractive,
    human: styles.bHuman,
    api_call: styles.bApiCall,
    document: styles.bDocument,
    end: styles.bEnd,
    script: styles.bScript,
    system_reset: styles.bSystem,
    default: styles.bNeutral,
  }[T] || styles.bNeutral;

  // se múltiplas visitas, usa um “tom” um pouco mais evidente (classe *_Strong)
  if (visits > 1) {
    const strong = {
      text: styles.bTextStrong,
      interactive: styles.bInteractiveStrong,
      system_reset: styles.bSystemStrong,
    }[T];
    return strong || base;
  }
  return base;
};

export default function JourneyBeholder() {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const userId = routeUserId;

  const [detail, setDetail] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const resp = await apiGet(`/tracert/customers/${encodeURIComponent(userId)}`);
      const det = resp?.data ?? resp;
      setDetail({
        user_id: det?.user_id || userId,
        name: det?.name || det?.user_id || userId,
        journey: normalizeJourney(det),
        dwell: det?.dwell ?? null,
      });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar jornada");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // auto refresh a cada 5s
  useEffect(() => {
    if (!userId) return;
    const t = setInterval(fetchDetail, 5000);
    return () => clearInterval(t);
  }, [userId, fetchDetail]);

  const lanes = useMemo(() => splitEvery10(detail?.journey || []), [detail]);

  return (
    <div className={styles.page}>
      {/* Header "clean/profissional" como no JSX de referência */}
      <div className={styles.headerCard}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <div className={styles.breadcrumbs}>
              <button
                className={styles.bcLink}
                onClick={() => navigate("/development/tracker")}
              >
                Journey
              </button>
              <span className={styles.bcSep}>/</span>
              <span className={styles.bcHere}>{detail?.user_id || userId || "—"}</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            {refreshing && (
              <div className={styles.refreshInfo}>
                <RefreshCw size={16} className={styles.spin} />
                <span>Atualizando...</span>
              </div>
            )}
            <button
              className={styles.backBtn}
              onClick={() => navigate(-1)}
              type="button"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className={styles.lanes}>
        {loading ? (
          <div className={styles.empty}>Carregando…</div>
        ) : lanes.length === 0 ? (
          <div className={styles.empty}>Sem histórico de etapas para este usuário.</div>
        ) : (
          lanes.map((lane, idx) => (
            <div key={`lane-${idx}`} className={styles.laneCard}>
              <div className={styles.laneInner}>
                <div className={styles.stageStrip}>
                  {lane.map((st, i) => (
                    <div key={`${st.stage}-${idx}-${i}`} className={styles.stageWrap}>
                      <div className={`${styles.stageCard} ${toneClass(st.type, st.visits)}`}>
                        <div className={styles.stageTop}>
                          <div className={styles.stageLeft}>
                            <StageIcon type={st.type} />
                            {st.visits > 1 && (
                              <span className={styles.visitsPill}>{st.visits}x</span>
                            )}
                          </div>
                          <span className={styles.duration}>{fmtTime(st.duration_sec)}</span>
                        </div>

                        <h3 className={styles.stageTitle}>{st.stage}</h3>

                        <p className={styles.timeText}>
                          {st.entered_at
                            ? new Date(st.entered_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit", minute: "2-digit", second: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>

                      {/* seta descolada */}
                      {i < lane.length - 1 && (
                        <div className={styles.arrow} aria-hidden="true" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Diagnóstico */}
      {detail?.dwell && (
        <div className={styles.dwellCard}>
          <div className={styles.dwellHead}>
            <h3>Diagnóstico da etapa atual</h3>
          </div>
          <div className={styles.dwellBody}>
            <div className={styles.dwellGrid}>
              <div>
                <label className={styles.fieldLabel}>Etapa</label>
                <div className={styles.fieldValue}>{labelize(detail.dwell.block)}</div>
              </div>

              <div>
                <label className={styles.fieldLabel}>Desde</label>
                <div className={styles.fieldValue}>
                  {detail.dwell.entered_at
                    ? new Date(detail.dwell.entered_at).toLocaleString("pt-BR")
                    : "—"}
                </div>
              </div>

              <div>
                <label className={styles.fieldLabel}>Duração</label>
                <div className={styles.fieldValue}>{fmtTime(detail.dwell.duration_sec)}</div>
              </div>

              <div>
                <label className={styles.fieldLabel}>Msgs Bot</label>
                <div className={styles.fieldValue}>{detail.dwell.bot_msgs ?? 0}</div>
              </div>

              <div>
                <label className={styles.fieldLabel}>Msgs Usuário</label>
                <div className={styles.fieldValue}>{detail.dwell.user_msgs ?? 0}</div>
              </div>

              <div>
                <label className={styles.fieldLabel}>Falhas Validação</label>
                <div className={styles.fieldValue}>{detail.dwell.validation_fails ?? 0}</div>
              </div>

              <div className={styles.span2}>
                <label className={styles.fieldLabel}>Maior gap (usuário)</label>
                <div className={styles.fieldValue}>
                  {fmtTime(detail.dwell.max_user_response_gap_sec ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
