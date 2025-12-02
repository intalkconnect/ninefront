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
import styles from "../../styles/AdminUI.module.css";

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
  const isNew = !isEdit;

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
        // criação sempre como atendente; edição mantém/perfilLower
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

  const title = isEdit ? "Editar usuário" : "Novo atendente";
  const subtitle = isEdit
    ? "Atualize os dados e filas vinculadas."
    : "Preencha os dados básicos e vincule às filas correspondentes.";

  return (
    <div className={styles.page} ref={topRef}>
      <div className={styles.container}>
        {/* HEADER padrão AdminUI com botão voltar */}
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <button
              onClick={handleCancel}
              type="button"
              className={styles.backBtn}
              title="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <div className={styles.headerActions}>
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
              <Save size={16} />
              <span>{saving ? "Salvando…" : "Salvar"}</span>
            </button>
          </div>
        </header>

        {/* Alertas inline padrão adminui */}
        {err && (
          <div className={styles.alertErr}>
            <span>{err}</span>
          </div>
        )}
        {isTryingToSaveAsAdmin && (
          <div className={styles.alertErr}>
            <span>
              Seu perfil não permite definir &quot;Admin&quot;. Selecione outro
              perfil para continuar.
            </span>
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <section className={styles.card}>
            <div className={styles.cardBody}>
              <div className={`${styles.skeleton} ${styles.sq48}`} />
            </div>
          </section>
        ) : (
          <>
            {/* Card: Identificação */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Identificação</div>
                  <p className={styles.cardDesc}>
                    Informações básicas do atendente.
                  </p>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardBodyGrid}>
                  {/* Nome */}
                  <div className={styles.group}>
                    <label className={styles.label}>
                      Nome <span className={styles.bold}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="Ex.: Ana"
                    />
                    {touched.name && nameInvalid && (
                      <div className={styles.helperInline}>
                        Informe o nome.
                      </div>
                    )}
                  </div>

                  {/* Sobrenome */}
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

                  {/* Email */}
                  <div className={styles.group}>
                    <label className={styles.label}>
                      E-mail <span className={styles.bold}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="exemplo@dominio.com"
                    />
                    {touched.email && emailInvalid && (
                      <div className={styles.helperInline}>
                        Informe um e-mail válido.
                      </div>
                    )}
                    <div className={styles.helper}>
                      O e-mail é usado para login e notificações.
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Card: Acesso & filas */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Acesso &amp; filas</div>
                  <p className={styles.cardDesc}>
                    Defina o perfil e vincule às filas de atendimento.
                  </p>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardBodyGrid}>
                  {/* Perfil */}
                  <div className={styles.group}>
                    <label className={styles.label}>Perfil</label>

                    {isNew ? (
                      <>
                        <div className={styles.readonly}>Atendente</div>
                        <div className={styles.helper}>
                          Criação restrita ao perfil <strong>Atendente</strong>.
                        </div>
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
                          <div className={styles.helper}>
                            Seu perfil não permite definir novos admins.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Select para adicionar fila */}
                  <div className={styles.group}>
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
                    <div className={styles.helper}>
                      Selecione filas para vincular ao atendente.
                    </div>
                  </div>

                  {/* Chips de filas vinculadas */}
                  <div className={styles.groupFull}>
                    <label className={styles.label}>Filas vinculadas</label>
                    {form.filas.length === 0 ? (
                      <span className={styles.muted}>
                        Nenhuma fila selecionada.
                      </span>
                    ) : (
                      <div className={styles.tagRow}>
                        {form.filas.map((fid) => {
                          const q = qsQueues.find(
                            (x) => String(x.id) === String(fid)
                          );
                          const label = q?.nome ?? fid;
                          return (
                            <button
                              type="button"
                              key={fid}
                              className={styles.tagChip}
                              onClick={() => toggleFila(String(fid))}
                              title={`Remover fila ${label}`}
                            >
                              <span className={styles.tagLabel}>{label}</span>
                              <span className={styles.tagRemove}>×</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
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
