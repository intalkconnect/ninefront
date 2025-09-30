import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, Palette, RefreshCw, X } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/QueueForm.module.css';

/* =================== utils de cor =================== */
const normalizeHexColor = (input) => {
  if (!input) return null;
  let c = String(input).trim();
  if (!c) return null;
  if (!c.startsWith('#')) c = `#${c}`;
  if (/^#([0-9a-fA-F]{3})$/.test(c)) c = '#' + c.slice(1).split('').map(ch => ch + ch).join('');
  return /^#([0-9a-fA-F]{6})$/.test(c) ? c.toUpperCase() : null;
};
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
};
const randomPastelHex = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 16);
  const l = 78 + Math.floor(Math.random() * 8);
  return hslToHex(h, s, l);
};

/* =================== RuleBuilder (visual) =================== */
const RULE_TYPES = [
  'equals','not_equals','contains','starts_with','ends_with',
  'exists','not_exists','regex',
  'gt','gte','lt','lte',
  'in','not_in'
];

function toUiRows(conditions) {
  if (!Array.isArray(conditions)) return [{ type: 'equals', variable: '', value: '' }];
  return conditions.map(c => ({
    type: c?.type || 'equals',
    variable: c?.variable || '',
    // para in/not_in, value pode vir como array
    value: Array.isArray(c?.value) ? c.value.join(', ') : (c?.value ?? '')
  })).filter(r => r.type && (r.variable || ['exists','not_exists'].includes(r.type)));
}

function toConditions(rows) {
  const out = [];
  for (const r of rows) {
    const type = String(r.type || '').trim();
    const variable = String(r.variable || '').trim();
    let value = r.value;

    if (!type) continue;
    if (!['exists','not_exists'].includes(type) && !variable) continue;

    if (type === 'exists' || type === 'not_exists') {
      out.push({ type, variable });
      continue;
    }

    if (type === 'in' || type === 'not_in') {
      // transforma "a, b, c" em ["a","b","c"]
      const arr = String(value || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      out.push({ type, variable, value: arr });
    } else {
      out.push({ type, variable, value: String(value ?? '') });
    }
  }
  return out;
}

function RuleBuilder({ enabled, onToggleEnabled, rows, setRows }) {
  const addRow = () => setRows(prev => [...prev, { type: 'equals', variable: '', value: '' }]);
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));
  const updateRow = (idx, patch) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const insertExample = () => {
    setRows([
      { type: 'equals', variable: 'x', value: 'y' },
      { type: 'contains', variable: 'lastUserMessage', value: 'agendar' },
      { type: 'starts_with', variable: 'contact.phone', value: '55' },
      { type: 'in', variable: 'channel', value: 'whatsapp, instagram' }
    ]);
    onToggleEnabled(true);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Regra de distribuição</h2>
        <p className={styles.cardDesc}>
          Crie condições para direcionar tickets automaticamente para esta fila.
        </p>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.group} style={{ marginBottom: 12 }}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
            />
            &nbsp; Habilitar regra para esta fila
          </label>
          <p className={styles.hint}>
            Quando desabilitada, a regra permanece salva mas não é aplicada.
          </p>
        </div>

        <div className={styles.tableLike}>
          <div className={styles.ruleHeaderRow}>
            <div className={styles.ruleColType}>Tipo</div>
            <div className={styles.ruleColVar}>Variável</div>
            <div className={styles.ruleColVal}>Valor</div>
            <div className={styles.ruleColAct}></div>
          </div>

          {rows.map((r, idx) => {
            const valueDisabled = r.type === 'exists' || r.type === 'not_exists';
            return (
              <div className={styles.ruleRow} key={idx}>
                <div className={styles.ruleColType}>
                  <select
                    className={styles.input}
                    value={r.type}
                    onChange={(e) => updateRow(idx, { type: e.target.value })}
                  >
                    {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className={styles.ruleColVar}>
                  <input
                    className={styles.input}
                    placeholder="ex.: contact.phone"
                    value={r.variable}
                    onChange={(e) => updateRow(idx, { variable: e.target.value })}
                    disabled={false}
                  />
                </div>

                <div className={styles.ruleColVal}>
                  <input
                    className={styles.input}
                    placeholder={r.type === 'in' || r.type === 'not_in'
                      ? 'lista separada por vírgulas (ex.: a, b, c)'
                      : 'valor'}
                    value={r.value}
                    onChange={(e) => updateRow(idx, { value: e.target.value })}
                    disabled={valueDisabled}
                  />
                </div>

                <div className={styles.ruleColAct}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => removeRow(idx)}
                    aria-label="Remover condição"
                    title="Remover"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.actionsRow} style={{ marginTop: 8 }}>
          <button type="button" className={styles.btnSecondary} onClick={addRow}>
            + Adicionar condição
          </button>
          <button type="button" className={styles.btn} onClick={insertExample}>
            Inserir exemplo
          </button>
        </div>

        <p className={styles.hint} style={{ marginTop: 8 }}>
          Exemplos de variáveis úteis: <code>lastUserMessage</code>, <code>contact.phone</code>, <code>contact.document</code>, <code>channel</code>…
        </p>
      </div>
    </div>
  );
}

/* =================== ChipsInput (tags) =================== */
function ChipsInput({ value = [], onChange, placeholder = 'ex.: agendamento, reclamacao, urgencia', maxLen = 40 }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  const slug = (s) => String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLen);

  const tokenize = (raw) =>
    String(raw || '')
      .split(/[,;\n]+/)
      .map(slug)
      .filter(Boolean);

  const addTokens = useCallback((raw) => {
    const tokens = tokenize(raw);
    if (!tokens.length) return;
    const set = new Set(value);
    const fresh = tokens.filter(t => !set.has(t));
    if (!fresh.length) return;
    onChange([...value, ...fresh]);
  }, [value, onChange]);

  const removeChip = (t) => onChange(value.filter(x => x !== t));

  const handleKeyDown = (e) => {
    const isSep = e.key === 'Enter' || e.key === ',' || e.key === ';';
    if (isSep) {
      e.preventDefault();
      if (text.trim()) {
        addTokens(text);
        setText('');
      }
      return;
    }
    if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (/[,\n;]/.test(pasted)) {
      e.preventDefault();
      addTokens(pasted);
    }
  };

  return (
    <div className={styles.tagsField} onClick={() => ref.current?.focus()}>
      {value.map((t) => (
        <span key={t} className={styles.tagChip}>
          <span>{t}</span>
          <button
            type="button"
            className={styles.tagChipX}
            aria-label={`Remover ${t}`}
            onClick={() => removeChip(t)}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={ref}
        className={styles.tagsInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={value.length ? '' : placeholder}
      />
    </div>
  );
}

/* =================== Página =================== */
export default function QueueForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const topRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({ nome: '', descricao: '', color: '' });
  const [touched, setTouched] = useState({ nome: false, color: false });

  const [queueDisplay, setQueueDisplay] = useState(id || '');

  // tags
  const [initialTags, setInitialTags] = useState([]);
  const [tags, setTags] = useState([]);

  // ===== regra por fila (visual) =====
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleRows, setRuleRows] = useState([{ type: 'equals', variable: '', value: '' }]);

  // validação
  const colorPreview = useMemo(() => normalizeHexColor(form.color), [form.color]);
  const nameInvalid = !form.nome.trim();
  const colorInvalid = form.color ? !colorPreview : false;
  const canSubmit = !saving && !nameInvalid && !colorInvalid;

  const loadTags = useCallback(async (filaNome) => {
    if (!filaNome) { setInitialTags([]); setTags([]); return; }
    try {
      const r = await apiGet(`/tags/ticket/catalog?fila=${encodeURIComponent(filaNome)}&page_size=200`);
      const list = Array.isArray(r?.data) ? r.data : [];
      const arr = list.map(x => x.tag);
      setInitialTags(arr);
      setTags(arr);
    } catch {
      setInitialTags([]);
      setTags([]);
    }
  }, []);

  const loadQueueRule = useCallback(async (filaNome) => {
    if (!filaNome) {
      setRuleEnabled(true);
      setRuleRows([{ type:'equals', variable:'', value:'' }]);
      return;
    }
    try {
      const r = await apiGet(`/queue-rules/${encodeURIComponent(filaNome)}`);
      const data = r?.data || r;
      const row = data?.data ?? data;
      if (row && row.queue_name) {
        setRuleEnabled(!!row.enabled);
        setRuleRows(toUiRows(row.conditions || []));
      } else {
        setRuleEnabled(true);
        setRuleRows([{ type:'equals', variable:'', value:'' }]);
      }
    } catch {
      // sem regra: defaults
      setRuleEnabled(true);
      setRuleRows([{ type:'equals', variable:'', value:'' }]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      if (isEdit) {
        const data = await apiGet(`/queues/${encodeURIComponent(id)}`);
        const q = data?.data ?? data ?? {};
        const nomeFila = (q.queue_name ?? q.nome ?? q.name ?? '').trim();

        setForm({
          nome: q.nome ?? q.name ?? '',
          descricao: q.descricao ?? '',
          color: q.color ?? ''
        });
        setQueueDisplay(nomeFila || id);

        await Promise.all([
          loadTags(nomeFila || q.nome || q.name),
          loadQueueRule(nomeFila || q.nome || q.name)
        ]);
      } else {
        setForm({ nome: '', descricao: '', color: '' });
        setQueueDisplay('');
        setInitialTags([]);
        setTags([]);
        setRuleEnabled(true);
        setRuleRows([{ type:'equals', variable:'', value:'' }]);
      }
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar dados da fila.');
      toast.error('Falha ao carregar dados da fila.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isEdit, id, loadTags, loadQueueRule]);

  useEffect(() => { load(); }, [load]);

  const handleSortearCor = () => setForm(f => ({ ...f, color: randomPastelHex() }));
  const handleLimparCor = () => setForm(f => ({ ...f, color: '' }));

  async function persistTagsDiff(filaNome, before = [], current = []) {
    const prev = new Set(before);
    const now  = new Set(current);
    const toAdd    = [...now].filter(t => !prev.has(t));
    const toRemove = [...prev].filter(t => !now.has(t));
    const jobs = [];
    for (const tag of toAdd) jobs.push(apiPost('/tags/ticket/catalog', { fila: filaNome, tag, active: true }));
    for (const tag of toRemove) jobs.push(apiDelete(`/tags/ticket/catalog/${encodeURIComponent(filaNome)}/${encodeURIComponent(tag)}`));
    if (!jobs.length) return;
    const res = await Promise.allSettled(jobs);
    const ok = res.filter(r => r.status === 'fulfilled').length;
    const fail = res.length - ok;
    if (ok) toast.success(`${ok} alteração(ões) de etiqueta aplicada(s).`);
    if (fail) toast.error(`${fail} alteração(ões) falharam. Verifique dependências (tags em uso).`);
  }

  async function persistQueueRule(filaNome) {
    const name = String(filaNome || '').trim();
    if (!name) return;
    const conditions = toConditions(ruleRows);
    // valida mínimo: se habilitada, precisa ter ao menos 1 condição válida
    if (ruleEnabled && conditions.length === 0) {
      throw new Error('Adicione ao menos uma condição ou desabilite a regra.');
    }
    await apiPut(`/queue-rules/${encodeURIComponent(name)}`, {
      enabled: !!ruleEnabled,
      conditions
    });
  }

  async function handleSave() {
    setTouched({ nome: true, color: true });
    if (!canSubmit) {
      toast.warn('Confira os campos obrigatórios.');
      return;
    }
    try {
      setSaving(true);

      const payload = {
        nome: form.nome.trim(),
        ...(form.descricao.trim() ? { descricao: form.descricao.trim() } : {}),
        ...(colorPreview ? { color: colorPreview } : {}),
      };

      if (isEdit) {
        await apiPut(`/queues/${encodeURIComponent(id)}`, payload);
        toast.success('Fila atualizada.');
      } else {
        await apiPost('/queues', payload);
        toast.success('Fila criada.');
      }

      const filaNome = form.nome.trim();
      await persistTagsDiff(filaNome, initialTags, tags);

      await persistQueueRule(filaNome);
      toast.success('Regra da fila salva.');

      navigate('/management/queues');
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/" className={styles.bcLink}>Dashboard</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><Link to="/management/queues" className={styles.bcLink}>Filas</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>{isEdit ? `${queueDisplay}` : 'Nova fila'}</span></li>
        </ol>
      </nav>

      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>{isEdit ? `Editar ${queueDisplay}` : 'Nova fila'}</h1>
          <p className={styles.pageSubtitle}>Defina o nome da fila, uma descrição e (opcionalmente) uma cor de identificação.</p>
        </div>
      </header>

      {loading ? (
        <div className={styles.skeleton}>
          <div className={styles.skelCard} />
          <div className={styles.skelCard} />
        </div>
      ) : (
        <>
          {err && <div className={styles.alert}>{err}</div>}

          {/* ===== Identificação ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Identificação</h2>
              <p className={styles.cardDesc}>Informações básicas da fila.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>
                  Nome <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${touched.nome && nameInvalid ? styles.invalid : ''}`}
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  onBlur={() => setTouched(t => ({ ...t, nome: true }))}
                  placeholder="Ex.: Suporte, Comercial, Financeiro…"
                />
                {touched.nome && nameInvalid && <span className={styles.errMsg}>Informe o nome da fila.</span>}
              </div>

              <div className={styles.groupWide}>
                <label className={styles.label}>Descrição (opcional)</label>
                <input
                  className={styles.input}
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Breve descrição"
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Cor (opcional)</label>
                <div className={styles.colorRow}>
                  <input
                    id="color"
                    className={`${styles.input} ${styles.colorField}`}
                    placeholder="#RRGGBB (ex.: #4682B4)"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                  />

                  <span className={styles.colorChip} title={colorPreview || 'Aleatória ao salvar'}>
                    <span className={styles.colorSwatch} style={{ background: colorPreview || '#ffffff' }} aria-hidden="true" />
                    <Palette size={16} aria-hidden="true" />
                    <span className={styles.hex}>{colorPreview || 'aleatória'}</span>
                  </span>

                  <button type="button" className={styles.btnSecondary} onClick={handleSortearCor}>
                    <RefreshCw size={16} aria-hidden="true" />
                    Sortear
                  </button>

                  {!!form.color && (
                    <button type="button" className={styles.btn} onClick={handleLimparCor}>
                      <X size={16} aria-hidden="true" />
                      Limpar
                    </button>
                  )}
                </div>

                {touched.color && colorInvalid && (
                  <span className={styles.errMsg}>Cor inválida. Use o formato #RRGGBB.</span>
                )}
              </div>
            </div>
          </section>

          {/* ===== Etiquetas ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Tags</h2>
              <p className={styles.cardDesc}>
                Digite as tags e pressione <strong>Enter</strong>. Separe várias por vírgula ou ponto-e-vírgula.
                As alterações (criações e remoções) serão aplicadas ao salvar a fila.
              </p>
            </div>

            <div className={styles.cardBody}>
              <ChipsInput value={tags} onChange={setTags} />
              <p className={styles.hint} style={{marginTop:8}}>
                Dica: Use <kbd>Backspace</kbd> para remover o último chip quando o campo estiver vazio.
              </p>
            </div>
          </section>

          {/* ===== Regra de distribuição (visual) ===== */}
          <RuleBuilder
            enabled={ruleEnabled}
            onToggleEnabled={setRuleEnabled}
            rows={ruleRows}
            setRows={setRuleRows}
          />

          {/* Rodapé */}
          <div className={styles.stickyFooter} role="region" aria-label="Ações">
            <div className={styles.stickyInner}>
              <button type="button" className={styles.btnGhost} onClick={() => navigate('/management/queues')}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={!canSubmit}
              >
                <Save size={16}/> {saving ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar fila')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
