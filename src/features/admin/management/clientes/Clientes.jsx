import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ChevronRight,
  RefreshCw,
  X as XIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Plus,
  Edit3,
  Save,
  MessageSquare,
  User,
  Tag as TagIcon,
} from 'lucide-react';

import { apiGet, apiPost, apiDelete, apiPut } from '../../../../shared/apiClient';
import styles from './styles/Clientes.module.css';

/* ============================ Utils ============================ */

const PAGE_SIZES = [10, 20, 30, 50];

// split + slugify
function splitTokens(raw) {
  return String(raw || '')
    .split(/[,\u003B\u061B\uFF1B]/)
    .map((s) => s.trim())
    .map((s) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
        .replace(/-+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
    )
    .filter(Boolean);
}

/* === cores sólidas (não pastéis) === */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}
function solidColorFromTag(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return hslToHex(hue, 68, 48);
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
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126*toLin(rgb.r) + 0.7152*toLin(rgb.g) + 0.0722*toLin(rgb.b);
  return L > 0.55 ? '#111827' : '#FFFFFF';
}
function chipStylesSolid(hex) {
  const text = contrastText(hex);
  return { background: hex, color: text, borderColor: hex };
}

/* ============ Ícones de Canal (SVG) ============ */
const IconWA = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#25D366" d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.98L0 24l6.2-1.62A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.22-3.48-8.52z"/>
    <path fill="#fff" d="M18.41 14.23c-.25.7-1.23 1.29-2.02 1.47-.54.13-1.24.24-3.58-.74-3.01-1.25-4.95-4.34-5.1-4.55-.15-.22-1.22-1.62-1.22-3.09 0-1.47.77-2.19 1.05-2.49.27-.3.58-.37.78-.37h.56c.18 0 .43.06.66.51.25.5.8 1.73.87 1.86.07.14.12.3.02.48-.1.19-.15.3-.3.47-.14.17-.3.38-.42.51-.14.14-.29.3-.13.58.15.29.65 1.08 1.4 1.75.97.86 1.79 1.13 2.06 1.25.27.12.43.1.6-.06.19-.2.43-.52.68-.84.17-.23.39-.26.62-.18.24.08 1.5.71 1.76.84.26.13.43.19.5.3.06.11.06.67-.19 1.37z"/>
  </svg>
);
const IconTG = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#229ED9" d="M9.999 15.2 9.9 20c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.8c.7.4 1.2.2 1.4-.6l2.6-12.2c.2-.8-.3-1.2-1-.9L3.8 9.4c-.8.3-.8.7-.1 1l4.7 1.5 10.8-6.7-9.4 10.5z"/>
  </svg>
);
const IconIG = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <defs>
      <radialGradient id="igGrad" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stopColor="#FFD776"/>
        <stop offset="50%" stopColor="#F56040"/>
        <stop offset="100%" stopColor="#8A3AB9"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#igGrad)"/>
    <circle cx="12" cy="12" r="4" fill="#fff"/>
    <circle cx="17" cy="7" r="1.3" fill="#fff"/>
  </svg>
);
function channelIcon(channel) {
  const c = String(channel || '').toLowerCase();
  if (c === 'whatsapp') return <IconWA />;
  if (c === 'telegram') return <IconTG />;
  if (c === 'instagram') return <IconIG />;
  return <MessageSquare size={18} className={styles.channelFallback} aria-hidden="true" />;
}

/* ============================ TagEditor (por cliente) ============================ */
function TagEditor({
  userId,
  userTags = [],
  catalog = [],
  onSave,
  onCancel,
  saving = false,
}) {
  const [selectedTags, setSelectedTags] = useState(userTags);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    onSave(userId, selectedTags);
  };

  return (
    <div className={styles.editorBox}>
      <div className={styles.editorHeader}>
        <h3 className={styles.editorTitle}>
          <Edit3 size={16} /> Editar Etiquetas
        </h3>
        <div className={styles.editorBtns}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.btnPrimary}
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={onCancel} className={styles.btnGhost}>
            Cancelar
          </button>
        </div>
      </div>

      <div className={styles.editorChipsWrap}>
        {catalog.map(({ tag, color }) => {
          const isSelected = selectedTags.includes(tag);
          const chipColor = color || solidColorFromTag(tag);
          const selectedStyle = chipStylesSolid(chipColor);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`${styles.tagOption} ${isSelected ? styles.tagOptionOn : ''}`}
              style={
                isSelected
                  ? selectedStyle
                  : { color: chipColor, borderColor: chipColor, background: '#fff' }
              }
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ ChipsCreateInput (catálogo) ============================ */
function ChipsCreateInput({
  placeholder = 'ex.: vip, reclamacao, atraso',
  onCreate,
  onDeleteTag,
  busy,
  tags = [], // [{tag, color}]
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

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
    if (/[,\u003B\u061B\uFF1B]/.test(txt)) {
      e.preventDefault();
      await commit(txt);
    }
  };

  return (
    <div
      className={`${styles.tagsField} ${focused ? styles.tagsFieldFocus : ''}`}
      onClick={(e) => e.currentTarget.querySelector('input')?.focus()}
    >
      {tags.map(({ tag, color }) => {
        const chipColor = color || solidColorFromTag(tag);
        const style = chipStylesSolid(chipColor);
        return (
          <span key={tag} className={styles.tagChip} style={style}>
            <span className={styles.tagText}>{tag}</span>
            <button
              type="button"
              className={styles.tagChipX}
              onClick={() => onDeleteTag && onDeleteTag(tag)}
              disabled={busy}
              aria-label={`Remover ${tag}`}
              title={`Remover ${tag}`}
            >
              ×
            </button>
          </span>
        );
      })}

      <input
        className={styles.tagsInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={tags.length === 0 ? placeholder : ''}
        disabled={busy}
      />
    </div>
  );
}

/* ============================ Main ============================ */
export default function Clientes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openRow, setOpenRow] = useState(null);

  const [editingTags, setEditingTags] = useState(null);
  const [tagsSaving, setTagsSaving] = useState(false);

  // catálogo global [{tag, color}]
  const [catalog, setCatalog] = useState([]);
  const [catalogBusy, setCatalogBusy] = useState(false);

  // filtro por tag (neutro)
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFilters, setShowFilters] = useState(true);

  // tags por cliente
  const [tagsByUser, setTagsByUser] = useState({});
  const [tagsLoaded, setTagsLoaded] = useState({});

  /* ====== carregar clientes ====== */
  const load = useCallback(
    async (opts = {}) => {
      const nextPage = opts.page ?? page;
      const nextPageSize = opts.pageSize ?? pageSize;
      const nextQ = opts.q ?? q;

      setLoading(true);
      try {
        const resp = await apiGet('/customers', {
          params: { q: nextQ, page: nextPage, page_size: nextPageSize },
        });
        const data = Array.isArray(resp?.data) ? resp.data : resp?.data ?? [];
        setItems(data);
        setPage(resp?.page || nextPage);
        setPageSize(resp?.page_size || nextPageSize);
        setTotal(Number(resp?.total || data.length || 0));

        // baixar tags de clientes visíveis
        const chunk = async (arr, size) => {
          for (let i = 0; i < arr.length; i += size) {
            const slice = arr.slice(i, i + size);
            await Promise.all(
              slice.map(async (row) => {
                const uid = row.user_id;
                if (!uid || tagsLoaded[uid]) return;
                try {
                  const r = await apiGet(`/tags/customer/${encodeURIComponent(uid)}`);
                  const list = Array.isArray(r?.tags)
                    ? r.tags
                    : Array.isArray(r?.data)
                    ? r.data
                    : [];
                  const norm = (list || [])
                    .map((x) => String(x?.tag || x).trim())
                    .filter(Boolean);
                  setTagsByUser((m) => ({ ...m, [uid]: norm }));
                  setTagsLoaded((m) => ({ ...m, [uid]: true }));
                } catch {
                  setTagsByUser((m) => ({ ...m, [uid]: [] }));
                  setTagsLoaded((m) => ({ ...m, [uid]: true }));
                }
              })
            );
          }
        };
        await chunk(data, 8);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, q, tagsLoaded]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== catálogo global ====== */
  const loadCatalog = useCallback(async () => {
    try {
      setCatalogBusy(true);
      const r = await apiGet('/tags/customer/catalog?active=true&page_size=200');
      const raw = Array.isArray(r?.data) ? r.data : Array.isArray(r?.tags) ? r.tags : [];
      const list = raw
        .map((it) => {
          if (typeof it === 'string') return { tag: it, color: solidColorFromTag(it) };
          const tag = String(it?.tag || '').trim();
          const color = (it?.color && String(it.color).trim()) || '';
          return { tag, color: color || solidColorFromTag(tag) };
        })
        .filter((x) => x.tag);
      const dedup = Array.from(new Map(list.map((x) => [x.tag, x])).values()).sort((a, b) =>
        a.tag.localeCompare(b.tag)
      );
      setCatalog(dedup);
    } finally {
      setCatalogBusy(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const createTags = async (tokens) => {
    if (!tokens?.length) return;
    try {
      setCatalogBusy(true);
      const uniq = [...new Set(tokens)];
      await Promise.all(
        uniq.map((tag) =>
          apiPost('/tags/customer/catalog', {
            tag,
            color: solidColorFromTag(tag),
            active: true,
          })
        )
      );
      await loadCatalog();
    } finally {
      setCatalogBusy(false);
    }
  };

  const deleteCatalogTag = async (tag) => {
    if (!tag) return;
    const ok = window.confirm(
      `Excluir a etiqueta "${tag}" do catálogo global?\nIsso não remove a etiqueta de clientes que já a possuem.`
    );
    if (!ok) return;
    try {
      setCatalogBusy(true);
      await apiDelete(`/tags/customer/catalog/${encodeURIComponent(tag)}`);
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
      await loadCatalog();
    } finally {
      setCatalogBusy(false);
    }
  };

  const saveUserTags = async (userId, newTags) => {
    try {
      setTagsSaving(true);
      const caller = apiPut ? apiPut : apiPost;
      await caller(`/tags/customer/${encodeURIComponent(userId)}`, { tags: newTags });
      setTagsByUser((prev) => ({ ...prev, [userId]: newTags }));
      setEditingTags(null);
    } finally {
      setTagsSaving(false);
    }
  };

  /* ====== busca / filtro ====== */
  const onSearch = async (e) => {
    e?.preventDefault?.();
    setPage(1);
    await load({ page: 1, q });
  };

  const colorMap = useMemo(() => {
    const m = new Map();
    catalog.forEach(({ tag, color }) => m.set(tag, color || solidColorFromTag(tag)));
    return m;
  }, [catalog]);

  const visible = useMemo(() => {
    let data = items;
    if (selectedTags.length > 0) {
      data = data.filter((row) => {
        const uid = row.user_id;
        const userTags = tagsByUser[uid] || [];
        return selectedTags.every((t) => userTags.includes(t));
      });
    }
    return data;
  }, [items, selectedTags, tagsByUser]);

  /* ====== paginação ====== */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerWrap}>
        <div>
          <h1 className={styles.title}>Gestão de Clientes</h1>
          <p className={styles.subtitle}>
            Crie etiquetas globais, filtre por etiquetas e visualize os detalhes.
          </p>
        </div>
        <button onClick={() => load()} className={styles.btn}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Criação de etiquetas */}
        <section className={`${styles.cardSection} ${styles.cardSectionGradient}`}>
          <div className={styles.sectionTitleRow}>
            <Plus className={styles.sectionIcon} size={20} />
            <label className={styles.sectionTitle}>Criar etiquetas globais</label>
          </div>
          <ChipsCreateInput
            onCreate={createTags}
            onDeleteTag={deleteCatalogTag}
            busy={catalogBusy}
            tags={catalog}
            placeholder="Digite e pressione Enter (pode colar várias separadas por vírgula)"
          />
          <p className={styles.sectionHint}>
            As etiquetas criadas aqui ficam disponíveis para todos os clientes.
          </p>
        </section>

        {/* Filtros e Busca */}
        <section className={`${styles.cardSection} ${styles.cardSectionSoft}`}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionTitleLeft}>
              <FilterIcon size={18} className={styles.sectionIconMuted} />
              <h3 className={styles.sectionTitle2}>Filtros e Busca</h3>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={styles.linkToggle}
            >
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>
          </div>

          {/* Filtro por etiquetas (neutro) */}
          {showFilters && (
            <div className={styles.filtersBlock}>
              <div className={styles.tagsFilterWrap}>
                {catalog.length === 0 ? (
                  <p className={styles.muted}>Nenhuma etiqueta cadastrada.</p>
                ) : (
                  catalog.map(({ tag }) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )
                        }
                        className={`${styles.tagFilterBtn} ${
                          active ? styles.tagFilterBtnOn : ''
                        }`}
                        title={active ? 'Remover do filtro' : 'Adicionar ao filtro'}
                      >
                        {tag}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedTags.length > 0 && (
                <div className={styles.filterSelectedRow}>
                  <span className={styles.filterActiveLabel}>Filtros ativos:</span>
                  <div className={styles.filterSelectedChips}>
                    {selectedTags.map((t) => (
                      <span key={t} className={styles.filterChip}>
                        {t}
                        <button
                          onClick={() =>
                            setSelectedTags((prev) => prev.filter((x) => x !== t))
                          }
                          className={styles.filterChipX}
                          aria-label={`Remover ${t}`}
                        >
                          <XIcon size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedTags([])}
                    className={styles.linkClear}
                  >
                    Limpar todos
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Busca (embaixo do filtro) */}
          <form onSubmit={onSearch} className={styles.searchForm}>
            <div className={styles.searchWrap}>
              <SearchIcon size={18} className={styles.searchIcon} aria-hidden="true" />
              <input
                className={styles.searchInput}
                placeholder="Buscar por nome, telefone ou user_id…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setQ('')}
                  aria-label="Limpar"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.theadRow}>
                <th className={styles.thLeft}>
                  <div className={styles.thFlex}>
                    <User size={16} />
                    Cliente
                  </div>
                </th>
                <th className={styles.thLeft}>
                  <div className={styles.thFlex}>
                    <TagIcon size={16} />
                    Etiquetas
                  </div>
                </th>
                <th className={styles.thCenter}>
                  <div className={styles.thFlexCenter}>
                    <MessageSquare size={16} />
                    Canal
                  </div>
                </th>
                <th className={styles.thCenter}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className={styles.loadingRow}>
                    <div className={styles.loadingInline}>
                      <RefreshCw size={18} className={styles.spin} />
                      Carregando…
                    </div>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.emptyRow}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => {
                  const uid = row.user_id;
                  const isOpen = openRow === uid;
                  const userTags = tagsByUser[uid];
                  const tagsPending = !tagsLoaded[uid];

                  return (
                    <React.Fragment key={uid}>
                      <tr
                        className={styles.dataRow}
                        onClick={() => setOpenRow(isOpen ? null : uid)}
                      >
                        <td className={styles.tdPad}>
                          <div className={styles.clientCell}>
                            <span
                              className={`${styles.chev} ${isOpen ? styles.chevOpen : ''}`}
                            >
                              <ChevronRight size={16} />
                            </span>
                            <span className={styles.clientName}>
                              {row.name || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Etiquetas (coluna) */}
                        <td className={styles.tdPad}>
                          {tagsPending ? (
                            <span className={styles.muted}>—</span>
                          ) : userTags && userTags.length > 0 ? (
                            <div className={styles.tagsRowWrap}>
                              {userTags.map((t) => {
                                const c = colorMap.get(t) || solidColorFromTag(t);
                                const style = chipStylesSolid(c);
                                return (
                                  <span
                                    key={t}
                                    className={styles.tableTag}
                                    style={style}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>

                        {/* Canal (ícone) */}
                        <td className={`${styles.tdPad} ${styles.textCenter}`}>
                          <span
                            className={styles.channelIconBox}
                            title={String(row.channel || '')}
                            aria-label={String(row.channel || '')}
                          >
                            {channelIcon(row.channel)}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className={`${styles.tdPad} ${styles.textCenter}`}>
                          <button
                            type="button"
                            className={styles.linkAction}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTags(uid);
                            }}
                          >
                            Editar etiquetas
                          </button>
                        </td>
                      </tr>

                      {/* detalhes */}
                      {isOpen && (
                        <tr className={styles.detailsTr}>
                          <td colSpan={4} className={styles.detailsTd}>
                            <div className={styles.detailsGrid}>
                              <div className={styles.detailCard}>
                                <div className={styles.detailK}>User ID</div>
                                <div className={styles.detailV}>{row.user_id || '—'}</div>
                              </div>

                              <div className={styles.detailCard}>
                                <div className={styles.detailK}>Telefone</div>
                                <div className={styles.detailV}>
                                  {String(row.channel || '').toLowerCase() === 'whatsapp'
                                    ? row.phone || '—'
                                    : '—'}
                                </div>
                              </div>

                              <div className={styles.detailCard}>
                                <div className={styles.detailK}>Canal</div>
                                <div className={styles.detailV}>
                                  {String(row.channel || '') || '—'}
                                </div>
                              </div>
                            </div>

                            {editingTags === uid && (
                              <div className={styles.editorMount}>
                                <TagEditor
                                  userId={uid}
                                  userTags={userTags || []}
                                  catalog={catalog}
                                  onSave={saveUserTags}
                                  onCancel={() => setEditingTags(null)}
                                  saving={tagsSaving}
                                />
                              </div>
                            )}
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
                setPageSize(ps);
                setPage(1);
                await load({ page: 1, pageSize: ps });
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} por página
                </option>
              ))}
            </select>

            <button
              className={styles.pBtn}
              disabled={page <= 1}
              onClick={() => load({ page: 1 })}
            >
              « Primeiro
            </button>
            <button
              className={styles.pBtn}
              disabled={page <= 1}
              onClick={() => load({ page: page - 1 })}
            >
              Anterior
            </button>
            <span className={styles.pInfo}>
              Página {page} de {totalPages}
            </span>
            <button
              className={styles.pBtn}
              disabled={page >= totalPages}
              onClick={() => load({ page: page + 1 })}
            >
              Próxima
            </button>
            <button
              className={styles.pBtn}
              disabled={page >= totalPages}
              onClick={() => load({ page: totalPages })}
            >
              Última »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
