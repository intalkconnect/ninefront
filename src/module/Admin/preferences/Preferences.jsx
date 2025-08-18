import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Preferences.module.css';

/** Mapeia chaves -> rótulos amigáveis e como editar/renderizar */
const FRIENDLY = {
  permitir_transferencia_fila: {
    label: 'Permitir transferência entre filas',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  permitir_transferencia_atendente: {
    label: 'Permitir transferência entre atendentes',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  enable_signature: {
    label: 'Assinatura em mensagens',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  distribuicao_tickets: {
    label: 'Distribuição de tickets',
    type: 'enum',
    options: [
      { value: 'manual',    label: 'Manual' },
      { value: 'preditiva', label: 'Automática' },
    ],
  },
};

/** Rotula valores de forma amigável */
const valueLabelFor = (key, value) => {
  const spec = FRIENDLY[key];
  if (spec?.type === 'boolean') return !!value ? (spec.onText || 'Ativado') : (spec.offText || 'Desativado');
  if (spec?.type === 'enum') {
    const opt = spec.options?.find(o => String(o.value) === String(value));
    return opt?.label ?? String(value ?? '—');
  }
  if (typeof value === 'boolean') return value ? 'Ativado' : 'Desativado';
  return String(value ?? '—');
};

/** Normaliza strings para boolean/number/objeto quando possível */
const coerceType = (v) => {
  if (v === null || v === undefined) return v;
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'object') return v;
  const s = String(v).trim();
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  try { const j = JSON.parse(s); if (typeof j === 'object') return j; } catch {}
  return s;
};

const Preferences = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // Edição inline para valores "livres"
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await apiGet('/settings');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErro('Falha ao carregar preferências.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const byKey = useMemo(() => {
    const m = new Map();
    for (const r of items) m.set(r.key ?? r['key'], r);
    return m;
  }, [items]);

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1800); };

  const saveSetting = async (key, value, description = null) => {
    setErro(null);
    try {
      const saved = await apiPost('/settings', { key, value, description });
      setItems(prev =>
        prev.map(r => (r.key === key || r['key'] === key)
          ? { ...r, value: saved?.value ?? value, description: saved?.description ?? r.description, updated_at: saved?.updated_at ?? r.updated_at }
          : r
        )
      );
      toastOK(`Preferência “${FRIENDLY[key]?.label || key}” salva.`);
    } catch (e) {
      console.error(e);
      setErro('Erro ao salvar. Tente novamente.');
      await load();
    }
  };

  const toggleBoolean = async (key) => {
    const row = byKey.get(key);
    const current = !!coerceType(row?.value);
    await saveSetting(key, !current, row?.description ?? null);
  };

  const changeEnum = async (key, newValue) => {
    const row = byKey.get(key);
    await saveSetting(key, newValue, row?.description ?? null);
  };

  const startEdit = (key) => {
    setEditingKey(key);
    const row = byKey.get(key);
    const raw = row?.value;
    setEditValue(raw !== null && typeof raw === 'object' ? JSON.stringify(raw, null, 2) : String(raw ?? ''));
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(''); };

  const submitEdit = async () => {
    if (!editingKey) return;
    const row = byKey.get(editingKey);
    let val = editValue;
    const orig = row?.value;
    if (typeof orig === 'boolean') val = /^true$/i.test(String(editValue).trim());
    else if (typeof orig === 'number') val = Number(editValue);
    else if (orig !== null && typeof orig === 'object') { try { val = JSON.parse(editValue); } catch { setErro('JSON inválido.'); return; } }
    else { val = coerceType(editValue); }
    await saveSetting(editingKey, val, row?.description ?? null);
    cancelEdit();
  };

  // conhecidas primeiro
  const ordered = useMemo(() => {
    const known = Object.keys(FRIENDLY);
    const score = (k) => { const i = known.indexOf(k); return i === -1 ? 999 : i; };
    return [...items].sort((a, b) => {
      const ka = a.key ?? a['key']; const kb = b.key ?? b['key'];
      const sa = score(ka); const sb = score(kb);
      if (sa !== sb) return sa - sb;
      return String(ka).localeCompare(String(kb));
    });
  }, [items]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Preferências</h1>
          <p className={styles.subtitle}>Altere rapidamente as preferências do sistema.</p>
          {erro ? <div className={styles.alertErr}>{erro}</div> : null}
          {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
        </div>
        <div className={styles.headerRight}>
          <button className={styles.btnGhost} onClick={load} title="Recarregar">
            <RefreshCcw size={16} /> Recarregar
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Preferências do sistema</div>
          <div className={styles.cardHint}>
            {loading ? 'Carregando…' : `${ordered.length} registro(s)`}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 320 }}>Opção</th>
                <th>Valor</th>
                <th style={{ minWidth: 220 }}>Descrição</th>
                <th style={{ minWidth: 160 }}>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const key = row.key ?? row['key'];
                const spec = FRIENDLY[key];
                const raw = row.value;
                const nice = valueLabelFor(key, raw);
                const isEditing = editingKey === key;

                return (
                  <tr key={key}>
                    <td className={styles.cellKey}>
                      <div className={styles.keyTitle}>{spec?.label ?? key}</div>
                      <div className={styles.keySub}>({key})</div>
                    </td>

                    <td>
                      {(spec?.type === 'boolean' || typeof raw === 'boolean') ? (
                        <button
                          className={`${styles.switch} ${!!coerceType(raw) ? styles.switchOn : ''}`}
                          onClick={() => toggleBoolean(key)}
                          aria-pressed={!!coerceType(raw)}
                          aria-label={`${spec?.label ?? key}: ${nice}`}
                          title={nice}
                        >
                          <span className={styles.knob} />
                          <span className={styles.switchText}>{nice}</span>
                        </button>
                      ) : spec?.type === 'enum' ? (
                        <select
                          className={styles.select}
                          value={String(raw ?? '')}
                          onChange={(e) => changeEnum(key, e.target.value)}
                          aria-label={spec?.label ?? key}
                        >
                          {spec.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          {!isEditing ? (
                            <pre className={styles.code} title={String(raw ?? '')}>
{String(raw ?? '')}
                            </pre>
                          ) : (
                            <textarea
                              className={styles.textarea}
                              rows={4}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                            />
                          )}
                        </>
                      )}
                    </td>

                    <td className={styles.cellDesc}>{row.description ?? '—'}</td>
                    <td>{row.updated_at ? new Date(row.updated_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                );
              })}

              {!loading && ordered.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nenhuma preferência encontrada.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={4} className={styles.loading}>Carregando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
