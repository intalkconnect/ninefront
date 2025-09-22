import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Save, UserPlus, UserCircle2 } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/UserForm.module.css';

function normalizeQueues(queues) {
  return (Array.isArray(queues) ? queues : []).map((q) => {
    if (typeof q === 'string') return { id: q, nome: q };
    const id = q?.id ?? q?.nome ?? q?.name;
    const nome = q?.nome ?? q?.name ?? String(id || '');
    return { id: String(id), nome: String(nome) };
  }).filter(q => q.id && q.nome);
}

export default function UserForm() {
  const { userId } = useParams();
  const isEdit = Boolean(userId);
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateAdmin = Boolean(location.state?.canCreateAdmin);

  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [originalPerfil, setOriginalPerfil] = useState('');

  const [form, setForm] = useState({
    name: '', lastname: '', email: '', perfil: 'atendente', filas: [],
  });

  const [touched, setTouched] = useState({});
  const topRef = useRef(null);

  const qs = useMemo(() => normalizeQueues(queues), [queues]);
  const perfilLower = String(form.perfil || '').toLowerCase();
  const isEditingAdmin = isEdit && originalPerfil === 'admin';
  const isTryingToSaveAsAdmin = perfilLower === 'admin' && !canCreateAdmin;

  const emailInvalid = !form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const nameInvalid = !form.name.trim();

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [filasResp, userResp] = await Promise.all([
        apiGet('/queues'),
        isEdit ? apiGet(`/users/${encodeURIComponent(userId)}`) : Promise.resolve(null),
      ]);
      setQueues(Array.isArray(filasResp) ? filasResp : []);
      if (isEdit) {
        const u = userResp?.data ?? userResp ?? {};
        setOriginalPerfil(String(u.perfil || '').toLowerCase());
        setForm({
          name: u.name ?? '',
          lastname: u.lastname ?? '',
          email: u.email ?? '',
          perfil: (u.perfil || 'atendente').toLowerCase(),
          filas: Array.isArray(u.filas) ? u.filas.map(String) : [],
        });
      } else {
        setOriginalPerfil('');
        setForm({ name: '', lastname: '', email: '', perfil: 'atendente', filas: [] });
      }
    } catch {
      setErr('Falha ao carregar dados.');
      toast.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isEdit, userId]);

  useEffect(() => { load(); }, [load]);

  function toggleFila(id) {
    setForm((p) => {
      const has = p.filas.includes(id);
      return { ...p, filas: has ? p.filas.filter(x => x !== id) : [...p.filas, id] };
    });
  }

  const canSubmit = !saving && !emailInvalid && !nameInvalid && !isTryingToSaveAsAdmin;

  async function handleSave(e) {
    e?.preventDefault?.();
    setErr(null);
    setTouched({ name: true, email: true });

    if (!canSubmit) {
      toast.warn('Confira os campos obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim(),
        perfil: perfilLower || 'atendente',
        filas: form.filas,
      };
      if (isEdit) {
        await apiPut(`/users/${encodeURIComponent(userId)}`, payload);
        toast.success('Usuário atualizado.');
      } else {
        await apiPost('/users', payload);
        toast.success('Usuário criado.');
      }
      navigate('/management/users');
    } catch {
      const msg = 'Não foi possível salvar. Verifique os dados e tente novamente.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/" className={styles.bcLink}>Dashboard</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><Link to="/management/users" className={styles.bcLink}>Usuários</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>{isEdit ? `Editar ${userId}` : 'Novo usuário'}</span></li>
        </ol>
      </nav>

      {/* Título */}
      <div className={styles.pageTitleBlock}>
        <h1 className={styles.pageTitle}>
          {isEdit ? <><UserCircle2 size={20}/> Editar usuário</> : <><UserPlus size={20}/> Novo usuário</>}
        </h1>
        <p className={styles.pageSubtitle}>
          Preencha os dados do usuário e defina o perfil de acesso e as filas vinculadas.
        </p>
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
          {isTryingToSaveAsAdmin && (
            <div className={styles.alert}>
              Seu perfil não permite definir "Admin". Selecione outro perfil para continuar.
            </div>
          )}

          {/* Identificação (3 colunas; nada full-width) */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Identificação</h2>
              <p className={styles.cardDesc}>Informações básicas do usuário.</p>
            </div>
            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>
                  Nome <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${touched.name && nameInvalid ? styles.invalid : ''}`}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  onBlur={() => setTouched(t => ({ ...t, name: true }))}
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
                  onChange={e => setForm({ ...form, lastname: e.target.value })}
                  placeholder="Ex.: Silva"
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>
                  E-mail <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${touched.email && emailInvalid ? styles.invalid : ''}`}
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  onBlur={() => setTouched(t => ({ ...t, email: true }))}
                  placeholder="exemplo@dominio.com"
                />
                {touched.email && emailInvalid && (
                  <span className={styles.errMsg}>Informe um e-mail válido.</span>
                )}
                <small className={styles.hint}>O e-mail é usado para login e notificações.</small>
              </div>
            </div>
          </section>

          {/* Acesso & Filas (3 colunas; nada full-width) */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Acesso & Filas</h2>
              <p className={styles.cardDesc}>Defina o perfil de acesso e as filas atendidas.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>Perfil</label>
                <select
                  className={styles.select}
                  value={form.perfil}
                  onChange={e => setForm({ ...form, perfil: e.target.value })}
                >
                  {canCreateAdmin && <option value="admin">Admin</option>}
                  {!canCreateAdmin && isEditingAdmin && (
                    <option value="admin" disabled>Admin (restrito)</option>
                  )}
                  <option value="supervisor">Supervisor</option>
                  <option value="atendente">Atendente</option>
                </select>
                {!canCreateAdmin && (
                  <small className={styles.hint}>Supervisores não podem definir o perfil “Admin”.</small>
                )}
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Adicionar fila</label>
                <select
                  className={styles.select}
                  onChange={(e) => { const v = e.target.value; if (v) toggleFila(v); e.target.value=''; }}
                  defaultValue=""
                >
                  <option value="" disabled>Selecionar…</option>
                  {qs.filter(q => !form.filas.includes(String(q.id))).map(q => (
                    <option key={q.id} value={q.id}>{q.nome}</option>
                  ))}
                </select>
                <small className={styles.hint}>Selecione uma fila para adicionar. Você pode adicionar várias.</small>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Filas vinculadas</label>
                <div className={styles.chipsBox}>
                  <div className={styles.chips}>
                    {form.filas.length === 0
                      ? <span className={styles.muted}>Nenhuma fila selecionada</span>
                      : form.filas.map(fid => {
                          const q = qs.find(x => String(x.id) === String(fid));
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
                        })
                    }
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
                onClick={() => navigate('/management/users')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={!canSubmit}
              >
                <Save size={16}/> {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
