import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Clock3, X as XIcon, SquarePen, Trash2, Plus } from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { apiGet, apiDelete } from '../../../../shared/apiClient';
import { useConfirm } from '../../../../app/provider/ConfirmProvider.jsx';
import { toast } from 'react-toastify';
import styles from './styles/Queues.module.css';

export default function Queues() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const flowId =
    params.flowId ||
    location.state?.flowId ||
    location.state?.meta?.flowId ||
    null;

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
      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : '';
      const data = await apiGet(`/queues${qs}`);
      setFilas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar filas.');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

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
        description: `Tem certeza que deseja excluir a fila "${queue.nome ?? queue.name}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        tone: 'danger',
      });
      if (!ok) return;

      const qs = flowId ? `?flow_id=${encodeURIComponent(flowId)}` : '';
      await apiDelete(`/queues/${encodeURIComponent(id)}${qs}`);

      toast.success('Fila excluída.');
      load();
    } catch (e) {
      console.error(e);

      let msg = 'Falha ao excluir fila.';
      const data = e?.response?.data || e?.data;
      if (data && typeof data.error === 'string') {
        msg = data.error;
      } else if (typeof e?.message === 'string') {
        const idx = e.message.indexOf('): ');
        if (idx !== -1) {
          msg = e.message.slice(idx + 3).trim();
        } else {
          msg = e.message;
        }
      }

      toast.error(msg);
    }
  }

  return (
    <div className={styles.container}>
      {/* Header com gradiente */}
      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de filas: crie, edite, configure horários e exclua.</p>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() =>
            navigate('/management/queues/new', { state: { flowId } })
          }
        >
          <Plus size={16}/> Nova Fila
        </button>
      </div>

      {/* Barra de busca e contador */}
      <div className={styles.searchBar}>
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
          <span>{filtered.length === 1 ? 'fila' : 'filas'}</span>
        </div>
      </div>

      {/* Lista de filas em cards */}
      <div className={styles.queueList}>
        {loading && (
          <div className={styles.loading}>Carregando filas…</div>
        )}
        
        {!loading && filtered.length === 0 && (
          <div className={styles.empty}>
            <p>Nenhuma fila encontrada.</p>
            {query && <button className={styles.btnSecondary} onClick={clearSearch}>Limpar busca</button>}
          </div>
        )}
        
        {!loading && filtered.map((f) => {
          const id = f.id ?? f.nome ?? f.name;
          const nomeFila = f.nome ?? f.name ?? '';
          const hex = f.color || '';
          const showHex = normalizeHexColor(hex);

          return (
            <div key={String(id)} className={styles.queueCard}>
              <div className={styles.queueCardHeader}>
                <div className={styles.queueInfo}>
                  <span 
                    className={styles.colorDot} 
                    style={{ background: showHex || '#e5e7eb' }} 
                    aria-hidden="true" 
                  />
                  <div>
                    <h3 className={styles.queueName}>{nomeFila}</h3>
                    {f.descricao && (
                      <p className={styles.queueDesc}>{f.descricao}</p>
                    )}
                  </div>
                </div>
                <div className={styles.queueActions}>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    title="Configurar horários e feriados"
                    onClick={() =>
                      navigate(
                        `/management/queues/${encodeURIComponent(nomeFila)}/hours`,
                        { state: { flowId } }
                      )
                    }
                  >
                    <Clock3 size={18}/>
                  </button>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    title="Editar"
                    onClick={() =>
                      navigate(
                        `/management/queues/${encodeURIComponent(id)}`,
                        { state: { flowId } }
                      )
                    }
                  >
                    <SquarePen size={18}/>
                  </button>
                  <button
                    type="button"
                    className={styles.btnIconDanger}
                    title="Excluir"
                    onClick={() => handleDelete(f)}
                  >
                    <Trash2 size={18}/>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
