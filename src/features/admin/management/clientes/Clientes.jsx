import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronRight, RefreshCw, X as XIcon } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

/* ================== helpers ================== */
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

/* ===== cores claras (não pastéis) ===== */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function contrastText(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#111827';
  const toLin = v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055)/1.055, 2.4);
  };
  const L = 0.2126*toLin(rgb.r) + 0.7152*toLin(rgb.g) + 0.0722*toLin(rgb.b);
  return L > 0.6 ? '#111827' : '#FFFFFF';
}
const HARMONIC_HUES = [285, 255, 225, 200, 170, 140, 100, 60, 30, 10, 350];
// cores claras, mas vivas (não lavadas)
function solidColorFromTag(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = HARMONIC_HUES[h % HARMONIC_HUES.length];
  const hex = hslToHex(hue, 62, 56); // S 62 / L 56 → claro, porém com presença
  return hex;
}
function chipStylesSolid(hex) {
  const text = contrastText(hex);
  return { background: hex, color: text, borderColor: hex };
}
// pílula “soft” do input (mais evidente que pastel)
function chipStylesSoft(hex) {
  const rgb = hexToRgb(hex) || { r: 59, g: 130, b: 246 };
  const { r, g, b } = rgb;
  return {
    background: `rgba(${r},${g},${b},0.22)`,
    color: `rgb(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*0.7)})`,
    border: `1px solid rgba(${r},${g},${b},0.55)`
  };
}
function chipCloseStyles(hex) {
  const rgb = hexToRgb(hex) || { r: 59, g: 130, b: 246 };
  const { r, g, b } = rgb;
  return {
    background: `rgb(255 255 255 / 95%)`,
    border: `1px solid rgba(${r},${g},${b},0.6)`,
    color: `rgb(${r},${g},${b})`
  };
}

/* ===== ícones de canal ===== */
const IconWA = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="#25D366" d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.2-1.62A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.22-3.48-8.52z"/>
    <path fill="#fff" d="M18.41 14.23c-.25.7-1.23 1.29-2.02 1.47-.54.13-1.24.24-3.58-.74-3.01-1.25-4.95-4.34-5.1-4.55-.15-.22-1.22-1.62-1.22-3.09 0-1.47.77-2.19 1.05-2.49.27-.3.58-.37.78-.37h.56c.18 0 .43.06.66.51.25.5.8 1.73.87 1.86.07.14.12.3.02.48-.1.19-.15.3-.3.47-.14.17-.3.38-.42.51-.14.14-.29.3-.13.58.15.29.65 1.08 1.4 1.75.97.86 1.79 1.13 2.06 1.25.27.12.43.1.6-.06.19-.2.43-.52.68-.84.17-.23.39-.26.62-.18.24.08 1.5.71 1.76.84.26.13.43.19.5.3.06.11.06.67-.19 1.37z"/>
  </svg>
);
const IconTG = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="#229ED9" d="M9.999 15.2 9.9 20c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.8c.7.4 1.2.2 1.4-.6l2.6-12.2c.2-.8-.3-1.2-1-.9L3.8 9.4c-.8.3-.8.7-.1 1l4.7 1.5 10.8-6.7-9.4 10.5z"/>
  </svg>
);
const IconIG = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <radialGradient id="igG" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stopColor="#FFD776"/><stop offset="50%" stopColor="#F56040"/><stop offset="100%" stopColor="#8A3AB9"/>
    </radialGradient>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igG)"/>
    <circle cx="12" cy="12" r="4" fill="#fff"/>
    <circle cx="17" cy="7" r="1.3" fill="#fff"/>
  </svg>
);
const IconFB = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.093 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.793-4.668 4.533-4.668 1.313 0 2.686.235 2.686.235v2.953h-1.514c-1.492 0-1.956.928-1.956 1.88v2.246h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);
function channelIcon(channel) {
  const c = String(channel || '').toLowerCase();
  if (c === 'whatsapp') return <IconWA />;
  if (c === 'telegram') return <IconTG />;
  if (c === 'instagram') return <IconIG />;
  if (c === 'facebook') return <IconFB />;
  return null;
}

/** Input de criação com chips internos (layout da imagem) */
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
      {tags.map(({ tag, color }) => {
        const col = color || solidColorFromTag(tag);
        return (
          <span key={tag} className={`${styles.tagChip} ${styles.tagChipSoft}`} style={chipStylesSoft(col)}>
            <span className={styles.tagText}>{tag}</span>
            <button
              type="button"
              className={`${styles.tagChipX} ${styles.tagChipXSoft}`}
              style={chipCloseStyles(col)}
              onClick={() => onDeleteTag && onDeleteTag(tag)}
              aria-label={`Excluir ${tag}`}
              disabled={busy}
            >
              ×
            </button>
          </span>
        );
      })}

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
  const [tagsByUser, setTagsByUser] = useState({});
  const [tagsLoaded, setTagsLoaded] = useState({});

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

      // baixa tags dos clientes visíveis
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
      const raw = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.tags) ? r.tags : []);
      const list = raw.map(it => {
        if (typeof it === 'string') return { tag: it, color: solidColorFromTag(it) };
        const tag = String(it?.tag || '').trim();
        const color = (it?.color && String(it.color).trim()) || '';
        return { tag, color: color || solidColorFromTag(tag) };
      }).filter(x => x.tag);
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
          apiPost('/tags/customer/catalog', { tag, color: solidColorFromTag(tag), active: true })
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
    catalog.forEach(({ tag, color }) => { m.set(tag, color || solidColorFromTag(tag)); });
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
        {/* ===== Criação ===== */}
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
                              const c = colorMap.get(t) || solidColorFromTag(t);
                              return (
                                <span key={t} className={styles.tagExisting} style={chipStylesSolid(c)}>
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
                        <span className={styles.chanIcon} title={String(row.channel || '')} aria-label={String(row.channel || '')}>
                          {channelIcon(row.channel)}
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
                                <div className={styles.v}>{String(row.channel || '') || '—'}</div>
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
                              {/* sem duplicar etiquetas aqui */}
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
