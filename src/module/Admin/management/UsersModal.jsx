import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { X, Save, UserPlus, UserCircle2 } from 'lucide-react';
import { apiPost, apiPut } from '../../../shared/apiClient';
import m from './styles/UsersModal.module.css';

function normalizeQueues(queues) {
  return (Array.isArray(queues) ? queues : []).map((q) => {
    if (typeof q === 'string') return { id: q, nome: q };
    const id = q?.id ?? q?.nome ?? q?.name;
    const nome = q?.nome ?? q?.name ?? String(id || '');
    return { id: String(id), nome: String(nome) };
  }).filter(q => q.id && q.nome);
}

/**
 * UsersModal
 * Regras solicitadas:
 * - Supervisor NÃO pode criar usuários com perfil "admin".
 * - Supervisor NÃO pode editar um usuário para "admin".
 *   (Caso esteja editando um admin, o botão Salvar fica desabilitado enquanto o valor for "admin").
 *
 * Passe a prop `canCreateAdmin={isAdmin}` a partir da página pai (UsersPage).
 */
export default function UsersModal({
  isOpen,
  onClose,
  onSaved,
  editing,
  queues,
  canCreateAdmin = false, // <-- importante: por padrão NÃO permite criar admin
}) {
  const qs = useMemo(() => normalizeQueues(queues), [queues]);

  const [form, setForm] = useState({
    name: '', lastname: '', email: '', perfil: 'atendente', filas: [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const isEditing = Boolean(editing);
  const originalPerfil = String(editing?.perfil || '').toLowerCase();
  const isEditingAdmin = isEditing && originalPerfil === 'admin';

  // Perfis permitidos no seletor
  const allowedProfiles = useMemo(() => {
    // Admin pode tudo; supervisor NÃO tem opção de "admin"
    return canCreateAdmin ? ['admin', 'supervisor', 'atendente'] : ['supervisor', 'atendente'];
  }, [canCreateAdmin]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setForm({
        name: editing.name ?? '',
        lastname: editing.lastname ?? '',
        email: editing.email ?? '',
        perfil: (editing.perfil || 'atendente').toLowerCase(),
        filas: Array.isArray(editing.filas) ? editing.filas.map(String) : [],
      });
    } else {
      setForm({ name: '', lastname: '', email: '', perfil: 'atendente', filas: [] });
    }
    setErr(null);
  }, [isOpen, editing]);

  const onEsc = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onEsc]);

  if (!isOpen) return null;

  const perfilLower = String(form.perfil || '').toLowerCase();
  const isTryingToSaveAsAdmin = perfilLower === 'admin' && !canCreateAdmin;

  async function handleSave(e) {
    e?.preventDefault?.();
    setErr(null);

    if (!form.email.trim()) { setErr('Informe o e-mail.'); return; }
    if (!form.name.trim()) { setErr('Informe o nome.'); return; }

    // BLOQUEIO: se não pode criar/definir admin e o perfil selecionado é admin, impede salvar
    if (isTryingToSaveAsAdmin) {
      setErr('Seu perfil não permite definir o perfil "Admin". Selecione outro perfil.');
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
      if (editing?.id) {
        await apiPut(`/users/${editing.id}`, payload);
      } else {
        await apiPost('/users', payload);
      }
      onSaved?.();
    } catch (e2) {
      console.error(e2);
      setErr('Não foi possível salvar. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function toggleFila(id) {
    setForm((p) => {
      const has = p.filas.includes(id);
      return { ...p, filas: has ? p.filas.filter(x => x !== id) : [...p.filas, id] };
    });
  }

  return (
    <div className={m.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={m.modal} role="dialog" aria-modal="true" aria-labelledby="users-modal-title">
        <div className={m.header}>
          <h3 id="users-modal-title" className={m.title}>
            {editing ? <UserCircle2 size={18}/> : <UserPlus size={18}/>}
            {editing ? 'Editar usuário' : 'Novo usuário'}
          </h3>
          <button className={m.iconBtn} onClick={onClose} aria-label="Fechar"><X size={16}/></button>
        </div>

        <form className={m.body} onSubmit={handleSave}>
          {err && <div className={m.alert}>{err}</div>}
          {isTryingToSaveAsAdmin && (
            <div className={m.alert}>
              Seu perfil não permite definir "Admin". Selecione outro perfil para continuar.
            </div>
          )}

          <div className={m.grid}>
            <div className={m.group}>
              <label className={m.label}>Nome</label>
              <input
                className={m.input}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className={m.group}>
              <label className={m.label}>Sobrenome</label>
              <input
                className={m.input}
                value={form.lastname}
                onChange={e => setForm({ ...form, lastname: e.target.value })}
              />
            </div>
          </div>

          <div className={m.group}>
            <label className={m.label}>E-mail</label>
            <input
              className={m.input}
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className={m.grid}>
            <div className={m.group}>
              <label className={m.label}>Perfil</label>
              <select
                className={m.select}
                value={form.perfil}
                onChange={e => setForm({ ...form, perfil: e.target.value })}
              >
                {/* Se o usuário logado não pode criar admin:
                    - não mostramos a opção "admin" para novos usuários
                    - se estiver editando um usuário que JÁ é admin, exibimos opção "Admin (restrito)" desabilitada */}
                {canCreateAdmin && <option value="admin">Admin</option>}
                {!canCreateAdmin && isEditingAdmin && (
                  <option value="admin" disabled>Admin (restrito)</option>
                )}
                <option value="supervisor">Supervisor</option>
                <option value="atendente">Atendente</option>
              </select>
              {!canCreateAdmin && (
                <small className={m.hint}>
                  Supervisores não podem definir perfil "Admin".
                </small>
              )}
            </div>

            <div className={m.group}>
              <label className={m.label}>Filas vinculadas</label>
              <div className={m.chipsBox}>
                <div className={m.chips}>
                  {form.filas.length === 0
                    ? <span className={m.muted}>Nenhuma fila selecionada</span>
                    : form.filas.map(fid => {
                        const q = qs.find(x => String(x.id) === String(fid));
                        return (
                          <span key={fid} className={m.chip}>
                            {q?.nome ?? fid}
                            <button
                              type="button"
                              className={m.chipX}
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
                  className={m.selectInline}
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

          <div className={m.footer}>
            <button type="button" className={m.btn} onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className={m.btnPrimary}
              disabled={saving || isTryingToSaveAsAdmin}
              title={isTryingToSaveAsAdmin ? 'Selecione outro perfil para habilitar o salvamento' : undefined}
            >
              <Save size={16}/> {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
