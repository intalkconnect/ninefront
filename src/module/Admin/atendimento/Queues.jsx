// src/pages/Queues/index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Users, Clock3, CheckCircle2 } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient';
import QueueHoursModal from './QueueHoursModal';
import QueueModal from './QueueModal';   // <— novo
import styles from './styles/Queues.module.css';

export default function Queues() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // modal horários
  const [hoursOpenFor, setHoursOpenFor] = useState(null);
  // modal criar
  const [createOpen, setCreateOpen] = useState(false);

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1800); };

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

  const rows = useMemo(() => filas, [filas]);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}><Users size={24} aria-hidden="true" /> Filas</h1>
            <p className={styles.subtitle}>Gerencie as filas de atendimento e configure horários/feriados por fila.</p>

            {erro && (
              <div className={styles.alertErr} role="alert" aria-live="assertive">
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

          {/* Botão "Criar" abre modal */}
          <div>
            <button type="button" className={styles.btnPrimary} onClick={() => setCreateOpen(true)}>
              + Criar fila
            </button>
          </div>
        </div>

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
                          <span className={styles.colorDot} style={{ background: showHex || '#fff' }} aria-hidden="true" />
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
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={3} className={styles.empty}>Nenhuma fila cadastrada.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={3} className={styles.loading}>Carregando…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modais */}
      <CreateQueueModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
      {hoursOpenFor && (
        <QueueHoursModal
          filaNome={hoursOpenFor}
          onClose={() => setHoursOpenFor(null)}
          onSaved={() => { setHoursOpenFor(null); load(); }}
        />
      )}
    </>
  );
}
