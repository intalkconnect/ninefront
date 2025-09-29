// File: CampaignWizard.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Calendar, Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/CampaignWizard.module.css';
import { toast } from 'react-toastify';

/**
 * Wizard em etapas para criação de campanha
 * - Etapa 1: Identificação
 * - Etapa 2: Template
 * - Etapa 3: Resposta padrão (origin/action/queue/agent/block)
 * - Etapa 4: Agendamento
 * - Etapa 5: Público (CSV)
 * - Revisão + Envio
 */

const ORIGINS = [
  { value: 'agent_active', label: 'Iniciado por atendente' },
  { value: 'individual',   label: 'Iniciado individualmente (API)' },
  { value: 'campaign',     label: 'Campanha' },
];

const ACTIONS = [
  { value: 'open_ticket', label: 'Abrir ticket (opcionalmente selecionar fila/atendente)' },
  { value: 'flow_goto',   label: 'Ir para bloco do fluxo' },
];

export default function CampaignWizardPage({ onCreated }) {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // dados carregados
  const [templates, setTemplates] = useState([]);
  const [queues, setQueues]       = useState([]);
  const [users, setUsers]         = useState([]);

  // formulário
  const [form, setForm] = useState({
    // etapa 1
    name: '',

    // etapa 2
    template_id: '',
    template_name: '',
    language_code: '',
    components: null, // deixamos null; variáveis virão do CSV

    // etapa 3 (resposta padrão)
    origin: 'agent_active',
    reply_action: 'open_ticket', // 'open_ticket' | 'flow_goto'
    reply_block_id: '',
    reply_queue_id: '',
    reply_queue_name: '',
    reply_assigned_to: '',

    // etapa 4 (agenda)
    mode: 'immediate', // 'immediate' | 'scheduled'
    start_at: '',

    // etapa 5 (csv)
    file: null,
  });

  const [touched, setTouched] = useState({});
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selectedTemplate = useMemo(
    () => templates.find(t => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  // Filtra os atendentes pela fila escolhida
  const filteredAgents = useMemo(() => {
    if (!form.reply_queue_id) return users || [];
    const id = String(form.reply_queue_id);
    const name = String(form.reply_queue_name || '');
    return (users || []).filter(u => {
      const fs = (u.filas || []).map(String);
      // compat: lista pode vir por id ou por nome
      return fs.includes(id) || (name && fs.includes(name));
    });
  }, [users, form.reply_queue_id, form.reply_queue_name]);

  // gera automaticamente o payload da resposta
  const buildReplyPayload = useCallback(() => {
    if (form.reply_action === 'open_ticket') {
      const obj = {};
      if (form.reply_queue_name)  obj.fila = form.reply_queue_name; // backend usa NOME
      if (form.reply_assigned_to) obj.assigned_to = form.reply_assigned_to;
      return Object.keys(obj).length ? obj : null;
    }
    if (form.reply_action === 'flow_goto') {
      return form.reply_block_id ? { blockId: form.reply_block_id } : null;
    }
    return null;
  }, [form.reply_action, form.reply_queue_name, form.reply_assigned_to, form.reply_block_id]);

  // ===== Carregamentos =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [tpl, qs, us] = await Promise.all([
          apiGet('/templates?status=approved'),
          apiGet('/queues'),
          apiGet('/users'),
        ]);
        if (!mounted) return;
        setTemplates(Array.isArray(tpl) ? tpl : []);
        setQueues(Array.isArray(qs) ? qs : []);
        setUsers(Array.isArray(us?.data ?? us) ? (us?.data ?? us) : []);
      } catch (e) {
        toast.error('Falha ao carregar dados iniciais.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // quando muda template_id, preenche name/idioma para envio
  useEffect(() => {
    if (!selectedTemplate) {
      setForm(p => ({ ...p, template_name: '', language_code: '' }));
      return;
    }
    setForm(p => ({
      ...p,
      template_name: selectedTemplate.name || '',
      language_code: selectedTemplate.language_code || selectedTemplate.language || '',
    }));
  }, [selectedTemplate]);

  // ===== validações por etapa =====
  const v1 = useMemo(() => ({
    nameInvalid: !form.name.trim(),
  }), [form.name]);

  const v2 = useMemo(() => ({
    tplInvalid: !selectedTemplate,
  }), [selectedTemplate]);

  const v3 = useMemo(() => {
    if (form.reply_action === 'flow_goto') {
      return { blockInvalid: !String(form.reply_block_id || '').trim() };
    }
    // open_ticket: sem obrigatoriedade
    return { blockInvalid: false };
  }, [form.reply_action, form.reply_block_id]);

  const v4 = useMemo(() => {
    const scheduled = form.mode === 'scheduled';
    const dateOk = !scheduled || Boolean(form.start_at);
    return { dateInvalid: !dateOk };
  }, [form.mode, form.start_at]);

  const v5 = useMemo(() => ({
    fileInvalid: !form.file,
  }), [form.file]);

  const canNext = useMemo(() => {
    if (loading) return false;
    if (step === 1) return !v1.nameInvalid;
    if (step === 2) return !v2.tplInvalid;
    if (step === 3) return !v3.blockInvalid;
    if (step === 4) return !v4.dateInvalid;
    if (step === 5) return !v5.fileInvalid;
    return true;
  }, [step, loading, v1, v2, v3, v4, v5]);

  // ===== envio =====
  async function handleSubmit() {
    try {
      setLoading(true);

      const meta = {
        name: form.name.trim(),
        start_at: form.mode === 'scheduled' && form.start_at
          ? new Date(form.start_at).toISOString()
          : null,
        template: {
          name: form.template_name,
          language: { code: form.language_code },
          // components: null  -> variáveis virão do CSV
        },
        // reply default
        reply_action: form.reply_action,
        reply_payload: buildReplyPayload() || undefined,
      };

      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('meta', JSON.stringify(meta));

      const res = await apiPost('/campaigns', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.ok) {
        toast.success(meta.start_at ? 'Campanha agendada!' : 'Campanha criada e enfileirada!');
        onCreated?.(res);
      } else {
        throw new Error(res?.error || 'Falha ao criar campanha.');
      }
    } catch (e) {
      toast.error(e?.message || 'Erro ao criar campanha.');
    } finally {
      setLoading(false);
    }
  }

  // ===== UI helpers =====
  const StepHeader = ({ title, desc }) => (
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <p className={styles.cardDesc}>{desc}</p>
    </div>
  );

  const FooterNav = () => (
    <div className={styles.wizFooter}>
      <div className={styles.wizFooterInner}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1 || loading}
        >
          <ChevronLeft size={16}/> Anterior
        </button>
        {step < 6 ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              setTouched(t => ({ ...t, [`step${step}`]: true }));
              if (canNext) setStep(s => s + 1);
            }}
            disabled={!canNext}
          >
            Próximo <ChevronRight size={16}/>
          </button>
        ) : (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 className={styles.spin} size={16}/> : <CheckCircle2 size={16}/>}
            {loading ? 'Enviando…' : 'Criar campanha'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Etapas */}
      <section className={styles.card}>
        <div className={styles.stepsHeader} role="tablist" aria-label="Etapas de criação">
          {['Identificação','Template','Resposta padrão','Agendamento','Público','Revisão']
            .map((label, idx) => {
              const n = idx + 1;
              const active = step === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`${styles.stepDot} ${active ? styles.active : ''}`}
                  onClick={() => setStep(n)}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className={styles.stepIdx}>{n}</span>
                  <span className={styles.stepLabel}>{label}</span>
                </button>
              );
            })}
        </div>

        {/* Conteúdo */}
        <div className={styles.cardBody}>
          {/* ===== Step 1: Identificação ===== */}
          {step === 1 && (
            <>
              <StepHeader
                title="Identificação"
                desc="Dê um nome para a campanha. Você verá esse nome na lista e nos relatórios."
              />
              <div className={styles.group}>
                <label className={styles.label}>
                  Nome da campanha <span className={styles.req}>(obrigatório)</span>
                </label>
                <input
                  className={`${styles.input} ${touched.step1 && v1.nameInvalid ? styles.invalid : ''}`}
                  placeholder="Ex.: Black Friday Leads"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, step1: true }))}
                />
                {touched.step1 && v1.nameInvalid && (
                  <span className={styles.errMsg}>Informe o nome da campanha.</span>
                )}
              </div>
            </>
          )}

          {/* ===== Step 2: Template ===== */}
          {step === 2 && (
            <>
              <StepHeader
                title="Template aprovado"
                desc="Selecione o template aprovado que será enviado. As variáveis serão lidas do CSV."
              />
              <div className={styles.group}>
                <label className={styles.label}>
                  Template <span className={styles.req}>(obrigatório)</span>
                </label>
                <select
                  className={`${styles.select} ${touched.step2 && v2.tplInvalid ? styles.invalid : ''}`}
                  value={form.template_id}
                  onChange={e => setField('template_id', e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, step2: true }))}
                >
                  <option value="">Selecione…</option>
                  {(templates || []).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {t.language_code || t.language}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <small className={styles.hint}>
                    Idioma: <b>{selectedTemplate.language_code || selectedTemplate.language}</b>.
                    Variáveis serão preenchidas a partir do CSV.
                  </small>
                )}
                {touched.step2 && v2.tplInvalid && (
                  <span className={styles.errMsg}>Selecione um template aprovado.</span>
                )}
              </div>
            </>
          )}

          {/* ===== Step 3: Resposta padrão ===== */}
          {step === 3 && (
            <>
              <StepHeader
                title="Resposta padrão"
                desc="Defina o que acontece quando o cliente responder a esta campanha."
              />

              <div className={styles.grid2}>
                <div className={styles.group}>
                  <label className={styles.label}>Origem do envio</label>
                  <select
                    className={styles.select}
                    value={form.origin}
                    onChange={e => setField('origin', e.target.value)}
                  >
                    {ORIGINS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <small className={styles.hint}>
                    O worker pode usar esse campo para diferenciar origem dos disparos.
                  </small>
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Ação ao responder</label>
                  <select
                    className={styles.select}
                    value={form.reply_action}
                    onChange={e => setField('reply_action', e.target.value)}
                  >
                    {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              {/* open_ticket -> fila + atendente (filtrado) */}
              {form.reply_action === 'open_ticket' && (
                <div className={styles.grid2}>
                  <div className={styles.group}>
                    <label className={styles.label}>Fila (opcional)</label>
                    <select
                      className={styles.select}
                      value={form.reply_queue_id}
                      onChange={e => {
                        const val = e.target.value;
                        const q = (queues || []).find(qx => String(qx.id ?? qx.nome ?? qx.name) === val);
                        const name = String(q?.nome ?? q?.name ?? '');
                        setForm(prev => ({
                          ...prev,
                          reply_queue_id: val,
                          reply_queue_name: name,
                          reply_assigned_to: '',
                        }));
                      }}
                    >
                      <option value="">(deixar em branco)</option>
                      {(queues || []).map(q => {
                        const id   = String(q.id ?? q.nome ?? q.name ?? '');
                        const nome = String(q.nome ?? q.name ?? id);
                        return <option key={id} value={id}>{nome}</option>;
                      })}
                    </select>
                    <small className={styles.hint}>
                      Ao selecionar uma fila, a lista de atendentes será filtrada automaticamente.
                    </small>
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>Atribuir a (opcional)</label>
                    <select
                      className={styles.select}
                      value={form.reply_assigned_to}
                      onChange={e => setField('reply_assigned_to', e.target.value)}
                      disabled={filteredAgents.length === 0}
                    >
                      <option value="">Ninguém</option>
                      {filteredAgents.map(u => (
                        <option key={u.email} value={u.email}>
                          {u.name ? `${u.name} — ${u.email}` : u.email}
                        </option>
                      ))}
                    </select>
                    {form.reply_queue_id && filteredAgents.length === 0 && (
                      <small className={styles.hint}>Nenhum atendente vinculado a esta fila.</small>
                    )}
                  </div>
                </div>
              )}

              {/* flow_goto -> block id */}
              {form.reply_action === 'flow_goto' && (
                <div className={styles.group}>
                  <label className={styles.label}>
                    ID do bloco destino <span className={styles.req}>(obrigatório)</span>
                  </label>
                  <input
                    className={`${styles.input} ${touched.step3 && v3.blockInvalid ? styles.invalid : ''}`}
                    placeholder='Ex.: ofertas_bf'
                    value={form.reply_block_id}
                    onChange={e => setField('reply_block_id', e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, step3: true }))}
                  />
                  {touched.step3 && v3.blockInvalid && (
                    <span className={styles.errMsg}>Informe o ID do bloco de destino.</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== Step 4: Agendamento ===== */}
          {step === 4 && (
            <>
              <StepHeader
                title="Agendamento"
                desc="Envie agora ou agende para uma data e horário específicos."
              />

              <div className={styles.group}>
                <div className={styles.optionsRow} role="radiogroup" aria-label="Modo de envio">
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="mode"
                      value="immediate"
                      checked={form.mode === 'immediate'}
                      onChange={() => setField('mode', 'immediate')}
                    />
                    <span>Imediata</span>
                  </label>
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="mode"
                      value="scheduled"
                      checked={form.mode === 'scheduled'}
                      onChange={() => setField('mode', 'scheduled')}
                    />
                    <span>Agendada</span>
                  </label>
                </div>
              </div>

              {form.mode === 'scheduled' && (
                <div className={styles.group}>
                  <label className={styles.label}>
                    Agendar para <span className={styles.req}>(obrigatório)</span>
                  </label>
                  <div className={styles.inputIconRow}>
                    <input
                      type="datetime-local"
                      className={`${styles.input} ${touched.step4 && v4.dateInvalid ? styles.invalid : ''}`}
                      value={form.start_at}
                      onChange={(e) => setField('start_at', e.target.value)}
                      onBlur={() => setTouched(t => ({ ...t, step4: true }))}
                    />
                    <Calendar size={16} />
                  </div>
                  {touched.step4 && v4.dateInvalid && (
                    <span className={styles.errMsg}>Informe a data e hora para o agendamento.</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== Step 5: Público (CSV) ===== */}
          {step === 5 && (
            <>
              <StepHeader
                title="Público"
                desc="Envie o CSV com os destinatários. Deve conter a coluna 'to' (E.164) e as variáveis do template."
              />

              <div className={styles.group}>
                <label className={styles.label}>
                  Arquivo CSV <span className={styles.req}>(obrigatório)</span>
                </label>
                <div className={styles.fileRow}>
                  <input
                    id="csvInput"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={e => setField('file', e.target.files?.[0] || null)}
                    className={styles.fileNative}
                  />
                  <label htmlFor="csvInput" className={styles.fileButton}>
                    <Upload size={16} /> {form.file ? 'Trocar arquivo…' : 'Selecionar arquivo…'}
                  </label>
                  <span className={styles.fileName}>
                    {form.file ? form.file.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <small className={styles.hint}>
                  Ex.: <code>to,first_name,offer</code> — as variáveis serão mapeadas automaticamente.
                </small>
                {touched.step5 && v5.fileInvalid && (
                  <span className={styles.errMsg}>Selecione o arquivo CSV.</span>
                )}
              </div>
            </>
          )}

          {/* ===== Step 6: Revisão ===== */}
          {step === 6 && (
            <>
              <StepHeader
                title="Revisão"
                desc="Confira os dados antes de criar a campanha."
              />
              <div className={styles.reviewGrid}>
                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>Nome</div>
                  <div className={styles.reviewValue}>{form.name || '—'}</div>
                </div>
                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>Template</div>
                  <div className={styles.reviewValue}>
                    {form.template_name
                      ? `${form.template_name} • ${form.language_code || '—'}`
                      : '—'}
                  </div>
                </div>

                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>Origem do envio</div>
                  <div className={styles.reviewValue}>
                    {ORIGINS.find(o => o.value === form.origin)?.label || form.origin}
                  </div>
                </div>

                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>Ação ao responder</div>
                  <div className={styles.reviewValue}>
                    {ACTIONS.find(a => a.value === form.reply_action)?.label || form.reply_action}
                  </div>
                </div>

                {form.reply_action === 'open_ticket' && (
                  <>
                    <div className={styles.reviewItem}>
                      <div className={styles.reviewLabel}>Fila</div>
                      <div className={styles.reviewValue}>{form.reply_queue_name || '—'}</div>
                    </div>
                    <div className={styles.reviewItem}>
                      <div className={styles.reviewLabel}>Atribuir a</div>
                      <div className={styles.reviewValue}>{form.reply_assigned_to || '—'}</div>
                    </div>
                  </>
                )}

                {form.reply_action === 'flow_goto' && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Bloco do fluxo</div>
                    <div className={styles.reviewValue}>{form.reply_block_id || '—'}</div>
                  </div>
                )}

                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>Modo</div>
                  <div className={styles.reviewValue}>
                    {form.mode === 'scheduled'
                      ? `Agendada para ${form.start_at || '—'}`
                      : 'Imediata'}
                  </div>
                </div>

                <div className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>CSV</div>
                  <div className={styles.reviewValue}>{form.file?.name || '—'}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <FooterNav />
      </section>
    </div>
  );
}
