// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";
import { ChevronLeft, MessageCircle, BarChart3, RefreshCw, User, Activity, FileText, AlertTriangle, Clock } from "lucide-react";
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

/* ícone por tipo (somente visual) */
const TypeIcon = ({ type }) => {
  switch (type) {
    case "text":         return <MessageCircle size={16} />;
    case "interactive":  return <BarChart3 size={16} />;
    case "system_reset": return <RefreshCw size={16} />;
    case "human":        return <User size={16} />;
    case "api_call":     return <Activity size={16} />;
    case "document":     return <FileText size={16} />;
    case "end":          return <AlertTriangle size={16} />;
    default:             return <Clock size={16} />;
  }
};

export default function JourneyBeholder({ userId: propUserId, onBack }) {
  const { userId: routeUserId } = useParams();
  const userId = propUserId ?? routeUserId;
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // carrega e auto-atualiza a cada 5s
  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(fetchDetail, 5000);
    return () => clearInterval(id);
  }, [userId, fetchDetail]);

  const lanes = useMemo(() => splitEvery10(detail?.journey || []), [detail]);

  // somente BORDA por tipo; fundo padrão azul-claro para todos
  const typeBorderClass = (t) => {
    const type = String(t || "").toLowerCase();
    if (type === "interactive")  return styles.tInteractive;
    if (type === "text")         return styles.tText;
    if (type === "media")        return styles.tMedia;
    if (type === "location")     return styles.tLocation;
    if (type === "human")        return styles.tHuman;
    if (type === "api_call")     return styles.tApiCall;
    if (type === "document")     return styles.tDocument;
    if (type === "end")          return styles.tEnd;
    if (type === "script")       return styles.tScript;
    if (type === "system_reset") return styles.tSystem;
    return styles.tNeutral;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.breadcrumbs}>
            <span
              className={styles.bcLink}
              onClick={() => navigate("/development/tracker")}
            >
              Journey
            </span>
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
            aria-label="Voltar"
            title="Voltar"
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
        </div>
      </div>

      {/* Timeline */}
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
                  <React.Fragment key={`${st.stage}-${idx}-${i}`}>
                    <div className={styles.blockWrap}>
                      <div className={`${styles.block} ${typeBorderClass(st.type)}`}>
                        <div className={styles.blockTop}>
                          <div className={`${styles.typeIcon} ${typeBorderClass(st.type)}`}>
                            <TypeIcon type={st.type} />
                          </div>
                          <div className={styles.duration}>{fmtTime(st.duration_sec)}</div>
                        </div>

                        <div className={styles.blockTitle}>{labelize(st.stage)}</div>
                        <div className={styles.blockMeta}>
                          {new Date(st.entered_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>

                        {Number(st.visits || 1) > 1 && (
                          <span className={styles.visitPill}>{st.visits}x</span>
                        )}
                      </div>
                    </div>

                    {/* conector descolado */}
                    {i < lane.length - 1 && <span className={styles.connector} aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Diagnóstico atual */}
        {detail?.dwell && (
          <section className={styles.dwellCard}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Etapa</label>
    <div className="text-lg font-semibold text-gray-900">
      {detail?.dwell?.block ?? '—'}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Desde</label>
    <div className="text-lg font-semibold text-gray-900">
      {detail?.dwell?.entered_at
        ? new Date(detail.dwell.entered_at).toLocaleString('pt-BR')
        : '—'}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Duração</label>
    <div className="text-lg font-semibold text-gray-900">
      {fmtTime(detail?.dwell?.duration_sec ?? 0)}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Msgs Bot</label>
    <div className="text-lg font-semibold text-gray-900">
      {detail?.dwell?.bot_msgs ?? 0}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Msgs Usuário</label>
    <div className="text-lg font-semibold text-gray-900">
      {detail?.dwell?.user_msgs ?? 0}
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-500 mb-1">Falhas Validação</label>
    <div className="text-lg font-semibold text-gray-900">
      {detail?.dwell?.validation_fails ?? 0}
    </div>
  </div>

  <div className="lg:col-span-2">
    <label className="block text-sm font-medium text-gray-500 mb-1">Maior gap (usuário)</label>
    <div className="text-lg font-semibold text-gray-900">
      {fmtTime(detail?.dwell?.max_user_response_gap_sec ?? 0)}
    </div>
  </div>
</div>

          </section>
        )}
      </div>
    </div>
  );
}
