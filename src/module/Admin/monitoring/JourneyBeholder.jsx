// File: JourneyBeholder.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ChevronLeft, Clock, User, MessageCircle, AlertTriangle, Activity, RefreshCw, BarChart3, Timer, MessageSquare, MapPin, FileText } from "lucide-react";
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

// borda por tipo; fundo é fixo azul claro
const typeBorder = (type) => {
  const t = String(type || "").toLowerCase();
  if (t === "text")        return "border-blue-300";
  if (t === "media")       return "border-cyan-300";
  if (t === "location")    return "border-sky-300";
  if (t === "interactive") return "border-green-400";
  if (t === "human")       return "border-purple-300";
  if (t === "api_call")    return "border-violet-300";
  if (t === "document")    return "border-indigo-300";
  if (t === "end")         return "border-red-300";
  if (t === "script")      return "border-orange-300";
  if (t === "system_reset")return "border-gray-300";
  return "border-slate-300";
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
        // Jornada já vem com preview do backend (type, last_in/out, has_error)
        journey: Array.isArray(det?.journey) ? det.journey : [],
        // Dwell detalhado (se existir uma view com métricas ampliadas, preencha no backend)
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button className="hover:text-gray-900 transition-colors" onClick={() => navigate("/development/tracker")}>
                Journey
              </button>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-medium">{detail?.user_id || userId || "—"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {refreshing && (
              <div className="flex items-center gap-2 text-gray-500">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">Atualizando...</span>
              </div>
            )}

            <button
              type="button"
              className="flex items-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              onClick={() => (onBack ? onBack() : navigate(-1))}
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-sm text-gray-500">Carregando…</div>
      ) : lanes.length === 0 ? (
        <div className="text-sm text-gray-500">Sem histórico de etapas para este usuário.</div>
      ) : (
        <div className="space-y-6">
          {lanes.map((lane, idx) => (
            <div key={`lane-${idx}`} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex gap-6 overflow-x-auto pb-4">
                  {lane.map((st, i) => {
                    const key = `${st.stage}|${st.entered_at}`;
                    return (
                      <div key={`${st.stage}-${idx}-${i}`} className="relative flex-shrink-0 w-64">
                        {/* Card da etapa */}
                        <div
                          className={[
                            "min-h-24 rounded-xl p-4 cursor-default transition-all duration-200 hover:shadow-md border-2 bg-blue-50",
                            typeBorder(st.type),
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {typeIcon(st.type)}
                              {Number(st.visits ?? 1) > 1 && (
                                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full font-semibold">
                                  {st.visits}x
                                </span>
                              )}
                              {st?.has_error && (
                                <span
                                  className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold bg-red-50 border-red-200 text-red-700"
                                  title="Erro detectado no intervalo desta etapa"
                                >
                                  Erro
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-500">{fmtTime(st.duration_sec)}</span>
                          </div>

                          <h3 className="font-semibold text-sm leading-tight mb-1">{labelize(st.stage)}</h3>

                          <p className="text-xs text-gray-500">
                            {st.entered_at
                              ? new Date(st.entered_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "—"}
                          </p>

                          {/* Preview (últimas mensagens dentro do intervalo) */}
                          <div className="mt-3 space-y-1 text-xs text-gray-600">
                            {st.last_incoming && (
                              <div className="truncate">
                                <span className="font-medium text-gray-700">Usuário:</span> {st.last_incoming}
                              </div>
                            )}
                            {st.last_outgoing && (
                              <div className="truncate">
                                <span className="font-medium text-gray-700">Bot:</span> {st.last_outgoing}
                              </div>
                            )}
                          </div>

                          {/* Toggle logs */}
                          <button
                            className="mt-3 text-xs font-medium text-blue-700 hover:underline"
                            onClick={async () => {
                              const willExpand = expandedKey !== key;
                              setExpandedKey(willExpand ? key : null);
                              if (willExpand) await fetchStageLog(key, st);
                            }}
                          >
                            {expandedKey === key ? "Ocultar logs" : "Ver logs"}
                          </button>

                          {/* Área expandida de logs */}
                          {expandedKey === key && (
                            <div className="mt-2 rounded-lg border border-gray-200 bg-white">
                              {logsByKey[key]?.loading ? (
                                <div className="p-3 text-xs text-gray-500">Carregando…</div>
                              ) : logsByKey[key]?.items?.length ? (
                                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                                  {logsByKey[key].items.map((lg, idx2) => (
                                    <li key={idx2} className="p-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span
                                          className={`font-semibold ${
                                            lg.direction === "incoming"
                                              ? "text-gray-800"
                                              : lg.direction === "outgoing"
                                              ? "text-gray-600"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          {lg.direction === "incoming"
                                            ? "Usuário"
                                            : lg.direction === "outgoing"
                                            ? "Bot"
                                            : "Sistema"}
                                        </span>
                                        <span className="text-gray-400">
                                          {new Date(lg.ts).toLocaleTimeString("pt-BR")}
                                        </span>
                                      </div>
                                      <div className={`mt-1 ${lg.is_error ? "text-red-700" : "text-gray-700"}`}>
                                        {lg.content}
                                      </div>
                                      {lg.is_error && (
                                        <div className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">
                                          erro detectado
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="p-3 text-xs text-gray-500">Sem mensagens neste intervalo.</div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Seta descolada (não encosta no card) */}
                        {i < lane.length - 1 && (
                          <div className="absolute top-1/2 -right-4 -translate-y-1/2">
                            <div className="w-6 h-[2px] bg-gray-300 relative">
                              <span className="absolute -right-[6px] -top-[3px] w-0 h-0 border-l-[6px] border-l-gray-300 border-y-[4px] border-y-transparent" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card “Diagnóstico” (mantido – serve como resumo, mas seu conteúdo já aparece por etapa) */}
      {detail?.dwell && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900">Visão da etapa atual</h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Etapa</label>
                <div className="text-lg font-semibold text-gray-900">{labelize(detail.dwell.block)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Desde</label>
                <div className="text-lg font-semibold text-gray-900">
                  {detail.dwell.entered_at ? new Date(detail.dwell.entered_at).toLocaleString("pt-BR") : "—"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Duração</label>
                <div className="text-lg font-semibold text-gray-900">{fmtTime(detail.dwell.duration_sec)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Msgs Bot</label>
                <div className="text-lg font-semibold text-gray-900">{detail.dwell.bot_msgs ?? 0}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Msgs Usuário</label>
                <div className="text-lg font-semibold text-gray-900">{detail.dwell.user_msgs ?? 0}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Falhas Validação</label>
                <div className="text-lg font-semibold text-gray-900">{detail.dwell.validation_fails ?? 0}</div>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">Maior gap (usuário)</label>
                <div className="text-lg font-semibold text-gray-900">
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
