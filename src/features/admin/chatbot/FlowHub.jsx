import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../../shared/apiClient";
import { Bot, Cable, Globe, Loader2 } from "lucide-react";

const ENV_DEFAULT = (import.meta.env?.VITE_FLOW_ENV || "prod").toLowerCase();

function groupBy(xs, key) {
  return xs.reduce((acc, it) => {
    const k = it[key];
    (acc[k] ||= []).push(it);
    return acc;
  }, {});
}

export default function FlowHub() {
  const navigate = useNavigate();
  const [env, setEnv] = useState(ENV_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [deploys, setDeploys] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await apiGet(`/flows/deployments?environment=${encodeURIComponent(env)}`);
        if (!alive) return;
        setDeploys(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Falha ao carregar deployments");
        setDeploys([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [env]);

  const grouped = useMemo(() => groupBy(deploys, "flow_id"), [deploys]);

  const openBuilder = async (d) => {
    try {
      // busca o JSON do fluxo por version_id
      const data = await apiGet(`/flows/data-by-version/${d.version_id}`);
      // navega para o Builder passando o fluxo no estado
      navigate("/development/studio", {
        state: {
          initialFlow: data,
          meta: {
            flowId: d.flow_id,
            versionId: d.version_id,
            version: d.version,
            channel: d.channel,
            environment: d.environment,
            name: d.name,
            deploymentId: d.id,
          },
        },
        replace: false,
      });
    } catch (e) {
      alert(`Falha ao abrir o builder: ${e?.message || e}`);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Bot size={18} />
        <h1 style={{ margin: 0, fontSize: 18 }}>Flow Hub</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Globe size={16} />
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            style={{
              background: "var(--bg2, #0f1422)",
              color: "var(--fg, #e5e7eb)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "6px 10px",
            }}
          >
            <option value="prod">prod</option>
            <option value="hmg">hmg</option>
          </select>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.8 }}>
          <Loader2 className="spin" size={16} />
          Carregando deployments…
        </div>
      ) : error ? (
        <div style={{ color: "#f87171" }}>{String(error)}</div>
      ) : deploys.length === 0 ? (
        <div style={{ opacity: 0.85 }}>
          Nenhum deployment encontrado em <b>{env}</b>.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {Object.entries(grouped).map(([flowId, list]) => {
            const first = list[0];
            return (
              <article
                key={flowId}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(255,255,255,0.03)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Bot size={18} />
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 600 }}>
                      {first?.name || `Flow ${flowId}`}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      #{flowId}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {list.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => openBuilder(d)}
                      title={`Abrir versão ${d.version} (${d.channel} / ${d.environment})`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <Cable size={14} />
                      <span>{d.channel}</span>
                      <span style={{ opacity: 0.7 }}>• v{d.version}</span>
                      {d.is_active && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            background: "#22c55e",
                            borderRadius: 999,
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
