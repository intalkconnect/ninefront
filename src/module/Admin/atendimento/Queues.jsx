import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Save as SaveIcon,
  Clock3,
  AlertCircle,
  CheckCircle2,
  Palette,
  RefreshCw,
  X as XIcon,
} from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import QueueHoursModal from './QueueHoursModal';
import styles from './styles/Queues.module.css';

export default function Queues() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // form
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [color, setColor] = useState(''); // opcional

  // modal
  const [hoursOpenFor, setHoursOpenFor] = useState(null);

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1800); };

  // helpers (mesmos do back, para consistência)
  const normalizeHexColor = (input) => {
    if (!input) return null;
    let c = String(input).trim();
    if (!c) return null;
    if (!c.startsWith('#')) c = `#${c}`;
    if (/^#([0-9a-fA-F]{3})$/.test(c)) {
      c = '#' + c.slice(1).split('').map(ch => ch + ch).join('');
    }
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
    const s = 50 + Math.floor(Math.random() * 16); // 50–65
    const l = 78 + Math.floor(Math.random() * 8);  // 78–85
    return hslToHex(h, s, l);
  };

  const load = async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await apiGet('/filas');
      setFilas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setErro('Falha ao carregar filas.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const criar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro(null);
    try {
      const payload = { nome: nome.trim() };
      const d = descricao.trim();
      if (d) payload.descricao = d;
      const norm = normalizeHexColor(color);
      if (norm) payload.color = norm; // se não enviar, o back sorteia

      await apiPost('/filas', payload);
      setNome(''); setDescricao(''); setColor('');
      toastOK('Fila criada.');
      load();
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar fila.');
    }
  };

  const rows = useMemo(() => filas, [filas]);

  const handleSortearCor = () => setColor(randomPastelHex());
  const handleLimparCor = () => setColor('');

  const previewColor = normalizeHexColor(color) || null;

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <Users size={24} aria-hidden="true" /> Filas
            </h1>
            <p className={styles.subtitle}>
              Gerencie as filas de atendimento e configure horários/feriados por fila.
            </p>

            {erro && (
              <div className={styles.alertErr} role="alert" aria-live="assertive">
                <span className={styles.alertIcon} aria-hidden="true"><AlertCircle size={16} /></span>
                <span>{erro}</span>
              </div>
            )}
            {okMsg && (
              <div className={styles.alertOk} role="status" aria-live="polite">
                <span className={styles.alertIcon} aria-hidden="true"><CheckCircle2 size={16} /></span>
                <span>{okMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Criar fila */}
        <form className={styles.form} onSubmit={criar}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <SaveIcon size={18} aria-hidden="true" /> Nova fila
            </div>
          </div>

          <div className={styles.formInner}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="nome">
                Nome da fila <span className={styles.req}>*</span>
              </label>
              <input
                id="nome"
                className={styles.input}
                placeholder="Ex.: Suporte, Comercial, Financeiro…"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="descricao">Descrição (opcional)</label>
              <textarea
                id="descricao"
                className={styles.textarea}
                placeholder="Breve descrição da fila…"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="color">Cor (opcional)</label>

              <div className={styles.colorRow}>
                <input
                  id="color"
                  className={`${styles.input} ${styles.colorField}`}
                  placeholder="#RRGGBB (ex.: #4682B4)"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className={styles.colorChip} title={previewColor || 'Aleatória ao salvar'}>
                  <span
                    className={styles.colorSwatch}
                    style={{ background: previewColor || '#ffffff' }}
                    aria-hidden="true"
                  />
                  <Palette size={16} aria-hidden="true" />
                  <span className={styles.hex}>
                    {previewColor || 'aleatória'}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleSortearCor}
                  title="Sortear cor"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Sortear cor
                </button>
                {color && (
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={handleLimparCor}
                    title="Limpar cor informada"
                  >
                    <XIcon size={16} aria-hidden="true" />
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.btnPrimary}
              type="submit"
              disabled={!nome.trim()}
              aria-label="Salvar fila"
              title="Salvar fila"
            >
              <SaveIcon size={16} aria-hidden="true" />
              Salvar
            </button>
          </div>
        </form>

        {/* Lista de filas */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <Users size={16} aria-hidden="true" /> Filas cadastradas
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 360 }}>Fila</th>
                  <th>Descrição</th>
                  <th style={{ width: 200, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const nomeFila = f.nome ?? f.name ?? '';
                  const hex = f.color || '';
                  const showHex = normalizeHexColor(hex);
                  return (
                    <tr key={`${nomeFila}-${hex}`} className={styles.rowHover}>
                      <td data-label="Fila">
                        <div className={styles.queueNameWrap}>
                          <span
                            className={styles.colorDot}
                            style={{ background: showHex || '#fff' }}
                            title={showHex || 'Sem cor definida'}
                            aria-hidden="true"
                          />
                          <span>{nomeFila}</span>
                        </div>
                      </td>
                      <td data-label="Descrição">{f.descricao || '—'}</td>
                      <td className={styles.actionsCell} data-label="Ações">
                        <button
                          type="button"
                          className={`${styles.btnSecondary} ${styles.iconOnly}`}
                          onClick={() => setHoursOpenFor(nomeFila)}
                          title="Configurar horário/feriados"
                          aria-label={`Configurar horário/feriados da fila ${nomeFila}`}
                        >
                          <Clock3 size={16} aria-hidden="true" />
                          <span className={styles.visuallyHidden}>Configurar horário</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className={styles.empty}>Nenhuma fila cadastrada.</td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={3} className={styles.loading}>Carregando…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de horários */}
      {hoursOpenFor && (
        <QueueHoursModal
          filaNome={hoursOpenFor}
          onClose={() => setHoursOpenFor(null)}
          onSaved={() => { setHoursOpenFor(null); toastOK('Horários atualizados.'); }}
        />
      )}
    </>
  );
}
