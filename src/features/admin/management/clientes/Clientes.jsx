import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Users as UsersIcon, ChevronRight, RefreshCw, X as XIcon } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/Clientes.module.css';

const CHANNELS = [
  { key: '',          label: 'Todos' },
  { key: 'whatsapp',  label: 'WhatsApp' },
  { key: 'telegram',  label: 'Telegram' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook',  label: 'Facebook' },
];
const PAGE_SIZES = [10, 20, 30, 40];

function labelChannel(c) {
  const m = { whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook' };
  return m[(c || '').toLowerCase()] || '—';
}

/** util de tokens a partir do texto colado/digitado */
function splitTokens(raw) {
  return String(raw || '')
    .split(/[,\u003B\u061B\uFF1B]/)          // vírgula e ; (ponto e vírgula) comuns/latinos
    .map(s => s.trim())
    .map(s => s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // sem acento
      .replace(/\s+/g,'-')                             // espaços -> hífen
      .replace(/[^a-z0-9-_]/g,'')                      // seguro para URL/PK
      .replace(/-+/g,'-')
      .replace(/^[-_]+|[-_]+$/g,'')
    )
    .filter(Boolean);
}

/** Campo com chips (cria ao pressionar Enter/ ,) */
function ChipsInput({ value, onAdd, onRemove, placeholder = 'ex.: vip, reclamacao, atraso', busy = false }) {
  const [text, setText] = useState('');

  const commit = async (raw) => {
    const tokens = splitTokens(raw);
    if (!tokens.length) return;
    setText('');
    await onAdd(tokens);
  };

  const onKeyDown = async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) await commit(text);
    }
    if (e.key === 'Backspace' && !text && value.length) {
      // remove último chip
      await onRemove(value[value.length - 1]);
    }
  };

  const onPaste = async (e) => {
    const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (/[,\u003B\u061B\uFF1B]/.test(txt)) {
      e.preventDefault();
      await commit(txt);
    }
  };

  return (
    <div className={`${styles.tagsField} ${busy ? styles.tagsBusy : ''}`}>
      {value.map(tag => (
        <span key={tag} className={styles.tagChip} title={tag}>
          <span className={styles.tagText}>{tag}</span>
          <button
            type="button"
            className={styles.tagChipX}
            onClick={() => onRemove(tag)}
            aria-label={`Remover ${tag}`}
            disabled={busy}
          >×</button>
        </span>
      ))}
      <input
        className={styles.tagsInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={value.length ? '' : placeholder}
        disabled={busy}
      />
    </div>
  );
}

export default function Clientes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // estado de tags por cliente
  const [tagsByUser, setTagsByUser] = useState({});      // { [user_id]: string[] }
  const [tagsBusy, setTagsBusy]   = useState({});         // { [user_id]: boolean }
  const [tagsLoaded, setTagsLoaded] = useState({});       // { [user_id]: boolean }

  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openRow, setOpenRow] = useState(null); // user_id aberto

  const load = useCallback(async (opts = {}) => {
    const nextPage     = opts.page ?? page;
    const nextPageSize = opts.pageSize ?? pageSize;
    const nextQ        = opts.q ?? q;

    setLoading(true);
    try {
      const resp = await apiGet('/customers', { params: { q: nextQ, page: nextPage, page_size: nextPageSize } });
      const data = Array.isArray(resp?.data) ? resp.data : resp?.data ?? [];
      setItems(data);
      setPage(resp?.page || nextPage);
      setPageSize(resp?.page_size || nextPageSize);
      const totalFound = Number(resp?.total || data.length || 0);
      setTotal(totalFound);
      return { data, total: totalFound };
    } catch (e) {
      toast.error('Falha ao carregar clientes.');
      setItems([]); setTotal(0);
      return { data: [], total: 0 };
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q]);

  useEffect(() => { load(); }, []); // primeira carga

  // filtro por canal (client-side)
  const visible = useMemo(() => {
    const c = (channel || '').toLowerCase();
    return c ? items.filter(it => String(it.channel || '').toLowerCase() === c) : items;
  }, [items, channel]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo   = total === 0 ? 0 : Math.min(page * pageSize, total);

  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    const res = await load({ page: 1, q });
    if (res?.total === 0) toast.info('Nenhum cliente encontrado para a busca.');
  };

  const phoneFor = (row) => {
    const ch = String(row?.channel || '').toLowerCase();
    if (ch !== 'whatsapp') return '—';
    const p = (row?.phone || '').trim();
    return p || '—';
  };

  /** ======= TAGS: API helpers ======= */
  const ensureTagsLoaded = useCallback(async (userId) => {
    if (tagsLoaded[userId]) return;
    try {
      setTagsBusy(b => ({ ...b, [userId]: true }));
      // Ajuste a URL abaixo caso seu backend seja diferente
      const r = await apiGet(`/tags/customer/${encodeURIComponent(userId)}`);
      const list = Array.isArray(r?.tags) ? r.tags : (Array.isArray(r?.data) ? r.data : []);
      setTagsByUser(m => ({ ...m, [userId]: (list || []).map(t => String(t.tag || t).trim()).filter(Boolean) }));
      setTagsLoaded(m => ({ ...m, [userId]: true }));
    } catch (e) {
      setTagsByUser(m => ({ ...m, [userId]: [] }));
      setTagsLoaded(m => ({ ...m, [userId]: true }));
    } finally {
      setTagsBusy(b => ({ ...b, [userId]: false }));
    }
  }, [tagsLoaded]);

  const addTags = async (userId, newTokens) => {
    const tokens = splitTokens(newTokens.join(','));
    if (!tokens.length) return;
    try {
      setTagsBusy(b => ({ ...b, [userId]: true }));
      await apiPost(`/tags/customer/${encodeURIComponent(userId)}`, { tags: tokens });
      setTagsByUser(m => {
        const cur = new Set(m[userId] || []);
        tokens.forEach(t => cur.add(t));
        return { ...m, [userId]: Array.from(cur).sort() };
      });
      toast.success(tokens.length === 1 ? 'Etiqueta adicionada.' : `${tokens.length} etiquetas adicionadas.`);
    } catch {
      toast.error('Não foi possível adicionar as etiquetas.');
    } finally {
      setTagsBusy(b => ({ ...b, [userId]: false }));
    }
  };

  const removeTag = async (userId, tag) => {
    try {
      setTagsBusy(b => ({ ...b, [userId]: true }));
      await apiDelete(`/tags/customer/${encodeURIComponent(userId)}/${encodeURIComponent(tag)}`);
      setTagsByUser(m => ({ ...m, [userId]: (m[userId] || []).filter(t => t !== tag) }));
    } catch {
      toast.error('Não foi possível remover a etiqueta.');
    } finally {
      setTagsBusy(b => ({ ...b, [userId]: false }));
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={()=> load()} title="Atualizar">
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </div>

      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de clientes: veja cadastro, segmento e última atividade.</p>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* filtros + busca */}
        <div className={styles.cardHead}>
          <form onSubmit={onSearch} className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome, telefone ou user_id…"
              value={q}
              onChange={(e)=> setQ(e.target.value)}
            />
            {q && (
              <button type="button" className={styles.searchClear} onClick={()=> setQ('')} aria-label="Limpar">
                <XIcon size={14}/>
              </button>
            )}
          </form>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colNome}/>
              <col className={styles.colCanal}/>
            </colgroup>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={2} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && visible.length === 0 && (
                <tr><td colSpan={2} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && visible.map((row) => {
                const uid = row.user_id;
                const isOpen = openRow === uid;
                return (
                  <React.Fragment key={uid}>
                    {/* summary row */}
                    <tr
                      className={`${styles.rowHover} ${styles.accRow}`}
                      onClick={async () => {
                        const willOpen = !isOpen;
                        setOpenRow(willOpen ? uid : null);
                        if (willOpen) await ensureTagsLoaded(uid);
                      }}
                    >
                      <td className={styles.summaryCell}>
                        <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}>
                          <ChevronRight size={16}/>
                        </span>
                        <span className={styles.nameText}>{row.name || '—'}</span>
                      </td>
                      <td className={styles.summaryRight}>
                        <span className={styles.chip}>{labelChannel(row.channel)}</span>
                      </td>
                    </tr>

                    {/* details row */}
                    {isOpen && (
                      <tr className={styles.rowDetails}>
                        <td colSpan={2}>
                          <div className={styles.detailsBox}>
                            <div className={styles.detailsGrid}>
                              <div className={styles.item}>
                                <div className={styles.k}>User ID</div>
                                <div className={styles.v}>{row.user_id || '—'}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Telefone</div>
                                <div className={styles.v}>{phoneFor(row)}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Canal</div>
                                <div className={styles.v}>{labelChannel(row.channel)}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Atualizado em</div>
                                <div className={styles.v}>
                                  {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
                                </div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Criado em</div>
                                <div className={styles.v}>
                                  {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                                </div>
                              </div>

                              {/* ======= TAGS DO CLIENTE ======= */}
                              <div className={styles.itemFull}>
                                <div className={styles.k}>Etiquetas</div>
                                <div className={styles.v}>
                                  <ChipsInput
                                    value={tagsByUser[uid] || []}
                                    onAdd={(tokens) => addTags(uid, tokens)}
                                    onRemove={(tag) => removeTag(uid, tag)}
                                    busy={!!tagsBusy[uid]}
                                    placeholder="ex.: vip, reclamacao, atraso"
                                  />
                                  <div className={styles.tagsHint}>Pressione <b>Enter</b> (ou vírgula) para criar. Clique no <b>×</b> para remover.</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* footer paginador */}
        <div className={styles.tableFooter}>
          <div className={styles.leftInfo}>
            Mostrando {showingFrom}–{showingTo} de {total}
          </div>

          <div className={styles.pager}>
            <select
              className={styles.pageSize}
              value={pageSize}
              onChange={async (e) => { 
                const ps = Number(e.target.value);
                setPageSize(ps); setPage(1);
                await load({ page: 1, pageSize: ps });
              }}
            >
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n} por página</option>)}
            </select>

            <button className={styles.pBtn} disabled={page <= 1} onClick={()=> load({ page: 1 })}>« Primeiro</button>
            <button className={styles.pBtn} disabled={page <= 1} onClick={()=> load({ page: page - 1 })}>Anterior</button>
            <span className={styles.pInfo}>Página {page} de {totalPages}</span>
            <button className={styles.pBtn} disabled={page >= totalPages} onClick={()=> load({ page: page + 1 })}>Próxima</button>
            <button className={styles.pBtn} disabled={page >= totalPages} onClick={()=> load({ page: totalPages })}>Última »</button>
          </div>
        </div>
      </div>
    </div>
  );
}
