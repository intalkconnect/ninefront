// src/pages/Campaigns/Campaigns.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css'; // reaproveitando o mesmo CSS base
import {
  Plus, RefreshCw, Upload, CalendarClock, X as XIcon, AlertCircle, BarChart2, FileText
} from 'lucide-react';

/* ========================= helpers visuais ========================= */

const CAMP_STATUS_TABS = [
  { key: '',            label: 'Todas' },
  { key: 'queued',      label: 'Imediatas (na fila)' },
  { key: 'scheduled',   label: 'Agendadas' },
  { key: 'running',     label: 'Em envio' },
  { key: 'finished',    label: 'Finalizadas' },
  { key: 'failed',      label: 'Falhas' },
];

function CampaignStatusChip({ status }) {
  const map = {
    queued:    { txt: 'Na fila',     cls: styles.stSubmitted },
    scheduled: { txt: 'Agendada',    cls: styles.stDraft },
    running:   { txt: 'Enviando',    cls: styles.stApproved },
    finished:  { txt: 'Finalizada',  cls: styles.stApproved },
    failed:    { txt: 'Falhou',      cls: styles.stRejected },
  };
  const it = map[status] || { txt: status || '—', cls: styles.stDefault };
  return <span className={`${styles.statusChip} ${it.cls}`}>{it.txt}</span>;
}

function fmtDate(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('pt-BR'); } catch { return String(dt); }
}

function ProgressBar({ current = 0, total = 0 }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className={styles.progressWrap} title={`${current}/${total} (${pct}%)`}>
      <div className={styles.progressBar} style={{ width: `${pct}%` }} />
      <span className={styles.progressText}>{total ? `${pct}%` : '—'}</span>
    </div>
  );
}

/* ========================= Modal: Detalhes ========================= */

function CampaignDetailsModal({ isOpen, item, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      // Opcional no backend: GET /campaigns/:id/stats -> { total, with_message_id, sent, delivered, read, failed }
      const data = await apiGet(`/campaigns/${item.id}/stats`);
      setStats(data || null);
    } catch {
      setStats(null); // se endpoint não existir, mostra "—"
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => { if (isOpen) loadStats(); }, [isOpen, loadStats]);

  if (!isOpen || !item) return null;

  const total = stats?.total ?? item?.total_items ?? 0;
  const current = stats?.delivered ?? item?.delivered_count ?? 0;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <BarChart2 size={18} style={{ marginRight:8 }} /> Andamento da campanha
          </h2>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.label}>Nome</div>
          <div className={styles.keyTitle} style={{ marginBottom:10 }}>{item.name}</div>

          <div className={styles.label}>Template</div>
          <div style={{ marginBottom:10 }}>
            {item.template_name || '—'} • {item.language_code || '—'}
          </div>

          <div className={styles.label}>Status</div>
          <div style={{ marginBottom:10 }}><CampaignStatusChip status={item.status} /></div>

          <div className={styles.label}>Início agendado</div>
          <div style={{ marginBottom:10 }}>{fmtDate(item.start_at)}</div>

          <div className={styles.label}>Progresso</div>
          <div style={{ marginBottom:12 }}>
            <ProgressBar current={current} total={total} />
          </div>

          <div className={styles.tableWrap} style={{ marginTop:10 }}>
            <table className={styles.table}>
              <tbody>
                <tr><td>Total</td><td>{stats?.total ?? item?.total_items ?? '—'}</td></tr>
                <tr><td>Com WAMID</td><td>{stats?.with_message_id ?? item?.with_message_id ?? '—'}</td></tr>
                <tr><td>Sent</td><td>{stats?.sent ?? item?.sent_count ?? '—'}</td></tr>
                <tr><td>Delivered</td><td>{stats?.delivered ?? item?.delivered_count ?? '—'}</td></tr>
                <tr><td>Read</td><td>{stats?.read ?? item?.read_count ?? '—'}</td></tr>
                <tr><td>Failed</td><td>{stats?.failed ?? item?.failed_count ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>

          {loading && <div className={styles.inputHelper} style={{ marginTop:8 }}>Carregando métricas…</div>}
          {!loading && !stats && (
            <div className={styles.inputHelper} style={{ marginTop:8 }}>
              <AlertCircle size={14} /> Não há endpoint de métricas disponível. Exibindo campos básicos (se existirem).
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={loadStats}><RefreshCw size={14}/> Recarregar</button>
          <button className={styles.btn} onClick={onClose}><XIcon size={14}/> Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ========================= Modal: Nova Campanha ========================= */

function CreateCampaignModal({ isOpen, onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [languageCode, setLanguageCode] = useState('pt_BR');
  const [componentsJson, setComponentsJson] = useState('');
  const [file, setFile] = useState(null);

  const [isScheduled, setIsScheduled] = useState(false);
  const [whenLocal, setWhenLocal] = useState(''); // datetime-local

  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    // carrega templates aprovados para facilitar a escolha
    (async () => {
      try {
        const data = await apiGet('/templates?status=approved');
        setTemplates(Array.isArray(data) ? data : []);
      } catch {
        setTemplates([]);
      }
    })();
  }, [isOpen]);

  const submit = useCallback(async () => {
    setErr(null);
    if (!file) { setErr('Selecione o arquivo CSV.'); return; }
    if (!name.trim()) { setErr('Informe um nome para a campanha.'); return; }
    if (!templateName.trim()) { setErr('Selecione/Informe o template.'); return; }
    if (!languageCode.trim()) { setErr('Informe o idioma (ex.: pt_BR).'); return; }

    let components = null;
    if (componentsJson.trim()) {
      try { components = JSON.parse(componentsJson); }
      catch { setErr('Components inválido (JSON).'); return; }
    }

    const meta = {
      name: name.trim(),
      template: {
        name: templateName.trim(),
        language: { code: languageCode.trim() },
        ...(components ? { components } : {})
      },
      ...(isScheduled && whenLocal ? { start_at: new Date(whenLocal).toISOString() } : {})
    };

    const fd = new FormData();
    fd.append('file', file);
    fd.append('meta', JSON.stringify(meta));

    setLoading(true);
    try {
      // POST /campaigns (multipart) — sua rota já existente
      const res = await apiPost('/campaigns', fd, { multipart: true });
      onCreated?.(res);
    } catch (e) {
      console.error(e);
      setErr(e?.message || 'Falha ao criar campanha.');
    } finally {
      setLoading(false);
    }
  }, [file, name, templateName, languageCode, componentsJson, isScheduled, whenLocal, onCreated]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}><Upload size={18} style={{ marginRight:8 }} /> Nova Campanha</h2>
          <button className={styles.alertClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        <div className={styles.modalBody} style={{ display:'grid', gap:12 }}>
          {err && (
            <div className={styles.alertError}>
              <AlertCircle size={16} /> {err}
            </div>
          )}

          <div>
            <div className={styles.label}>Nome da campanha</div>
            <input className={styles.input} value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ex.: Promoção Setembro" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:12 }}>
            <div>
              <div className={styles.label}>Template</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  className={styles.input}
                  list="tpl-list"
                  placeholder="hello_world (ou escolha abaixo)"
                  value={templateName}
                  onChange={(e)=>setTemplateName(e.target.value)}
                />
                <datalist id="tpl-list">
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.language_code}</option>
                  ))}
                </datalist>
              </div>
              <div className={styles.inputHelper}>
                Só “Aprovados” aparecem no datalist. Você pode digitar o nome manualmente.
              </div>
            </div>

            <div>
              <div className={styles.label}>Idioma</div>
              <input className={styles.input} value={languageCode} onChange={(e)=>setLanguageCode(e.target.value)} placeholder="pt_BR" />
            </div>
          </div>

          <div>
            <div className={styles.label}>Components (opcional, JSON)</div>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder='Ex.: [{"type":"body","parameters":[{"type":"text","text":"{nome}"}]}]'
              value={componentsJson}
              onChange={(e)=>setComponentsJson(e.target.value)}
            />
            <div className={styles.inputHelper}>
              Você pode usar placeholders como <code>{'{nome}'}</code> no CSV para hidratar componentes.
            </div>
          </div>

          <div>
            <div className={styles.label}>Arquivo CSV</div>
            <input type="file" accept=".csv,text/csv" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
            <div className={styles.inputHelper}>
              O CSV deve ter a coluna <b>to</b> e, opcionalmente, variáveis adicionais (ex.: <code>nome</code>, <code>pedido</code>).
            </div>
          </div>

          <div className={styles.card} style={{ padding:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={isScheduled} onChange={(e)=>setIsScheduled(e.target.checked)} />
              <CalendarClock size={16}/> Agendar envio
            </label>
            {isScheduled && (
              <div style={{ marginTop:8 }}>
                <input
                  type="datetime-local"
                  className={styles.input}
                  value={whenLocal}
                  onChange={(e)=>setWhenLocal(e.target.value)}
                />
                <div className={styles.inputHelper}>
                  Será enviado como ISO (UTC) para o backend em <code>meta.start_at</code>.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}><XIcon size={14}/> Cancelar</button>
          <button className={styles.btnPrimary} onClick={submit} disabled={loading}>
            {loading ? 'Enviando…' : (<><Upload size={14}/> Criar campanha</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= Página principal ========================= */

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);

  const pollRef = useRef(null);
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

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

      // GET /campaigns -> [{ id, name, status, start_at, template_name, language_code, ... opcionalmente métricas }]
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

  // polling leve enquanto houver campanhas "vivas"
  useEffect(() => {
    const needsPoll = items.some(c => ['queued', 'scheduled', 'running'].includes(c.status));
    if (!needsPoll) { stopPolling(); return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(load, 8000);
    return stopPolling;
  }, [items, load]);

  const filtered = useMemo(() => {
    let data = [...items];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      data = data.filter(c =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.template_name || '').toLowerCase().includes(q)
      );
    }
    return data
      .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
      .reverse();
  }, [items, query]);

  const openDetails = (item) => { setDetailsItem(item); setDetailsOpen(true); };
  const closeDetails = () => { setDetailsItem(null); setDetailsOpen(false); };

  const clearSearch = () => setQuery('');

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.toolbar}>
        <div className={styles.headerActions}>
          <button className={styles.btn} type="button" onClick={load} title="Atualizar">
            <RefreshCw size={16} /> Atualizar
          </button>
          <button className={styles.btnPrimary} type="button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Nova Campanha
          </button>
          <a
            className={styles.btn}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('to,nome\n559999999999,João\n559999999998,Maria')}`}
            download="modelo_campanha.csv"
            style={{ marginLeft: 8 }}
          >
            <FileText size={16}/> Modelo CSV
          </a>
        </div>
      </div>

      {/* Filtros + busca */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.tabs} role="tablist" aria-label="Filtrar por status">
            {CAMP_STATUS_TABS.map(tab => (
              <button
                key={tab.key || 'all'}
                className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
                onClick={() => setStatusFilter(tab.key)}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.searchGroup}>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nome ou template…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar campanhas"
            />
            {query && (
              <button className={styles.searchClear} onClick={clearSearch} aria-label="Limpar busca" type="button">
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Campanha</th>
                <th>Template</th>
                <th>Idioma</th>
                <th>Status</th>
                <th>Início</th>
                <th style={{ width: 220 }}>Andamento</th>
                <th style={{ width: 120 }}>Ações</th>
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
                // números podem vir do backend (se existir) ou ficar em “—”
                const total = c.total_items ?? c.total ?? 0;
                const delivered = c.delivered_count ?? c.delivered ?? 0;
                const progressCurrent = delivered;
                const progressTotal = total;

                return (
                  <tr
                    key={c.id}
                    className={styles.rowHover}
                    style={{ cursor:'pointer' }}
                    onClick={() => openDetails(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(c); }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir detalhes de ${c.name}`}
                  >
                    <td data-label="Campanha">
                      <div className={styles.keyTitle}>{c.name}</div>
                      <div className={styles.inputHelper}>
                        Criada em {fmtDate(c.created_at)} • Atualizada {fmtDate(c.updated_at)}
                      </div>
                    </td>
                    <td data-label="Template">{c.template_name || '—'}</td>
                    <td data-label="Idioma">{c.language_code || '—'}</td>
                    <td data-label="Status"><CampaignStatusChip status={c.status} /></td>
                    <td data-label="Início">{fmtDate(c.start_at)}</td>
                    <td data-label="Andamento"><ProgressBar current={progressCurrent} total={progressTotal} /></td>
                    <td data-label="Ações" className={styles.actionsCell}
                        onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button className={styles.qrIconBtn} title="Atualizar" onClick={load} type="button">
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <div className={styles.alertError} style={{ marginTop:12 }}>
            <AlertCircle size={16}/> {error}
          </div>
        )}
        {okMsg && (
          <div className={styles.alertOk} style={{ marginTop:12 }}>
            {okMsg}
          </div>
        )}
      </div>

      {/* Modal criar campanha */}
      <CreateCampaignModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(res) => { setCreateOpen(false); load(); 
          const mode = res?.mode || (res?.launched ? 'immediate' : 'scheduled');
          const lbl = mode === 'immediate' ? 'imediato' : 'agendado';
          toastOK(`Campanha criada (${lbl}).`);
        }}
      />

      {/* Modal detalhes */}
      <CampaignDetailsModal isOpen={detailsOpen} item={detailsItem} onClose={closeDetails} />
    </div>
  );
}
