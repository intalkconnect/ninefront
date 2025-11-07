import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { Save, Palette, RefreshCw, X } from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import styles from "./styles/QueueForm.module.css";

/* =================== utils de cor =================== */
const normalizeHexColor = (input) => {
  if (!input) return null;
  let c = String(input).trim();
  if (!c) return null;
  if (!c.startsWith("#")) c = `#${c}`;
  if (/^#([0-9a-fA-F]{3})$/.test(c))
    c =
      "#" +
      c
        .slice(1)
        .split("")
        .map((ch) => ch + ch)
        .join("");
  return /^#([0-9a-fA-F]{6})$/.test(c) ? c.toUpperCase() : null;
};
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
};
const randomPastelHex = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 16);
  const l = 78 + Math.floor(Math.random() * 8);
  return hslToHex(h, s, l);
};

/* =================== ChipsInput (tags) =================== */
function ChipsInput({
  value = [],
  onChange,
  placeholder = "ex.: Agendamento, Cliente VIP, Urgência",
  maxLen = 40,
}) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  const sanitize = (s) =>
    String(s ?? "")
      .trim()
      .slice(0, maxLen);

  const tokenize = (raw) =>
    String(raw ?? "")
      .split(/[,;\n]+/)
      .map(sanitize)
      .filter(Boolean);

  const addTokens = useCallback(
    (raw) => {
      const tokens = tokenize(raw);
      if (!tokens.length) return;
      const existing = new Set(value); // case-sensitive
      const fresh = tokens.filter((t) => !existing.has(t));
      if (!fresh.length) return;
      onChange([...value, ...fresh]);
    },
    [value, onChange]
  );

  const removeChip = (t) => onChange(value.filter((x) => x !== t));

  const handleKeyDown = (e) => {
    const isSep = e.key === "Enter" || e.key === "," || e.key === ";";
    if (isSep) {
      e.preventDefault();
      if (text.trim()) {
        addTokens(text);
        setText("");
      }
      return;
    }
    if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e) => {
    const pasted =
      (e.clipboardData || window.clipboardData)?.getData("text") || "";
    if (/[,\n;]/.test(pasted)) {
      e.preventDefault();
      addTokens(pasted);
    }
  };

  return (
    <div className={styles.tagsField} onClick={() => ref.current?.focus()}>
      {value.map((t) => (
        <span key={t} className={styles.tagChip}>
          <span>{t}</span>
          <button
            type="button"
            className={styles.tagChipX}
            aria-label={`Remover ${t}`}
            onClick={() => removeChip(t)}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={ref}
        className={styles.tagsInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length ? "" : placeholder}
      />
    </div>
  );
}

/* =================== NiceSelect (custom dropdown) =================== */
function NiceSelect({ value, onChange, options = [], disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const cur = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative", maxWidth: 420 }}>
      <button
        type="button"
        className={styles.input}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span>{cur?.label || "Selecionar…"}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ color: "#64748b" }}
        >
          <polyline
            points="6 9 12 15 18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            marginTop: 6,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow-md)",
            listStyle: "none",
            padding: 6,
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--text2)",
                background: opt.value === value ? "#e8f0ff" : "transparent",
                border:
                  opt.value === value
                    ? "1px solid #d6e4ff"
                    : "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  opt.value === value ? "#e8f0ff" : "transparent";
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* =================== Página =================== */
export default function QueueForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const topRef = useRef(null);

  // flowId vindo do FlowHub ou de rota com param
  const flowId =
    location.state?.flowId ||
    location.state?.meta?.flowId ||
    null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({ nome: "", descricao: "", color: "" });
  const [touched, setTouched] = useState({ nome: false, color: false });

  // nome exibido no breadcrumb
  const [queueDisplay, setQueueDisplay] = useState(id || "");

  // tags
  const [initialTags, setInitialTags] = useState([]); // catálogo original
  const [tags, setTags] = useState([]); // estado visível

  // --- Regra de roteamento ---
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [hadRuleInitially, setHadRuleInitially] = useState(false);
  const [rule, setRule] = useState({ field: "", op: "equals", value: "" });

  // validação
  const colorPreview = useMemo(
    () => normalizeHexColor(form.color),
    [form.color]
  );
  const nameInvalid = !form.nome.trim();
  const colorInvalid = form.color ? !colorPreview : false;
  const canSubmit = !saving && !nameInvalid && !colorInvalid;

  const baseQueuesPath = flowId
    ? `/development/flowhub/${encodeURIComponent(flowId)}/queues`
    : "/management/queues";

  // carrega catálogo por nome de fila
  const loadTags = useCallback(async (filaNome, flowIdParam) => {
    if (!filaNome) {
      setInitialTags([]);
      setTags([]);
      return;
    }
    try {
      const qsParts = [
        `fila=${encodeURIComponent(filaNome)}`,
        "page_size=200",
      ];
      if (flowIdParam) {
        qsParts.push(`flow_id=${encodeURIComponent(flowIdParam)}`);
      }
      const url = `/tags/ticket/catalog?${qsParts.join("&")}`;
      const r = await apiGet(url);
      const list = Array.isArray(r?.data) ? r.data : [];
      const arr = list.map((x) => x.tag);
      setInitialTags(arr);
      setTags(arr);
    } catch {
      setInitialTags([]);
      setTags([]);
    }
  }, []);

  // carrega UMA regra da API
  const loadRule = useCallback(async (filaIdOrName, flowIdParam) => {
    if (!filaIdOrName) {
      setRuleEnabled(false);
      setRule({ field: "", op: "equals", value: "" });
      return;
    }
    try {
      const qs = flowIdParam
        ? `?flow_id=${encodeURIComponent(flowIdParam)}`
        : "";
      const r = await apiGet(
        `/queue-rules/${encodeURIComponent(filaIdOrName)}${qs}`
      );
      const cfg = r?.data || r;
      const first = Array.isArray(cfg?.conditions) ? cfg.conditions[0] : null;
      const type = first?.type ?? first?.op ?? "";
      const variable = first?.variable ?? first?.field ?? "";

      setRuleEnabled(!!cfg?.enabled);
      setRule({
        field: variable,
        op: type === "contains" ? "contains" : "equals",
        value: first?.value || "",
      });
      setHadRuleInitially(!!cfg?.enabled && !!variable && !!first?.value);
    } catch {
      setRuleEnabled(false);
      setRule({ field: "", op: "equals", value: "" });
    }
  }, []);

  // carrega fila
  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (isEdit) {
        const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
        const data = await apiGet(`/queues/${encodeURIComponent(id)}${qs}`);
        const q = data?.data ?? data ?? {};
        const nomeFila = (q.queue_name ?? q.nome ?? q.name ?? "").trim();

        setForm({
          nome: q.nome ?? q.name ?? "",
          descricao: q.descricao ?? "",
          color: q.color ?? "",
        });
        setQueueDisplay(nomeFila || id);

        await loadTags(nomeFila || q.nome || q.name, flowId);
        await loadRule(nomeFila || q.nome || q.name, flowId);
      } else {
        setForm({ nome: "", descricao: "", color: "" });
        setQueueDisplay("");
        setInitialTags([]);
        setTags([]);
        setRuleEnabled(false);
        setRule({ field: "", op: "equals", value: "" });
      }
    } catch (e) {
      console.error(e);
      setErr("Falha ao carregar dados da fila.");
      toast.error("Falha ao carregar dados da fila.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }, [isEdit, id, loadTags, loadRule, flowId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSortearCor = () =>
    setForm((f) => ({ ...f, color: randomPastelHex() }));
  const handleLimparCor = () => setForm((f) => ({ ...f, color: "" }));

  // cria e remove conforme diff — respeita exatamente como escrito nas tags
  async function persistTagsDiff(
    filaNome,
    before = [],
    current = [],
    flowIdParam
  ) {
    const prev = new Set(before);
    const now = new Set(current);

    const toAdd = [...now].filter((t) => !prev.has(t));
    const toRemove = [...prev].filter((t) => !now.has(t));

    const jobs = [];

    for (const tag of toAdd) {
      jobs.push(
        apiPost("/tags/ticket/catalog", {
          fila: filaNome,
          tag,
          active: true,
          ...(flowIdParam ? { flow_id: flowIdParam } : {}),
        })
      );
    }
    for (const tag of toRemove) {
      const qs = flowIdParam
        ? `?flow_id=${encodeURIComponent(flowIdParam)}`
        : "";
      jobs.push(
        apiDelete(
          `/tags/ticket/catalog/${encodeURIComponent(
            filaNome
          )}/${encodeURIComponent(tag)}${qs}`
        )
      );
    }

    if (!jobs.length) return;

    const res = await Promise.allSettled(jobs);
    const ok = res.filter((r) => r.status === "fulfilled").length;
    const fail = res.length - ok;
    if (ok) toast.success(`${ok} alteração(ões) de etiqueta aplicada(s).`);
    if (fail)
      toast.error(
        `${fail} alteração(ões) falharam. Verifique dependências (tags em uso).`
      );
  }

  async function handleSave() {
    setTouched({ nome: true, color: true });
    if (!canSubmit) {
      toast.warn("Confira os campos obrigatórios.");
      return;
    }
    try {
      setSaving(true);

      const payload = {
        nome: form.nome.trim(),
        ...(form.descricao.trim() ? { descricao: form.descricao.trim() } : {}),
        ...(colorPreview ? { color: colorPreview } : {}),
        ...(flowId ? { flow_id: flowId } : {}),
      };

      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";

      if (isEdit) {
        await apiPut(`/queues/${encodeURIComponent(id)}${qs}`, payload);
        toast.success("Fila atualizada.");
      } else {
        await apiPost(`/queues${qs}`, payload);
        toast.success("Fila criada.");
      }

      const filaNome = form.nome.trim();
      await persistTagsDiff(filaNome, initialTags, tags, flowId);

      if (ruleEnabled && rule.field.trim() && rule.value.trim()) {
        const body = {
          enabled: true,
          conditions: [
            {
              type: rule.op === "contains" ? "contains" : "equals",
              variable: rule.field.trim(),
              value: rule.value.trim(),
            },
          ],
        };
        await apiPut(
          `/queue-rules/${encodeURIComponent(filaNome)}${qs}`,
          body
        );
      } else if (hadRuleInitially) {
        await apiDelete(`/queue-rules/${encodeURIComponent(filaNome)}${qs}`);
      } else {
        // nada a fazer
      }

      navigate(baseQueuesPath);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li>
            <Link to="/" className={styles.bcLink}>
              Dashboard
            </Link>
          </li>
          <li className={styles.bcSep}>/</li>
          <li>
            <Link to={baseQueuesPath} className={styles.bcLink}>
              Filas
            </Link>
          </li>
          <li className={styles.bcSep}>/</li>
          <li>
            <span className={styles.bcCurrent}>
              {isEdit ? `${queueDisplay}` : "Nova fila"}
            </span>
          </li>
        </ol>
      </nav>

      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>
            {isEdit ? `Editar ${queueDisplay}` : "Nova fila"}
          </h1>
          <p className={styles.pageSubtitle}>
            Defina o nome da fila, uma descrição e (opcionalmente) uma cor de
            identificação.
          </p>
        </div>
      </header>

      {loading ? (
        <div className={styles.skeleton}>
          <div className={styles.skelCard} />
          <div className={styles.skelCard} />
        </div>
      ) : (
        <>
          {err && <div className={styles.alert}>{err}</div>}

          {/* ===== Identificação ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Identificação</h2>
              <p className={styles.cardDesc}>Informações básicas da fila.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>
                  Nome <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${
                    touched.nome && nameInvalid ? styles.invalid : ""
                  }`}
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
                  placeholder="Ex.: Suporte, Comercial, Financeiro…"
                />
                {touched.nome && nameInvalid && (
                  <span className={styles.errMsg}>Informe o nome da fila.</span>
                )}
              </div>

              <div className={styles.groupWide}>
                <label className={styles.label}>Descrição (opcional)</label>
                <input
                  className={styles.input}
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                  placeholder="Breve descrição"
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Cor (opcional)</label>
                <div className={styles.colorRow}>
                  <input
                    id="color"
                    className={`${styles.input} ${styles.colorField || ""}`}
                    placeholder="#RRGGBB (ex.: #4682B4)"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                  />

                  <span
                    className={styles.colorChip}
                    title={colorPreview || "Aleatória ao salvar"}
                  >
                    <span
                      className={styles.colorSwatch}
                      style={{ background: colorPreview || "#ffffff" }}
                      aria-hidden="true"
                    />
                    <Palette size={16} aria-hidden="true" />
                    <span className={styles.hex}>
                      {colorPreview || "aleatória"}
                    </span>
                  </span>

                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleSortearCor}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Sortear
                  </button>

                  {!!form.color && (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={handleLimparCor}
                    >
                      <X size={16} aria-hidden="true" />
                      Limpar
                    </button>
                  )}
                </div>

                {touched.color && colorInvalid && (
                  <span className={styles.errMsg}>
                    Cor inválida. Use o formato #RRGGBB.
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ===== Etiquetas ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Tags</h2>
              <p className={styles.cardDesc}>
                Digite as tags e pressione <strong>Enter</strong>. Separe várias
                por vírgula ou ponto-e-vírgula. As alterações (criações e
                remoções) serão aplicadas ao salvar a fila.
              </p>
            </div>

            <div className={styles.cardBody}>
              <ChipsInput value={tags} onChange={setTags} />
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Dica: Use <kbd>Backspace</kbd> para remover o último chip quando
                o campo estiver vazio.
              </p>
            </div>
          </section>

          {/* ===== Regra de roteamento ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>
                Regra de roteamento para esta fila
              </h2>
              <p className={styles.cardDesc}>
                Defina uma condição para que tickets entrem automaticamente
                nesta fila. (Somente uma condição. Operadores:{" "}
                <strong>igual</strong> ou <strong>contém</strong>.)
              </p>
            </div>

            <div className={styles.cardBody}>
              <label
                className={styles.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={ruleEnabled}
                  onChange={(e) => setRuleEnabled(e.target.checked)}
                  style={{ transform: "scale(1.1)" }}
                />
                Habilitar regra de roteamento
              </label>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "180px 1fr 1fr auto",
                  alignItems: "center",
                }}
              >
                {/* Operador */}
                <div>
                  <label
                    className={styles.label}
                    style={{ marginBottom: 6, display: "block" }}
                  >
                    Operador
                  </label>
                  <NiceSelect
                    value={rule.op}
                    onChange={(v) => setRule((r) => ({ ...r, op: v }))}
                    options={[
                      { value: "equals", label: "igual" },
                      { value: "contains", label: "contém" },
                    ]}
                    disabled={!ruleEnabled}
                  />
                </div>

                {/* Variável */}
                <div>
                  <label
                    className={styles.label}
                    style={{ marginBottom: 6, display: "block" }}
                  >
                    Variável
                  </label>
                  <input
                    className={styles.input}
                    value={rule.field}
                    onChange={(e) =>
                      setRule((r) => ({ ...r, field: e.target.value }))
                    }
                    placeholder="Ex.: contact.document"
                    disabled={!ruleEnabled}
                  />
                </div>

                {/* Valor */}
                <div>
                  <label
                    className={styles.label}
                    style={{ marginBottom: 6, display: "block" }}
                  >
                    Valor
                  </label>
                  <input
                    className={styles.input}
                    value={rule.value}
                    onChange={(e) =>
                      setRule((r) => ({ ...r, value: e.target.value }))
                    }
                    placeholder="Ex.: Particular"
                    disabled={!ruleEnabled}
                  />
                </div>

                {/* Ação */}
                <div>
                  <label
                    className={styles.label}
                    style={{
                      marginBottom: 6,
                      display: "block",
                      visibility: "hidden",
                    }}
                  >
                    .
                  </label>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setRule({ field: "", op: "equals", value: "" });
                    }}
                    disabled={!ruleEnabled}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <p className={styles.hint} style={{ marginTop: 8 }}>
                Exemplos de variável: <code>contact.document</code>,{" "}
                <code>contact.email</code>, <code>tag</code>.
              </p>
            </div>
          </section>

          {/* Rodapé */}
          <div className={styles.stickyFooter} role="region" aria-label="Ações">
            <div className={styles.stickyInner}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => navigate(baseQueuesPath)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={!canSubmit}
              >
                <Save size={16} />{" "}
                {saving
                  ? "Salvando…"
                  : isEdit
                  ? "Salvar alterações"
                  : "Criar fila"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
