import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';
import { apiPost, apiPut } from '../../../shared/apiClient';
import styles from './styles/Users.module.css';

const PERFIS = [
  { value: 'admin',      label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'atendente',  label: 'Atendente' },
];

const sid   = (v) => String(v ?? '').trim();
const sname = (v) => String(v ?? '').toLowerCase().trim();

/** ---- MultiSelectChips -------------------------------------------------- **/
function MultiSelectChips({ allItems, value, onChange, placeholder = 'Adicionar fila…' }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  // itens restantes = todos - já selecionados (por id/nome)
  const options = useMemo(() => {
    const usedIds   = new Set(value.map(f => sid(f.id)));
    const usedNames = new Set(value.map(f => sname(f.nome)));
    const base = (allItems || [])
      .map(q => ({ id: q.id, nome: q.nome ?? q.name ?? String(q.id) }))
      .filter(q => !usedIds.has(sid(q.id)) && !usedNames.has(sname(q.nome)));
    const q = sname(query);
    return q ? base.filter(o => sname(o.nome).includes(q)) : base;
  }, [allItems, value, query]);

  // clique fora fecha
  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const add = (opt) => {
    onChange([...value, opt]);
    setQuery('');
    setOpen(true); // mantém aberto para multi seleção rápida
  };
  const remove = (id) => onChange(value.filter(f => sid(f.id) !== sid(id)));

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setActiveIdx((p) => Math.min(p + 1, Math.max(options.length - 1, 0)));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActiveIdx((p) => Math.max(p - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (options[activeIdx]) add(options[activeIdx]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.preventDefault();
    } else if (e.key === 'Backspace' && !query && value.length) {
      // backspace remove último chip
      remove(value[value.length - 1].id);
      e.preventDefault();
    }
  };

  return (
    <div className={styles.chipsControl} ref={wrapRef} onClick={() => setOpen(true)}>
      {/* chips */}
      {value.map((f) => (
        <span key={sid(f.id)} className={styles.chip}>
          {f.nome}
          <button
            type="button"
            className={styles.chipX}
            onClick={(e) => { e.stopPropagation(); remove(f.id); }}
            aria-label={`Remover ${f.nome}`}
          >
            ×
          </button>
        </span>
      ))}

      {/* “input” de chips */}
      <input
        className={styles.chipInput}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
        onKeyDown={onKeyDown}
        placeholder={value.length ? '' : placeholder}
        onFocus={() => setOpen(true)}
      />

      {/* dropdown flutuante */}
      {open && options.length > 0 && (
        <div className={styles.options} role="listbox">
          {options.map((opt, i) => (
            <button
              key={sid(opt.id)}
              type="button"
              className={`${styles.option} ${i === activeIdx ? styles.optionActive : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => add(opt)}
              role="option"
            >
              {opt.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** ---- UsersModal -------------------------------------------------------- **/
export default function UsersModal({ isOpen, onClose, onSaved, editing, queues }) {
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState('atendente');
  const [filasSel, setFilasSel] = useState([]); // [{id,nome}]
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editing) {
      setName(editing.name || '');
      setLastname(editing.lastname || '');
      setEmail(editing.email || '');
      setPerfil(editing.perfil || 'atendente');

      const arr = Array.isArray(editing.filas) ? editing.filas : [];
      const mapped = arr.map(v => {
        const byId   = (queues || []).find(x => sid(x.id) === sid(v));
        const byName = (queues || []).find(x => sname(x.nome ?? x.name) === sname(v));
        const q = byId || byName;
        return { id: q?.id ?? v, nome: q?.nome ?? q?.name ?? String(v) };
      });
      setFilasSel(mapped);
    } else {
      setName(''); setLastname(''); setEmail(''); setPerfil('atendente'); setFilasSel([]);
    }
    setErr(null);
  }, [isOpen, editing, queues]);

  const canSave = name.trim() && lastname.trim() && email.trim() && perfil;
  const showFilas = perfil === 'atendente';

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
        filas: showFilas ? filasSel.map(f => f.nome) : [],
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
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{editing ? 'Editar usuário' : 'Novo usuário'}</h3>
          <button className={`${styles.btn} ${styles.iconOnly}`} onClick={onClose} aria-label="Fechar">
            <XIcon size={16}/>
          </button>
        </div>

        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              {err && <div className={styles.alertErr}>{err}</div>}

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-nome">Nome *</label>
                <input id="u-nome" className={styles.input} value={name} onChange={e=>setName(e.target.value)} autoFocus/>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-last">Sobrenome *</label>
                <input id="u-last" className={styles.input} value={lastname} onChange={e=>setLastname(e.target.value)}/>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-email">Email *</label>
                <input id="u-email" className={styles.input} value={email} onChange={e=>setEmail(e.target.value)}/>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="u-perfil">Perfil *</label>
                <select id="u-perfil" className={styles.select} value={perfil} onChange={e=>setPerfil(e.target.value)}>
                  {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {showFilas && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Filas</label>
                  <MultiSelectChips
                    allItems={queues}
                    value={filasSel}
                    onChange={setFilasSel}
                    placeholder="Adicionar fila…"
                  />
                  <div className={styles.inputHelper}>
                    Digite para filtrar; Enter/Click adiciona. Cada seleção vira uma etiqueta. “×” remove.
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
