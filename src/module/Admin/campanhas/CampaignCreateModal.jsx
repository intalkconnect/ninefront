import React, { useEffect, useMemo, useState } from 'react';
import { X as XIcon, Upload, Calendar, Loader2 } from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/CampaignCreateModal.module.css';

export default function CampaignCreateModal({
  isOpen,
  onClose,
  onCreated, // callback para recarregar a lista
}) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    name: '',
    mode: 'immediate',        // 'immediate' | 'scheduled'
    start_at: '',             // datetime-local (ISO parcial)
    template_id: '',          // id selecionado
    file: null,
  });
  const [error, setError] = useState(null);

  // carrega templates aprovados
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setError(null);
        const data = await apiGet('/templates?status=approved');
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e) {
        setError('Falha ao carregar templates aprovados.');
      }
    })();
  }, [isOpen]);

  // template selecionado
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    // validações mínimas
    if (!form.name.trim()) return setError('Informe o nome da campanha.');
    if (!selectedTemplate) return setError('Selecione um template aprovado.');
    if (!form.file) return setError('Selecione o arquivo CSV.');

    if (form.mode === 'scheduled' && !form.start_at) {
      return setError('Defina a data/horário para agendamento.');
    }

    try {
      setLoading(true);
      setError(null);

      // monta meta conforme a rota /campaigns (apenas meta + file)
      const meta = {
        name: form.name.trim(),
        start_at: form.mode === 'scheduled' ? new Date(form.start_at).toISOString() : null,
        template: {
          name: selectedTemplate.name,
          language: { code: selectedTemplate.language_code },
          // sem components — variáveis virão do CSV
        },
      };

      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('meta', JSON.stringify(meta));

      const res = await apiPost('/campaigns', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.ok) {
        // limpa e fecha
        setForm({ name: '', mode: 'immediate', start_at: '', template_id: '', file: null });
        onCreated?.(res);
        onClose?.();
      } else {
        setError(res?.error || 'Não foi possível criar a campanha.');
      }
    } catch (e) {
      setError('Erro ao criar campanha.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.cmpModalOverlay} onClick={onClose}>
      <div
        className={styles.cmpModal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.cmpModalHeader}>
          <h2 className={styles.cmpModalTitle}>Nova campanha</h2>

          {/* botão fechar */}
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
          >
            <XIcon size={16} />
          </button>
        </div>

        <form className={styles.cmpModalBody} onSubmit={handleSubmit}>
          {error && <div className={styles.alertErr}>⚠️ {error}</div>}

          {/* Nome */}
          <div className={styles.cmpField}>
            <label className={styles.cmpLabel}>Nome da campanha</label>
            <input
              className={styles.input}
              placeholder="Ex.: Black Friday Leads"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          {/* Modo de envio (optionsRow / opt) */}
          <div className={styles.cmpField}>
            <div className={styles.cmpLabel}>Modo de envio</div>
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

          {/* Data/hora (se agendada) */}
          {form.mode === 'scheduled' && (
            <div className={styles.cmpField}>
              <label className={styles.cmpLabel}>Agendar para</label>
              <div className={styles.inputIconRow}>
                <input
                  type="datetime-local"
                  className={styles.input}
                  value={form.start_at}
                  onChange={(e) => setField('start_at', e.target.value)}
                />
                <Calendar size={16} />
              </div>
              <div className={styles.cmpHint}>
                O horário é convertido para ISO e enviado ao backend.
              </div>
            </div>
          )}

          {/* Template aprovado */}
          <div className={styles.cmpField}>
            <label className={styles.cmpLabel}>Template aprovado</label>
            <select
              className={styles.select}
              value={form.template_id}
              onChange={(e) => setField('template_id', e.target.value)}
            >
              <option value="">Selecione um template…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} • {t.language_code}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className={styles.cmpHint}>
                Idioma usado: <b>{selectedTemplate.language_code}</b>.
                Variáveis serão carregadas do CSV.
              </div>
            )}
          </div>

          {/* CSV */}
          <div className={styles.cmpField}>
            <label className={styles.cmpLabel}>Arquivo CSV</label>
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
            <div className={styles.cmpHint}>
              O CSV deve conter a coluna <b>to</b> (E.164) e colunas com variáveis usadas no template.
            </div>
          </div>

          {/* Ações */}
          <div className={styles.cmpModalActions}>
            <button
              type="button"
              className={styles.btn}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
            >
              {loading ? <Loader2 className={styles.spin} size={16}/> : null}
              Criar campanha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
