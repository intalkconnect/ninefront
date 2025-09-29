// File: CampaignWizard.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Upload, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/CampaignWizard.module.css';

const STEPS = [
  'Informações',
  'Público-alvo',
  'Resposta padrão',
  'Revisão',
];

const initial = {
  // step 1
  name: '',
  sendKind: 'individual', // 'individual' | 'csv'
  scheduleMode: 'immediate', // 'immediate' | 'scheduled'
  start_at: '',
  template_id: '',

  // step 2
  to: '',
  file: null,

  // step 3 - reply
  origin: 'agent_active', // 'agent_active' | 'campaign' | 'individual'
  reply_action: 'open_ticket', // 'open_ticket' | 'flow_goto'
  queue: '', // para open_ticket
  agent: '', // para open_ticket
  flowId: '', // id do fluxo ativo (carregado)
  blockId: '', // para flow_goto
};

export default function CampaignWizard({ onCreated }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);

  const [activeFlowId, setActiveFlowId] = useState('');
  const [flowBlocks, setFlowBlocks] = useState([]); // [{id,name,type},...]

  const [form, setForm] = useState(initial);

  const selectedTemplate = useMemo(
    () => templates.find(t => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  /* ---------- Load data ---------- */
  const loadEverything = useCallback(async () => {
    setErr(null);
    try {
      const [tpl, qs, us, latest] = await Promise.all([
        apiGet('/templates?status=approved').catch(() => []),
        apiGet('/queues').catch(() => []),
        apiGet('/users').catch(() => []),
        apiGet('/flows/latest').catch(() => []),
      ]);

      setTemplates(Array.isArray(tpl) ? tpl : []);
      setQueues(Array.isArray(qs) ? qs : []);
      setUsers(Array.isArray(us?.data) ? us.data : Array.isArray(us) ? us : []);

      // fluxo ativo + dados
      const activeId =
        Array.isArray(latest) ? latest.find(x => x.active)?.id :
        latest?.find?.(x => x.active)?.id || latest?.id || null;

      if (activeId) {
        setActiveFlowId(String(activeId));
        const data = await apiGet(`/flows/data/${encodeURIComponent(activeId)}`).catch(() => null);
        const blocks = Object.entries((data?.blocks || {})).map(([id, b]) => ({
          id,
          name: b?.name || b?.title || id,
          type: String(b?.type || '').toLowerCase(),
        }));
        // filtra script e api_call
        const filtered = blocks.filter(b => !['script', 'api_call'].includes(b.type));
        setFlowBlocks(filtered);
      } else {
        setActiveFlowId('');
        setFlowBlocks([]);
      }
    } catch (e) {
      setErr('Falha ao carregar dados iniciais.');
    }
  }, []);

  useEffect(() => { loadEverything(); }, [loadEverything]);

  /* ---------- helpers ---------- */
  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // atendentes da fila selecionada
  const agentsInQueue = useMemo(() => {
    if (!form.queue) return [];
    // tenta por relação users[].filas
    const list = (users || []).filter(u =>
      Array.isArray(u.filas) && u.filas.map(String).includes(String(form.queue))
    );
    // fallback: se a fila trouxer membros por e-mail/id
    const q = (queues || []).find(x =>
      String(x.id) === String(form.queue) ||
      String(x.nome) === String(form.queue) ||
      String(x.name) === String(form.queue)
    );
    const emails = new Set(
      []
        .concat(q?.members || q?.agentes || q?.agents || [])
        .map(x => (typeof x === 'string' ? x : x?.email || x?.id))
        .filter(Boolean)
        .map(String)
    );
    const merged = [
      ...list,
      ...users.filter(u => emails.has(String(u.email || u.id))),
    ];
    // remove duplicados por email
    const seen = new Set();
    return merged.filter(u => {
      const key = String(u.email || u.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [users, queues, form.queue]);

  // validação mínima por etapa
  function canNext(k = step) {
    if (k === 0) {
      if (!form.name.trim()) return false;
      if (!selectedTemplate) return false;
      if (form.scheduleMode === 'scheduled' && !form.start_at) return false;
      return true;
    }
    if (k === 1) {
      if (form.sendKind === 'individual') {
        return /^\d{10,15}$/.test(String(form.to).replace(/\D/g, ''));
      }
      return !!form.file;
    }
    if (k === 2) {
      if (form.reply_action === 'open_ticket') {
        return !!form.queue; // agente é opcional
      }
      if (form.reply_action === 'flow_goto') {
        return !!form.blockId;
      }
      return true;
    }
    return true;
  }

  /* ---------- submit ---------- */
  async function handleSubmit() {
    setErr(null);
    setLoading(true);
    try {
      // monta template para API
      const template = {
        name: selectedTemplate.name,
        language: { code: selectedTemplate.language_code },
      };

      if (form.sendKind === 'individual') {
        // monta payload reply automático
        let reply_action = form.reply_action; // 'open_ticket' | 'flow_goto'
        let reply_payload = null;

        if (reply_action === 'open_ticket') {
          reply_payload = {
            fila: resolveQueueName(form.queue),
            assigned_to: form.agent || null,
          };
        } else if (reply_action === 'flow_goto') {
          reply_payload = { blockId: form.blockId };
        }

        const body = {
          to: String(form.to).replace(/\D/g, ''),
          template,
          origin: 'individual', // fica claro no DB
          reply_action,
          ...(reply_payload ? { reply_payload } : {}),
        };

        const res = await apiPost('/messages/send/template', body);
        if (!res?.success) throw new Error(res?.error || 'Falha ao enviar mensagem.');
        onCreated?.();
        return;
      }

      // campanha com CSV
      const meta = {
        name: form.name.trim(),
        start_at:
          form.scheduleMode === 'scheduled'
            ? new Date(form.start_at).toISOString()
            : null,
        template,
        reply_action: form.reply_action,
        reply_payload:
          form.reply_action === 'open_ticket'
            ? {
                fila: resolveQueueName(form.queue),
                assigned_to: form.agent || null,
              }
            : { blockId: form.blockId },
      };

      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('meta', JSON.stringify(meta));

      const out = await apiPost('/campaigns', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!out?.ok) throw new Error(out?.error || 'Falha ao criar campanha.');
      onCreated?.();
    } catch (e) {
      setErr(e?.message || 'Erro ao processar.');
    } finally {
      setLoading(false);
    }
  }

  function resolveQueueName(idOrName) {
    const q = queues.find(
      q =>
        String(q.id) === String(idOrName) ||
        String(q.nome) === String(idOrName) ||
        String(q.name) === String(idOrName)
    );
    return q?.nome || q?.name || String(idOrName);
  }

  /* ---------- render ---------- */
  return (
    <div className={styles.page}>
      {/* Stepper */}
      <div className={styles.stepper}>
        {STEPS.map((t, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={t}
              className={`${styles.step} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`}
            >
              <span className={styles.stepIdx}>{i + 1}</span>
              <span className={styles.stepTxt}>{t}</span>
            </div>
          );
        })}
      </div>

      {err && <div className={styles.alertErr}>⚠️ {err}</div>}

      {/* ===== Step 1: Informações ===== */}
      {step === 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Informações</h3>
            <p className={styles.cardDesc}>Defina nome, tipo de envio, agendamento e template.</p>
          </div>
          <div className={styles.grid2}>
            <div className={styles.group}>
              <label className={styles.label}>Nome da campanha</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Ex.: Black Friday Leads"
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Tipo de envio</label>
              <div className={styles.optionsRow} role="radiogroup">
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="sendKind"
                    value="individual"
                    checked={form.sendKind === 'individual'}
                    onChange={() => setField('sendKind', 'individual')}
                  />
                  <span>Individual</span>
                </label>
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="sendKind"
                    value="csv"
                    checked={form.sendKind === 'csv'}
                    onChange={() => setField('sendKind', 'csv')}
                  />
                  <span>CSV (em massa)</span>
                </label>
              </div>
            </div>

            <div className={styles.group}>
              <label className={styles.label}>Quando enviar</label>
              <div className={styles.optionsRow} role="radiogroup">
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="scheduleMode"
                    value="immediate"
                    checked={form.scheduleMode === 'immediate'}
                    onChange={() => setField('scheduleMode', 'immediate')}
                  />
                  <span>Imediato</span>
                </label>
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="scheduleMode"
                    value="scheduled"
                    checked={form.scheduleMode === 'scheduled'}
                    onChange={() => setField('scheduleMode', 'scheduled')}
                  />
                  <span>Agendar</span>
                </label>
              </div>
            </div>

            {form.scheduleMode === 'scheduled' && (
              <div className={styles.group}>
                <label className={styles.label}>Agendar para</label>
                <div className={styles.inputIconRow}>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={form.start_at}
                    onChange={e => setField('start_at', e.target.value)}
                  />
                  <Calendar size={16} />
                </div>
              </div>
            )}

            <div className={styles.group}>
              <label className={styles.label}>Template aprovado</label>
              <select
                className={styles.select}
                value={form.template_id}
                onChange={e => setField('template_id', e.target.value)}
              >
                <option value="">Selecionar…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} • {t.language_code}
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <small className={styles.hint}>
                  Idioma: <b>{selectedTemplate.language_code}</b>.
                </small>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== Step 2: Público ===== */}
      {step === 1 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Público-alvo</h3>
            <p className={styles.cardDesc}>
              Informe o destinatário ou faça upload do CSV (coluna <b>to</b> obrigatória).
            </p>
          </div>

          <div className={styles.grid1}>
            {form.sendKind === 'individual' ? (
              <div className={styles.group}>
                <label className={styles.label}>Destinatário (E.164)</label>
                <input
                  className={styles.input}
                  value={form.to}
                  onChange={e => setField('to', e.target.value)}
                  placeholder="Ex.: 5511999999999"
                />
              </div>
            ) : (
              <div className={styles.group}>
                <label className={styles.label}>Arquivo CSV</label>
                <div className={styles.fileRow}>
                  <input
                    id="csvInput"
                    type="file"
                    accept=".csv,text/csv"
                    className={styles.fileNative}
                    onChange={e => setField('file', e.target.files?.[0] || null)}
                  />
                  <label htmlFor="csvInput" className={styles.fileButton}>
                    <Upload size={16} /> {form.file ? 'Trocar arquivo…' : 'Selecionar arquivo…'}
                  </label>
                  <span className={styles.fileName}>
                    {form.file ? form.file.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <small className={styles.hint}>
                  O CSV deve conter a coluna <b>to</b> (E.164) e variáveis usadas no template.
                </small>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Step 3: Resposta padrão ===== */}
      {step === 2 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Resposta padrão</h3>
            <p className={styles.cardDesc}>
              O que acontece quando o cliente responder a esta mensagem.
            </p>
          </div>

          <div className={styles.grid2}>
            {/* origem */}
            <div className={styles.group}>
              <label className={styles.label}>Origem do envio</label>
              <select
                className={styles.select}
                value={form.origin}
                onChange={e => setField('origin', e.target.value)}
              >
                <option value="individual">Individual</option>
                <option value="agent_active">Iniciado por atendente</option>
                <option value="campaign">Campanha / CSV</option>
              </select>
              <small className={styles.hint}>
                Usado pelo worker para diferenciar a origem dos disparos.
              </small>
            </div>

            {/* ação */}
            <div className={styles.group}>
              <label className={styles.label}>Ação ao responder</label>
              <select
                className={styles.select}
                value={form.reply_action}
                onChange={e => setField('reply_action', e.target.value)}
              >
                <option value="open_ticket">Abrir ticket</option>
                <option value="flow_goto">Ir para bloco do fluxo</option>
              </select>
            </div>

            {/* open_ticket */}
            {form.reply_action === 'open_ticket' && (
              <>
                <div className={styles.group}>
                  <label className={styles.label}>Fila</label>
                  <select
                    className={styles.select}
                    value={form.queue}
                    onChange={e => {
                      setField('queue', e.target.value);
                      setField('agent', ''); // reset agente ao trocar fila
                    }}
                  >
                    <option value="">Selecionar…</option>
                    {queues.map(q => (
                      <option key={q.id ?? q.nome ?? q.name} value={q.id ?? q.nome ?? q.name}>
                        {q.nome ?? q.name ?? q.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Atendente (opcional)</label>
                  <select
                    className={styles.select}
                    value={form.agent}
                    onChange={e => setField('agent', e.target.value)}
                    disabled={!form.queue}
                  >
                    <option value="">Qualquer atendente da fila</option>
                    {agentsInQueue.map(u => (
                      <option key={u.email ?? u.id} value={u.email ?? u.id}>
                        {(u.name ? `${u.name} ${u.lastname || ''}`.trim() : u.email ?? u.id)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* flow_goto */}
            {form.reply_action === 'flow_goto' && (
              <>
                <div className={styles.group}>
                  <label className={styles.label}>Bloco de destino (obrigatório)</label>
                  <select
                    className={styles.select}
                    value={form.blockId}
                    onChange={e => setField('blockId', e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {flowBlocks.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {activeFlowId && (
                    <small className={styles.hint}>
                      Fluxo ativo:&nbsp;
                      <code style={{ opacity: .8 }}>{activeFlowId}</code>
                    </small>
                  )}
                </div>

                {/* Observação só quando NÃO for individual */}
                {form.sendKind !== 'individual' && (
                  <div className={styles.group}>
                    <label className={styles.label}>Observação</label>
                    <textarea
                      className={styles.textarea}
                      value={"Caso o bloco não exista, seu motor deve tratar como fallback (ex.: onerror)."}
                      readOnly
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ===== Step 4: Revisão ===== */}
      {step === 3 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Revisão</h3>
            <p className={styles.cardDesc}>Confira as informações antes de confirmar.</p>
          </div>

          <div className={styles.grid2}>
            <ReviewLine label="Nome" value={form.name || '—'} />
            <ReviewLine
              label="Tipo de envio"
              value={form.sendKind === 'csv' ? 'CSV (em massa)' : 'Individual'}
            />

            {form.sendKind === 'individual' ? (
              <ReviewLine label="Destinatário" value={form.to || '—'} />
            ) : (
              <ReviewLine label="Arquivo" value={form.file?.name || '—'} />
            )}

            <ReviewLine
              label="Template"
              value={selectedTemplate ? `${selectedTemplate.name} • ${selectedTemplate.language_code}` : '—'}
            />

            <ReviewLine
              label="Quando"
              value={
                form.scheduleMode === 'immediate'
                  ? 'Imediato'
                  : (form.start_at ? new Date(form.start_at).toLocaleString('pt-BR') : '—')
              }
            />

            <ReviewLine
              label="Ação de resposta"
              value={form.reply_action === 'open_ticket' ? 'Abrir ticket' : 'Ir para bloco do fluxo'}
            />

            {form.reply_action === 'open_ticket' ? (
              <>
                <ReviewLine label="Fila" value={resolveQueueName(form.queue) || '—'} />
                <ReviewLine
                  label="Atendente"
                  value={
                    (agentsInQueue.find(a => (a.email ?? a.id) === form.agent)?.email) ||
                    (agentsInQueue.find(a => (a.email ?? a.id) === form.agent)?.name) ||
                    (form.agent || '—')
                  }
                />
              </>
            ) : (
              <ReviewLine
                label="Bloco"
                value={
                  (flowBlocks.find(b => b.id === form.blockId)?.name) ||
                  (form.blockId || '—')
                }
              />
            )}
          </div>
        </section>
      )}

      {/* ===== Footer ===== */}
      <div className={styles.stickyFooter}>
        <div className={styles.stickyInner}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0 || loading}
          >
            Voltar
          </button>

          {step < 3 ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext(step) || loading}
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <Loader2 className={styles.spin} size={16}/> : null}
              Confirmar envio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewLine({ label, value }) {
  return (
    <div className={styles.group}>
      <label className={styles.label}>{label}</label>
      <div className={styles.input} style={{ background: '#f9fafb' }}>
        {String(value || '—')}
      </div>
    </div>
  );
}
