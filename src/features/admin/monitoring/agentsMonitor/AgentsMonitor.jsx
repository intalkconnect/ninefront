import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from "react";
import { apiGet } from "../../../../shared/apiClient";
import { RefreshCw, ToggleLeft, PauseCircle, Power, Clock } from "lucide-react";
import { toast } from "react-toastify";
import styles from "./styles/AgentsMonitor.module.css";

/* ---------- helpers ---------- */

const fmtMin = (m) => {
  const n = Math.max(0, Math.floor(Number(m || 0)));
  const h = Math.floor(n / 60);
  const r = n % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

const fmtRel = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const days = Math.floor(h / 24);
  return `${days}d ${h % 24}h`;
};

const uniq = (arr) => Array.from(new Set(arr || []));

/* ---------- componente ---------- */

export default function AgentsRealtime() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);
  const unmountedRef = useRef(false);

  // limites de pausa vindos de /breaks
  const [pauseCfg, setPauseCfg] = useState({ map: new Map(), def: 15 });

  // filtros
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterText, setFilterText] = useState("");
  const [filterFila, setFilterFila] = useState("todas");

  // paginação
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  /* ----- carrega dados ----- */
  const fetchAll = useCallback(
    async ({ fromButton = false } = {}) => {
      try {
        setRefreshing(true);

        const [ags, pauses] = await Promise.all([
          apiGet("/analytics/agents/realtime"),
          apiGet("/breaks?active=true"),
        ]);

        if (unmountedRef.current) return;

        const list = Array.isArray(ags)
          ? ags
          : Array.isArray(ags?.data)
          ? ags.data
          : [];
        setAgents(list);

        const pList = Array.isArray(pauses)
          ? pauses
          : Array.isArray(pauses?.data)
          ? pauses.data
          : [];

        const map = new Map();
        let def = 15;

        for (const p of pList || []) {
          const label = String(p?.label || "").trim().toLowerCase();
          const code = String(p?.code || "").trim().toLowerCase();
          const mins = Number(p?.max_minutes);

          if (Number.isFinite(mins) && mins > 0) {
            if (label) map.set(label, mins);
            if (code) map.set(code, mins);
            if (code === "default" || label === "default") def = mins;
          }
        }

        setPauseCfg({ map, def });
        setErro(null);

        if (fromButton) toast.success("Atualizado com sucesso");
      } catch (e) {
        setErro("Falha ao atualizar. Tentaremos novamente em 10s.");
        if (fromButton) toast.error("Não foi possível atualizar agora");
      } finally {
        if (!unmountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  // polling com pausa quando a aba está oculta
  useEffect(() => {
    unmountedRef.current = false;
    const run = () => fetchAll();
    run();

    let it = setInterval(run, 10000);

    const onVis = () => {
      if (document.hidden) {
        clearInterval(it);
      } else {
        run();
        it = setInterval(run, 10000);
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      unmountedRef.current = true;
      clearInterval(it);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchAll]);

  /* ----- pausa config ----- */

  const getPauseLimit = useCallback(
    (reason) => {
      const key = String(reason || "").trim().toLowerCase();
      return pauseCfg.map.get(key) ?? pauseCfg.def;
    },
    [pauseCfg]
  );

  // tom da linha: só ok ou late (sem warn)
  const rowTone = useCallback(
    (a) => {
      if (a.status !== "pause") return "ok";
      const dur = Number(a?.pausa?.duracao_min ?? 0);
      const lim = getPauseLimit(a?.pausa?.motivo);
      if (dur >= lim) return "late";
      return "ok";
    },
    [getPauseLimit]
  );

  /* ----- KPIs ----- */

  const kpis = useMemo(() => {
    const online = agents.filter((a) => a.status === "online").length;
    const pause = agents.filter((a) => a.status === "pause").length;
    const offline = agents.filter((a) => a.status === "offline").length;
    const inativo = agents.filter((a) => a.status === "inativo").length;
    return { online, pause, offline, inativo };
  }, [agents]);

  /* ----- listas auxiliares ----- */

  const filasOptions = useMemo(() => {
    const all = agents.flatMap((a) =>
      Array.isArray(a.filas) ? a.filas : []
    );
    return ["todas", ...uniq(all).sort((a, b) => a.localeCompare(b, "pt-BR"))];
  }, [agents]);

  /* ----- filtros + paginação ----- */

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (filterStatus !== "todos" && a.status !== filterStatus) return false;

      if (filterFila !== "todas") {
        const lista = Array.isArray(a.filas) ? a.filas : [];
        if (!lista.includes(filterFila)) return false;
      }

      const txt = filterText.trim().toLowerCase();
      if (!txt) return true;

      const hay =
        (a.agente || "").toLowerCase().includes(txt) ||
        (a.filas || []).some((f) =>
          String(f).toLowerCase().includes(txt)
        ) ||
        (a.pausa?.motivo || "").toLowerCase().includes(txt);

      return hay;
    });
  }, [agents, filterStatus, filterFila, filterText]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [pageSafe, start] = useMemo(() => {
    const p = Math.min(page, totalPages);
    return [p, (p - 1) * PAGE_SIZE];
  }, [page, totalPages]);

  const pageData = useMemo(
    () => filtered.slice(start, start + PAGE_SIZE),
    [filtered, start]
  );

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterFila, filterText, agents]);

  /* ----- helpers de render ----- */

  const StatusPill = ({ s }) => (
    <span className={`${styles.stPill} ${styles["st_" + s]}`}>
      {s === "pause"
        ? "Pausa"
        : s === "online"
        ? "Online"
        : s === "offline"
        ? "Offline"
        : "Inativo"}
    </span>
  );

  const PauseInfo = ({ a }) => {
    if (a.status !== "pause") return "—";

    const motivo = a?.pausa?.motivo || "Pausa";
    const dur = Number(a?.pausa?.duracao_min ?? 0);
    const lim = getPauseLimit(motivo);
    const rest = lim - dur;

    const late = rest <= 0;

    return (
      <span className={styles.pauseText}>
        {motivo} •{" "}
        {late
          ? `excedido +${fmtMin(-rest)}`
          : `${fmtMin(dur)} de ${fmtMin(lim)}`}
      </span>
    );
  };

  const filasTexto = (a) => {
    const lista = Array.isArray(a.filas) ? a.filas : [];
    if (!lista.length) return "—";
    return lista.join(", ");
  };

  const rowClass = (a, index) => {
    const tone = rowTone(a);
    const zebra = index % 2 === 0 ? styles.rowEven : styles.rowOdd;
    const toneClass = styles[`tone_${tone}`] || "";
    return `${styles.row} ${zebra} ${toneClass}`;
  };

  /* ---------- render ---------- */

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER no padrão do monitor de clientes */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Monitor de Agentes</h1>
            <p className={styles.subtitle}>
              Acompanhe em tempo real quem está online, em pausa, offline ou inativo.
            </p>
          </div>

          <button
            className={styles.refreshBtn}
            onClick={() => fetchAll({ fromButton: true })}
            disabled={refreshing}
            title="Atualizar agora"
          >
            <RefreshCw
              size={16}
              className={refreshing ? styles.spinning : ""}
            />
          </button>
        </div>

        {/* KPIs */}
        <section className={styles.cardGroup}>
          {loading ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
              <KpiCard
                icon={<ToggleLeft size={16} />}
                label="Online"
                value={kpis.online}
                tone="green"
              />
              <KpiCard
                icon={<PauseCircle size={16} />}
                label="Em pausa"
                value={kpis.pause}
                tone="amber"
              />
              <KpiCard
                icon={<Power size={16} />}
                label="Offline"
                value={kpis.offline}
                tone="blue"
              />
              <KpiCard
                icon={<Clock size={16} />}
                label="Inativos"
                value={kpis.inativo}
                tone="orange"
              />
            </>
          )}
        </section>

        {/* Filtros */}
        <section className={styles.filters}>
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Status</div>
            {["todos", "online", "pause", "offline", "inativo"].map((s) => (
              <button
                key={s}
                className={`${styles.chip} ${
                  filterStatus === s ? styles.chipActive : ""
                }`}
                onClick={() => setFilterStatus(s)}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Fila</div>
            <select
              value={filterFila}
              onChange={(e) => setFilterFila(e.target.value)}
              className={styles.select}
            >
              {filasOptions.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroupGrow}>
            <div className={styles.filterTitle}>Buscar</div>
            <input
              className={styles.input}
              placeholder="Nome, fila, motivo…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          {erro && (
            <div className={styles.filterError}>
              <span className={styles.kpillAmber}>{erro}</span>
            </div>
          )}
        </section>

        {/* Tabela */}
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Agentes em tempo real</h2>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colFirst}>Agente</th>
                  <th>Status</th>
                  <th>Detalhe</th>
                  <th>Filas</th>
                  <th>Tickets abertos</th>
                  <th>Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className={styles.skelRow}>
                      <td colSpan={6}>
                        <div className={styles.skeletonRow} />
                      </td>
                    </tr>
                  ))
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>
                      Nenhum agente no filtro atual.
                    </td>
                  </tr>
                ) : (
                  pageData.map((a, index) => (
                    <tr
                      key={a.email || a.agente || index}
                      className={rowClass(a, index)}
                    >
                      <td className={styles.agentCell}>
                        <span className={styles.agentName}>
                          {a.agente || "—"}
                        </span>
                      </td>
                      <td>
                        <StatusPill s={a.status} />
                      </td>
                      <td>
                        <PauseInfo a={a} />
                      </td>
                      <td>{filasTexto(a)}</td>
                      <td>{a.tickets_abertos || 0}</td>
                      <td
                        className={`${styles.lastAct} ${
                          !a.last_seen
                            ? styles.lastStale
                            : (Date.now() -
                                new Date(a.last_seen).getTime()) /
                                1000 <=
                              60
                            ? styles.lastOk
                            : (Date.now() -
                                new Date(a.last_seen).getTime()) /
                                1000 <=
                              180
                            ? styles.lastWarn
                            : styles.lastStale
                        }`}
                        title={
                          a.last_seen
                            ? new Date(a.last_seen).toLocaleString("pt-BR")
                            : ""
                        }
                      >
                        {fmtRel(a.last_seen)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* paginação */}
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
            >
              ‹ Anterior
            </button>
            <span className={styles.pageInfo}>
              Página {pageSafe} de {totalPages} • {total} registro(s)
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
            >
              Próxima ›
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- subcomponentes de KPI ---------- */

function KpiCard({ icon, label, value, tone = "blue" }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.kpiValue} ${styles[`tone_${tone}`]}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={`${styles.skeleton} ${styles.sq16}`} />
          <span className={`${styles.skeleton} ${styles.sq120}`} />
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.skeleton} ${styles.sq48}`} />
      </div>
    </div>
  );
}
