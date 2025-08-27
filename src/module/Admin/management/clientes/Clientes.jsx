// src/pages/Clients/Clients.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users as UsersIcon,
  RefreshCw,
  X as XIcon
} from 'lucide-react';
import { apiGet } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css'; // reaproveita o CSS da página de usuários

const CHANNELS = [
  { key: '',           label: 'Todos' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'telegram',   label: 'Telegram' },
  { key: 'instagram',  label: 'Instagram' },
  { key: 'facebook',   label: 'Facebook' },
];

function prettyChannel(c) {
  const map = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook: 'Facebook'
  };
  return map[(c || '').toLowerCase()] || (c ? String(c) : '—');
}

function phoneForDisplay(channel, phone) {
  return (String(channel).toLowerCase() === 'whatsapp' && phone) ? phone : '—';
}

export default function Clients() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const [q, setQ] = useState('');
  const [chan, setChan] = useState('');

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10); // 10 | 20 | 30 | 40

  const [selected, setSelected] = useState(null); // cliente selecionado para modal

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // se seu backend aceitar paginação server-side, adapte aqui (query string).
      const data = await apiGet('/clientes');
      setItems(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(c => {
      if (chan && String(c.channel || '').toLowerCase() !== chan) return false;
      if (!needle) return true;
      const name  = String(c.name || '').toLowerCase();
      const uid   = String(c.user_id || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      return name.includes(needle) || uid.includes(needle) || phone.includes(needle);
    });
  }, [items, chan, q]);

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const pageSafe = Math.min(page, lastPage);

  const startIdx = (pageSafe - 1) * perPage;
  const endIdx   = startIdx + perPage;
  const pageRows = filtered.slice(startIdx, endIdx);

  const gotoFirst = () => setPage(1);
  const gotoPrev  = () => setPage(p => Math.max(1, p - 1));
  const gotoNext  = () => setPage(p => Math.min(lastPage, p + 1));
  const gotoLast  = () => setPage(lastPage);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><UsersIcon size={22} /> Clientes</h1>
          <p className={styles.subtitle}>Listagem de clientes com paginação.</p>

          {error && (
            <div className={styles.alertErr} role="alert">
              <span>⚠️</span>
              <span>{error}</span>
              <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar">
                <XIcon size={14}/>
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome, telefone ou user_id…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <button className={styles.btn} onClick={load}><RefreshCw size={16}/> Atualizar</button>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          {/* Filtro por canal (chips) */}
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por canal">
            {CHANNELS.map(c => (
              <button
                key={c.key || 'all'}
                role="tab"
                aria-selected={chan === c.key}
                className={`${styles.tab} ${chan === c.key ? styles.tabActive : ''}`}
                onClick={() => { setChan(c.key); setPage(1); }}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Busca duplicada no header do card (opcional) */}
          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, telefone ou user_id…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button className={styles.searchClear} onClick={() => setQ('')} aria-label="Limpar busca">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>User ID</th>
                <th>Telefone</th>
                <th>Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={4} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && pageRows.map(c => (
                <tr
                  key={c.id || c.user_id}
                  className={styles.rowHover}
                  onClick={() => setSelected(c)}
                  style={{ cursor: 'pointer' }}
                  title="Clique para ver detalhes"
                >
                  <td data-label="Nome">{c.name || '—'}</td>
                  <td data-label="User ID">{c.user_id || '—'}</td>
                  <td data-label="Telefone">
                    {phoneForDisplay(c.channel, c.phone)}
                  </td>
                  <td data-label="Canal">{prettyChannel(c.channel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rodapé: paginação */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px' }}>
          <span className={styles.muted}>
            Mostrando {total === 0 ? 0 : startIdx + 1}–{Math.min(endIdx, total)} de {total}
          </span>

          <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap:8 }}>
            <select
              className={styles.selectInline}
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            >
              {[10,20,30,40].map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>

            <button className={styles.btn} onClick={gotoFirst} disabled={pageSafe === 1}>« Primeiro</button>
            <button className={styles.btn} onClick={gotoPrev}  disabled={pageSafe === 1}>Anterior</button>
            <span className={styles.muted}>Página {pageSafe} de {lastPage}</span>
            <button className={styles.btn} onClick={gotoNext}  disabled={pageSafe === lastPage}>Próxima</button>
            <button className={styles.btn} onClick={gotoLast}  disabled={pageSafe === lastPage}>Última »</button>
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      {selected && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Detalhes do cliente" onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Cliente</h3>
              <button className={styles.btn} onClick={() => setSelected(null)} aria-label="Fechar">
                <XIcon size={16}/>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <span className={styles.label}>Nome</span>
                  <div>{selected.name || '—'}</div>
                </div>
                <div className={styles.inputGroup}>
                  <span className={styles.label}>User ID</span>
                  <div>{selected.user_id || '—'}</div>
                </div>
                <div className={styles.inputGroup}>
                  <span className={styles.label}>Telefone</span>
                  <div>{phoneForDisplay(selected.channel, selected.phone)}</div>
                </div>
                <div className={styles.inputGroup}>
                  <span className={styles.label}>Canal</span>
                  <div>{prettyChannel(selected.channel)}</div>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btn} onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
