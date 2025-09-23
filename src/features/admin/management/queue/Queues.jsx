import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Clock3, X as XIcon, SquarePen, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiDelete } from '../../../../shared/apiClient';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';
import { toast } from 'react-toastify';
import styles from './styles/Queues.module.css';

export default function Queues() {
  const navigate = useNavigate();

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const confirm = useConfirm();

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/queues');
      setFilas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar filas.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter((f) => {
      const nome = String(f.nome ?? f.name ?? '').toLowerCase();
      const desc = String(f.descricao ?? '').toLowerCase();
      return nome.includes(q) || desc.includes(q);
    });
  }, [filas, query]);

  const clearSearch = () => setQuery('');

  async function handleDelete(queue) {
    const id = queue.id ?? queue.nome ?? queue.name;
    if (!id) {
      toast.warn('ID da fila indisponível.');
      return;
    }
    try {
          const ok = await confirm({
      title: 'Excluir fila?',
      description: `Tem certeza que deseja excluir a fila "${fila.nome ?? fila.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;
      await apiDelete(`/queues/${encodeURIComponent(id)}`);
      toast.success('Fila excluída.');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Falha ao excluir fila.');
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate('/management/queues/new')}
          >
            <Plus size={16}/> Nova Fila
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de filas: crie, edite, configure horários e exclua.</p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardActions}>
            <div className={styles.searchGroup}>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome ou descrição…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar filas"
              />
              {query && (
                <button
                  className={styles.searchClear}
                  onClick={clearSearch}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <div className={styles.counter} aria-label="Total de itens filtrados">
              <span className={styles.counterNumber}>{filtered.length}</span>
              <span>{filtered.length === 1 ? 'item' : 'itens'}</span>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 360 }}>Fila</th>
                <th>Descrição</th>
                <th style={{ width: 220, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className={styles.loading}>Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={3} className={styles.empty}>Nenhuma fila encontrada.</td></tr>
              )}
              {!loading && filtered.map((f) => {
                const id = f.id ?? f.nome ?? f.name; // fallback seguro
                const nomeFila = f.nome ?? f.name ?? '';
                const hex = f.color || '';
                const showHex = normalizeHexColor(hex);

                return (
                  <tr key={String(id)} className={styles.rowHover}>
                    <td data-label="Fila">
                      <div className={styles.queueNameWrap}>
                        <span className={styles.colorDot} style={{ background: showHex || '#fff' }} aria-hidden="true" />
                        <span>{nomeFila}</span>
                      </div>
                    </td>
                    <td data-label="Descrição">{f.descricao || '—'}</td>
                    <td className={styles.actionsCell} data-label="Ações">
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          className={`${styles.btnSecondary} ${styles.iconOnly}`}
                          title="Configurar horários e feriados"
                          onClick={() => navigate(`/management/queues/${encodeURIComponent(nomeFila)}/hours`)}
                        >
                          <Clock3 size={16}/>
                        </button>
                        <button
                          type="button"
                          className={`${styles.btnSecondary} ${styles.iconOnly}`}
                          title="Editar"
                          onClick={() => navigate(`/management/queues/${encodeURIComponent(id)}`)}
                        >
                          <SquarePen size={16}/>
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.iconOnly}`}
                          title="Excluir"
                          onClick={() => handleDelete(f)}
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
