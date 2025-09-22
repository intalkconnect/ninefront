// File: src/pages/admin/management/users/UserForm.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Save, ArrowLeft, UserPlus, UserCircle2 } from 'lucide-react';
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
  const canCreateAdmin = Boolean(location.state?.canCreateAdmin); // fallback false

  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [originalPerfil, setOriginalPerfil] = useState('');

  const [form, setForm] = useState({
    name: '', lastname: '', email: '', perfil: 'atendente', filas: [],
  });

  const qs = useMemo(() => normalizeQueues(queues), [queues]);
  const perfilLower = String(form.perfil || '').toLowerCase();
  const isEditingAdmin = isEdit && originalPerfil === 'admin';
  const isTryingToSaveAsAdmin = perfilLower === 'admin' && !canCreateAdmin;

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
    } catch (e) {
      setErr('Falha ao carregar dados.');
      toast.error('Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [isEdit, userId]);
  useEffect(() => { load(); }, [load]);

  function toggleFila(id) {
    setForm((p) => {
      const has = p.filas.includes(id);
      return { ...p, filas: has ? p.filas.filter(x => x !== id) : [...p.filas, id] };
    });
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    setErr(null);

    if (!form.email.trim()) { setErr('Informe o e-mail.'); return; }
    if (!form.name.trim()) { setErr('Informe o nome.'); return; }
    if (isTryingToSaveAsAdmin) {
      const msg = 'Seu perfil não permite definir o perfil "Admin". Selecione outro perfil.';
      setErr(msg);
      toast.warn(msg);
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
    } catch (e2) {
      const msg = 'Não foi possível salvar. Verifique os dados e tente novamente.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <div className={styles.crumbBar}>
        <Link to="/admin" className={styles.crumb}>Admin</Link>
        <span className={styles.bcSep}>/</span>
        <Link to="/management/users" className={styles.crumb}>Usuários</Link>
        <span className={styles.bcSep}>/</span>
        <span className={styles.crumb}>{isEdit ? `Editar ${userId}` : 'Novo'}</span>
      </div>

      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={16}/> Voltar
        </button>
        <h2 className={styles.title}>
          {isEdit ? <><UserCircle2 size={18}/> Editar usuário</> : <><UserPlus size={18}/> Novo usuário</>}
        </h2>
      </div>

      <form className={styles.form} onSubmit={handleSave}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : (
          <>
            {err && <div className={styles.alert}>{err}</div>}
            {isTryingToSaveAsAdmin && (
              <div className={styles.alert}>
                Seu perfil não permite definir "Admin". Selecione outro perfil para continuar.
              </div>
            )}

            <div className={styles.grid}>
              <div className={styles.group}>
                <label className={styles.label}>Nome</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className={styles.group}>
                <label className={styles.label}>Sobrenome</label>
                <input
                  className={styles.input}
                  value={form.lastname}
                  onChange={e => setForm({ ...form, lastname: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>E-mail</label>
              <input
                className={styles.input}
                type="email"
                value={form.email}
                aria-invalid={!form.email.trim() ? 'true' : 'false'}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className={styles.grid}>
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
                  <small className={styles.hint}>
                    Supervisores não podem definir perfil "Admin".
                  </small>
                )}
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
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                    }
                  </div>
                  <select
                    className={styles.selectInline}
                    onChange={(e) => { const v = e.target.value; if (v) toggleFila(v); e.target.value=''; }}
                    defaultValue=""
                  >
                    <option value="" disabled>Adicionar fila…</option>
                    {qs.filter(q => !form.filas.includes(String(q.id))).map(q => (
                      <option key={q.id} value={q.id}>{q.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.btn} onClick={() => navigate(-1)}>Cancelar</button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving || isTryingToSaveAsAdmin}
                title={isTryingToSaveAsAdmin ? 'Selecione outro perfil para habilitar o salvamento' : undefined}
              >
                <Save size={16}/> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
