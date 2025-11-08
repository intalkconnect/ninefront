import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import { apiGet, apiPost, apiPut } from "../../../../shared/apiClient";
import { toast } from "react-toastify";
import styles from "./styles/AgentsForm.module.css";

function normalizeQueues(queues) {
  return (Array.isArray(queues) ? queues : [])
    .map((q) => {
      if (typeof q === "string") return { id: q, nome: q };
      const id = q?.id ?? q?.nome ?? q?.name;
      const nome = q?.nome ?? q?.name ?? String(id || "");
      return { id: String(id), nome: String(nome) };
    })
    .filter((q) => q.id && q.nome);
}

export default function AgentsForm() {
  const { flowId, userId } = useParams();
  const isEdit = Boolean(userId);
  const navigate = useNavigate();
  const location = useLocation();

  const flowIdFromState = location.state?.flowId || location.state?.meta?.flowId;
  const effectiveFlowId = flowId || flowIdFromState || null;
  const inFlowContext = Boolean(effectiveFlowId);

  const [queues, setQueues] = useState([]);
  const [flowName, setFlowName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({
    name: "",
    lastname: "",
    email: "",
    filas: [], // aqui SEMPRE nomes de filas
  });

  const [touched, setTouched] = useState({});
  const topRef = useRef(null);

  const qsQueues = useMemo(() => normalizeQueues(queues), [queues]);

  const emailInvalid =
    !form.email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const nameInvalid = !form.name.trim();

  const baseAgentsPath = inFlowContext
    ? `/development/flowhub/${encodeURIComponent(effectiveFlowId)}/agents`
    : "/management/users";

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = effectiveFlowId
        ? `?flow_id=${encodeURIComponent(effectiveFlowId)}`
        : "";

      const [filasResp, userResp, flowMeta] = await Promise.all([
        apiGet(`/queues${qs}`),
        isEdit
          ? apiGet(`/users/id/${encodeURIComponent(userId)}${qs}`)
          : Promise.resolve(null),
        effectiveFlowId
          ? apiGet(`/flows/${encodeURIComponent(effectiveFlowId)}`)
          : Promise.resolve(null),
      ]);

      setQueues(Array.isArray(filasResp) ? filasResp : []);
      if (flowMeta) {
        setFlowName(flowMeta?.name ?? flowMeta?.nome ?? "");
      }

      if (isEdit) {
        const u = userResp?.data ?? userResp ?? {};
        setForm({
          name: u.name ?? "",
          lastname: u.lastname ?? "",
          email: u.email ?? "",
          // backend agora retorna nomes nas filas
          filas: Array.isArray(u.filas) ? u.filas.map(String) : [],
        });
      } else {
        setForm({
          name: "",
          lastname: "",
          email: "",
          filas: [],
        });
      }
    } catch (e) {
      console.error(e);
      setErr("Falha ao carregar dados do atendente.");
      toast.error("Falha ao carregar dados do atendente.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  }, [isEdit, userId, effectiveFlowId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFila(value) {
    // value aqui é o NOME da fila
    setForm((p) => {
      const has = p.filas.includes(value);
      return {
        ...p,
        filas: has
          ? p.filas.filter((x) => x !== value)
          : [...p.filas, value],
      };
    });
  }

  const canSubmit = !saving && !emailInvalid && !nameInvalid;

  async function handleSave(e) {
    e?.preventDefault?.();
    setErr(null);
    setTouched({ name: true, email: true });

    if (!canSubmit) {
      toast.warn("Confira os campos obrigatórios.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim(),
        perfil: "atendente", // sempre atendente
        // filas já estão em NOME, mas o back aceita ids ou nomes
        filas: form.filas,
        ...(effectiveFlowId ? { flow_id: effectiveFlowId } : {}),
      };

      const qs = effectiveFlowId
        ? `?flow_id=${encodeURIComponent(effectiveFlowId)}`
        : "";

      if (isEdit) {
        await apiPut(`/users/${encodeURIComponent(userId)}${qs}`, payload);
        toast.success("Atendente atualizado.");
      } else {
        await apiPost(`/users${qs}`, payload);
        toast.success("Atendente criado.");
      }

      navigate(baseAgentsPath, { state: { flowId: effectiveFlowId } });
    } catch (e) {
      console.error(e);
      const msg =
        "Não foi possível salvar. Verifique os dados e tente novamente.";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const handleCancel = () => {
    navigate(baseAgentsPath, { state: { flowId: effectiveFlowId } });
  };

  return (
    <div className={styles.page} ref={topRef}>
      {/* HEADER NO PADRÃO DOS OUTROS (Voltar + meta do flow) */}
      <div className={styles.headerCard}>
        <button className={styles.btn} onClick={handleCancel}>
          <ArrowLeft size={14} />
          <span>Voltar</span>
        </button>

        <div className={styles.headerCenter}>
          <div className={styles.headerTitle}>
            {isEdit ? "Editar atendente" : "Novo atendente"}
          </div>
        </div>

        <div className={styles.headerRight} />
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className={styles.skeleton}>
          <div className={styles.skelCard} />
          <div className={styles.skelCard} />
        </div>
      ) : (
        <>
          {err && <div className={styles.alert}>{err}</div>}

          {/* Identificação */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Identificação</h2>
              <p className={styles.cardDesc}>
                Informações básicas do atendente.
              </p>
            </div>
            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>
                  Nome <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${
                    touched.name && nameInvalid ? styles.invalid : ""
                  }`}
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="Ex.: Ana"
                />
                {touched.name && nameInvalid && (
                  <span className={styles.errMsg}>Informe o nome.</span>
                )}
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Sobrenome</label>
                <input
                  className={styles.input}
                  value={form.lastname}
                  onChange={(e) =>
                    setForm({ ...form, lastname: e.target.value })
                  }
                  placeholder="Ex.: Silva"
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>
                  E-mail <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${
                    touched.email && emailInvalid ? styles.invalid : ""
                  }`}
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="exemplo@dominio.com"
                />
                {touched.email && emailInvalid && (
                  <span className={styles.errMsg}>
                    Informe um e-mail válido.
                  </span>
                )}
                <small className={styles.hint}>
                  O e-mail é usado para login e notificações.
                </small>
              </div>
            </div>
          </section>

          {/* Filas do atendente */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Filas do atendente</h2>
            </div>

            <div className={styles.cardBodyGrid2}>
              <div className={styles.group}>
                <label className={styles.label}>Adicionar fila</label>
                <select
                  className={styles.select}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const q = qsQueues.find(
                        (qq) => String(qq.id) === String(v)
                      );
                      const valueToAdd = q?.nome ?? v; // salvar sempre NOME
                      if (valueToAdd) toggleFila(valueToAdd);
                    }
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecionar…
                  </option>
                  {qsQueues
                    // esconde filas já vinculadas (comparando por NOME)
                    .filter((q) => !form.filas.includes(q.nome))
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.nome}
                      </option>
                    ))}
                </select>
                <small className={styles.hint}>
                  Selecione uma fila para adicionar. Você pode adicionar
                  várias.
                </small>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Filas vinculadas</label>
                <div className={styles.chipsBox}>
                  <div className={styles.chips}>
                    {form.filas.length === 0 ? (
                      <span className={styles.muted}>
                        Nenhuma fila selecionada
                      </span>
                    ) : (
                      form.filas.map((filaName) => {
                        const q = qsQueues.find(
                          (x) => String(x.nome) === String(filaName)
                        );
                        const label = q?.nome ?? filaName;
                        return (
                          <span key={filaName} className={styles.chip}>
                            {label}
                            <button
                              type="button"
                              className={styles.chipX}
                              onClick={() => toggleFila(String(filaName))}
                              aria-label={`Remover fila ${label}`}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Rodapé fixo */}
          <div className={styles.stickyFooter} role="region" aria-label="Ações">
            <div className={styles.stickyInner}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={handleCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={!canSubmit}
              >
                <Save size={16} /> {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
