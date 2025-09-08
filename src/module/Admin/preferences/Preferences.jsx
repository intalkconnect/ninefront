import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Preferences.module.css';

/** Mapeia chaves -> rótulos amigáveis, ajuda e modo de edição */
const FRIENDLY = {
  permitir_transferencia_fila: {
    label: 'Permitir transferência entre filas',
    help: 'Habilita mover um ticket para outra fila. Útil para realocar demandas entre times.',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  permitir_transferencia_atendente: {
    label: 'Permitir transferência entre atendentes',
    help: 'Autoriza passar o ticket para outro atendente dentro da mesma fila.',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  enable_signature: {
    label: 'Assinatura em mensagens',
    help: 'Inclui automaticamente a assinatura padrão em respostas enviadas pelo atendente.',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  distribuicao_tickets: {
    label: 'Distribuição de tickets',
    help: 'Define como novos tickets são atribuídos: manualmente ou automática preditiva.',
    type: 'enum',
    options: [
      { value: 'manual',    label: 'Manual' },
      { value: 'preditiva', label: 'Automática' },
    ],
  },

  /* ▼ Novas opções com UI visual */
  habilitar_alertas_atendimento: {
    label: 'Habilitar alertas de atendimento',
    help: 'Ativa cores/avisos no monitor conforme limites de tempo. Depende dos “overrides por prioridade”.',
    type: 'boolean',
    onText: 'Ativado',
    offText: 'Desativado',
  },
  overrides_por_prioridade_json: {
    label: 'Overrides por prioridade',
    help: 'Defina (em minutos) os limites por prioridade para gerar alertas no monitor.',
    type: 'overrides_form', // << sem JSON na UI
  },
};

/** Rótulo amigável para o valor atual */
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

/* -------- Overrides helpers -------- */
const DEFAULT_OVERRIDES = {
  alta:  { espera_inicial: 5,  demora_durante: 10 },
  media: { espera_inicial: 15, demora_durante: 20 },
};

const parseOverrides = (raw) => {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    const out = {
      alta: {
        espera_inicial: Number(obj?.alta?.espera_inicial ?? DEFAULT_OVERRIDES.alta.espera_inicial),
        demora_durante: Number(obj?.alta?.demora_durante ?? DEFAULT_OVERRIDES.alta.demora_durante),
      },
      media: {
        espera_inicial: Number(obj?.media?.espera_inicial ?? DEFAULT_OVERRIDES.media.espera_inicial),
        demora_durante: Number(obj?.media?.demora_durante ?? DEFAULT_OVERRIDES.media.demora_durante),
      },
    };
    return out;
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
};

const invalidNum = (n) => !Number.isFinite(n) || n < 0;

/* -------- Componente -------- */
const Preferences = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // Edição inline
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');        // genérico
  const [ovForm, setOvForm] = useState(DEFAULT_OVERRIDES); // formulário visual de overrides
  const [ovErrs, setOvErrs] = useState({});             // erros por campo

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

    if (FRIENDLY[key]?.type === 'overrides_form') {
      setOvForm(parseOverrides(raw));
      setOvErrs({});
    } else {
      const v = row?.value;
      setEditValue(v !== null && typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? ''));
    }
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
    setOvErrs({});
  };

  const validateOv = (draft) => {
    const e = {};
    (['alta','media']).forEach(level => {
      const p = draft[level] || {};
      if (invalidNum(Number(p.espera_inicial))) e[`${level}.espera_inicial`] = 'Informe minutos válidos (≥ 0)';
      if (invalidNum(Number(p.demora_durante))) e[`${level}.demora_durante`] = 'Informe minutos válidos (≥ 0)';
    });
    return e;
    };

  const submitEdit = async () => {
    if (!editingKey) return;
    const row = byKey.get(editingKey);

    if (FRIENDLY[editingKey]?.type === 'overrides_form') {
      const errs = validateOv(ovForm);
      setOvErrs(errs);
      if (Object.keys(errs).length) { setErro('Revise os campos destacados.'); return; }
      await saveSetting(editingKey, {
        alta:  { espera_inicial: Number(ovForm.alta.espera_inicial),  demora_durante: Number(ovForm.alta.demora_durante) },
        media: { espera_inicial: Number(ovForm.media.espera_inicial), demora_durante: Number(ovForm.media.demora_durante) },
      }, row?.description ?? null);
      cancelEdit();
      return;
    }

    // genérico (não-json overrides)
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

  /* ---------- UI helpers ---------- */
  const renderOverridesView = (key, raw) => {
    const v = parseOverrides(raw);
    return (
      <div>
        <div className={styles.pillRow}>
          <span className={`${styles.pill} ${styles.pillAmber}`}>Alta • espera inicial {v.alta.espera_inicial}m</span>
          <span className={`${styles.pill} ${styles.pillAmber}`}>Alta • durante {v.alta.demora_durante}m</span>
          <span className={`${styles.pill} ${styles.pillBlue}`}>Média • espera inicial {v.media.espera_inicial}m</span>
          <span className={`${styles.pill} ${styles.pillBlue}`}>Média • durante {v.media.demora_durante}m</span>
        </div>
        <div className={styles.rowNote}>Clique em Editar para ajustar os limites (minutos).</div>
        <div className={styles.cellActions}>
          <button className={styles.btnTiny} onClick={() => startEdit(key)}>Editar</button>
        </div>
      </div>
    );
  };

  const renderOverridesForm = () => (
    <>
      <div className={styles.ovGrid}>
        {/* Alta */}
        <div className={`${styles.ovCard} ${styles.ovAmber}`}>
          <div className={styles.ovTitle}>Prioridade Alta</div>
          <div className={styles.ovRow}>
            <label>Espera inicial (min)</label>
            <input
              type="number" min="0" step="1"
              className={`${styles.input} ${ovErrs['alta.espera_inicial'] ? styles.inputErr : ''}`}
              value={ovForm.alta.espera_inicial}
              onChange={(e)=> setOvForm(f=>({ ...f, alta:{ ...f.alta, espera_inicial: e.target.value } }))}
            />
            {ovErrs['alta.espera_inicial'] && <div className={styles.fieldErr}>{ovErrs['alta.espera_inicial']}</div>}
          </div>
          <div className={styles.ovRow}>
            <label>Demora durante (min)</label>
            <input
              type="number" min="0" step="1"
              className={`${styles.input} ${ovErrs['alta.demora_durante'] ? styles.inputErr : ''}`}
              value={ovForm.alta.demora_durante}
              onChange={(e)=> setOvForm(f=>({ ...f, alta:{ ...f.alta, demora_durante: e.target.value } }))}
            />
            {ovErrs['alta.demora_durante'] && <div className={styles.fieldErr}>{ovErrs['alta.demora_durante']}</div>}
          </div>
        </div>

        {/* Média */}
        <div className={`${styles.ovCard} ${styles.ovBlue}`}>
          <div className={styles.ovTitle}>Prioridade Média</div>
          <div className={styles.ovRow}>
            <label>Espera inicial (min)</label>
            <input
              type="number" min="0" step="1"
              className={`${styles.input} ${ovErrs['media.espera_inicial'] ? styles.inputErr : ''}`}
              value={ovForm.media.espera_inicial}
              onChange={(e)=> setOvForm(f=>({ ...f, media:{ ...f.media, espera_inicial: e.target.value } }))}
            />
            {ovErrs['media.espera_inicial'] && <div className={styles.fieldErr}>{ovErrs['media.espera_inicial']}</div>}
          </div>
          <div className={styles.ovRow}>
            <label>Demora durante (min)</label>
            <input
              type="number" min="0" step="1"
              className={`${styles.input} ${ovErrs['media.demora_durante'] ? styles.inputErr : ''}`}
              value={ovForm.media.demora_durante}
              onChange={(e)=> setOvForm(f=>({ ...f, media:{ ...f.media, demora_durante: e.target.value } }))}
            />
            {ovErrs['media.demora_durante'] && <div className={styles.fieldErr}>{ovErrs['media.demora_durante']}</div>}
          </div>
        </div>
      </div>

      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={cancelEdit}>Cancelar</button>
        <button className={styles.btnPrimary} onClick={submitEdit}>Salvar</button>
      </div>
    </>
  );

  /* ---------- render ---------- */
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>
            As mudanças são salvas automaticamente e afetam todo o workspace.
          </p>
          {erro ? <div className={styles.alertErr}>{erro}</div> : null}
          {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Preferências do sistema</div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 360 }}>Opção</th>
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
                      ) : spec?.type === 'overrides_form' ? (
                        <>
                          {!isEditing ? renderOverridesView(key, raw) : renderOverridesForm()}
                        </>
                      ) : (
                        <>
                          {!isEditing ? (
                            <>
                              <pre className={styles.code} title={String(raw ?? '')}>
{String(raw ?? '')}
                              </pre>
                              <div className={styles.cellActions}>
                                <button className={styles.btnTiny} onClick={() => startEdit(key)}>Editar</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <textarea
                                className={styles.textarea}
                                rows={4}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                              />
                              <div className={styles.formActions}>
                                <button className={styles.btnGhost} onClick={cancelEdit}>Cancelar</button>
                                <button className={styles.btnPrimary} onClick={submitEdit}>Salvar</button>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </td>

                    <td className={styles.cellDesc}>
                      {spec?.help ? <div className={styles.helpMain}>{spec.help}</div> : null}
                      {row.description
                        ? <div className={styles.helpNote}>{row.description}</div>
                        : (!spec?.help ? '—' : null)
                      }
                    </td>
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
