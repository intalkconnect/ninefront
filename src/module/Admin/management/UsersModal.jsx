import React, { useEffect, useMemo, useState } from 'react';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';
import { apiPost, apiPut } from '../../shared/apiClient';
import styles from './styles/Users.module.css';

const PERFIS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'atendente', label: 'Atendente' },
];

export default function UsersModal({ isOpen, onClose, onSaved, editing, queues }) {
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState('atendente');
  const [filasSel, setFilasSel] = useState([]); // [{id,nome}]
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // opções do dropdown = filas ainda não selecionadas
  const options = useMemo(() => {
    const used = new Set(filasSel.map(f => String(f.id)));
    return (queues || [])
      .filter(f => !used.has(String(f.id)))
      .map(f => ({ id: f.id, nome: f.nome ?? f.name ?? String(f.id) }));
  }, [queues, filasSel]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name || '');
      setLastname(editing.lastname || '');
      setEmail(editing.email || '');
      setPerfil(editing.perfil || 'atendente');
      const arr = Array.isArray(editing.filas) ? editing.filas : [];
      const mapped = arr.map(id => {
        const q = (queues || []).find(x => String(x.id) === String(id));
        return { id, nome: q?.nome ?? q?.name ?? String(id) };
      });
      setFilasSel(mapped);
    } else {
      setName(''); setLastname(''); setEmail(''); setPerfil('atendente'); setFilasSel([]);
    }
    setErr(null);
  }, [isOpen, editing, queues]);

  const canSave = name.trim() && lastname.trim() && email.trim() && perfil;

  const addFila = (idStr) => {
    if (!idStr) return;
    const q = (queues || []).find(f => String(f.id) === String(idStr));
    if (!q) return;
    setFilasSel(prev => [...prev, { id: q.id, nome: q.nome ?? q.name ?? String(q.id) }]);
  };
  const removeFila = (id) => setFilasSel(prev => prev.filter(f => String(f.id) !== String(id)));

  async function submit(e) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: name.trim(),
        lastname: lastname.trim(),
        email: email.trim(),
        perfil,
        filas: perfil === 'admin' ? [] : filasSel.map(f => f.id),
      };
      if (editing) {
        await apiPut(`/users/${editing.id}`, payload);
      } else {
        await apiPost('/users', payload);
      }
      onSaved?.();
    } catch (er) {
      console.error(er);
      setErr('Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{editing ? 'Editar usuário' : 'Novo usuário'}</h3>
          <button className={`${styles.btn} ${styles.iconOnly}`} onClick={onClose} aria-label="Fechar"><XIcon size={16}/></button>
        </div>

        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              {err && <div className={styles.alertErr}>{err}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-nome">Nome *</label>
                <input id="u-nome" className={styles.input} value={name} onChange={e=>setName(e.target.value)} autoFocus />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-last">Sobrenome *</label>
                <input id="u-last" className={styles.input} value={lastname} onChange={e=>setLastname(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-email">Email *</label>
                <input id="u-email" className={styles.input} value={email} onChange={e=>setEmail(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-perfil">Perfil *</label>
                <select id="u-perfil" className={styles.select} value={perfil} onChange={e=>setPerfil(e.target.value)}>
                  {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {perfil !== 'admin' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Filas</label>

                  <div className={styles.chipsWrap}>
                    {filasSel.map(f => (
                      <span key={f.id} className={styles.chip}>
                        {f.nome}
                        <button type="button" className={styles.chipX} onClick={()=>removeFila(f.id)} aria-label={`Remover ${f.nome}`}>×</button>
                      </span>
                    ))}

                    <select
                      className={styles.selectInline}
                      value=""
                      onChange={(e)=>addFila(e.target.value)}
                    >
                      <option value="" disabled>Adicionar fila…</option>
                      {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>

                  <div className={styles.inputHelper}>
                    Selecione no menu; cada seleção vira uma etiqueta. Clique no “×” para remover.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={!canSave || saving}>
              <SaveIcon size={16}/> {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
