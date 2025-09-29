import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Upload, Calendar, Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import styles from './styles/CampaignWizard.module.css';
import { toast } from 'react-toastify';

/**
 * Wizard de criação de campanha/envio ativo
 *
 * Fluxos suportados:
 * - Massa (CSV): POST /campaigns   (multipart: file + meta)
 * - Individual:  POST /messages/send/template (JSON)
 *
 * Regras:
 * - Agendamento só existe para Massa (CSV).
 * - reply_action = 'open_ticket'
 * - reply_payload = { fila: <nome_da_fila>, assigned_to?: <email> }
 * - Atendentes são filtrados pela fila selecionada.
 */

// Helpers para normalizar filas
function normalizeQueues(queues) {
  return (Array.isArray(queues) ? queues : []).map((q) => {
    if (typeof q === 'string') return { id: q, nome: q };
    const id = q?.id ?? q?.nome ?? q?.name;
    const nome = q?.nome ?? q?.name ?? String(id || '');
    return { id: String(id), nome: String(nome) };
  }).filter(q => q.id && q.nome);
}

export default function CampaignWizard({ onCreated }) {
  // ====== Estado geral ======
  const [step, setStep] = useState(0); // 0..3
  const maxStep = 3;

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // dados carregados
  const [templates, setTemplates] = useState([]);
  const [queues, setQueues]       = useState([]);  // filas (normalizadas)
  const [users, setUsers]         = useState([]);  // todos usuários (para filtrar atendentes por fila)

  // formulário
  const [form, setForm] = useState({
    // Etapa 0 — Configuração
    name: '',
    sendType: 'mass',      // 'mass' | 'single'
    mode: 'immediate',     // 'immediate' | 'scheduled' (apenas mass)
    start_at: '',

    // Etapa 1 — Resposta
    fila: '',              // guardaremos o NOME da fila (não o id)
    assigned_to: '',       // email do atendente (opcional)

    // Etapa 2 — Template & Destino
    template_id: '',
    file: null,            // quando mass
    to: '',                // quando single (E.164)
  });

  // ====== Helpers ======
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const selectedTemplate = useMemo(
    () => templates.find(t => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  const queuesNorm = useMemo(() => normalizeQueues(queues), [queues]);

  const selectedQueue = useMemo(
    () => queuesNorm.find(q => q.nome === form.fila) || null,
    [queuesNorm, form.fila]
  );

  const agentsForQueue = useMemo(() => {
    if (!selectedQueue) return [];
    const wantNome = selectedQueue.nome;
    const wantId   = selectedQueue.id;
    const norm = (arr) => (Array.isArray(arr) ? arr.map(x => String(x)) : []);
    return (users || []).filter(u => {
      const filas = norm(u.filas);
      // alguns ambientes armazenam ids, outros nomes — tentamos ambos
      return filas.includes(String(wantNome)) || filas.includes(String(wantId));
    });
  }, [users, selectedQueue]);

  // Etapa 0
  const canNextFromStep0 = useMemo(() => {
    if (!form.name.trim()) return false;
    if (form.sendType === 'mass' && form.mode === 'scheduled' && !form.start_at) return false;
    return true;
  }, [form.name, form.sendType, form.mode, form.start_at]);

  // Etapa 1
  const canNextFromStep1 = useMemo(() => !!String(form.fila || '').trim(), [form.fila]);

  // Etapa 2
  const canNextFromStep2 = useMemo(() => {
    if (!selectedTemplate) return false;
    if (form.sendType === 'mass') return Boolean(form.file);
    return !!form.to.trim(); // single
  }, [selectedTemplate, form.file, form.to, form.sendType]);

  const canCreate = useMemo(
    () => canNextFromStep0 && canNextFromStep1 && canNextFromStep2,
    [canNextFromStep0, canNextFromStep1, canNextFromStep2]
  );

  // ====== Load inicial ======
  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [tRes, qRes, uRes] = await Promise.all([
        apiGet('/templates?status=approved'), // templates aprovados
        apiGet('/queues'),                    // filas
        apiGet('/users'),                     // usuários (array ou { data: [] })
      ]);

      setTemplates(Array.isArray(tRes) ? tRes : []);
      setQueues(Array.isArray(qRes) ? qRes : []);
      setUsers(Array.isArray(uRes?.data) ? uRes.data : Array.isArray(uRes) ? uRes : []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar dados (templates/filas/usuários).');
      toast.error('Falha ao carregar dados.');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ====== Etapas ======
  function goPrev() {
    setStep(s => Math.max(0, s - 1));
  }
  function goNext() {
    if (step === 0 && !canNextFromStep0) { toast.warn('Preencha os campos obrigatórios.'); return; }
    if (step === 1 && !canNextFromStep1) { toast.warn('Selecione a fila.'); return; }
    if (step === 2 && !canNextFromStep2) { 
      toast.warn(form.sendType === 'mass' ? 'Selecione o template e o arquivo CSV.' : 'Informe o número do destinatário e o template.');
      return; 
    }
    setStep(s => Math.min(maxStep, s + 1));
  }

  function handlePickFile(e) {
    const f = e.target.files?.[0] || null;
    setField('file', f);
  }

  // ====== Criação ======
  async function handleCreate() {
    if (!canCreate) {
      toast.warn('Confira os campos obrigatórios.');
      return;
    }

    const reply_payload = {
      fila: form.fila || null, // nome da fila
      ...(form.assigned_to ? { assigned_to: form.assigned_to } : {})
    };

    try {
      setLoading(true);
      setError(null);

      if (form.sendType === 'mass') {
        // ===== Massa (CSV) → /campaigns
        const meta = {
          name: form.name.trim(),
          start_at: form.mode === 'scheduled' ? new Date(form.start_at).toISOString() : null,
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
          },
          reply_action: 'open_ticket',
          reply_payload
        };

        const fd = new FormData();
        fd.append('file', form.file);
        fd.append('meta', JSON.stringify(meta));

        const res = await apiPost('/campaigns', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res?.ok) {
          toast.success(
            meta.start_at
              ? 'Campanha agendada! O scheduler disparará no horário definido.'
              : 'Campanha criada! O scheduler iniciará o envio.'
          );
          onCreated?.(res);
        } else {
          setError(res?.error || 'Não foi possível criar a campanha.');
          toast.error(res?.error || 'Não foi possível criar a campanha.');
        }
      } else {
        // ===== Individual → /messages/send/template
        const payload = {
          to: form.to.trim(),
          origin: 'individual',
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
            // components: (opcional) — variáveis se quiser validar antes
          },
          reply_action: 'open_ticket',
          reply_payload,
        };

        // esse endpoint é JSON puro
        const res = await apiPost('/messages/send/template', payload);

        if (res?.enqueued) {
          toast.success('Mensagem ativa enfileirada com sucesso.');
          onCreated?.(res);
        } else {
          setError(res?.error || 'Não foi possível enviar a mensagem.');
          toast.error(res?.error || 'Não foi possível enviar a mensagem.');
        }
      }
    } catch (e) {
      console.error(e);
      setError('Erro ao processar o envio.');
      toast.error('Erro ao processar o envio.');
    } finally {
      setLoading(false);
    }
  }

  // ====== UI auxiliares ======
  const stepLabel = (idx) => {
    switch (idx) {
      case 0: return 'Configuração';
      case 1: return 'Resposta';
      case 2: return 'Template & Destino';
      case 3: return 'Revisão';
      default: return '';
    }
  };

  // ====== Render ======
  return (
    <div className={styles.page}>
      {/* Stepper */}
      <div className={styles.stepper} role="navigation" aria-label="Etapas">
        {[0,1,2,3].map((i) => {
          const active = step === i;
          const done   = step > i;
          return (
            <div
              key={i}
              className={`${styles.step} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className={styles.stepIdx}>{i + 1}</span>
              <span className={styles.stepTxt}>{stepLabel(i)}</span>
            </div>
          );
        })}
      </div>

      {error && <div className={styles.alertErr}>⚠️ {error}</div>}

      {/* ====== STEP 0 — Configuração ====== */}
      {step === 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Configuração</h2>
            <p className={styles.cardDesc}>Defina nome, tipo de envio e (se massa) o agendamento.</p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.grid2}>
              <div className={styles.group}>
                <label className={styles.label}>Nome da campanha</label>
                <input
                  className={styles.input}
                  placeholder="Ex.: Black Friday Leads"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Tipo de envio</label>
                <div className={styles.optionsRow} role="radiogroup" aria-label="Tipo de envio">
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="sendType"
                      value="mass"
                      checked={form.sendType === 'mass'}
                      onChange={() => setField('sendType', 'mass')}
                    />
                    <span>Massa (CSV)</span>
                  </label>
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="sendType"
                      value="single"
                      checked={form.sendType === 'single'}
                      onChange={() => setField('sendType', 'single')}
                    />
                    <span>Individual</span>
                  </label>
                </div>
              </div>

              {form.sendType === 'mass' && (
                <>
                  <div className={styles.group}>
                    <label className={styles.label}>Modo de execução</label>
                    <div className={styles.optionsRow} role="radiogroup" aria-label="Modo de execução">
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
                      <label className={styles.label}>Agendar para</label>
                      <div className={styles.inputIconRow}>
                        <input
                          type="datetime-local"
                          className={styles.input}
                          value={form.start_at}
                          onChange={(e) => setField('start_at', e.target.value)}
                        />
                        <Calendar size={16} />
                      </div>
                      <span className={styles.hint}>Será convertido para ISO e enviado ao backend.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ====== STEP 1 — Resposta (fila/atendente) ====== */}
      {step === 1 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Resposta do cliente</h2>
            <p className={styles.cardDesc}>
              Defina para qual <b>fila</b> o retorno do cliente abrirá o ticket. Opcionalmente, selecione um <b>atendente</b> dessa fila.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.grid2}>
              <div className={styles.group}>
                <label className={styles.label}>Fila (obrigatório)</label>
                <select
                  className={styles.select}
                  value={form.fila}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      fila: v,
                      assigned_to: '' // ao trocar fila, limpamos atendente para evitar inconsistência
                    }));
                  }}
                >
                  <option value="">Selecione…</option>
                  {queuesNorm.map(q => (
                    <option key={q.id} value={q.nome}>{q.nome}</option>
                  ))}
                </select>
                <small className={styles.hint}>
                  Quando o cliente responder, será criado um ticket nesta fila (reply_action: <b>open_ticket</b>).
                </small>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Atendente (opcional)</label>
                <select
                  className={styles.select}
                  value={form.assigned_to}
                  onChange={(e) => setField('assigned_to', e.target.value)}
                  disabled={!form.fila}
                >
                  <option value="">Sem atendente específico</option>
                  {agentsForQueue.map(u => {
                    const label = u.name
                      ? `${u.name}${u.lastname ? ` ${u.lastname}` : ''} — ${u.email}`
                      : u.email;
                    return <option key={u.email} value={u.email}>{label}</option>;
                  })}
                </select>
                <small className={styles.hint}>
                  A lista mostra apenas atendentes vinculados à fila selecionada.
                </small>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====== STEP 2 — Template & Destino ====== */}
      {step === 2 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Template & Destino</h2>
            <p className={styles.cardDesc}>
              Selecione o template aprovado e informe o destino conforme o tipo de envio.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.grid2}>
              <div className={styles.group}>
                <label className={styles.label}>Template aprovado</label>
                <select
                  className={styles.select}
                  value={form.template_id}
                  onChange={(e) => setField('template_id', e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {t.language_code}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <small className={styles.hint}>
                    Idioma: <b>{selectedTemplate.language_code}</b>. Variáveis virão do CSV (massa) ou do template (individual).
                  </small>
                )}
              </div>

              {form.sendType === 'mass' ? (
                <div className={styles.group}>
                  <label className={styles.label}>Arquivo CSV</label>
                  <div className={styles.fileRow}>
                    <input
                      id="csvInput"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handlePickFile}
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
                    O CSV deve conter a coluna <b>to</b> (E.164) e colunas com variáveis usadas no template.
                  </small>
                </div>
              ) : (
                <div className={styles.group}>
                  <label className={styles.label}>Número do destinatário (E.164)</label>
                  <input
                    className={styles.input}
                    placeholder="Ex.: 5511999998888"
                    value={form.to}
                    onChange={(e) => setField('to', e.target.value.replace(/\s+/g, ''))}
                  />
                  <small className={styles.hint}>
                    Envio individual não possui agendamento; é enfileirado imediatamente.
                  </small>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ====== STEP 3 — Revisão ====== */}
      {step === 3 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Revisão</h2>
            <p className={styles.cardDesc}>Confira as informações antes de confirmar.</p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.grid2}>
              <div className={styles.group}>
                <label className={styles.label}>Nome</label>
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                  {form.name || '—'}
                </div>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Tipo de envio</label>
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                  {form.sendType === 'mass' ? 'Massa (CSV)' : 'Individual'}
                </div>
              </div>

              {form.sendType === 'mass' ? (
                <>
                  <div className={styles.group}>
                    <label className={styles.label}>Execução</label>
                    <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                      {form.mode === 'scheduled'
                        ? (form.start_at ? new Date(form.start_at).toLocaleString('pt-BR') : 'Agendada (sem data)')
                        : 'Imediata'}
                    </div>
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>Arquivo</label>
                    <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                      {form.file?.name || '—'}
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.group}>
                  <label className={styles.label}>Destinatário</label>
                  <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                    {form.to || '—'}
                  </div>
                </div>
              )}

              <div className={styles.group}>
                <label className={styles.label}>Fila</label>
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                  {form.fila || '—'}
                </div>
                <small className={styles.hint}>reply_action: open_ticket</small>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Atendente</label>
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                  {form.assigned_to || '—'}
                </div>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Template</label>
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center' }}>
                  {selectedTemplate ? `${selectedTemplate.name} • ${selectedTemplate.language_code}` : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====== Footer / Navegação ====== */}
      <div className={styles.stickyFooter} role="region" aria-label="Ações do wizard">
        <div className={styles.stickyInner}>
          <div />
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button type="button" className={styles.btnGhost} onClick={goPrev}>
                Voltar
              </button>
            )}
            {step < maxStep && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={goNext}
                disabled={
                  (step === 0 && !canNextFromStep0) ||
                  (step === 1 && !canNextFromStep1) ||
                  (step === 2 && !canNextFromStep2)
                }
              >
                Avançar
              </button>
            )}
            {step === maxStep && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={loading || !canCreate}
              >
                {loading ? <Loader2 className={styles.spin} size={16}/> : null}
                {loading ? 'Processando…' : (form.sendType === 'mass' ? 'Criar campanha' : 'Enviar mensagem')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
