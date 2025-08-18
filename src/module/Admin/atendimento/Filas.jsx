import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, ChevronDown } from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Filas.module.css';

export default function Filas() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  // criação
  const [nome, setNome] = useState('');
  // expansão / cache de atendentes online
  const [open, setOpen] = useState(null);
  const [onlineByFila, setOnlineByFila] = useState({}); // { [nomeFila]: { list: [], loaded: true } }

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

  const toggleOpen = async (filaNome) => {
    setOpen((prev) => (prev === filaNome ? null : filaNome));
    // carrega online se ainda não carregado
    if (!onlineByFila[filaNome]) {
      try {
        const res = await apiGet(`/filas/atendentes/${encodeURIComponent(filaNome)}`);
        const list = Array.isArray(res?.atendentes) ? res.atendentes : [];
        setOnlineByFila((m) => ({ ...m, [filaNome]: { list, loaded: true } }));
      } catch (e) {
        console.error(e);
        setOnlineByFila((m) => ({ ...m, [filaNome]: { list: [], loaded: true } }));
      }
    }
  };

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
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Filas</h1>
          <p className={styles.subtitle}>
            Gerencie as filas de atendimento e visualize quem está online em cada uma.
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
            placeholder="Ex.: Suporte, Comercial, Financeiro..."
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
                <th style={{minWidth: 280}}>Fila</th>
                <th style={{width: 160}}>Online agora</th>
                <th style={{width: 160}}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const nomeFila = f.nome ?? f.name ?? '';
                const opened = open === nomeFila;
                const online = onlineByFila[nomeFila]?.list ?? [];
                return (
                  <React.Fragment key={nomeFila}>
                    <tr className={styles.rowHover}>
                      <td>{nomeFila}</td>
                      <td>
                        {onlineByFila[nomeFila]
                          ? <strong>{online.length}</strong>
                          : <span className={styles.subtleCenter}>—</span>
                        }
                      </td>
                      <td>
                        <button className={styles.btnTiny} onClick={() => toggleOpen(nomeFila)}>
                          <ChevronDown size={14} style={{transform: opened ? 'rotate(180deg)' : 'none', transition:'transform .15s'}}/>
                          {opened ? 'Ocultar' : 'Ver atendentes'}
                        </button>
                      </td>
                    </tr>

                    {opened && (
                      <tr>
                        <td colSpan={3} className={styles.nestedCell}>
                          <div className={styles.nestedWrap}>
                            <div className={styles.nestedTitle}>
                              Atendentes online em “{nomeFila}”
                            </div>
                            {!onlineByFila[nomeFila]
                              ? <div className={styles.loading}>Carregando…</div>
                              : (
                                online.length === 0
                                  ? <div className={styles.empty}>Nenhum atendente online nesta fila.</div>
                                  : (
                                    <ul className={styles.inlineList}>
                                      {online.map(a => (
                                        <li key={a.email}>
                                          <span className={styles.badgeOk}/>
                                          {a.name} {a.lastname} — {a.email}
                                        </li>
                                      ))}
                                    </ul>
                                  )
                              )
                            }
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
  );
}
