import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Clock3 } from 'lucide-react';
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

  const toastOK = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 1600); };

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
            <h1 className={styles.title}>Filas</h1>
            <p className={styles.subtitle}>
              Gerencie as filas de atendimento e configure horários/feriados por fila.
            </p>
            {erro ? <div className={styles.alertErr}>{erro}</div> : null}
            {okMsg ? <div className={styles.alertOk}>{okMsg}</div> : null}
          </div>
        </div>

        {/* Criar fila */}
        <form className={styles.form} onSubmit={criar}>
          <div className={styles.formRow}>
            <label className={styles.inlineLabel}>Nome da fila <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              placeholder="Ex.: Suporte, Comercial, Financeiro…"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} type="submit">
              <Plus size={16}/> Criar fila
            </button>
          </div>
        </form>

        {/* Lista de filas */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}><Users size={16}/> Filas cadastradas</div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{minWidth: 360}}>Fila</th>
                  <th style={{width: 200, textAlign:'right'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const nomeFila = f.nome ?? f.name ?? '';
                  return (
                    <tr key={nomeFila} className={styles.rowHover}>
                      <td>{nomeFila}</td>
                      <td className={styles.actionsCell}>
                        <button
                          type="button"
                          className={styles.btnTiny}
                          onClick={() => setHoursOpenFor(nomeFila)}
                          title="Configurar horário/feriados"
                        >
                          <Clock3 size={14}/> Configurar horário
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && rows.length === 0 && (
                  <tr><td colSpan={2} className={styles.empty}>Nenhuma fila cadastrada.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={2} className={styles.loading}>Carregando…</td></tr>
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
