// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { toast } from "react-toastify";
import { ChevronLeft } from "lucide-react";
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

const chunk10 = (arr) => {
  const out = [];
  for (let i = 0; i < arr.length; i += 10) out.push(arr.slice(i, i + 10));
  return out;
};

/* ---------- page ---------- */
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

  const lanes = useMemo(() => chunk10(detail?.journey || []), [detail]);

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
          <div className={styles.heading}>
            <div className={styles.pageTitle}>Jornada</div>
            <div className={styles.pageSubtitle}>—</div>
          </div>
          <div className={styles.actions}>
            <button className={styles.backBtn} onClick={() => (onBack ? onBack() : navigate(-1))}>
              <ChevronLeft size={18} /> Voltar
            </button>
          </div>
        </div>
        <div className={styles.content}><div className={styles.empty}>Faltou o identificador do usuário na URL.</div></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Topo no padrão: título à esquerda, ações à direita */}
      <div className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.pageTitle}>{detail?.name || userId}</div>
          <div className={styles.pageSubtitle}>{detail?.user_id || userId}</div>
        </div>

        <div className={styles.actions}>
          {/* sem botão atualizar; apenas indicador discreto */}
          {refreshing && <span className={styles.dot} aria-label="Atualizando" />}
          <button
            className={styles.backBtn}
            onClick={() => (onBack ? onBack() : navigate(-1))}
            aria-label="Voltar"
            title="Voltar"
            type="button"
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
                    <div className={`${styles.block} ${toneClass(st.stage, st.type)}`}>
                      <div className={styles.blockTitle}>{labelize(st.stage)}</div>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.time}>{fmtTime(st.duration_sec)}</span>
                      {st.entered_at && (
                        <span className={styles.started}>
                          {new Date(st.entered_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>

                    {i < lane.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

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
