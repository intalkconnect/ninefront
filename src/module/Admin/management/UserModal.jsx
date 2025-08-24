import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';

const PERFIS = [
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'atendente', label: 'Atendente' },
];

export default function UserModal({ isOpen, user, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState('atendente');
  const [filas, setFilas] = useState([]);           // selected
  const [allFilas, setAllFilas] = useState([]);     // options

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const canSave = useMemo(() =>
    name.trim() && lastname.trim() && email.trim() && perfil.trim(), [name, lastname, email, perfil]
  );

  useEffect(() => {
    if (!isOpen) return;
    // carregar filas disponíveis
    (async () => {
      try {
        const data = await apiGet('/filas');
        setAllFilas(Array.isArray(data) ? data.map(f => f.nome ?? f.name).filter(Boolean) : []);
      } catch { /* ignore */ }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setName(user.name || '');
      setLastname(user.lastname || '');
      setEmail(user.email || '');
      setPerfil(user.perfil || 'atendente');
      setFilas(Array.isArray(user.filas) ? user.filas : []);
    } else {
      setName(''); setLastname(''); setEmail(''); setPerfil('atendente'); setFilas([]);
    }
    setErr(null);
  }, [isOpen, user]);

  const toggleFila = (nome) => {
    setFilas(prev => prev.includes(nome) ? prev.filter(x => x !== nome) : [...prev, nome]);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true); setErr(null);
    try {
      const payload = { name: name.trim(), lastname: lastname.trim(), email: email.trim(), filas, perfil };
      if (user?.id) {
        await apiPut(`/users/${user.id}`, payload);
      } else {
        await apiPost('/users', payload);
      }
      onSaved?.();
    } catch (error) {
      console.error(error);
      setErr(error?.message || 'Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{user ? 'Editar usuário' : 'Novo usuário'}</h3>
          <button type="button" className={`${styles.btn} ${styles.iconOnly}`} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <form onSubmit={submit}>
            <div className={styles.formGrid}>

              {err && <div className={styles.alertErr}>{err}</div>}

              <div className={styles.grid2}>
                <div className={styles.inputGroup}>
                  <label className={styles.label} htmlFor="u-name">Nome *</label>
                  <input id="u-name" className={styles.input} value={name} onChange={e => setName(e.target.value)} autoFocus />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label} htmlFor="u-lastname">Sobrenome *</label>
                  <input id="u-lastname" className={styles.input} value={lastname} onChange={e => setLastname(e.target.value)} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-email">Email *</label>
                <input id="u-email" className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-perfil">Perfil *</label>
                <select id="u-perfil" className={styles.select} value={perfil} onChange={e => setPerfil(e.target.value)}>
                  {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Filas (opcional)</label>
                <div className={styles.filasList}>
                  {allFilas.length === 0 && <div className={styles.inputHelper}>Nenhuma fila encontrada.</div>}
                  {allFilas.map(nome => (
                    <label key={nome} className={styles.checkItem}>
                      <input
                        type="checkbox"
                        checked={filas.includes(nome)}
                        onChange={() => toggleFila(nome)}
                      />
                      <span>{nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={!canSave || saving}>
                <SaveIcon size={16} /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
