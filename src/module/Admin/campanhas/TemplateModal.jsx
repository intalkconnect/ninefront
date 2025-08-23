import React, { useMemo, useState } from 'react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css';
import { X as XIcon, Save as SaveIcon } from 'lucide-react';

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const LANGS = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'Inglês (US)' },
  { value: 'es_ES', label: 'Espanhol (ES)' },
  { value: 'pt_PT', label: 'Português (PT)' },
  { value: 'es_MX', label: 'Espanhol (MX)' },
  { value: 'fr_FR', label: 'Francês (FR)' },
  { value: 'it_IT', label: 'Italiano (IT)' },
  { value: 'de_DE', label: 'Alemão (DE)' },
];

const HEADER_TYPES = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'VIDEO', label: 'Vídeo' },
];

const MAX_BTNS = 3;

const TemplateModal = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('MARKETING');

  const [headerType, setHeaderType] = useState('TEXT');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');

  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');

  const [buttonMode, setButtonMode] = useState('none'); // 'none' | 'cta' | 'quick'
  const [ctas, setCtas] = useState([]);     // [{id, type:'URL'|'PHONE_NUMBER', text, url, phone_number}]
  const [quicks, setQuicks] = useState([]); // [{id, text}]

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    if (buttonMode === 'cta' && ctas.some(b =>
      !b.text.trim() ||
      (b.type === 'URL' && !b.url.trim()) ||
      (b.type === 'PHONE_NUMBER' && !b.phone_number.trim())
    )) return false;
    if (buttonMode === 'quick' && quicks.some(q => !q.text.trim())) return false;
    return true;
  }, [name, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const newId = () =>
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const addCta = () =>
    setCtas(prev => (prev.length >= MAX_BTNS ? prev
      : [...prev, { id:newId(), type:'URL', text:'', url:'', phone_number:'' }]));

  const addQuick = () =>
    setQuicks(prev => (prev.length >= MAX_BTNS ? prev
      : [...prev, { id:newId(), text:'' }]));

  async function handleSave(e) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setErr(null);

    try {
      let buttons = null;
      if (buttonMode === 'cta' && ctas.length) {
        buttons = ctas.map(b =>
          b.type === 'URL'
            ? { type:'URL', text:b.text.trim(), url:b.url.trim() }
            : { type:'PHONE_NUMBER', text:b.text.trim(), phone_number:b.phone_number.trim() }
        );
      } else if (buttonMode === 'quick' && quicks.length) {
        buttons = quicks.map(q => ({ type:'QUICK_REPLY', text:q.text.trim() }));
      }

      const payload = {
        name: name.trim(),
        language_code: language,
        category,
        header_type: headerType || 'NONE',
        header_text: headerType === 'TEXT' ? headerText.trim() : null,
        body_text: bodyText.trim(),
        footer_text: footerText.trim() || null,
        buttons,
        example: null,
      };

      await apiPost('/templates', payload);
      onCreated?.();
    } catch (e2) {
      console.error('Erro ao criar template:', e2);
      setErr(e2?.message || 'Falha ao criar template.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Criar template" onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Novo modelo de mensagem</h3>
          <button type="button" className={styles.btn} onClick={onClose} aria-label="Fechar">
            <XIcon size={16} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className={styles.modalBody}>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              {err && <div className={styles.alertErr}>{err}</div>}

              {/* Nome */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-name">Nome do modelo *</label>
                <input
                  id="tpl-name"
                  className={styles.input}
                  placeholder="use letras minúsculas, números ou underscore"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Categoria */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-category">Categoria *</label>
                <select
                  id="tpl-category"
                  className={styles.select}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Idioma */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-language">Idioma *</label>
                <select
                  id="tpl-language"
                  className={styles.select}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  required
                >
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <div className={styles.inputHelper}>Formato Meta: pt_BR, en_US, es_ES…</div>
              </div>

              {/* Cabeçalho */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Cabeçalho</label>
                <div className={styles.headerTabs} role="tablist" aria-label="Tipo de cabeçalho">
                  {HEADER_TYPES.map(h => (
                    <button
                      key={h.value}
                      type="button"
                      role="tab"
                      aria-selected={headerType === h.value}
                      className={`${styles.headerTab} ${headerType === h.value ? styles.headerTabActive : ''}`}
                      onClick={() => setHeaderType(h.value)}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>

                {headerType === 'TEXT' ? (
                  <input
                    className={styles.input}
                    placeholder="Texto do cabeçalho (opcional, mas recomendado)"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                ) : (
                  <>
                    <input
                      className={styles.input}
                      placeholder={
                        headerType === 'IMAGE' ? 'Link da imagem'
                        : headerType === 'DOCUMENT' ? 'Link do documento'
                        : 'Link do vídeo'
                      }
                      value={headerMediaUrl}
                      onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    />
                    <div className={styles.inputHelper}>
                      Compatível com formatos padrão. O link é apenas para prévia local — a aprovação da Meta usa o formato/estrutura.
                    </div>
                  </>
                )}
              </div>

              {/* Corpo */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-body">Corpo *</label>
                <textarea
                  id="tpl-body"
                  className={styles.textarea}
                  placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  required
                />
                <div className={styles.inputHelper}>
                  Use placeholders <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… conforme necessário.
                </div>
              </div>

              {/* Rodapé */}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-footer">Rodapé (opcional)</label>
                <input
                  id="tpl-footer"
                  className={styles.input}
                  placeholder="Mensagem do rodapé"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />
              </div>

              {/* Botões */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Botões</label>

                <div className={styles.pillTabs}>
                  <button
                    type="button"
                    className={`${styles.pill} ${buttonMode==='none' ? styles.pillActive : ''}`}
                    onClick={() => { setButtonMode('none'); setCtas([]); setQuicks([]); }}
                  >
                    Nenhum
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${buttonMode==='cta' ? styles.pillActive : ''}`}
                    onClick={() => { setButtonMode('cta'); setQuicks([]); }}
                  >
                    Botões de ação
                  </button>
                  <button
                    type="button"
                    className={`${styles.pill} ${buttonMode==='quick' ? styles.pillActive : ''}`}
                    onClick={() => { setButtonMode('quick'); setCtas([]); }}
                  >
                    Respostas rápidas
                  </button>
                </div>

               {buttonMode === 'cta' && (
  <>
    <div className={styles.btnList} role="list">
      {ctas.map(b => (
        <div key={b.id} className={styles.btnItem} role="listitem">
          <div className={styles.btnItemHeader}>
            <select
              className={styles.select}
              value={b.type}
              onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, type:e.target.value } : x))}
            >
              <option value="URL">Abrir URL</option>
              <option value="PHONE_NUMBER">Chamar</option>
            </select>
            <button type="button" className={styles.btnRemove}
              onClick={() => setCtas(prev => prev.filter(x => x.id !== b.id))}>
              Remover
            </button>
          </div>

          <div className={styles.grid3}>
            <input
              className={styles.input}
              placeholder="Rótulo do botão"
              value={b.text}
              onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, text:e.target.value } : x))}
            />
            {b.type === 'URL' ? (
              <input
                className={styles.input}
                placeholder="https://exemplo.com/{{1}}"
                value={b.url}
                onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, url:e.target.value } : x))}
              />
            ) : (
              <input
                className={styles.input}
                placeholder="+55XXXXXXXXXXX"
                value={b.phone_number ?? ''}
                onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, phone_number:e.target.value } : x))}
              />
            )}
          </div>
        </div>
      ))}
    </div>

    {/* só mostra se ainda não atingiu o limite */}
    {ctas.length < MAX_BTNS && (
      <button
        type="button"
        className={styles.btnSmall}
        onClick={addCta}
      >
        + Adicionar botão ({ctas.length}/{MAX_BTNS})
      </button>
    )}
  </>
)}

{buttonMode === 'quick' && (
  <>
    <div className={styles.btnList} role="list">
      {quicks.map(q => (
        <div key={q.id} className={styles.btnItem} role="listitem">
          <div className={styles.btnItemHeader}>
            <span className={styles.label}>Resposta rápida</span>
            <button type="button" className={styles.btnRemove}
              onClick={() => setQuicks(prev => prev.filter(x => x.id !== q.id))}>
              Remover
            </button>
          </div>
          <input
            className={styles.input}
            placeholder="Texto da resposta (curto)"
            value={q.text}
            onChange={e => setQuicks(prev => prev.map(x => x.id === q.id ? { ...x, text:e.target.value } : x))}
          />
        </div>
      ))}
    </div>

    {/* idem aqui */}
    {quicks.length < MAX_BTNS && (
      <button
        type="button"
        className={styles.btnSmall}
        onClick={addQuick}
      >
        + Adicionar resposta ({quicks.length}/{MAX_BTNS})
      </button>
    )}
  </>
)}

              </div>
            </div>

            {/* Footer do modal */}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btn} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={!canSave || saving}>
                <SaveIcon size={16} /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;
