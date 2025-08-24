import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';

export default function UserModal({ isOpen, onClose, onSaved, editing }) {
  const isEdit = !!editing;

  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState('atendente');

  // filas
  const [allFilas, setAllFilas] = useState([]);        // lista completa de nomes
  const [selectedFilas, setSelectedFilas] = useState([]); // nomes escolhidos

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setErr(null);

    // carrega filas do backend
    apiGet('/filas')
      .then((data) => {
        const nomes = Array.isArray(data) ? data.map(f => f.nome ?? f.name).filter(Boolean) : [];
        setAllFilas(nomes);
      })
      .catch(() => setAllFilas([]));

    if (isEdit) {
      setName(editing?.name || '');
      setLastname(editing?.lastname || '');
      setEmail(editing?.email || '');
      setPerfil(editing?.perfil || 'atendente');
      setSelectedFilas(Array.isArray(editing?.filas) ? editing.filas.filter(Boolean) : []);
    } else {
      setName(''); setLastname(''); setEmail(''); setPerfil('atendente'); setSelectedFilas([]);
    }
  }, [isOpen, isEdit, editing]);

  const canSave = useMemo(() => {
    if (!name.trim() || !lastname.trim() || !email.trim()) return false;
    // quando não for admin, não precisa ter filas obrigatoriamente, mas mantém validação leve
    return true;
  }, [name, lastname, email]);

  // opções restantes do dropdown (exclui as já escolhidas)
  const remainingOptions = useMemo(() => {
    const set = new Set(selectedFilas);
    return allFilas.filter(n => !set.has(n));
  }, [allFilas, selectedFilas]);

  const addFila = (valor) => {
    if (!valor) return;
    setSelectedFilas((prev) => prev.includes(valor) ? prev : [...prev, valor]);
  };

  const removeFila = (valor) => {
    setSelectedFilas((prev) => prev.filter(n => n !== valor));
  };

  const submit = async (e) => {
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
        filas: perfil === 'admin' ? [] : selectedFilas,
      };

      if (isEdit) {
        await apiPut(`/users/${editing.id}`, payload);
      } else {
        await apiPost('/users', payload);
      }
      onSaved?.();
    } catch (error) {
      console.error(error);
      setErr('Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Usuário">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{isEdit ? 'Editar usuário' : 'Novo usuário'}</h3>
          <button type="button" className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <form onSubmit={submit}>
            <div className={styles.formGrid}>

              {err && <div className={styles.alertErr}>{err}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="us-nome">Nome *</label>
                <input id="us-nome" className={styles.input} value={name}
                  onChange={(e)=>setName(e.target.value)} autoFocus />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="us-last">Sobrenome *</label>
                <input id="us-last" className={styles.input} value={lastname}
                  onChange={(e)=>setLastname(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="us-email">Email *</label>
                <input id="us-email" className={styles.input} type="email" value={email}
                  onChange={(e)=>setEmail(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="us-perfil">Perfil *</label>
                <select id="us-perfil" className={styles.select} value={perfil}
                  onChange={(e)=>setPerfil(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="atendente">Atendente</option>
                </select>
              </div>

              {/* FILAS: oculto quando admin */}
              {perfil !== 'admin' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Filas</label>

                  <div className={styles.chipInputWrap}>
                    {/* chips selecionados */}
                    {selectedFilas.map((n) => (
                      <span key={n} className={styles.chip}>
                        {n}
                        <button type="button" className={styles.chipRemove} onClick={()=>removeFila(n)} aria-label={`Remover ${n}`}>
                          <XIcon size={12} />
                        </button>
                      </span>
                    ))}

                    {/* dropdown com o restante */}
                    {remainingOptions.length > 0 && (
                      <select
                        className={styles.chipSelect}
                        value=""
                        onChange={(e)=>{ addFila(e.target.value); }}
                      >
                        <option value="" disabled>Adicionar fila…</option>
                        {remainingOptions.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className={styles.inputHelper}>
                    Selecione uma fila no menu; ela vira uma etiqueta. Clique no “x” para remover.
                  </div>
                </div>
              )}

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
