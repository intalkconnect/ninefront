import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import { Calendar, Upload, Loader2, Check, ChevronRight } from 'lucide-react';
import styles from './styles/CampaignWizardPage.module.css';

// helpers
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

export default function CampaignWizardPage({ onCreated }) {
  const [step, setStep] = useState(1); // 1..6
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  // dados remotos
  const [templates, setTemplates] = useState([]);
  const [activeFlowMeta, setActiveFlowMeta] = useState(null);
  const [activeFlowData, setActiveFlowData] = useState(null);
  const flowBlocks = useMemo(() => {
    const blocks = activeFlowData?.blocks || {};
    return Object.entries(blocks).map(([id, b]) => ({ id, title: b?.title || id }));
  }, [activeFlowData]);

  // formulário
  const [form, setForm] = useState({
    mode: 'mass', // 'mass' | 'individual'

    // template
    template_id: '',

    // comportamento na resposta
    reply_mode: 'flow',   // 'flow' | 'queue'
    flow_block_id: '',
    fila: '',
    agente_email: '',

    // mass
    name: '',
    schedule_mode: 'immediate', // 'immediate' | 'scheduled'
    start_at: '',
    csvFile: null,

    // individual
    msisdn: '',
  });

  const selectedTemplate = useMemo(
    () => templates.find(t => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  function setField(k, v) {
    setError(null);
    setForm(prev => ({ ...prev, [k]: v }));
  }
  const next = () => setStep(s => Math.min(6, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  // carregar templates + fluxo ativo
  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [tpls, latest] = await Promise.all([
          apiGet('/templates?status=approved').catch(() => []),
          apiGet('/flows/latest').catch(() => []),
        ]);

        setTemplates(Array.isArray(tpls) ? tpls : []);

        const active = Array.isArray(latest) ? latest.find(f => f.active) : latest?.[0];
        if (active?.id) {
          setActiveFlowMeta(active);
          const data = await apiGet(`/flows/data/${active.id}`).catch(() => null);
          setActiveFlowData(data || null);
        }
      } catch {
        setError('Falha ao carregar templates/fluxo.');
      }
    })();
  }, []);

  // montar reply_action/payload conforme UI
  function buildReplyActionAndPayload() {
    if (form.reply_mode === 'flow') {
      return {
        reply_action: 'flow_goto',
        reply_payload: form.flow_block_id ? { block_id: form.flow_block_id } : {},
      };
    }
    const payload = {};
    if (form.fila) payload.fila = form.fila;
    if (form.agente_email) payload.assigned_to = form.agente_email;
    return { reply_action: 'open_ticket', reply_payload: payload };
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (loading) return;

    try {
      setError(null);
      setLoading(true);

      const { reply_action, reply_payload } = buildReplyActionAndPayload();

      if (form.mode === 'mass') {
        if (!form.name.trim()) throw new Error('Informe o nome da campanha.');
        if (!selectedTemplate) throw new Error('Selecione um template aprovado.');
        if (!form.csvFile) throw new Error('Envie o CSV com a coluna "to".');
        if (form.schedule_mode === 'scheduled' && !form.start_at) {
          throw new Error('Defina data/horário para agendar.');
        }

        const meta = {
          name: form.name.trim(),
          start_at:
            form.schedule_mode === 'scheduled' && form.start_at
              ? new Date(form.start_at).toISOString()
              : null,
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
          },
          reply_action,
          reply_payload,
        };

        const fd = new FormData();
        fd.append('file', form.csvFile);
        fd.append('meta', JSON.stringify(meta));

        const res = await apiPost('/campaigns', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (!res?.ok) throw new Error(res?.error || 'Falha ao criar campanha.');
        onCreated?.(res);
      } else {
        // individual
        const to = onlyDigits(form.msisdn);
        if (!to) throw new Error('Informe um número válido (E.164).');
        if (!selectedTemplate) throw new Error('Selecione um template aprovado.');

        const payload = {
          to,
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
          },
          origin: 'individual',
          reply_action,
          reply_payload,
        };

        const sent = await apiPost('/messages/send/template', payload);
        if (!sent?.enqueued) throw new Error(sent?.error || 'Não foi possível enviar.');

        // posicionar sessão (opcional) se reply_mode=flow
        if (form.reply_mode === 'flow' && form.flow_block_id && activeFlowMeta?.id) {
          try {
            setSavingSession(true);
            const userId = `${to}@w.msgcli.net`;
            await apiPost(`/flows/sessions/${encodeURIComponent(userId)}`, {
              current_block: form.flow_block_id,
              flow_id: activeFlowMeta.id,
              vars: {},
            });
          } catch {
            // não bloqueia o envio
          } finally {
            setSavingSession(false);
          }
        }

        onCreated?.(sent);
      }

      // reset
      setForm({
        mode: 'mass',
        template_id: '',
        reply_mode: 'flow',
        flow_block_id: '',
        fila: '',
        agente_email: '',
        name: '',
        schedule_mode: 'immediate',
        start_at: '',
        csvFile: null,
        msisdn: '',
      });
      setStep(1);
    } catch (e2) {
      setError(e2?.message || 'Erro ao finalizar.');
    } finally {
      setLoading(false);
      setSavingSession(false);
    }
  }

  const StepHeader = ({ n, title, done }) => (
    <div className={styles.stepHeader}>
      <div className={`${styles.stepCircle} ${done ? styles.stepCircleDone : ''}`}>
        {done ? <Check size={16} /> : n}
      </div>
      <div className={styles.stepTitle}>{title}</div>
    </div>
  );

  const Card = ({ children }) => <div className={styles.card}>{children}</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Novo disparo</h1>

      {/* Steps topo */}
      <div className={styles.stepsGrid}>
        <Card><StepHeader n={1} title="Tipo" done={step > 1} /></Card>
        <Card><StepHeader n={2} title="Template" done={step > 2} /></Card>
        <Card><StepHeader n={3} title="Resposta do cliente" done={step > 3} /></Card>
      </div>
      <div className={styles.stepsGrid}>
        <Card><StepHeader n={4} title="Agendamento" done={step > 4} /></Card>
        <Card><StepHeader n={5} title="Público" done={step > 5} /></Card>
        <Card><StepHeader n={6} title="Revisão & envio" done={false} /></Card>
      </div>

      {error && <div className={styles.alertErr}>⚠️ {error}</div>}

      <form onSubmit={handleSubmit}>
        {/* STEP 1 */}
        {step === 1 && (
          <Card>
            <div className={styles.blockTitle}>Como você quer disparar?</div>
            <div className={styles.row}>
              <label className={`${styles.selectTile} ${form.mode === 'mass' ? styles.tileActive : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  checked={form.mode === 'mass'}
                  onChange={() => setField('mode', 'mass')}
                />
                <div className={styles.tileTitle}>Em massa (CSV)</div>
                <div className={styles.tileDesc}>
                  Carregue um CSV com coluna <b>to</b> e variáveis.
                </div>
              </label>

              <label className={`${styles.selectTile} ${form.mode === 'individual' ? styles.tileActive : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  checked={form.mode === 'individual'}
                  onChange={() => setField('mode', 'individual')}
                />
                <div className={styles.tileTitle}>Individual</div>
                <div className={styles.tileDesc}>Enviar para um único número.</div>
              </label>
            </div>

            <div className={styles.actionsRight}>
              <button type="button" onClick={next} className={styles.btnPrimary}>
                Continuar <ChevronRight size={16} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </Card>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <Card>
            <div className={styles.blockTitle}>Template aprovado</div>
            <select
              className={styles.input}
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
              <div className={styles.hint}>
                Idioma: <b>{selectedTemplate.language_code}</b>. Em massa, as variáveis vêm do CSV.
              </div>
            )}

            <div className={styles.actionsSplit}>
              <button type="button" onClick={back} className={styles.btn}>
                Voltar
              </button>
              <button type="button" onClick={next} className={styles.btnPrimary}>
                Continuar
              </button>
            </div>
          </Card>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <Card>
            <div className={styles.blockTitle}>Quando o cliente responder…</div>

            <div className={styles.radioRow}>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="reply_mode"
                  value="flow"
                  checked={form.reply_mode === 'flow'}
                  onChange={() => setField('reply_mode', 'flow')}
                />
                <span>Seguir no fluxo</span>
              </label>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="reply_mode"
                  value="queue"
                  checked={form.reply_mode === 'queue'}
                  onChange={() => setField('reply_mode', 'queue')}
                />
                <span>Abrir ticket (fila/agente)</span>
              </label>
            </div>

            {form.reply_mode === 'flow' && (
              <div className={styles.stack}>
                <div className={styles.hint}>
                  Fluxo ativo: {activeFlowMeta?.id ? <b>#{activeFlowMeta.id}</b> : <i>não encontrado</i>}
                </div>
                <label className={styles.label}>Bloco de destino</label>
                <select
                  className={styles.input}
                  value={form.flow_block_id}
                  onChange={(e) => setField('flow_block_id', e.target.value)}
                >
                  <option value="">Selecione um bloco…</option>
                  {flowBlocks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.id})
                    </option>
                  ))}
                </select>
                <div className={styles.hintSmall}>
                  No <b>individual</b>, a sessão já é posicionada neste bloco agora.
                  Na <b>campanha</b>, o backend usa como padrão via <code>default_reply_*</code>.
                </div>
              </div>
            )}

            {form.reply_mode === 'queue' && (
              <div className={styles.grid2}>
                <div>
                  <label className={styles.label}>Fila</label>
                  <input
                    className={styles.input}
                    placeholder="Ex.: Suporte N1"
                    value={form.fila}
                    onChange={(e) => setField('fila', e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label}>Atribuir ao atendente (opcional)</label>
                  <input
                    className={styles.input}
                    placeholder="email do agente"
                    value={form.agente_email}
                    onChange={(e) => setField('agente_email', e.target.value)}
                  />
                </div>
                <div className={styles.gridFull + ' ' + styles.hintSmall}>
                  Na <b>campanha</b>, isso vira <code>default_reply_payload</code>.
                </div>
              </div>
            )}

            <div className={styles.actionsSplit}>
              <button type="button" onClick={back} className={styles.btn}>
                Voltar
              </button>
              <button type="button" onClick={next} className={styles.btnPrimary}>
                Continuar
              </button>
            </div>
          </Card>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <Card>
            {form.mode === 'mass' ? (
              <>
                <div className={styles.blockTitle}>Agendamento</div>
                <div className={styles.radioRow}>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="schedule_mode"
                      value="immediate"
                      checked={form.schedule_mode === 'immediate'}
                      onChange={() => setField('schedule_mode', 'immediate')}
                    />
                    <span>Imediata</span>
                  </label>
                  <label className={styles.radioItem}>
                    <input
                      type="radio"
                      name="schedule_mode"
                      value="scheduled"
                      checked={form.schedule_mode === 'scheduled'}
                      onChange={() => setField('schedule_mode', 'scheduled')}
                    />
                    <span>Agendada</span>
                  </label>
                </div>

                {form.schedule_mode === 'scheduled' && (
                  <div>
                    <label className={styles.label}>Agendar para</label>
                    <div className={styles.inputIconRow}>
                      <input
                        type="datetime-local"
                        className={styles.input}
                        value={form.start_at}
                        onChange={(e) => setField('start_at', e.target.value)}
                      />
                      <Calendar size={18} />
                    </div>
                    <div className={styles.hintSmall}>
                      Enviado em ISO/UTC para o backend.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.hint}>
                Disparo individual não tem agendamento (use campanha em massa).
              </div>
            )}

            <div className={styles.actionsSplit}>
              <button type="button" onClick={back} className={styles.btn}>
                Voltar
              </button>
              <button type="button" onClick={next} className={styles.btnPrimary}>
                Continuar
              </button>
            </div>
          </Card>
        )}

        {/* STEP 5 */}
        {step === 5 && (
          <Card>
            {form.mode === 'mass' ? (
              <>
                <div className={styles.blockTitle}>Arquivo CSV</div>
                <div className={styles.fileRow}>
                  <input
                    id="csvInput"
                    type="file"
                    accept=".csv,text/csv"
                    className={styles.fileNative}
                    onChange={(e) => setField('csvFile', e.target.files?.[0] || null)}
                  />
                  <label htmlFor="csvInput" className={styles.fileButton}>
                    <Upload size={16} /> {form.csvFile ? 'Trocar arquivo…' : 'Selecionar arquivo…'}
                  </label>
                  <span className={styles.fileName}>
                    {form.csvFile ? form.csvFile.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <div className={styles.hintSmall}>
                  O CSV deve conter a coluna <b>to</b> (E.164) e as variáveis do template.
                </div>
                <div className={styles.mt4}>
                  <label className={styles.label}>Nome da campanha</label>
                  <input
                    className={styles.input}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Ex.: Black Friday Leads"
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.blockTitle}>Número do cliente (E.164)</div>
                <input
                  className={styles.input}
                  placeholder="Ex.: 5511999998888"
                  value={form.msisdn}
                  onChange={(e) => setField('msisdn', e.target.value)}
                />
                <div className={styles.hintSmall}>
                  Será enviado via <code>/messages/send/template</code>.
                </div>
              </>
            )}

            <div className={styles.actionsSplit}>
              <button type="button" onClick={back} className={styles.btn}>
                Voltar
              </button>
              <button type="button" onClick={next} className={styles.btnPrimary}>
                Continuar
              </button>
            </div>
          </Card>
        )}

        {/* STEP 6 */}
        {step === 6 && (
          <Card>
            <div className={styles.blockTitle}>Revisão</div>
            <ul className={styles.reviewList}>
              <li><b>Tipo:</b> {form.mode === 'mass' ? 'Em massa (CSV)' : 'Individual'}</li>
              {form.mode === 'mass' && <li><b>Nome:</b> {form.name || '—'}</li>}
              <li><b>Template:</b> {selectedTemplate ? `${selectedTemplate.name} • ${selectedTemplate.language_code}` : '—'}</li>
              <li>
                <b>Ao responder:</b>{' '}
                {form.reply_mode === 'flow'
                  ? (form.flow_block_id ? `Seguir no fluxo em "${form.flow_block_id}"` : 'Seguir no fluxo (bloco não escolhido)')
                  : `Abrir ticket na fila "${form.fila || '—'}"${form.agente_email ? `, agente ${form.agente_email}` : ''}`
                }
              </li>
              {form.mode === 'mass' && (
                <li>
                  <b>Envio:</b>{' '}
                  {form.schedule_mode === 'immediate'
                    ? 'Imediato'
                    : `Agendado para ${form.start_at || '—'}`}
                </li>
              )}
              {form.mode === 'mass'
                ? <li><b>CSV:</b> {form.csvFile?.name || '—'}</li>
                : <li><b>Número:</b> {onlyDigits(form.msisdn) || '—'}</li>
              }
            </ul>

            <div className={styles.actionsSplit}>
              <button type="button" onClick={back} className={styles.btn}>
                Voltar
              </button>
              <button
                type="submit"
                className={`${styles.btnPrimary} ${styles.btnSuccess}`}
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className={styles.spin} /> : null}
                {form.mode === 'mass' ? 'Criar campanha' : 'Enviar mensagem'}
              </button>
            </div>

            {savingSession && (
              <div className={styles.hintSmall} style={{ marginTop: 8 }}>
                Posicionando sessão no bloco escolhido…
              </div>
            )}
          </Card>
        )}
      </form>
    </div>
  );
}
