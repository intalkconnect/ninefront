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

/* =================== ChipsInput (tags) =================== */
function ChipsInput({
  value = [],
  onChange,
  placeholder = 'ex.: agendamento, reclamacao, urgencia',
  maxLen = 40,
}) {
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

  // nome exibido no breadcrumb (usa queue_name do backend quando disponível)
  const [queueDisplay, setQueueDisplay] = useState(id || '');

  // tags
  const [initialTags, setInitialTags] = useState([]); // catálogo original
  const [tags, setTags] = useState([]);               // estado visível no input (com chips)

  // --- Regra de roteamento (apenas 1 condição; operadores: equals|contains) ---
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [rule, setRule] = useState({ field: '', op: 'equals', value: '' });

  // validação
  const colorPreview = useMemo(() => normalizeHexColor(form.color), [form.color]);
  const nameInvalid = !form.nome.trim();
  const colorInvalid = form.color ? !colorPreview : false;
  const canSubmit = !saving && !nameInvalid && !colorInvalid;

  // carrega catálogo por nome de fila
  const loadTags = useCallback(async (filaNome) => {
    if (!filaNome) { setInitialTags([]); setTags([]); return; }
    try {
      const r = await apiGet(`/tags/ticket/catalog?fila=${encodeURIComponent(filaNome)}&page_size=200`);
      const list = Array.isArray(r?.data) ? r.data : [];
      const arr = list.map(x => x.tag);
      setInitialTags(arr);
      setTags(arr); // mostra as já cadastradas como chips dentro do input
    } catch {
      setInitialTags([]);
      setTags([]);
    }
  }, []);

  // carrega UMA regra da API
  const loadRule = useCallback(async (filaIdOrName) => {
    if (!filaIdOrName) {
      setRuleEnabled(false);
      setRule({ field: '', op: 'equals', value: '' });
      return;
    }
    try {
      const r = await apiGet(`/queues/${encodeURIComponent(filaIdOrName)}/rules`);
      const cfg = r?.data || r;
      const first = Array.isArray(cfg?.conditions) ? cfg.conditions[0] : null;

      setRuleEnabled(!!cfg?.enabled);
      setRule({
        field: first?.field || '',
        op: first?.op === 'contains' ? 'contains' : 'equals',
        value: first?.value || ''
      });
    } catch {
      setRuleEnabled(false);
      setRule({ field: '', op: 'equals', value: '' });
    }
  }, []);

  // carrega fila
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

        await loadTags(nomeFila || q.nome || q.name);
        await loadRule(nomeFila || q.nome || q.name);
      } else {
        setForm({ nome: '', descricao: '', color: '' });
        setQueueDisplay('');
        setInitialTags([]);
        setTags([]);
        setRuleEnabled(false);
        setRule({ field: '', op: 'equals', value: '' });
      }
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar dados da fila.');
      toast.error('Falha ao carregar dados da fila.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isEdit, id, loadTags, loadRule]);

  useEffect(() => { load(); }, [load]);

  const handleSortearCor = () => setForm(f => ({ ...f, color: randomPastelHex() }));
  const handleLimparCor = () => setForm(f => ({ ...f, color: '' }));

  // cria e remove conforme diff
  async function persistTagsDiff(filaNome, before = [], current = []) {
    const prev = new Set(before);
    const now  = new Set(current);

    const toAdd    = [...now].filter(t => !prev.has(t));
    const toRemove = [...prev].filter(t => !now.has(t));

    const jobs = [];

    // criar
    for (const tag of toAdd) {
      jobs.push(apiPost('/tags/ticket/catalog', { fila: filaNome, tag, active: true }));
    }
    // remover
    for (const tag of toRemove) {
      jobs.push(apiDelete(`/tags/ticket/catalog/${encodeURIComponent(filaNome)}/${encodeURIComponent(tag)}`));
    }

    if (!jobs.length) return;

    const res = await Promise.allSettled(jobs);
    const ok = res.filter(r => r.status === 'fulfilled').length;
    const fail = res.length - ok;
    if (ok) toast.success(`${ok} alteração(ões) de etiqueta aplicada(s).`);
    if (fail) toast.error(`${fail} alteração(ões) falharam. Verifique dependências (tags em uso).`);
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

      // salvar fila (criar/editar)
      if (isEdit) {
        await apiPut(`/queues/${encodeURIComponent(id)}`, payload);
        toast.success('Fila atualizada.');
      } else {
        await apiPost('/queues', payload);
        toast.success('Fila criada.');
      }

      // aplicar diff das etiquetas usando o NOME atual do formulário
      const filaNome = form.nome.trim();
      await persistTagsDiff(filaNome, initialTags, tags);

      // salvar/limpar regra (1 condição; equals|contains)
      if (ruleEnabled && rule.field.trim() && rule.value.trim()) {
        const body = {
          enabled: true,
          conditions: [{
            field: rule.field.trim(),
            op: rule.op === 'contains' ? 'contains' : 'equals',
            value: rule.value.trim()
          }]
        };
        await apiPut(`/queues/${encodeURIComponent(filaNome)}/rules`, body);
      } else {
        await apiDelete(`/queues/${encodeURIComponent(filaNome)}/rules`);
      }

      navigate('/management/queues');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar. Tente novamente.');
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
                    className={`${styles.input} ${styles.colorField || ''}`}
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
              <ChipsInput
                value={tags}
                onChange={setTags}
              />
              <p className={styles.hint} style={{marginTop:8}}>
                Dica: Use <kbd>Backspace</kbd> para remover o último chip quando o campo estiver vazio.
              </p>
            </div>
          </section>

          {/* ===== Regra de roteamento ===== */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Regra de roteamento para esta fila</h2>
              <p className={styles.cardDesc}>
                Defina uma condição para que tickets entrem automaticamente nesta fila.
                (Somente uma condição. Operadores: <strong>igual</strong> ou <strong>contém</strong>.)
              </p>
            </div>

            <div className={styles.cardBody}>
              <label className={styles.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <input
                  type="checkbox"
                  checked={ruleEnabled}
                  onChange={(e) => setRuleEnabled(e.target.checked)}
                  style={{ transform:'scale(1.1)' }}
                />
                Habilitar regra de roteamento
              </label>

              <div style={{ display:'grid', gap:12, gridTemplateColumns:'180px 1fr 1fr auto', alignItems:'center' }}>
                {/* Operador */}
                <div>
                  <label className={styles.label} style={{ marginBottom:6, display:'block' }}>Operador</label>
                  <select
                    className={styles.input}
                    value={rule.op}
                    onChange={(e) => setRule(r => ({ ...r, op: e.target.value }))}
                    disabled={!ruleEnabled}
                  >
                    <option value="equals">igual</option>
                    <option value="contains">contém</option>
                  </select>
                </div>

                {/* Variável */}
                <div>
                  <label className={styles.label} style={{ marginBottom:6, display:'block' }}>Variável</label>
                  <input
                    className={styles.input}
                    value={rule.field}
                    onChange={(e) => setRule(r => ({ ...r, field: e.target.value }))}
                    placeholder="Ex.: contact.document"
                    disabled={!ruleEnabled}
                  />
                </div>

                {/* Valor */}
                <div>
                  <label className={styles.label} style={{ marginBottom:6, display:'block' }}>Valor</label>
                  <input
                    className={styles.input}
                    value={rule.value}
                    onChange={(e) => setRule(r => ({ ...r, value: e.target.value }))}
                    placeholder="Ex.: particular"
                    disabled={!ruleEnabled}
                  />
                </div>

                {/* Ação */}
                <div>
                  <label className={styles.label} style={{ marginBottom:6, display:'block', visibility:'hidden' }}>.</label>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => { setRule({ field: '', op: 'equals', value: '' }); }}
                    disabled={!ruleEnabled}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <p className={styles.hint} style={{ marginTop: 8 }}>
                Exemplos de variável: <code>contact.document</code>, <code>contact.email</code>, <code>tag</code>.
              </p>
            </div>
          </section>

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
