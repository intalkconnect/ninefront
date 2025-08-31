import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Campaigns.module.css';
import {
  Plus,
  RefreshCw,
  X as XIcon,
  Upload as UploadIcon,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '',          label: 'Todos' },
  { value: 'queued',    label: 'Imediatas (Em fila)' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'finished',  label: 'Finalizadas' },
  { value: 'failed',    label: 'Falhadas' }
];

function StatusChip({ status }) {
  const map = {
    queued:    { txt: 'Em fila',    cls: styles.stSubmitted },
    scheduled: { txt: 'Agendada',   cls: styles.stDraft },
    finished:  { txt: 'Finalizada', cls: styles.stApproved },
    failed:    { txt: 'Falhou',     cls: styles.stRejected },
  };
  const it = map[status] || { txt: status || '—', cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

function ProgressMini({ done = 0, total = 0 }) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div className={styles.progressWrap}>
        <div className={styles.progressBar} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.progressText}>
        {total ? `${done}/${total} • ${percent}%` : '—'}
      </span>
    </div>
  );
}

/** Modal de criação/envio de campanha */
function CampaignCreateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('pt_BR');
  const [components, setComponents] = useState('');
  const [startAt, setStartAt] = useState('');
  const [file, setFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setTemplateName('');
      setLanguageCode('pt_BR');
      setComponents('');
      setStartAt('');
      setFile(null);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!file) { setError('Selecione um arquivo CSV.'); return; }
    if (!name || !templateName || !languageCode) {
      setError('Preencha nome, template e idioma.');
      return;
    }

    let compParsed = undefined;
    if (components.trim()) {
      try { compParsed = JSON.parse(components); }
      catch { setError('Components precisa ser um JSON válido.'); return; }
    }

    const meta = {
      name,
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(compParsed ? { components: compParsed } : {})
      },
      start_at: startAt ? new Date(startAt).toISOString() : null
    };

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('meta', JSON.stringify(meta));

    try {
      setSubmitting(true);
      const res = await apiPost('/campaigns', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onCreated?.(res);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Falha ao criar campanha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}><UploadIcon size={18}/> Nova campanha</h2>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>

            {error && (
              <div className={styles.alertError} style={{ marginBottom: 12 }}>
                <AlertCircle size={16}/> {error}
              </div>
            )}

            <div style={{ display:'grid', gap:12 }}>
              <div>
                <div className={styles.label}>Nome da campanha</div>
                <input className={styles.input} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Lançamento Setembro" />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:12 }}>
                <div>
                  <div className={styles.label}>Template (nome)</div>
                  <input className={styles.input} value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="ex.: hello_world" />
                </div>
                <div>
                  <div className={styles.label}>Idioma</div>
                  <input className={styles.input} value={languageCode} onChange={e=>setLanguageCode(e.target.value)} placeholder="pt_BR / en_US..." />
                </div>
              </div>

              <div>
                <div className={styles.label}>Components (JSON opcional)</div>
                <textarea className={styles.textarea} rows={4} value={components} onChange={e=>setComponents(e.target.value)} placeholder='Ex.: [{"type":"body","parameters":[{"type":"text","text":"{nome}"}]}]'></textarea>
                <div className={styles.inputHelper}>Use placeholders como {"{nome}"} e preencha no CSV.</div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:12 }}>
                <div>
                  <div className={styles.label}>Arquivo CSV</div>
                  <input className={styles.input} type="file" accept=".csv" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
                  <div className={styles.inputHelper}>Colunas: <code>to</code> + variáveis (ex.: <code>nome</code>, <code>pedido</code>...)</div>
                </div>

                <div>
                  <div className={styles.label}>Agendar (opcional)</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <CalendarIcon size={18} style={{ marginTop:8, color:'var(--fg-muted)' }} />
                    <input
                      className={styles.input}
                      type="datetime-local"
                      value={startAt}
                      onChange={(e)=>setStartAt(e.target.value)}
                      style={{ flex:1 }}
                    />
                  </div>
                  <div className={styles.inputHelper}>
                    Deixe vazio para envio imediato.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onClose}><XIcon size={14}/> Cancelar</button>
            <button type="submit" className={styles.btnPrimary} disabled={submitting}>
              <UploadIcon size={16}/> {submitting ? 'Enviando…' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // ▼ AGORA via radio (bolinhas)
  const [createOpen, setCreateOpen] = useState(false);

  const toastOK = useCallback((msg) => {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (query.trim()) qs.set('q', query.trim());

      const data = await apiGet(`/campaigns${qs.toString() ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao listar campanhas:', e);
      setError('Falha ao carregar campanhas.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return [...items]
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items]);

  return (
    <div className={styles.container}>
      {/* Toolbar superior: radio (bolinhas) + busca à esquerda, botões à direita */}
      <div className={styles.toolbar}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flex:1, minWidth:0 }}>
          {/* Radio group (opções) */}
          <fieldset style={{ border:'none', padding:0, margin:0 }}>
            <legend className="sr-only">Filtrar por status</legend>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              {STATUS_OPTIONS.map(opt => (
                <label key={opt.value || 'all'} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                  <input
                    type="radio"
                    name="campaign-status"
                    value={opt.value}
                    checked={statusFilter === opt.value}
                    onChange={() => setStatusFilter(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Busca */}
          <div className={styles.searchGroup} style={{ maxWidth: 380, marginLeft: 8 }}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar campanhas"
            />
            {query && (
              <button
                className={styles.searchClear}
                onClick={()=>setQuery('')}
                aria-label="Limpar busca"
                type="button"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Botões à direita (mantidos) */}
        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar lista">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Nova campanha
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className={styles.alertError}><AlertCircle size={16}/> {error}</div>
      )}
      {okMsg && (
        <div className={styles.alertOk}><CheckCircle2 size={16}/> {okMsg}</div>
      )}

      {/* Lista */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>Campanha</th>
                <th>Template</th>
                <th>Idioma</th>
                <th>Agendada para</th>
                <th>Status</th>
                <th>Progresso</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td className={styles.loading} colSpan={7}>Carregando…</td></tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr><td className={styles.empty} colSpan={7}>Nenhuma campanha encontrada.</td></tr>
              )}

              {!loading && filtered.map(c => {
                const total = Number(c.total_items ?? c.total ?? 0);
                const done  = Number(c.done_items  ?? c.sent  ?? 0);
                return (
                  <tr key={c.id} className={styles.rowHover}>
                    <td data-label="Campanha">
                      <div className={styles.keyTitle}>{c.name || c.id}</div>
                      <div className={styles.inputHelper}>ID: {c.id}</div>
                    </td>
                    <td data-label="Template">{c.template_name || '—'}</td>
                    <td data-label="Idioma">{c.language_code || '—'}</td>
                    <td data-label="Agendada">{c.start_at ? new Date(c.start_at).toLocaleString('pt-BR') : '—'}</td>
                    <td data-label="Status"><StatusChip status={c.status} /></td>
                    <td data-label="Progresso"><ProgressMini done={done} total={total} /></td>
                    <td data-label="Atualizado">
                      {c.updated_at ? new Date(c.updated_at).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de criação */}
      <CampaignCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }}
      />
    </div>
  );
}
