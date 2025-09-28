import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronRight, RefreshCw, X as XIcon } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

/* ================== helpers ================== */
function labelChannel(c) {
  const m = { whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook' };
  return m[(c || '').toLowerCase()] || '—';
}
const PAGE_SIZES = [10, 20, 30, 40];

/* hash → cor pastel estável por tag */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function tagVars(tag) {
  const hue = hash32(String(tag)) % 360;
  const s = 72;   // saturação
  const l = 92;   // luminosidade (bg)
  return {
    '--tag-bg': `hsl(${hue} ${s}% ${l}%)`,
    '--tag-border': `hsl(${hue} ${s}% ${l - 10}%)`,
    '--tag-fg': `hsl(${hue} 32% 22%)`,
  };
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

/** Input: cria etiquetas do catálogo ao Enter/virgula/colar (sem botão, sem toast) */
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
    if (/[,\u003B\u061B\uFF1B]/.test(txt)) { e.preventDefault(); await commit(txt); }
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
  const [openRow, setOpenRow] = useState(null);

  // catálogo global de tags
  const [catalog, setCatalog] = useState([]);        // strings
  const [catalogBusy, setCatalogBusy] = useState(false);

  // filtro por tag
  const [selectedTags, setSelectedTags] = useState([]);

  // tags por cliente
  const [tagsByUser, setTagsByUser] = useState({});  // { [user_id]: string[] }
  const [tagsLoaded, setTagsLoaded] = useState({});  // { [user_id]: bool }

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
      await loadCatalog();
    } finally { setCatalogBusy(false); }
  };

  const deleteCatalogTag = async (tag) => {
    if (!tag) return;
    const ok = window.confirm(`Excluir a etiqueta "${tag}" do catálogo global?\nIsso não remove a etiqueta de clientes que já a possuem.`);
    if (!ok) return;
    try {
      setCatalogBusy(true);
      await apiDelete(`/tags/customer/catalog/${encodeURIComponent(tag)}`);
      setSelectedTags(prev => prev.filter(t => t !== tag));
      await loadCatalog();
    } finally { setCatalogBusy(false); }
  };

  /* ========= filtros ========= */
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    await load({ page: 1, q });
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
          <p className={styles.subtitle}>
            Gestão de clientes: crie etiquetas globais, filtre por etiquetas e visualize os detalhes.
          </p>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* ===== Criação de etiquetas (topo do card) ===== */}
        <section className={styles.cardHead}>
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
        </section>

        {/* ===== Filtros + BUSCA (logo abaixo do cabeçalho) ===== */}
        <section className={styles.filtersBar}>
          <div className={styles.filtersHead}>
            <div className={styles.filtersTitle}>Filtrar por etiquetas</div>
          </div>

          <div className={styles.tagsFilterWrap}>
            {catalogBusy && catalog.length === 0 && <div className={styles.loading}>Carregando etiquetas…</div>}
            {!catalogBusy && catalog.length === 0 && <div className={styles.empty}>Nenhuma etiqueta cadastrada.</div>}
            {catalog.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <span key={tag} className={styles.tagToggleWrap} style={tagVars(tag)}>
                  <button
                    type="button"
                    className={`${styles.tagToggle} ${styles.tagDynamic} ${active ? styles.tagToggleOn : ''}`}
                    onClick={() =>
                      setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
                    }
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

          {/* chips do filtro selecionado */}
          {selectedTags.length > 0 && (
            <div className={styles.filterSelectedRow}>
              {selectedTags.map(t => (
                <span key={t} className={`${styles.tagChip} ${styles.tagDynamic}`} style={tagVars(t)}>
                  <span className={styles.tagText}>{t}</span>
                  <button className={styles.tagChipX} onClick={() =>
                    setSelectedTags(prev => prev.filter(x => x !== t))
                  } aria-label={`Remover ${t}`}>×</button>
                </span>
              ))}
              <button type="button" className={styles.btn} onClick={()=> setSelectedTags([])}>Limpar filtro</button>
            </div>
          )}

          {/* BUSCA — sob o filtro */}
          <form onSubmit={onSearch} className={styles.searchGroupInline}>
            <label className={styles.searchLabel}>Buscar</label>
            <div className={styles.searchBox}>
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
            </div>
          </form>
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
              {loading && <tr><td colSpan={3} className={styles.loading}>Carregando…</td></tr>}
              {!loading && visible.length === 0 && <tr><td colSpan={3} className={styles.empty}>Nenhum cliente encontrado.</td></tr>}

              {!loading && visible.map((row) => {
                const uid = row.user_id;
                const isOpen = openRow === uid;
                const userTags = tagsByUser[uid];
                const tagsPending = !tagsLoaded[uid];

                return (
                  <React.Fragment key={uid}>
                    <tr className={`${styles.rowHover} ${styles.accRow}`} onClick={() => setOpenRow(isOpen ? null : uid)}>
                      <td className={styles.summaryCell}>
                        <span className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}><ChevronRight size={16}/></span>
                        <span className={styles.nameText}>{row.name || '—'}</span>
                      </td>

                      <td className={styles.tagsCell}>
                        {tagsPending ? (
                          <span className={styles.muted}>—</span>
                        ) : (userTags && userTags.length > 0) ? (
                          <div className={styles.tagsRowWrap}>
                            {userTags.map(t => (
                              <span key={t} className={`${styles.tagExisting} ${styles.tagDynamic}`} style={tagVars(t)}>{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>

                      <td className={styles.summaryRight}>
                        <span
                          className={styles.chip}
                          data-channel={String(row.channel || '').toLowerCase()}
                          title={labelChannel(row.channel)}
                        >
                          {/* aqui você pode trocar por SVGs dos canais se quiser */}
                          {labelChannel(row.channel)}
                        </span>
                      </td>
                    </tr>

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
                              {/* Removido bloco de etiquetas aqui para evitar duplicidade, conforme solicitado */}
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
