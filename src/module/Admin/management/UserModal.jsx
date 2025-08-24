import React, { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';

const PERFIS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'atendente', label: 'Atendente' },
];

const UserModal = ({ isOpen, onClose, onSaved, editing }) => {
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState('atendente');
  const [filas, setFilas] = useState([]);
  const [allFilas, setAllFilas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadFilas();
      if (editing) {
        setName(editing.name || '');
        setLastname(editing.lastname || '');
        setEmail(editing.email || '');
        setPerfil(editing.perfil || 'atendente');
        setFilas(editing.filas || []);
      } else {
        setName('');
        setLastname('');
        setEmail('');
        setPerfil('atendente');
        setFilas([]);
      }
    }
  }, [isOpen, editing]);

  async function loadFilas() {
    try {
      const data = await apiGet('/filas');
      if (Array.isArray(data)) {
        setAllFilas(data.map(f => f.nome));
      }
    } catch (e) {
      console.error('Erro ao carregar filas:', e);
    }
  }

  function toggleFila(nome) {
    setFilas(prev =>
      prev.includes(nome) ? prev.filter(f => f !== nome) : [...prev, nome]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    try {
      const payload = { name, lastname, email, perfil, filas };
      if (editing) {
        await apiPut(`/users/${editing.id}`, payload);
      } else {
        await apiPost('/users', payload);
      }
      onSaved?.();
    } catch (e2) {
      console.error('Erro ao salvar usuário:', e2);
      setErr(e2?.message || 'Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        {/* Cabeçalho */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {editing ? 'Editar usuário' : 'Novo usuário'}
          </h3>
          <button type="button" className={styles.btn} onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className={styles.modalBody}>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              {err && <div className={styles.alertErr}>{err}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-name">Nome *</label>
                <input
                  id="u-name"
                  className={styles.input}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-lastname">Sobrenome *</label>
                <input
                  id="u-lastname"
                  className={styles.input}
                  value={lastname}
                  onChange={e => setLastname(e.target.value)}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-email">Email *</label>
                <input
                  id="u-email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Perfil */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-perfil">Perfil *</label>
                <select
                  id="u-perfil"
                  className={styles.select}
                  value={perfil}
                  onChange={e => setPerfil(e.target.value)}
                >
                  {PERFIS.map(p => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filas — só aparece se perfil !== admin */}
              {perfil !== 'admin' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Filas (opcional)</label>
                  <div className={styles.filasList}>
                    {allFilas.length === 0 && (
                      <div className={styles.inputHelper}>Nenhuma fila encontrada.</div>
                    )}
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
              )}
            </div>

            {/* Ações */}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                <SaveIcon size={16} />
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
