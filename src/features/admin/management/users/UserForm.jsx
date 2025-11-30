// File: UserForm.jsx
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
import styles from "./styles/UserForm.module.css";

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

export default function UserForm() {
  const { userId } = useParams();
  const isEdit = Boolean(userId);
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateAdmin = Boolean(location.state?.canCreateAdmin);

  // flowId vindo do FlowHub (state/meta)
  const flowId =
    location.state?.flowId || location.state?.meta?.flowId || null;

  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [originalPerfil, setOriginalPerfil] = useState("");

  const [form, setForm] = useState({
    name: "",
    lastname: "",
    email: "",
    perfil: "atendente",
    filas: [],
  });

  const [touched, setTouched] = useState({});
  const topRef = useRef(null);

  const qsQueues = useMemo(() => normalizeQueues(queues), [queues]);
  const perfilLower = String(form.perfil || "").toLowerCase();
  const isEditingAdmin = isEdit && originalPerfil === "admin";
  const isTryingToSaveAsAdmin = perfilLower === "admin" && !canCreateAdmin;
  const isNew = !isEdit;

  const emailInvalid =
    !form.email.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const nameInvalid = !form.name.trim();

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";
      const [filasResp, userResp] = await Promise.all([
        apiGet(`/queues${qs}`),
        isEdit
          ? apiGet(`/users/id/${encodeURIComponent(userId)}${qs}`)
          : Promise.resolve(null),
      ]);
      setQueues(Array.isArray(filasResp) ? filasResp : []);
      if (isEdit) {
        const u = userResp?.data ?? userResp ?? {};
        const perfil = (u.perfil || "atendente").toLowerCase();
        setOriginalPerfil(perfil);
        setForm({
          name: u.name ?? "",
          lastname: u.lastname ?? "",
          email: u.email ?? "",
          perfil,
          filas: Array.isArray(u.filas) ? u.filas.map(String) : [],
        });
      } else {
        setOriginalPerfil("");
        setForm({
          name: "",
          lastname: "",
          email: "",
          perfil: "atendente",
          filas: [],
        });
      }
    } catch (e) {
      setErr("Falha ao carregar dados.");
      toast.error("Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [isEdit, userId, flowId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFila(id) {
    setForm((p) => {
      const has = p.filas.includes(id);
      return {
        ...p,
        filas: has ? p.filas.filter((x) => x !== id) : [...p.filas, id],
      };
    });
  }

  const canSubmit =
    !saving && !emailInvalid && !nameInvalid && !isTryingToSaveAsAdmin;

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
        perfil: (isNew ? "atendente" : perfilLower) || "atendente",
        filas: form.filas,
        ...(flowId ? { flow_id: flowId } : {}),
      };

      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : "";

      if (isEdit) {
        await apiPut(`/users/${encodeURIComponent(userId)}${qs}`, payload);
        toast.success("Usuário atualizado.");
      } else {
        await apiPost(`/users${qs}`, payload);
        toast.success("Usuário criado.");
      }

      navigate("/management/users", { state: { flowId } });
    } catch (e) {
      const msg =
        "Não foi possível salvar. Verifique os dados e tente novamente.";
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const handleCancel = () => {
    navigate("/management/users", { state: { flowId } });
  };

  return (
    <div className={styles.page} ref={topRef}>
      <div className={styles.container}>
        {/* HEADER NO PADRÃO DAS OUTRAS TELAS */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              onClick={handleCancel}
              type="button"
              className={styles.backBtn}
              title="Voltar"
            >
              <ArrowLeft size={16} />
            </button>

            <div className={styles.titleBlock}>
              <h1 className={styles.title}>
                {isEdit ? "Editar usuário" : "Novo atendente"}
              </h1>
              <p className={styles.subtitle}>
                {isEdit
                  ? "Atualize os dados e filas vinculadas."
                  : "Preencha os dados básicos e vincule às filas correspondentes."}
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={handleSave}
              disabled={!canSubmit}
            >
              <Save size={16} />
              <span>{saving ? "Salvando…" : "Salvar"}</span>
            </button>
          </div>
        </header>

        {/* Alertas */}
        {(err || isTryingToSaveAsAdmin) && (
          <div className={styles.alertsStack}>
            {err && (
              <div className={styles.alertErr}>
                <span>{err}</span>
              </div>
            )}
            {isTryingToSaveAsAdmin && (
              <div className={styles.alertErr}>
                <span>
                  Seu perfil não permite definir &quot;Admin&quot;. Selecione
                  outro perfil para continuar.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div className={styles.skeleton}>
            <div className={styles.skelCard} />
            <div className={styles.skelCard} />
          </div>
        ) : (
          <>
            {/* Identificação */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Identificação</div>
                <div className={styles.cardDesc}>
                  Informações básicas do atendente.
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Nome <span className={styles.req}>*</span>
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

                  <div className={styles.formGroup}>
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

                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      E-mail <span className={styles.req}>*</span>
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
              </div>
            </section>

            {/* Acesso & Filas */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Acesso &amp; filas</div>
                <div className={styles.cardDesc}>
                  Defina o perfil e vincule às filas de atendimento.
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.formGrid}>
                  {/* Perfil */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Perfil</label>

                    {isNew ? (
                      <>
                        <div className={styles.fixedPerfilChip}>Atendente</div>
                        <small className={styles.hint}>
                          Criação restrita ao perfil{" "}
                          <strong>Atendente</strong>.
                        </small>
                      </>
                    ) : (
                      <>
                        <select
                          className={styles.select}
                          value={form.perfil}
                          onChange={(e) =>
                            setForm({ ...form, perfil: e.target.value })
                          }
                        >
                          {canCreateAdmin && <option value="admin">Admin</option>}
                          {!canCreateAdmin && isEditingAdmin && (
                            <option value="admin" disabled>
                              Admin (restrito)
                            </option>
                          )}
                          <option value="supervisor">Supervisor</option>
                          <option value="atendente">Atendente</option>
                        </select>
                        {!canCreateAdmin && (
                          <small className={styles.hint}>
                            Seu perfil não permite definir novos admins.
                          </small>
                        )}
                      </>
                    )}
                  </div>

                  {/* Select para adicionar fila */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Adicionar fila</label>
                    <select
                      className={styles.select}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) toggleFila(v);
                        e.target.value = "";
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Selecionar…
                      </option>
                      {qsQueues
                        .filter((q) => !form.filas.includes(String(q.id)))
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.nome}
                          </option>
                        ))}
                    </select>
                    <small className={styles.hint}>
                      Selecione filas para vincular ao atendente.
                    </small>
                  </div>

                  {/* Chips de filas vinculadas */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Filas vinculadas</label>
                    <div className={styles.chipsBox}>
                      {form.filas.length === 0 ? (
                        <span className={styles.muted}>
                          Nenhuma fila selecionada
                        </span>
                      ) : (
                        <div className={styles.chips}>
                          {form.filas.map((fid) => {
                            const q = qsQueues.find(
                              (x) => String(x.id) === String(fid)
                            );
                            return (
                              <span key={fid} className={styles.chip}>
                                {q?.nome ?? fid}
                                <button
                                  type="button"
                                  className={styles.chipX}
                                  onClick={() => toggleFila(String(fid))}
                                  aria-label={`Remover fila ${q?.nome ?? fid}`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
