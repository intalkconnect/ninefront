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

// split + slugify
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

/* ===== cores ===== */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
function randomPastel() {
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 10);   // 55–64
  const l = 78 + Math.floor(Math.random() * 8);    // 78–85
  return hslToHex(h, s, l);
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function colorStyles(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return {};
  const bg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`;
  const bd = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`;
  return { background: bg, borderColor: bd, color: '#0f172a' };
}
// cor determinística (fallback) baseada no nome
function hashColorFromTag(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) { h = (h * 31 + tag.charCodeAt(i)) >>> 0; }
  const hue = h % 360;
  return hslToHex(hue, 58, 82);
}

/** Input de criação com chips internos coloridos (catálogo) e X para excluir */
function ChipsCreateInput({
  placeholder = 'ex.: vip, reclamacao, atraso',
  onCreate,
  onDeleteTag,
  busy,
  tags = [], // [{tag, color}]
}) {
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
    if (e.key === 'Backspace' && !text && tags.length) {
      onDeleteTag && onDeleteTag(tags[tags.length - 1].tag);
    }
  };

  const onPaste = async (e) => {
    const txt = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    if (/[,\u003B\u061B\uFF1B]/.test(txt)) { e.preventDefault(); await commit(txt); }
  };

  return (
    <div
      className={styles.tagsField}
      onClick={(e)=>e.currentTarget.querySelector('input')?.focus()}
      aria-label="Criar etiquetas do catálogo"
    >
      {tags.map(({ tag, color }) => (
        <span key={tag} className={styles.tagChip} style={colorStyles(color || hashColorFromTag(tag))}>
          <span className={styles.tagText}>{tag}</span>
          <button
            type="button"
            className={styles.tagChipX}
            onClick={() => onDeleteTag && onDeleteTag(tag)}
            aria-label={`Excluir ${tag}`}
            disabled={busy}
          >
            ×
          </button>
        </span>
      ))}

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

  // catálogo global [{tag, color}]
  const [catalog, setCatalog] = useState([]);
  const [catalogBusy, setCatalogBusy] = useState(false);

  // filtro por tag (strings)
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
      // aceita tanto [{tag, color}] quanto [string]
      const raw = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.tags) ? r.tags : []);
      const list = raw.map(it => {
        if (typeof it === 'string') return { tag: it, color: hashColorFromTag(it) };
        const tag = String(it?.tag || '').trim();
        const color = (it?.color && String(it.color).trim()) || '';
        return { tag, color: color || hashColorFromTag(tag) };
      }).filter(x => x.tag);
      // remove duplicados por tag
      const dedup = Array.from(new Map(list.map(x => [x.tag, x])).values())
        .sort((a,b) => a.tag.localeCompare(b.tag));
      setCatalog(dedup);
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
      await Promise.all(
        uniq.map(tag =>
          apiPost('/tags/customer/catalog', { tag, color: randomPastel(), active: true })
        )
      );
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

  /* ========= filtros / busca ========= */
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    await load({ page: 1, q });
  };

  // mapa tag -> color para pintar na tabela
  const colorMap = useMemo(() => {
    const m = new Map();
    catalog.forEach(({ tag, color }) => { m.set(tag, color || hashColorFromTag(tag)); });
    return m;
  }, [catalog]);

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
        {/* ===== Criação (chips coloridos dentro do input) ===== */}
        <section className={styles.cardHead}>
          <div className={styles.groupColumn}>
            <div className={styles.groupRow}>
              <label className={styles.label}>Criar etiquetas (globais)</label>
              <ChipsCreateInput
                onCreate={createTags}
                onDeleteTag={deleteCatalogTag}
                busy={catalogBusy}
                tags={catalog}
                placeholder="Digite e pressione Enter (pode colar várias separadas por vírgula)"
              />
              <div className={styles.hint}>As etiquetas criadas aqui ficam disponíveis para todos os clientes.</div>
            </div>
          </div>
        </section>

        {/* ===== Filtro + Busca ===== */}
        <section className={styles.filtersBar}>
          <div className={styles.filtersHead}>
            <div className={styles.filtersTitle}>Filtrar por etiquetas</div>
          </div>

          <div className={styles.tagsFilterWrap}>
            {catalog.length === 0 && <div className={styles.empty}>Nenhuma etiqueta cadastrada.</div>}
            {catalog.map(({ tag }) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  className={`${styles.tagToggle} ${active ? styles.tagToggleOn : ''}`}
                  onClick={() =>
                    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {selectedTags.length > 0 && (
            <div className={styles.filterSelectedRow}>
              {selectedTags.map(t => (
                <span key={t} className={styles.tagChip}>
                  <span className={styles.tagText}>{t}</span>
                  <button
                    className={styles.tagChipX}
                    onClick={()=> setSelectedTags(prev => prev.filter(x => x !== t))}
                    aria-label={`Remover ${t}`}
                  >×</button>
                </span>
              ))}
              <button type="button" className={styles.btn} onClick={()=> setSelectedTags([])}>Limpar filtro</button>
            </div>
          )}

          {/* BUSCA */}
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
                            {userTags.map(t => {
                              const c = colorMap.get(t) || hashColorFromTag(t);
                              return (
                                <span key={t} className={styles.tagExisting} style={colorStyles(c)}>
                                  {t}
                                </span>
                              );
                            })}
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
                              {/* Sem repetir etiquetas dentro do detalhe */}
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
