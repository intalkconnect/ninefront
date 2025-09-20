// File: JourneyBeholder.jsx (página clara, 10 blocos por faixa, auto-refresh 5s)
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
export default function JourneyBeholder({ userId, onBack }) {
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

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.header}>
        <div className={styles.left}>
          <button
            className={styles.backBtn}
            onClick={() => onBack?.()}
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

              {/* 10 por linha (sem espremer) — em telas menores habilita scroll X */}
              <div className={styles.flow}>
                {lane.map((st, i) => {
                  let tone = styles.bNeutral;
                  const name = String(st.stage || "").toLowerCase();
                  const t = String(st.type || "");
                  if (t.includes("human") || name.includes("atendimento")) tone = styles.bHuman;
                  else if (t.includes("interactive") || name.includes("menu") || name.includes("opcao")) tone = styles.bInteractive;
                  else if (t.includes("script") || t.includes("api") || name.includes("webhook")) tone = styles.bScript;
                  else if (t.includes("condition") || name.includes("condi") || name.includes("valida")) tone = styles.bCondition;
                  else if (t.includes("input") || name.includes("entrada")) tone = styles.bInput;

                  return (
                    <div className={styles.blockWrap} key={`${st.stage}-${idx}-${i}`}>
                      <div className={`${styles.block} ${tone}`}>
                        <div className={styles.blockTitle}>{labelize(st.stage)}</div>
                      </div>
                      <div className={styles.timeLink}>{fmtTime(st.duration_sec)}</div>
                      {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
