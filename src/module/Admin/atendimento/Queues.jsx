import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Save as SaveIcon,
  Clock3,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import QueueHoursModal from './QueueHoursModal';
import styles from './styles/Filas.module.css';

export default function Queues() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [nome, setNome] = useState('');
  const [hoursOpenFor, setHoursOpenFor] = useState(null); // nome da fila para abrir o modal

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1800); };

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
      await apiPost('/filas', { nome: nome.trim() });
      setNome('');
      toastOK('Fila criada.');
      load();
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar fila.');
    }
  };

  const rows = useMemo(() => filas, [filas]);

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

        {/* Criar fila – mesmo padrão (card + botão Salvar) */}
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
                  <th style={{ width: 200, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const nomeFila = f.nome ?? f.name ?? '';
                  return (
                    <tr key={nomeFila} className={styles.rowHover}>
                      <td data-label="Fila">{nomeFila}</td>
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
                    <td colSpan={2} className={styles.empty}>Nenhuma fila cadastrada.</td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={2} className={styles.loading}>Carregando…</td>
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
