import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Upload } from 'lucide-react';
import { apiGet, apiPost } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/CampaignWizard.module.css';

export default function CampaignWizardPage({ onCreated }) {
  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    // Etapa 1
    name: '',
    mode: 'immediate',           // immediate | scheduled
    start_at: '',                // datetime-local

    // Etapa 2
    send_origin: 'campaign',     // campaign | individual | agent_active
    reply_action: 'open_ticket', // open_ticket | flow_goto
    reply_payload: '',           // JSON (string)

    // Etapa 3
    template_id: '',
    // Etapa 4
    file: null,                  // CSV com to, variáveis...
  });

  const topRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const data = await apiGet('/templates?status=approved');
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Falha ao carregar templates aprovados.');
      }
    })();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find(t => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handlePickFile(e) {
    const f = e.target.files?.[0] || null;
    setField('file', f);
  }

  // ===== Validações por etapa =====
  function validateStep(s) {
    if (s === 1) {
      if (!form.name.trim()) return 'Informe o nome da campanha.';
      if (form.mode === 'scheduled' && !form.start_at) return 'Defina a data/horário para agendamento.';
    }
    if (s === 2) {
      if (!['open_ticket', 'flow_goto'].includes(String(form.reply_action))) {
        return "Ação de resposta inválida. Use 'open_ticket' ou 'flow_goto'.";
      }
      if (form.reply_payload) {
        try { JSON.parse(form.reply_payload); } catch { return 'reply_payload precisa ser um JSON válido.'; }
      }
    }
    if (s === 3) {
      if (!selectedTemplate) return 'Selecione um template aprovado.';
    }
    if (s === 4) {
      if (!form.file) return 'Selecione o arquivo CSV.';
    }
    return null;
  }

  function canNext() {
    return validateStep(step) == null;
  }

  function gotoNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      toast.warn(err);
      return;
    }
    setError(null);
    setStep(s => Math.min(4, s + 1));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  function gotoPrev() {
    setStep(s => Math.max(1, s - 1));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    const err = validateStep(4);
    if (err) {
      setError(err);
      toast.warn(err);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const meta = {
        name: form.name.trim(),
        start_at: form.mode === 'scheduled' ? new Date(form.start_at).toISOString() : null,
        template: {
          name: selectedTemplate.name,
          language: { code: selectedTemplate.language_code },
          // componentes serão hidratados por CSV
        },
        // “gatilho” padrão para próxima resposta do cliente
        reply_action: form.reply_action || 'open_ticket',
      };

      if (form.reply_payload) {
        try {
          meta.reply_payload = JSON.parse(form.reply_payload);
        } catch { /* já validado acima */ }
      }

      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('meta', JSON.stringify(meta));

      const res = await apiPost('/campaigns', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.ok) {
        toast.success(res.message || 'Campanha criada!');
        onCreated?.(res);
      } else {
        setError(res?.error || 'Não foi possível criar a campanha.');
        toast.error(res?.error || 'Não foi possível criar a campanha.');
      }
    } catch (e) {
      setError('Erro ao criar campanha.');
      toast.error('Erro ao criar campanha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page} ref={topRef}>
      {/* Steps head */}
      <div className={styles.stepper} aria-label="Etapas">
        {[1,2,3,4].map(n => (
          <div key={n} className={`${styles.step} ${step === n ? styles.stepActive : ''} ${step > n ? styles.stepDone : ''}`}>
            <span className={styles.stepIdx}>{n}</span>
            <span className={styles.stepTxt}>
              {n === 1 && 'Configuração'}
              {n === 2 && 'Resposta padrão'}
              {n === 3 && 'Template'}
              {n === 4 && 'Destinatários'}
            </span>
          </div>
        ))}
      </div>

      {error && <div className={styles.alertErr}>⚠️ {error}</div>}

      {/* === Etapa 1: Configuração === */}
      {step === 1 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Configuração</h2>
            <p className={styles.cardDesc}>Nome, modo de envio e agendamento.</p>
          </div>

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
              <label className={styles.label}>Modo de envio</label>
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
              <div className={styles.groupFull}>
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
                <small className={styles.hint}>O horário é convertido para ISO e enviado ao backend.</small>
              </div>
            )}
          </div>
        </section>
      )}

      {/* === Etapa 2: Resposta padrão (gatilho) === */}
      {step === 2 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Resposta padrão</h2>
            <p className={styles.cardDesc}>O que acontece quando o cliente responder a esta campanha.</p>
          </div>

          <div className={styles.grid2}>
            <div className={styles.group}>
              <label className={styles.label}>Origem do envio</label>
              <select
                className={styles.select}
                value={form.send_origin}
                onChange={(e) => setField('send_origin', e.target.value)}
              >
                <option value="campaign">Campanha</option>
                <option value="individual">Envio individual</option>
                <option value="agent_active">Iniciado por atendente</option>
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
                onChange={(e) => setField('reply_action', e.target.value)}
              >
                <option value="open_ticket">Abrir ticket</option>
                <option value="flow_goto">Ir para bloco do fluxo</option>
              </select>
              <small className={styles.hint}>
                Se "Ir para bloco", informe o payload com o ID do bloco.
              </small>
            </div>

            <div className={styles.groupFull}>
              <label className={styles.label}>Reply payload (JSON)</label>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder='Ex.: { "blockId": "ofertas_bf" }'
                value={form.reply_payload}
                onChange={(e) => setField('reply_payload', e.target.value)}
              />
              <small className={styles.hint}>
                Deixe vazio para usar o padrão da API (/messages/send/template cria gatilho open_ticket).
              </small>
            </div>
          </div>
        </section>
      )}

      {/* === Etapa 3: Template === */}
      {step === 3 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Template aprovado</h2>
            <p className={styles.cardDesc}>Selecione o template que será enviado.</p>
          </div>

          <div className={styles.grid1}>
            <div className={styles.group}>
              <label className={styles.label}>Template</label>
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
                  Idioma: <b>{selectedTemplate.language_code}</b>. Variáveis virão do CSV.
                </small>
              )}
            </div>
          </div>
        </section>
      )}

      {/* === Etapa 4: Destinatários (CSV) === */}
      {step === 4 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Destinatários</h2>
            <p className={styles.cardDesc}>Envie um CSV com a coluna <b>to</b> e as variáveis necessárias.</p>
          </div>

          <div className={styles.grid1}>
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
                O CSV deve conter a coluna <b>to</b> (E.164). Outras colunas são mapeadas para as variáveis do template.
              </small>
            </div>
          </div>
        </section>
      )}

      {/* Footer com navegação */}
      <div className={styles.stickyFooter} role="region" aria-label="Ações">
        <div className={styles.stickyInner}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={gotoPrev}
            disabled={step === 1}
          >
            <ChevronLeft size={16}/> Anterior
          </button>

          {step < 4 ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={gotoNext}
              disabled={!canNext()}
            >
              Próximo <ChevronRight size={16}/>
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSubmit}
              disabled={loading || !!validateStep(4)}
            >
              {loading ? <Loader2 className={styles.spin} size={16}/> : null}
              Criar campanha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
