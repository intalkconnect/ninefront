// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";
import { ChevronLeft, RefreshCw, MessageCircle } from "lucide-react";
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

const normalizeJourney = (det) => {
  const raw = Array.isArray(det?.journey) ? det.journey : [];
  return raw.map((it) => ({
    stage: it.stage,
    type: String(it?.type || it?.stage_type || "").toLowerCase(),
    entered_at: it.entered_at,
    duration_sec: it.duration_sec,
    visits: it.visits ?? 1,
  }));
};

const chunk10 = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 10) out.push(arr.slice(i, i + 10));
  return out;
};

/* ---------- página ---------- */
export default function JourneyBeholder({ userId: propUserId, onBack }) {
  const { userId: routeUserId } = useParams();
  const userId = propUserId ?? routeUserId; // aceita prop OU rota
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

  const lanes = useMemo(() => chunk10(detail?.journey || []), [detail]);

  // mapeia tom por tipo/label (mesma paleta clara do tracker)
  const toneClass = (stage, type) => {
    const name = String(stage || "").toLowerCase();
    const t = String(type || "");
    if (t.includes("human") || name.includes("atendimento")) return styles.bHuman;
    if (t.includes("interactive") || name.includes("menu") || name.includes("opcao")) return styles.bInteractive;
    if (t.includes("script") || t.includes("api") || name.includes("webhook")) return styles.bScript;
    if (t.includes("condition") || name.includes("condi") || name.includes("valida")) return styles.bCondition;
    if (t.includes("input") || name.includes("entrada")) return styles.bInput;
    return styles.bNeutral;
  };

  if (!userId) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => (onBack ? onBack() : navigate(-1))}>
            <ChevronLeft size={18} /> Voltar
          </button>
        </div>
        <div className={styles.content}>
          <div className={styles.empty}>Faltou o identificador do usuário na URL.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.header}>
        <div className={styles.left}>
          <button
            className={styles.backBtn}
            onClick={() => (onBack ? onBack() : navigate(-1))}
            title="Voltar"
            aria-label="Voltar"
          >
            <ChevronLeft size={18} />
            Voltar
          </button>

          <div className={styles.identity}>
            <div className={styles.title}>{detail?.name || userId}</div>
            <div className={styles.sub}>{detail?.user_id || userId}</div>
          </div>
        </div>

        <button
          className={styles.refreshBtn}
          onClick={fetchDetail}
          disabled={refreshing}
          title="Atualizar agora"
        >
          <RefreshCw size={16} className={refreshing ? styles.spin : ""} />
          Atualizar
        </button>
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
              <header className={styles.laneHead}>
                <div className={styles.laneTitle}>
                  <MessageCircle size={16} />
                  Faixa {idx + 1}
                </div>
                <div className={styles.laneMeta}>
                  Blocos {idx * 10 + 1}–{idx * 10 + lane.length}
                </div>
              </header>

              {/* 10 por linha. Em telas estreitas vira scroll X */}
              <div className={styles.flow}>
                {lane.map((st, i) => (
                  <div className={styles.blockWrap} key={`${st.stage}-${idx}-${i}`}>
                    <div className={`${styles.block} ${toneClass(st.stage, st.type)}`}>
                      <div className={styles.blockTitle}>{labelize(st.stage)}</div>
                    </div>
                    <div className={styles.timeLink}>{fmtTime(st.duration_sec)}</div>
                    {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Diagnóstico (se disponível) */}
        {detail?.dwell && (
          <section className={styles.dwellCard}>
            <div className={styles.dwellHead}>Diagnóstico da etapa atual</div>
            <div className={styles.dwellGrid}>
              <div><span className={styles.dt}>Etapa</span><span className={styles.dv}>{labelize(detail?.dwell?.block || "")}</span></div>
              <div><span className={styles.dt}>Desde</span><span className={styles.dv}>{detail?.dwell?.entered_at ? new Date(detail.dwell.entered_at).toLocaleString("pt-BR") : "—"}</span></div>
              <div><span className={styles.dt}>Duração</span><span className={styles.dv}>{fmtTime(detail?.dwell?.duration_sec)}</span></div>
              <div><span className={styles.dt}>Msgs Bot</span><span className={styles.dv}>{detail?.dwell?.bot_msgs ?? 0}</span></div>
              <div><span className={styles.dt}>Msgs Usuário</span><span className={styles.dv}>{detail?.dwell?.user_msgs ?? 0}</span></div>
              <div><span className={styles.dt}>Falhas Validação</span><span className={styles.dv}>{detail?.dwell?.validation_fails ?? 0}</span></div>
              <div><span className={styles.dt}>Maior gap (usuário)</span><span className={styles.dv}>{fmtTime(detail?.dwell?.max_user_response_gap_sec ?? 0)}</span></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
