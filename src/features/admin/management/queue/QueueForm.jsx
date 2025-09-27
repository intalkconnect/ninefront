// src/features/admin/management/queue/QueueForm.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, Palette, RefreshCw, X, Trash2, RotateCcw } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/QueueForm.module.css';

/* ===== util de cor ===== */
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

/* ===== util de tags ===== */
const slugifyTag = (s) => {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, '-')        // espaço -> hífen
    .replace(/[^a-z0-9-_]/g, '') // somente seguro
    .replace(/-+/g, '-')         // colapsa hífens
    .replace(/^[-_]+|[-_]+$/g, '');
};
const parseTokens = (raw) =>
  String(raw || '')
    .split(',')
    .map(t => slugifyTag(t))
    .filter(Boolean);

export default function QueueForm() {
  const { id } = useParams(); // id da fila (pk/uuid) usado para GET/PUT /queues/:id
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const topRef = useRef(null);

  /* ===== estados básicos ===== */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({ nome: '', descricao: '', color: '' });
  const [touched, setTouched] = useState({ nome: false, color: false });

  // Nome exibido no breadcrumb (usa queue_name se backend enviar)
  const [queueDisplay, setQueueDisplay] = useState(id || '');

  /* ===== estados de tags (catálogo por fila) ===== */
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tags, setTags] = useState([]); // [{tag,label,color,active}]

  // Entrada rápida
  const [newTagsInput, setNewTagsInput] = useState('');
  const [pendingTags, setPendingTags] = useState([]); // strings ainda não salvas
  const [savingBatch, setSavingBatch] = useState(false);

  /* ===== validações ===== */
  const colorPreview = useMemo(() => normalizeHexColor(form.color), [form.color]);
  const nameInvalid = !form.nome.trim();
  const colorInvalid = form.color ? !colorPreview : false;
  const canSubmit = !saving && !nameInvalid && !colorInvalid;

  /* ===== carregar fila + catálogo ===== */
  const loadTags = useCallback(async (filaNome) => {
    if (!filaNome) { setTags([]); return; }
    setTagsLoading(true);
    try {
      const r = await apiGet(`/tags/ticket/catalog?fila=${encodeURIComponent(filaNome)}&page_size=200`);
      setTags(Array.isArray(r?.data) ? r.data.map(x => ({
        tag: x.tag,
        label: x.label || '',
        color: x.color || '',
        active: Boolean(x.active)
      })) : []);
    } catch (e) {
      console.error(e);
      setTags([]);
      toast.error('Falha ao carregar etiquetas da fila.');
    } finally {
      setTagsLoading(false);
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
        await loadTags(nomeFila || q.nome || q.name);
      } else {
        setForm({ nome: '', descricao: '', color: '' });
        setQueueDisplay('');
        setTags([]); setPendingTags([]);
      }
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar dados da fila.');
      toast.error('Falha ao carregar dados da fila.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isEdit, id, loadTags]);

  useEffect(() => { load(); }, [load]);

  /* ===== ações do form ===== */
  const handleSortearCor = () => setForm(f => ({ ...f, color: randomPastelHex() }));
  const handleLimparCor = () => setForm(f => ({ ...f, color: '' }));

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
      navigate('/management/queues');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  /* ===== entrada rápida de tags ===== */
  const addPending = (raw) => {
    const tokens = parseTokens(raw);
    if (!tokens.length) return;

    const currentSet = new Set(pendingTags);
    const catalogSet = new Set((tags || []).map(t => t.tag));
    const fresh = tokens.filter(t => !currentSet.has(t) && !catalogSet.has(t));
    if (!fresh.length) {
      toast.info('Todas as etiquetas inseridas já existem ou estão pendentes.');
      return;
    }
    setPendingTags(prev => [...prev, ...fresh]);
  };

  const onNewTagsKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (newTagsInput.trim()) {
        addPending(newTagsInput);
        setNewTagsInput('');
      }
    }
  };
  const onNewTagsPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (text.includes(',')) {
      e.preventDefault();
      addPending(text);
    }
  };
  const removePending = (t) => setPendingTags(arr => arr.filter(x => x !== t));

  const savePendingBatch = async () => {
    if (!pendingTags.length) {
      toast.info('Nenhuma etiqueta pendente para salvar.');
      return;
    }
    const filaNome = queueDisplay || form.nome || id;
    if (!filaNome) {
      toast.warn('Defina/salve o nome da fila antes de cadastrar etiquetas.');
      return;
    }
    setSavingBatch(true);
    try {
      const promises = pendingTags.map(tag =>
        apiPost('/tags/ticket/catalog', {
          fila: filaNome,
          tag,
          label: null,
          color: null,
          active: true,
        })
      );
      const res = await Promise.allSettled(promises);
      const ok = res.filter(r => r.status === 'fulfilled').length;
      const fail = res.length - ok;

      if (ok) toast.success(`${ok} etiqueta(s) criada(s).`);
      if (fail) toast.error(`${fail} etiqueta(s) falharam.`);

      setPendingTags([]);
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar etiquetas.');
    } finally {
      setSavingBatch(false);
    }
  };

  /* ===== edição/exclusão linha-a-linha ===== */
  const handleTagField = (idx, field, value) => {
    setTags(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  };

  const saveRow = async (idx) => {
    const filaNome = queueDisplay || form.nome || id;
    const row = tags[idx];
    try {
      await apiPost('/tags/ticket/catalog', {
        fila: filaNome,
        tag: row.tag,
        label: row.label || null,
        color: row.color || null,
        active: !!row.active
      });
      toast.success('Etiqueta atualizada.');
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar a etiqueta.');
    }
  };

  const deleteRow = async (idx) => {
    const filaNome = queueDisplay || form.nome || id;
    const row = tags[idx];
    try {
      await apiDelete(`/tags/ticket/catalog/${encodeURIComponent(filaNome)}/${encodeURIComponent(row.tag)}`);
      toast.success('Etiqueta removida.');
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Não foi possível remover. Verifique se não está em uso.');
    }
  };

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/" className={styles.bcLink}>Dashboard</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><Link to="/management/queues" className={styles.bcLink}>Filas</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>{isEdit ? `Editar ${queueDisplay}` : 'Nova fila'}</span></li>
        </ol>
      </nav>

      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>{isEdit ? 'Editar fila' : 'Nova fila'}</h1>
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

          {/* ===== Card: identificação ===== */}
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

          {/* ===== Card: etiquetas por fila (somente em edição) ===== */}
          {isEdit ? (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Etiquetas da fila</h2>
                <p className={styles.cardDesc}>
                  Crie, edite ou desative etiquetas disponíveis para tickets transferidos/abertos nesta fila.
                </p>
              </div>

              <div className={styles.cardBody}>
                {/* Entrada rápida */}
                <div className={styles.groupTitle}>Adicionar etiquetas (rápido)</div>
                <p className={styles.cardDesc} style={{ marginTop: -6 }}>
                  Digite a(s) etiqueta(s) e pressione <strong>Enter</strong>. Separe várias por vírgula.
                </p>

                <div className={styles.cardBodyGrid3} style={{ alignItems: 'center' }}>
                  <div className={styles.groupWide}>
                    <label className={styles.label}>Etiquetas</label>
                    <input
                      className={styles.input}
                      placeholder="ex.: agendamento, reclamacao, urgencia"
                      value={newTagsInput}
                      onChange={e => setNewTagsInput(e.target.value)}
                      onKeyDown={onNewTagsKeyDown}
                      onPaste={onNewTagsPaste}
                    />
                  </div>

                  <div className={styles.group} style={{ alignSelf: 'end' }}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => { if (newTagsInput.trim()) { addPending(newTagsInput); setNewTagsInput(''); } }}
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {pendingTags.length > 0 && (
                  <>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {pendingTags.map(t => (
                        <span
                          key={t}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 999, fontSize: 12,
                            background: '#eef2ff', border: '1px solid #dbeafe', color: '#1e3a8a'
                          }}
                          title={t}
                        >
                          <span>{t}</span>
                          <button
                            type="button"
                            onClick={() => removePending(t)}
                            style={{
                              width: 18, height: 18, borderRadius: 999, border: 0, cursor: 'pointer',
                              display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.08)',
                              color: '#1e3a8a', fontWeight: 700, lineHeight: 1
                            }}
                            aria-label={`Remover ${t}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={savePendingBatch}
                        disabled={savingBatch}
                      >
                        <Save size={16} /> {savingBatch ? 'Salvando…' : 'Salvar etiquetas'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => setPendingTags([])}
                        disabled={savingBatch}
                      >
                        Limpar pendentes
                      </button>
                    </div>
                  </>
                )}

                <div className={styles.divider} />

                {/* Lista/edição de etiquetas existentes */}
                <div className={styles.groupTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Etiquetas cadastradas</span>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => loadTags(queueDisplay || form.nome || id)}
                    title="Recarregar"
                  >
                    <RotateCcw size={16} /> Recarregar
                  </button>
                </div>

                {tagsLoading ? (
                  <div className={styles.cardDesc}>Carregando…</div>
                ) : tags.length === 0 ? (
                  <div className={styles.cardDesc}>Nenhuma etiqueta cadastrada.</div>
                ) : (
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    {tags.map((row, idx) => (
                      <div
                        key={row.tag}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(140px, 220px) 1fr 170px 120px',
                          gap: 8,
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <label className={styles.label}>Tag</label>
                          <input className={styles.input} value={row.tag} disabled />
                        </div>

                        <div>
                          <label className={styles.label}>Rótulo (opcional)</label>
                          <input
                            className={styles.input}
                            value={row.label || ''}
                            onChange={e => handleTagField(idx, 'label', e.target.value)}
                            placeholder="ex.: Agendamento"
                          />
                        </div>

                        <div>
                          <label className={styles.label}>Cor (opcional)</label>
                          <input
                            className={styles.input}
                            value={row.color || ''}
                            onChange={e => handleTagField(idx, 'color', e.target.value)}
                            placeholder="#RRGGBB"
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <label className={styles.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={!!row.active}
                              onChange={e => handleTagField(idx, 'active', e.target.checked)}
                            />
                            Ativa
                          </label>

                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => saveRow(idx)}
                            title="Salvar"
                          >
                            <Save size={16} />
                          </button>

                          <button
                            type="button"
                            className={styles.btn}
                            onClick={() => deleteRow(idx)}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Etiquetas da fila</h2>
                <p className={styles.cardDesc}>
                  Salve a fila primeiro para gerenciar as etiquetas disponíveis.
                </p>
              </div>
            </section>
          )}

          {/* rodapé fixo */}
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
