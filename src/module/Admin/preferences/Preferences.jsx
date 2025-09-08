import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Preferences.module.css';

/* ---------- mapa amigável ---------- */
const FRIENDLY = {
  permitir_transferencia_fila: {
    label: 'Permitir transferência entre filas',
    help: 'Habilita mover um ticket para outra fila. Útil para realocar demandas entre times.',
    type: 'boolean', onText: 'Ativado', offText: 'Desativado',
  },
  permitir_transferencia_atendente: {
    label: 'Permitir transferência entre atendentes',
    help: 'Autoriza passar o ticket para outro atendente dentro da mesma fila.',
    type: 'boolean', onText: 'Ativado', offText: 'Desativado',
  },
  enable_signature: {
    label: 'Assinatura em mensagens',
    help: 'Inclui automaticamente a assinatura padrão em respostas enviadas pelo atendente.',
    type: 'boolean', onText: 'Ativado', offText: 'Desativado',
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
  habilitar_alertas_atendimento: {
    label: 'Habilitar alertas de atendimento',
    help: 'Ativa cores/avisos no monitor com base nos limites por prioridade.',
    type: 'boolean', onText: 'Ativado', offText: 'Desativado',
  },
  overrides_por_prioridade_json: {
    label: 'Alertas por prioridade',
    help: 'Defina, em minutos, os limites por prioridade para “aguardando” e “durante o atendimento”.',
    type: 'overrides_form',
  },
};

/* ---------- helpers ---------- */
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
const coerceType = (v) => {
  if (v === null || v === undefined) return v;
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'object') return v;
  const s = String(v).trim();
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  try { const j = JSON.parse(s); if (typeof j === 'object') return j; } catch {}
  return s;
};

/* ---------- modelo dos overrides ---------- */
const DEFAULT_OVERRIDES = {
  alta:  { espera_inicial: 5,  demora_durante: 10 },
  media: { espera_inicial: 15, demora_durante: 20 },
};
const parseOverrides = (raw) => {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    return {
      alta:  {
        espera_inicial: Number(obj?.alta?.espera_inicial ?? DEFAULT_OVERRIDES.alta.espera_inicial),
        demora_durante: Number(obj?.alta?.demora_durante ?? DEFAULT_OVERRIDES.alta.demora_durante),
      },
      media: {
        espera_inicial: Number(obj?.media?.espera_inicial ?? DEFAULT_OVERRIDES.media.espera_inicial),
        demora_durante: Number(obj?.media?.demora_durante ?? DEFAULT_OVERRIDES.media.demora_durante),
      },
    };
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
};
const isBad = (n) => !Number.isFinite(n) || n < 0;

/* ---------- componente ---------- */
export default function Preferences() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [editingKey, setEditingKey] = useState(null); // inclusive overrides
  const [editValue, setEditValue] = useState('');

  // estado do editor visual de overrides
  const [ovDraft, setOvDraft] = useState(DEFAULT_OVERRIDES);
  const [ovErr, setOvErr] = useState({});

  const load = async () => {
    setLoading(true); setErro(null);
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

  const alertsEnabled = !!coerceType(byKey.get('habilitar_alertas_atendimento')?.value);

  // se desabilitar "habilitar_alertas_atendimento" enquanto edita overrides, fecha edição
  useEffect(() => {
    if (!alertsEnabled && editingKey === 'overrides_por_prioridade_json') {
      setEditingKey(null);
      setOvErr({});
    }
  }, [alertsEnabled, editingKey]);

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
      setOvDraft(parseOverrides(raw));
      setOvErr({});
      return;
    }
    const v = row?.value;
    setEditValue(v !== null && typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? ''));
  };

  const cancelEdit = () => { setEditingKey(null); setEditValue(''); setOvErr({}); };

  const submitGeneric = async () => {
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

  /* ----- valida/salva overrides ----- */
  const validateOv = (d) => {
    const e = {};
    if (isBad(Number(d.alta.espera_inicial)))  e['alta.espera_inicial']  = 'Informe um número ≥ 0';
    if (isBad(Number(d.alta.demora_durante)))  e['alta.demora_durante']  = 'Informe um número ≥ 0';
    if (isBad(Number(d.media.espera_inicial))) e['media.espera_inicial'] = 'Informe um número ≥ 0';
    if (isBad(Number(d.media.demora_durante))) e['media.demora_durante'] = 'Informe um número ≥ 0';
    return e;
  };

  const saveOv = async () => {
    const errs = validateOv(ovDraft);
    setOvErr(errs);
    if (Object.keys(errs).length) { setErro('Revise os campos destacados.'); return; }
    await saveSetting('overrides_por_prioridade_json', {
      alta:  { espera_inicial: Number(ovDraft.alta.espera_inicial),  demora_durante: Number(ovDraft.alta.demora_durante) },
      media: { espera_inicial: Number(ovDraft.media.espera_inicial), demora_durante: Number(ovDraft.media.demora_durante) },
    }, byKey.get('overrides_por_prioridade_json')?.description ?? null);
    setEditingKey(null);
  };

  /* ----- UI: leitura e edição inline do bloco ----- */
  const NumInput = ({ value, onChange, error }) => (
    <div className={styles.numWrap}>
      <input
        type="number"
        min="0"
        step="1"
        className={`${styles.input} ${styles.inputXs} ${error ? styles.inputErr : ''}`}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
      />
      <span className={styles.numSuffix}>min</span>
      {error && <div className={styles.fieldErr}>{error}</div>}
    </div>
  );

  const OverridesRead = ({ raw }) => {
    const v = parseOverrides(raw);
    return (
      <div className={`${styles.miniCard} ${!alertsEnabled ? styles.isDisabled : ''}`}>
        <table className={styles.miniTable} aria-label="Limites por prioridade">
          <thead>
            <tr>
              <th className={styles.tCenter}>Prioridade</th>
              <th>Aguardando</th>
              <th>Durante o atendimento (silêncio)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`${styles.tCenter} ${styles.bold}`}>Alta</td>
              <td>{v.alta.espera_inicial} min</td>
              <td>{v.alta.demora_durante} min</td>
            </tr>
            <tr>
              <td className={`${styles.tCenter} ${styles.bold}`}>Média</td>
              <td>{v.media.espera_inicial} min</td>
              <td>{v.media.demora_durante} min</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.miniActions}>
          <button
            className={styles.btnTiny}
            onClick={() => alertsEnabled && startEdit('overrides_por_prioridade_json')}
            disabled={!alertsEnabled}
            title={!alertsEnabled ? 'Ative os alertas para editar' : 'Editar limites'}
          >
            Editar
          </button>
          {!alertsEnabled && <span className={styles.mutedNote}>Ative os alertas para editar.</span>}
        </div>
      </div>
    );
  };

  const OverridesEdit = () => (
    <div className={styles.ovBlock}>
      <div className={styles.ovGrid}>
        <div className={`${styles.ovHead} ${styles.tCenter}`}>Prioridade</div>
        <div className={styles.ovHead}>Aguardando</div>
        <div className={styles.ovHead}>Durante o atendimento</div>

        <div className={`${styles.ovCell} ${styles.tCenter} ${styles.bold}`}>Alta</div>
        <div className={styles.ovCell}>
          <NumInput
            value={ovDraft.alta.espera_inicial}
            onChange={(v)=>setOvDraft(d=>({ ...d, alta:{ ...d.alta, espera_inicial: v } }))}
            error={ovErr['alta.espera_inicial']}
          />
        </div>
        <div className={styles.ovCell}>
          <NumInput
            value={ovDraft.alta.demora_durante}
            onChange={(v)=>setOvDraft(d=>({ ...d, alta:{ ...d.alta, demora_durante: v } }))}
            error={ovErr['alta.demora_durante']}
          />
        </div>

        <div className={`${styles.ovCell} ${styles.tCenter} ${styles.bold}`}>Média</div>
        <div className={styles.ovCell}>
          <NumInput
            value={ovDraft.media.espera_inicial}
            onChange={(v)=>setOvDraft(d=>({ ...d, media:{ ...d.media, espera_inicial: v } }))}
            error={ovErr['media.espera_inicial']}
          />
        </div>
        <div className={styles.ovCell}>
          <NumInput
            value={ovDraft.media.demora_durante}
            onChange={(v)=>setOvDraft(d=>({ ...d, media:{ ...d.media, demora_durante: v } }))}
            error={ovErr['media.demora_durante']}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={cancelEdit}>Cancelar</button>
        <button className={styles.btnPrimary} onClick={saveOv}>Salvar</button>
      </div>
    </div>
  );

  /* ---------- ordenação ---------- */
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
                <th style={{ minWidth: 260 }}>Descrição</th>
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
    /* ---- switch boolean ---- */
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
    /* ---- select enum ---- */
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
    /* ---- bloco visual de overrides (read/edit inline) ---- */
    isEditing ? <OverridesEdit /> : <OverridesRead raw={raw} />
  ) : !isEditing ? (
    /* ---- valor “livre” em leitura ---- */
    <>
      <pre className={styles.code} title={String(raw ?? '')}>
        {String(raw ?? '')}
      </pre>
      <div className={styles.cellActions}>
        <button className={styles.btnTiny} onClick={() => startEdit(key)}>Editar</button>
      </div>
    </>
  ) : (
    /* ---- valor “livre” em edição ---- */
    <>
      <textarea
        className={styles.textarea}
        rows={4}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
      />
      <div className={styles.formActions}>
        <button className={styles.btnGhost} onClick={cancelEdit}>Cancelar</button>
        <button className={styles.btnPrimary} onClick={submitGeneric}>Salvar</button>
      </div>
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
}
