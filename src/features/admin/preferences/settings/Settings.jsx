import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import styles from "./styles/Settings.module.css";

/* ---------- mapa amigável ---------- */
const FRIENDLY = {
  permitir_transferencia_fila: {
    label: "Permitir transferência entre filas",
    help: "Permite mover um ticket para outra fila durante o atendimento.",
    type: "boolean",
    onText: "Ativado",
    offText: "Desativado",
  },
  permitir_transferencia_atendente: {
    label: "Permitir transferência entre atendentes",
    help: "Permite passar o ticket para outro atendente na mesma fila.",
    type: "boolean",
    onText: "Ativado",
    offText: "Desativado",
  },
  enable_signature: {
    label: "Assinatura em mensagens",
    help: "Inclui automaticamente a assinatura do atendente nas respostas.",
    type: "boolean",
    onText: "Ativado",
    offText: "Desativado",
  },
  distribuicao_tickets: {
    label: "Distribuição de tickets",
    help: "Define como novos tickets são atribuídos.",
    type: "enum",
    options: [
      { value: "manual", label: "Manual" },
      { value: "preditiva", label: "Automática" },
    ],
  },
  habilitar_alertas_atendimento: {
    label: "Habilitar alertas de atendimento",
    help: "Ativa cores/avisos no monitor com base em limites por prioridade.",
    type: "boolean",
    onText: "Ativado",
    offText: "Desativado",
  },
  overrides_por_prioridade_json: {
    label: "Alertas por prioridade",
    help: 'Limites (min) para "aguardando" e "durante o atendimento".',
    type: "overrides_form",
  },
};

/* ---------- helpers ---------- */
const valueLabelFor = (key, value) => {
  const spec = FRIENDLY[key];
  if (spec?.type === "boolean")
    return !!value ? spec.onText || "Ativado" : spec.offText || "Desativado";
  if (spec?.type === "enum") {
    const opt = spec.options?.find((o) => String(o.value) === String(value));
    return opt?.label ?? String(value ?? "—");
  }
  if (typeof value === "boolean") return value ? "Ativado" : "Desativado";
  return String(value ?? "—");
};
const coerceType = (v) => {
  if (v === null || v === undefined) return v;
  if (
    typeof v === "boolean" ||
    typeof v === "number" ||
    typeof v === "object"
  )
    return v;
  const s = String(v).trim();
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  try {
    const j = JSON.parse(s);
    if (typeof j === "object") return j;
  } catch {}
  return s;
};

/* ---------- overrides ---------- */
const DEFAULT_OVERRIDES = {
  alta: { espera_inicial: 5, demora_durante: 10 },
  media: { espera_inicial: 15, demora_durante: 20 },
};
const parseOverrides = (raw) => {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw || {};
    return {
      alta: {
        espera_inicial: Number(
          obj?.alta?.espera_inicial ?? DEFAULT_OVERRIDES.alta.espera_inicial
        ),
        demora_durante: Number(
          obj?.alta?.demora_durante ?? DEFAULT_OVERRIDES.alta.demora_durante
        ),
      },
      media: {
        espera_inicial: Number(
          obj?.media?.espera_inicial ?? DEFAULT_OVERRIDES.media.espera_inicial
        ),
        demora_durante: Number(
          obj?.media?.demora_durante ?? DEFAULT_OVERRIDES.media.demora_durante
        ),
      },
    };
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
};
const isBad = (n) => !Number.isFinite(n) || n < 0;

/* ---------- UI: Toggle ---------- */
const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    onClick={onChange}
    aria-pressed={checked}
    className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
    title={label}
  >
    <span className={styles.knob} />
    <span className={styles.toggleText} />
  </button>
);

/* ---------- componente ---------- */
export default function Preferences() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editingOv, setEditingOv] = useState(false);
  const [ovDraft, setOvDraft] = useState(DEFAULT_OVERRIDES);
  const [ovErr, setOvErr] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/settings");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao carregar preferências.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const byKey = useMemo(() => {
    const m = new Map();
    for (const r of items) m.set(r.key ?? r["key"], r);
    return m;
  }, [items]);

  const alertsEnabled = !!coerceType(
    byKey.get("habilitar_alertas_atendimento")?.value
  );

  useEffect(() => {
    if (!alertsEnabled && editingOv) {
      setEditingOv(false);
      setOvErr({});
    }
  }, [alertsEnabled, editingOv]);

  const saveSetting = async (key, value, description = null) => {
    const tid = toast.loading("Salvando…");
    try {
      const saved = await apiPost("/settings", { key, value, description });
      setItems((prev) =>
        prev.map((r) =>
          r.key === key || r["key"] === key
            ? {
                ...r,
                value: saved?.value ?? value,
                description: saved?.description ?? r.description,
                updated_at: saved?.updated_at ?? r.updated_at,
              }
            : r
        )
      );
      toast.update(tid, {
        render: `Preferência “${FRIENDLY[key]?.label || key}” salva.`,
        type: "success",
        isLoading: false,
        autoClose: 2200,
      });
    } catch (e) {
      console.error(e);
      toast.update(tid, {
        render: "Erro ao salvar. Tente novamente.",
        type: "error",
        isLoading: false,
        autoClose: 3200,
      });
      await load();
    }
  };

  const toggleBoolean = async (key) => {
    const row = byKey.get(key);
    const current = !!coerceType(row?.value);
    await saveSetting(key, !current, row?.description ?? null);
  };

  const changeEnum = async (key, newValue) => {
    const row = byKey.get(key);
    await saveSetting(key, newValue, row?.description ?? null);
  };

  const ordered = useMemo(() => {
    const known = Object.keys(FRIENDLY);
    const score = (k) => {
      const i = known.indexOf(k);
      return i === -1 ? 999 : i;
    };
    return [...items].sort((a, b) => {
      const ka = a.key ?? a["key"];
      const kb = b.key ?? b["key"];
      const sa = score(ka);
      const sb = score(kb);
      if (sa !== sb) return sa - sb;
      return String(ka).localeCompare(String(kb));
    });
  }, [items]);

  /* ---------- Overrides ---------- */
  const validateOv = (d) => {
    const e = {};
    if (isBad(Number(d.alta.espera_inicial)))
      e["alta.espera_inicial"] = "≥ 0";
    if (isBad(Number(d.alta.demora_durante)))
      e["alta.demora_durante"] = "≥ 0";
    if (isBad(Number(d.media.espera_inicial)))
      e["media.espera_inicial"] = "≥ 0";
    if (isBad(Number(d.media.demora_durante)))
      e["media.demora_durante"] = "≥ 0";
    return e;
  };

  const saveOv = async () => {
    const errs = validateOv(ovDraft);
    setOvErr(errs);
    if (Object.keys(errs).length) {
      toast.warn("Revise os campos destacados.");
      return;
    }
    await saveSetting(
      "overrides_por_prioridade_json",
      {
        alta: {
          espera_inicial: Number(ovDraft.alta.espera_inicial),
          demora_durante: Number(ovDraft.alta.demora_durante),
        },
        media: {
          espera_inicial: Number(ovDraft.media.espera_inicial),
          demora_durante: Number(ovDraft.media.demora_durante),
        },
      },
      byKey.get("overrides_por_prioridade_json")?.description ?? null
    );
    setEditingOv(false);
  };

  const renderValueCell = (key, raw) => {
    const spec = FRIENDLY[key];

    if (spec?.type === "boolean" || typeof raw === "boolean") {
      return (
        <div className={styles.valueInline}>
          <Toggle
            checked={!!coerceType(raw)}
            onChange={() => toggleBoolean(key)}
            label={valueLabelFor(key, raw)}
          />
          <span className={styles.valueText}>
            {valueLabelFor(key, raw)}
          </span>
        </div>
      );
    }

    if (spec?.type === "enum") {
      return (
        <select
          value={String(raw ?? "")}
          onChange={(e) => changeEnum(key, e.target.value)}
          className={styles.select}
        >
          {spec.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (spec?.type === "overrides_form") {
      const v = parseOverrides(raw);

      if (!editingOv) {
        return (
          <div className={styles.ovCompact}>
            <div className={styles.ovPill}>
              <span className={styles.ovTag}>Alta</span>
              <span className={styles.ovText}>
                {v.alta.espera_inicial} min aguardo ·{" "}
                {v.alta.demora_durante} min durante
              </span>
            </div>
            <div className={styles.ovPill}>
              <span className={styles.ovTag}>Média</span>
              <span className={styles.ovText}>
                {v.media.espera_inicial} min aguardo ·{" "}
                {v.media.demora_durante} min durante
              </span>
            </div>
            <button
              className={styles.btnTiny}
              onClick={() => {
                if (!alertsEnabled) return;
                setEditingOv(true);
                setOvDraft(v);
              }}
              disabled={!alertsEnabled}
              title={
                !alertsEnabled
                  ? "Ative os alertas para editar"
                  : "Editar limites"
              }
            >
              Editar
            </button>
          </div>
        );
      }

      return (
        <div className={styles.ovEditor}>
          {["alta", "media"].map((pr) => (
            <div key={pr} className={styles.ovEditorRow}>
              <span className={styles.ovEditorLabel}>{pr}</span>
              <label className={styles.ovEditorField}>
                Aguardo
                <input
                  type="number"
                  min="0"
                  className={`${styles.num} ${
                    ovErr[`${pr}.espera_inicial`] ? styles.numErr : ""
                  }`}
                  value={ovDraft[pr].espera_inicial}
                  onChange={(e) =>
                    setOvDraft((d) => ({
                      ...d,
                      [pr]: {
                        ...d[pr],
                        espera_inicial: e.target.value,
                      },
                    }))
                  }
                />
                <span className={styles.numSuffix}>min</span>
              </label>
              <label className={styles.ovEditorField}>
                Durante
                <input
                  type="number"
                  min="0"
                  className={`${styles.num} ${
                    ovErr[`${pr}.demora_durante`] ? styles.numErr : ""
                  }`}
                  value={ovDraft[pr].demora_durante}
                  onChange={(e) =>
                    setOvDraft((d) => ({
                      ...d,
                      [pr]: {
                        ...d[pr],
                        demora_durante: e.target.value,
                      },
                    }))
                  }
                />
                <span className={styles.numSuffix}>min</span>
              </label>
            </div>
          ))}
          <div className={styles.formActions}>
            <button
              className={styles.btnGhost}
              onClick={() => {
                setEditingOv(false);
                setOvErr({});
              }}
            >
              Cancelar
            </button>
            <button className={styles.btnPrimary} onClick={saveOv}>
              Salvar
            </button>
          </div>
        </div>
      );
    }

    return (
      <pre className={styles.freeValue}>
        {String(raw ?? "")}
      </pre>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header no padrão dark das outras telas */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Preferências do workspace</h1>
            <p className={styles.subtitle}>
              Ajuste regras de atendimento e opções globais do ambiente.
            </p>
          </div>
        </header>

        {/* Card da “tabela” com header escuro */}
        <div className={styles.tableCard}>
          <div className={styles.tableHead}>
            <div className={styles.th}>Opção</div>
            <div className={styles.th}>Valor</div>
            <div className={styles.th}>Atualizado</div>
          </div>

          <div className={styles.tableBody}>
            {loading && (
              <div className={styles.loading}>Carregando…</div>
            )}

            {!loading &&
              ordered.map((row) => {
                const key = row.key ?? row["key"];
                const spec = FRIENDLY[key];
                const raw = row.value;

                return (
                  <div className={styles.row} key={key}>
                    <div className={styles.colOption}>
                      <div className={styles.optionTitle}>
                        {spec?.label ?? key}
                      </div>
                      {spec?.help && (
                        <div className={styles.optionHelp}>
                          {spec.help}
                        </div>
                      )}
                      {row.description && (
                        <div className={styles.optionDesc}>
                          {row.description}
                        </div>
                      )}
                    </div>

                    <div className={styles.colValue}>
                      {renderValueCell(key, raw)}
                    </div>

                    <div className={styles.colUpdated}>
                      {row.updated_at
                        ? new Date(
                            row.updated_at
                          ).toLocaleString("pt-BR")
                        : "—"}
                    </div>
                  </div>
                );
              })}

            {!loading && ordered.length === 0 && (
              <div className={styles.empty}>
                Nenhuma preferência encontrada.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
