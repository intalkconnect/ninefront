import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, Palette, RefreshCw, X, Plus, Trash2, Check } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/QueueForm.module.css';

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

  // Nome a ser exibido no breadcrumb (usa queue_name do backend)
  const [queueDisplay, setQueueDisplay] = useState(id || '');

  // === catálogo de tags da fila (somente em edição) ===
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tags, setTags] = useState([]); // [{tag,label,color,active}]
  const [newTag, setNewTag] = useState({ tag: '', label: '', color: '', active: true });
  const [rowSaving, setRowSaving] = useState({}); // {tagKey: boolean}
  const [rowDeleting, setRowDeleting] = useState({}); // {tagKey: boolean}

  const colorPreview = useMemo(() => normalizeHexColor(form.color), [form.color]);
  const nameInvalid = !form.nome.trim();
  const colorInvalid = form.color ? !colorPreview : false;
  const canSubmit = !saving && !nameInvalid && !colorInvalid;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      if (isEdit) {
        const data = await apiGet(`/queues/${encodeURIComponent(id)}`);
        const q = data?.data ?? data ?? {};
        setForm({
          nome: q.nome ?? q.name ?? '',
          descricao: q.descricao ?? '',
          color: q.color ?? ''
        });
        setQueueDisplay(q.queue_name ?? q.nome ?? q.name ?? id);

        // carrega catálogo de tags da fila (por nome)
        await loadTags(q.nome ?? q.name ?? id);
      } else {
        setForm({ nome: '', descricao: '', color: '' });
        setQueueDisplay('');
        setTags([]); // nada para criar/editar sem fila persistida
      }
    } catch (e) {
      console.error(e);
      setErr('Falha ao carregar dados da fila.');
      toast.error('Falha ao carregar dados da fila.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [isEdit, id]);

  // carrega catálogo de tags
  const loadTags = useCallback(async (queueName) => {
    if (!queueName) { setTags([]); return; }
    setTagsLoading(true);
    try {
      const res = await apiGet(`/tags/ticket/catalog?fila=${encodeURIComponent(queueName)}&active=&page_size=1000`);
      const arr = Array.isArray(res?.data) ? res.data : [];
      // normaliza array
      setTags(arr.map(x => ({
        tag: x.tag,
        label: x.label || '',
        color: x.color || '',
        active: !!x.active
      })));
    } catch (e) {
      console.error(e);
      setTags([]);
      toast.error('Não foi possível carregar as tags da fila.');
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  // ===== CRUD de TAGS da FILA =====

  const saveRow = async (filaNome, item) => {
    const tagKey = item.tag;
    setRowSaving(s => ({ ...s, [tagKey]: true }));
    try {
      // valida cor (se preenchida)
      const norm = item.color ? normalizeHexColor(item.color) : '';
      if (item.color && !norm) {
        toast.warn(`Cor inválida em "${item.tag}". Use #RRGGBB.`);
        return;
      }
      // PATCH /tags/ticket/catalog/:fila/:tag
      await apiPatch(`/tags/ticket/catalog/${encodeURIComponent(filaNome)}/${encodeURIComponent(tagKey)}`, {
        label: item.label || null,
        color: norm || null,
        active: !!item.active
      });
      toast.success(`Etiqueta "${tagKey}" salva.`);
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error(`Erro ao salvar a etiqueta "${tagKey}".`);
    } finally {
      setRowSaving(s => ({ ...s, [tagKey]: false }));
    }
  };

  const deleteRow = async (filaNome, tagKey) => {
    if (!window.confirm(`Remover a etiqueta "${tagKey}" desta fila?`)) return;
    setRowDeleting(s => ({ ...s, [tagKey]: true }));
    try {
      // DELETE /tags/ticket/catalog/:fila/:tag
      await apiDelete(`/tags/ticket/catalog/${encodeURIComponent(filaNome)}/${encodeURIComponent(tagKey)}`);
      toast.success(`Etiqueta "${tagKey}" removida.`);
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error(`Não foi possível remover "${tagKey}".`);
    } finally {
      setRowDeleting(s => ({ ...s, [tagKey]: false }));
    }
  };

  const createTag = async (filaNome) => {
    const t = (newTag.tag || '').trim();
    if (!t) { toast.warn('Informe a “tag” (chave).'); return; }

    const norm = newTag.color ? normalizeHexColor(newTag.color) : '';
    if (newTag.color && !norm) { toast.warn('Cor inválida. Use #RRGGBB.'); return; }

    try {
      await apiPost('/tags/ticket/catalog', {
        fila: filaNome,
        tag: t,
        label: newTag.label || null,
        color: norm || null,
        active: !!newTag.active,
      });
      toast.success('Etiqueta criada/atualizada.');
      setNewTag({ tag: '', label: '', color: '', active: true });
      await loadTags(filaNome);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar/atualizar a etiqueta.');
    }
  };

  const queueNameForTags = useMemo(() => (isEdit ? (form.nome || id) : ''), [isEdit, form.nome, id]);

  return (
    <div className={styles.page} ref={topRef}>
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

          {/* CARD: Identificação */}
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

          {/* CARD: Tags da fila (somente em edição) */}
          {isEdit && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>Etiquetas da fila</h2>
                <p className={styles.cardDesc}>
                  Crie, edite ou desative etiquetas disponíveis para tickets transferidos/abertos nesta fila.
                </p>
              </div>

              <div className={styles.cardBody}>
                {/* Lista/edição inline */}
                {tagsLoading ? (
                  <div className={styles.emptyRow}>Carregando etiquetas…</div>
                ) : tags.length === 0 ? (
                  <div className={styles.emptyRow}>Nenhuma etiqueta cadastrada.</div>
                ) : (
                  <div className={styles.table}>
                    <div className={styles.thead}>
                      <div className={styles.th} style={{minWidth:160}}>Tag</div>
                      <div className={styles.th} style={{flex:1}}>Rótulo</div>
                      <div className={styles.th} style={{minWidth:130}}>Cor</div>
                      <div className={styles.th} style={{minWidth:110}}>Ativa</div>
                      <div className={styles.th} style={{minWidth:150}}>Ações</div>
                    </div>
                    {tags.map((it, idx) => (
                      <div key={it.tag} className={styles.tr}>
                        <div className={styles.td} style={{minWidth:160}}>
                          <code>{it.tag}</code>
                        </div>
                        <div className={styles.td} style={{flex:1}}>
                          <input
                            className={styles.input}
                            value={it.label || ''}
                            onChange={e => {
                              const v = e.target.value;
                              setTags(arr => {
                                const n = [...arr];
                                n[idx] = {...n[idx], label: v};
                                return n;
                              });
                            }}
                            placeholder="Rótulo visível (opcional)"
                          />
                        </div>
                        <div className={styles.td} style={{minWidth:130}}>
                          <input
                            className={styles.input}
                            value={it.color || ''}
                            onChange={e => {
                              const v = e.target.value;
                              setTags(arr => {
                                const n = [...arr];
                                n[idx] = {...n[idx], color: v};
                                return n;
                              });
                            }}
                            placeholder="#RRGGBB"
                          />
                        </div>
                        <div className={styles.td} style={{minWidth:110}}>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              checked={!!it.active}
                              onChange={e => {
                                const v = e.target.checked;
                                setTags(arr => {
                                  const n = [...arr];
                                  n[idx] = {...n[idx], active: v};
                                  return n;
                                });
                              }}
                            />
                            <span className={styles.slider}/>
                          </label>
                        </div>
                        <div className={styles.td} style={{minWidth:150, display:'flex', gap:8}}>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => saveRow(form.nome || id, it)}
                            disabled={!!rowSaving[it.tag]}
                            title="Salvar linha"
                          >
                            <Check size={16}/> {rowSaving[it.tag] ? 'Salvando…' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.danger}`}
                            onClick={() => deleteRow(form.nome || id, it.tag)}
                            disabled={!!rowDeleting[it.tag]}
                            title="Remover"
                          >
                            <Trash2 size={16}/> {rowDeleting[it.tag] ? 'Removendo…' : 'Remover'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Criar nova */}
                <div className={styles.divider} />
                <div className={styles.groupTitle}>Adicionar etiqueta</div>
                <div className={styles.cardBodyGrid3}>
                  <div className={styles.group}>
                    <label className={styles.label}>Tag (chave)</label>
                    <input
                      className={styles.input}
                      value={newTag.tag}
                      onChange={e => setNewTag(nt => ({ ...nt, tag: e.target.value }))}
                      placeholder="ex.: agendamento"
                    />
                  </div>
                  <div className={styles.groupWide}>
                    <label className={styles.label}>Rótulo (opcional)</label>
                    <input
                      className={styles.input}
                      value={newTag.label}
                      onChange={e => setNewTag(nt => ({ ...nt, label: e.target.value }))}
                      placeholder="ex.: Agendamento"
                    />
                  </div>
                  <div className={styles.group}>
                    <label className={styles.label}>Cor (opcional)</label>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <input
                        className={styles.input}
                        value={newTag.color}
                        onChange={e => setNewTag(nt => ({ ...nt, color: e.target.value }))}
                        placeholder="#RRGGBB"
                      />
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setNewTag(nt => ({ ...nt, color: randomPastelHex() }))}
                        title="Sortear cor"
                      >
                        <RefreshCw size={16}/>
                        Sortear
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.inlineRow} style={{marginTop:8}}>
                  <div className={styles.inlineItem}>
                    <span className={styles.inlineLabel}>Ativa</span>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={!!newTag.active}
                        onChange={e => setNewTag(nt => ({ ...nt, active: e.target.checked }))}
                      />
                      <span className={styles.slider}/>
                    </label>
                  </div>
                </div>

                <div style={{display:'flex', gap:8, marginTop:12}}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => createTag(form.nome || id)}
                  >
                    <Plus size={16}/> Adicionar etiqueta
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => loadTags(form.nome || id)}
                    disabled={tagsLoading}
                  >
                    Recarregar
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Footer fixo */}
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
