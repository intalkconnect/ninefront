import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronRight, RefreshCw, X as XIcon } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

/* ================== helpers ================== */
const PAGE_SIZES = [10, 20, 30, 40];

// ícones de canal (inline SVG, leves e sem dependência externa)
function ChannelIcon({ channel, className }) {
  const c = String(channel || '').toLowerCase();
  if (c === 'whatsapp') {
    return (
      <svg viewBox="0 0 256 256" className={className} aria-label="WhatsApp">
        <path d="M128 20a108 108 0 0 0-93.3 162.7L24 236l54-10.7A108 108 0 1 0 128 20Z" fill="currentColor"/>
        <path d="M190.7 149.3c-2.2 6.2-10.8 11.4-17.4 12.9-4.6 1-10.6 1.8-33.2-6.9-27.9-11-46-39-47.4-40.8-1.4-1.9-11.3-15-11.3-28.6s7.2-20.5 10-23.4c2.6-2.9 6.9-4.2 11.1-4.2 1.4 0 2.6 0.1 3.7 0.1 3.2 0.1 4.9 0.3 7 5.4 2.2 5.4 7.5 18.8 8.2 20.2 0.6 1.4 1.1 3.2 0.2 5-0.8 1.7-1.3 2.7-2.6 4.3s-2.7 3-4.1 4.8c-1.3 1.7-2.7 3.6-1.2 6.4 1.4 2.9 6 9.8 12.9 16 8.9 7.9 16.4 10.4 19.3 11.6 2.9 1.1 4.7 0.9 6.5-0.6 2.1-1.5 4.4-5.7 7-9.1 1.8-2.4 4-2.8 6.4-1.9 2.4 0.8 15.1 7.1 17.7 8.4 2.6 1.3 4.3 1.9 4.9 3C192.9 139.5 192.9 143.1 190.7 149.3z" fill="#fff"/>
      </svg>
    );
  }
  if (c === 'telegram') {
    return (
      <svg viewBox="0 0 256 256" className={className} aria-label="Telegram">
        <path d="M128 16a112 112 0 1 0 0 224 112 112 0 0 0 0-224Z" fill="currentColor"/>
        <path d="M194 77 53 126c-6 2-6 10-1 12l33 10 14 44c2 6 10 6 12 1l19-30 39 29c5 3 11 1 12-5l20-99c1-7-5-12-11-10Z" fill="#fff"/>
      </svg>
    );
  }
  if (c === 'instagram') {
    return (
      <svg viewBox="0 0 256 256" className={className} aria-label="Instagram">
        <rect x="36" y="36" width="184" height="184" rx="48" fill="currentColor"/>
        <circle cx="128" cy="128" r="46" fill="#fff"/>
        <circle cx="182" cy="74" r="10" fill="#fff"/>
      </svg>
    );
  }
  if (c === 'facebook') {
    return (
      <svg viewBox="0 0 256 256" className={className} aria-label="Facebook">
        <path d="M128 16a112 112 0 1 0 0 224 112 112 0 0 0 0-224Z" fill="currentColor"/>
        <path d="M138 216v-76h25l4-30h-29v-19c0-9 3-15 15-15h15V49c-3 0-14-1-26-1-26 0-44 16-44 45v17H78v30h20v76h40z" fill="#fff"/>
      </svg>
    );
  }
  // fallback: bolha genérica
  return <div className={className} aria-hidden="true" />;
}

// quebra por vírgula/; , normaliza e slugifica
function splitTokens(raw) {
  return String(raw || '')
    .split(/[,\u003B\u061B\uFF1B]/)
    .map(s => s.trim())
    .map(s => s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,'-')
      .replace(/[^a-z0-9-_]/g,'')
      .replace(/-+/g,'-')
      .replace(/^[-_]+|[-_]+$/g,'')
    )
    .filter(Boolean);
}

/** Input simples: cria etiquetas do catálogo ao Enter/virgula/colar (sem toast) */
function ChipsCreateInput({ placeholder = 'ex.: vip, reclamacao, atraso', onCreate, busy }) {
  const [text, setText] = useState('');

  const commit = async (raw) => {
    const tokens = splitTokens(raw);
    if (!tokens.length) return;
    setText('');
    await onCreate(tokens);
  };

  const onKeyDown = async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) await commit(text);
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
    <div className={styles.tagsField} onClick={(e)=>e.currentTarget.querySelector('input')?.focus()}>
      <input
        className={styles.tagsInput}
        value={text}
        onChange={(e)=> setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={busy}
      />
    </div>
  );
}

export default function Clientes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openRow, setOpenRow] = useState(null); // user_id aberto

  // ===== catálogo global de tags de cliente =====
  const [catalog, setCatalog] = useState([]);        // array de strings
  const [catalogBusy, setCatalogBusy] = useState(false);

  // ===== filtro por tag =====
  const [selectedTags, setSelectedTags] = useState([]); // tags usadas no filtro

  // ===== tags por cliente =====
  const [tagsByUser, setTagsByUser] = useState({});     // { [user_id]: string[] }
  const [tagsLoaded, setTagsLoaded] = useState({});     // { [user_id]: bool }

  /* ========= carregar clientes ========= */
  const load = useCallback(async (opts = {}) => {
    const nextPage     = opts.page ?? page;
    const nextPageSize = opts.pageSize ?? pageSize;
    const nextQ        = opts.q ?? q;

    setLoading(true);
    try {
      const resp = await apiGet('/customers', {
        params: { q: nextQ, page: nextPage, page_size: nextPageSize }
      });
      const data = Array.isArray(resp?.data) ? resp.data : resp?.data ?? [];
      setItems(data);
      setPage(resp?.page || nextPage);
      setPageSize(resp?.page_size || nextPageSize);
      const totalFound = Number(resp?.total || data.length || 0);
      setTotal(totalFound);

      // baixa tags dos clientes visíveis em pequenos lotes
      const chunk = async (arr, size) => {
        for (let i = 0; i < arr.length; i += size) {
          const slice = arr.slice(i, i + size);
          await Promise.all(slice.map(async (row) => {
            const uid = row.user_id;
            if (!uid || tagsLoaded[uid]) return;
            try {
              const r = await apiGet(`/tags/customer/${encodeURIComponent(uid)}`);
              const list = Array.isArray(r?.tags) ? r.tags : (Array.isArray(r?.data) ? r.data : []);
              const norm = (list || []).map(x => String(x?.tag || x).trim()).filter(Boolean);
              setTagsByUser(m => ({ ...m, [uid]: norm }));
              setTagsLoaded(m => ({ ...m, [uid]: true }));
            } catch {
              setTagsByUser(m => ({ ...m, [uid]: [] }));
              setTagsLoaded(m => ({ ...m, [uid]: true }));
            }
          }));
        }
      };
      await chunk(data, 8);

      return { data, total: totalFound };
    } catch {
      setItems([]); setTotal(0);
      return { data: [], total: 0 };
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, tagsLoaded]);

  useEffect(() => { load(); }, []); // primeira carga

  /* ========= catálogo global ========= */
  const loadCatalog = useCallback(async () => {
    try {
      setCatalogBusy(true);
      const r = await apiGet('/tags/customer/catalog?active=true&page_size=200');
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.tags) ? r.tags : []);
      const names = list.map(t => String(t?.tag || t).trim()).filter(Boolean);
      setCatalog([...new Set(names)].sort());
    } catch {
      setCatalog([]);
    } finally {
      setCatalogBusy(false);
    }
  }, []);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const createTags = async (tokens) => {
    if (!tokens?.length) return;
    try {
      setCatalogBusy(true);
      const uniq = [...new Set(tokens)];
      await Promise.all(uniq.map(tag => apiPost('/tags/customer/catalog', { tag, active: true })));
      await loadCatalog(); // silencioso, sem toast
    } catch {
      // silencioso
    } finally {
      setCatalogBusy(false);
    }
  };

  const deleteCatalogTag = async (tag) => {
    if (!tag) return;
    const ok = window.confirm(`Excluir a etiqueta "${tag}" do catálogo global?\nIsso não remove a etiqueta de clientes que já a possuem.`);
    if (!ok) return;
    try {
      setCatalogBusy(true);
      await apiDelete(`/tags/customer/catalog/${encodeURIComponent(tag)}`);
      setSelectedTags(prev => prev.filter(t => t !== tag));
      await loadCatalog(); // silencioso
    } catch {
      // silencioso
    } finally {
      setCatalogBusy(false);
    }
  };

  /* ========= filtros ========= */
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    await load({ page: 1, q });
  };

  const toggleFilterTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const visible = useMemo(() => {
    let data = items;
    if (selectedTags.length > 0) {
      data = data.filter(row => {
        const uid = row.user_id;
        const userTags = tagsByUser[uid] || [];
        return selectedTags.every(t => userTags.includes(t));
      });
    }
    return data;
  }, [items, selectedTags, tagsByUser]);

  /* ========= helpers de UI ========= */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo   = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className={styles.container}>
      {/* Toolbar topo */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={()=> load()} title="Atualizar">
            <RefreshCw size={16}/> Atualizar
          </button>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className={styles.header}>
        <div>
          <p className={styles.subtitle}>Gestão de clientes: crie etiquetas globais, filtre por etiquetas e visualize os detalhes.</p>
        </div>
      </div>

      {/* Card principal */}
      <div className={styles.card}>
        {/* ===== Cabeçalho do card (criação + busca à direita) ===== */}
        <section className={styles.cardHead}>
          {/* criar etiquetas */}
          <div className={styles.groupColumn}>
            <div className={styles.groupRow}>
              <label className={styles.label}>Criar etiquetas (globais)</label>
              <ChipsCreateInput
                onCreate={createTags}
                busy={catalogBusy}
                placeholder="Digite a etiqueta e pressione Enter (pode colar várias separadas por vírgula)"
              />
              <div className={styles.hint}>As etiquetas criadas aqui ficam disponíveis para todos os clientes.</div>
            </div>
          </div>

          {/* busca */}
          <form onSubmit={onSearch} className={styles.searchGroup}>
            <label className={styles.searchLabel}>Buscar</label>
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
        </section>

        {/* ===== Barra de filtros (abaixo do cabeçalho) ===== */}
        <section className={styles.filtersBar}>
          <div className={styles.filtersHead}>
            <span className={styles.filtersTitle}>Filtrar por etiquetas</span>
          </div>
          <div className={styles.tagsFilterWrap}>
            {catalogBusy && catalog.length === 0 && <div className={styles.loading}>Carregando etiquetas…</div>}
            {!catalogBusy && catalog.length === 0 && <div className={styles.empty}>Nenhuma etiqueta cadastrada.</div>}
            {catalog.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <span key={tag} className={styles.tagToggleWrap}>
                  <button
                    type="button"
                    className={`${styles.tagToggle} ${active ? styles.tagToggleOn : ''}`}
                    onClick={() => toggleFilterTag(tag)}
                    title={active ? 'Remover do filtro' : 'Adicionar ao filtro'}
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    className={styles.tagRemove}
                    aria-label={`Excluir ${tag}`}
                    title={`Excluir ${tag} do catálogo`}
                    onClick={() => deleteCatalogTag(tag)}
                    disabled={catalogBusy}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>

          {selectedTags.length > 0 && (
            <div className={styles.filterSelectedRow}>
              {selectedTags.map(t => (
                <span key={t} className={styles.tagChip}>
                  <span className={styles.tagText}>{t}</span>
                  <button className={styles.tagChipX} onClick={()=> toggleFilterTag(t)} aria-label={`Remover ${t}`}>×</button>
                </span>
              ))}
              <button type="button" className={styles.btn} onClick={()=> setSelectedTags([])}>Limpar filtro</button>
            </div>
          )}
        </section>

        {/* ===== Tabela ===== */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.colNome}/>
              <col className={styles.colTags}/>
              <col className={styles.colCanal}/>
            </colgroup>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Etiquetas</th>
                <th>Canal</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className={styles.loading}>Carregando…</td></tr>
              )}

              {!loading && visible.length === 0 && (
                <tr><td colSpan={3} className={styles.empty}>Nenhum cliente encontrado.</td></tr>
              )}

              {!loading && visible.map((row) => {
                const uid = row.user_id;
                const isOpen = openRow === uid;
                const userTags = tagsByUser[uid];
                const tagsPending = !tagsLoaded[uid];

                return (
                  <React.Fragment key={uid}>
                    {/* summary (3 colunas) */}
                    <tr
                      className={`${styles.rowHover} ${styles.accRow}`}
                      onClick={() => setOpenRow(isOpen ? null : uid)}
                    >
                      <td className={styles.summaryCell}>
                        <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}>
                          <ChevronRight size={16}/>
                        </span>
                        <span className={styles.nameText}>{row.name || '—'}</span>
                      </td>

                      {/* Etiquetas (coluna do meio) */}
                      <td className={styles.tagsCell}>
                        {tagsPending ? (
                          <span className={styles.muted}>—</span>
                        ) : (userTags && userTags.length > 0) ? (
                          <div className={styles.tagsRowWrap}>
                            {userTags.map(t => (
                              <span key={t} className={styles.tagExisting}>{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>

                      {/* Canal com ícone */}
                      <td className={styles.summaryRight}>
                        <span
                          className={`${styles.chanBubble} ${styles[`chan-${String(row.channel || '').toLowerCase()}`]}`}
                          title={String(row.channel || '').charAt(0).toUpperCase() + String(row.channel || '').slice(1)}
                        >
                          <ChannelIcon channel={row.channel} className={styles.chanIcon} />
                        </span>
                      </td>
                    </tr>

                    {/* details */}
                    {isOpen && (
                      <tr className={styles.rowDetails}>
                        <td colSpan={3}>
                          <div className={styles.detailsBox}>
                            <div className={styles.detailsGrid}>
                              <div className={styles.item}>
                                <div className={styles.k}>User ID</div>
                                <div className={styles.v}>{row.user_id || '—'}</div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Telefone</div>
                                <div className={styles.v}>
                                  {String(row.channel || '').toLowerCase() === 'whatsapp' ? (row.phone || '—') : '—'}
                                </div>
                              </div>
                              <div className={styles.item}>
                                <div className={styles.k}>Canal</div>
                                <div className={styles.v}>
                                  <span
                                    className={`${styles.chanBubble} ${styles[`chan-${String(row.channel || '').toLowerCase()}`]}`}
                                  >
                                    <ChannelIcon channel={row.channel} className={styles.chanIcon}/>
                                  </span>
                                </div>
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

                              {/* removido: exibição interna de etiquetas (você pediu para manter só fora) */}
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

        {/* Footer paginador */}
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
