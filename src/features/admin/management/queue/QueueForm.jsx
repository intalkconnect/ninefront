import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Save, Palette, RefreshCw, X } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../../../shared/apiClient';
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
      } else {
        setForm({ nome: '', descricao: '', color: '' });
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

  return (
    <div className={styles.page} ref={topRef}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/" className={styles.bcLink}>Dashboard</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><Link to="/management/queues" className={styles.bcLink}>Filas</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>{isEdit ? `Editar fila: ${form.nome?.trim() || '…'}` : 'Nova fila'}</span></li>
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
