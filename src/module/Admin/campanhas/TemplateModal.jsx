import React, { useMemo, useState } from 'react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/TemplateCreate.module.css';
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
  { value: 'TEXT',     label: 'Texto' },
  { value: 'IMAGE',    label: 'Imagem' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'VIDEO',    label: 'Vídeo' },
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
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true" aria-label="Criar template" onMouseDown={onClose}>
      <aside className={`${styles.drawer} ${styles.drawerRight}`} onMouseDown={e => e.stopPropagation()}>
        {/* Cabeçalho compacto, estilo Meta */}
        <div className={styles.drawerHeader}>
          <h3>Novo modelo de mensagem</h3>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={18} />
          </button>
        </div>

        {/* Introdução curta */}
        <div className={styles.drawerIntro}>
          Preencha os campos abaixo para fazer a submissão de um modelo de mensagem.
          <br />
          Lembre-se de seguir as <a href="#" onClick={e=>e.preventDefault()}>regras e boas práticas</a> propostas pelo Facebook.
        </div>

        {/* Corpo (sem rolagem em alturas comuns; ainda assim overflow:auto se necessário) */}
        <form className={styles.drawerBody} onSubmit={handleSave}>
          {err && <div className={styles.alertErr} style={{marginBottom:8}}>{err}</div>}

          {/* Nome */}
          <div className={styles.inputGroupSm}>
            <label className={styles.labelSm} htmlFor="tpl-name">Nome do modelo *</label>
            <input
              id="tpl-name"
              className={styles.inputSm}
              placeholder="Use letras minúsculas, números ou underline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Categoria */}
          <div className={styles.inputGroupSm}>
            <label className={styles.labelSm} htmlFor="tpl-category">Categoria *</label>
            <select
              id="tpl-category"
              className={styles.selectSm}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="" disabled>Selecione</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Idioma */}
          <div className={styles.inputGroupSm}>
            <label className={styles.labelSm} htmlFor="tpl-language">Idioma *</label>
            <select
              id="tpl-language"
              className={styles.selectSm}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
            >
              {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <hr className={styles.hrThin} />

          {/* Tipo de cabeçalho — segmentado */}
          <div className={styles.segmentedWrap}>
            {HEADER_TYPES.map(h => (
              <button
                key={h.value}
                type="button"
                className={`${styles.segmentedItem} ${headerType === h.value ? styles.segmentedActive : ''}`}
                onClick={() => setHeaderType(h.value)}
                aria-pressed={headerType === h.value}
              >
                {h.label}
              </button>
            ))}
          </div>

          {/* Campos do bloco de mensagem */}
          <div className={styles.blockCard}>
            {headerType === 'TEXT' ? (
              <div className={styles.inputGroupSm}>
                <label className={styles.labelXs}>Cabeçalho</label>
                <input
                  className={styles.inputSm}
                  placeholder="Texto do cabeçalho"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              </div>
            ) : (
              <div className={styles.inputGroupSm}>
                <label className={styles.labelXs}>{headerType === 'IMAGE' ? 'Imagem' : headerType === 'DOCUMENT' ? 'Documento' : 'Vídeo'}</label>
                <input
                  className={styles.inputSm}
                  placeholder={
                    headerType === 'IMAGE' ? 'Link da imagem'
                    : headerType === 'DOCUMENT' ? 'Link do documento'
                    : 'Link do vídeo'
                  }
                  value={headerMediaUrl}
                  onChange={(e) => setHeaderMediaUrl(e.target.value)}
                />
                <div className={styles.helpXs}>Compatível com formatos padrão. O link é apenas para prévia local.</div>
              </div>
            )}

            <div className={styles.inputGroupSm}>
              <label className={styles.labelXs}>Corpo *</label>
              <textarea
                className={styles.textareaSm}
                placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
              />
              <div className={styles.helpXs}>Use variáveis <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>…</div>
            </div>

            <div className={styles.inputGroupSm}>
              <label className={styles.labelXs}>Rodapé (opcional)</label>
              <input
                className={styles.inputSm}
                placeholder="Mensagem do rodapé"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>

            {/* Botões (segmentado) */}
            <div className={styles.segmentedWrapAlt}>
              <button
                type="button"
                className={`${styles.segmentedItemAlt} ${buttonMode==='cta' ? styles.segmentedActiveAlt : ''}`}
                onClick={() => { setButtonMode('cta'); setQuicks([]); }}
              >
                Botões de ação
              </button>
              <button
                type="button"
                className={`${styles.segmentedItemAlt} ${buttonMode==='quick' ? styles.segmentedActiveAlt : ''}`}
                onClick={() => { setButtonMode('quick'); setCtas([]); }}
              >
                Respostas rápidas
              </button>
            </div>

            {buttonMode === 'cta' && (
              <>
                {ctas.map(b => (
                  <div key={b.id} className={styles.inlineRow}>
                    <select
                      className={styles.selectSm}
                      value={b.type}
                      onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, type:e.target.value } : x))}
                    >
                      <option value="URL">Abrir URL</option>
                      <option value="PHONE_NUMBER">Chamar</option>
                    </select>
                    <input
                      className={styles.inputSm}
                      placeholder="Rótulo"
                      value={b.text}
                      onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, text:e.target.value } : x))}
                    />
                    {b.type === 'URL' ? (
                      <input
                        className={styles.inputSm}
                        placeholder="https://exemplo.com/{{1}}"
                        value={b.url}
                        onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, url:e.target.value } : x))}
                      />
                    ) : (
                      <input
                        className={styles.inputSm}
                        placeholder="+55XXXXXXXXXXX"
                        value={b.phone_number ?? ''}
                        onChange={e => setCtas(prev => prev.map(x => x.id === b.id ? { ...x, phone_number:e.target.value } : x))}
                      />
                    )}
                    <button type="button" className={styles.pillMini}
                      onClick={() => setCtas(prev => prev.filter(x => x.id !== b.id))}>
                      Remover
                    </button>
                  </div>
                ))}
                {ctas.length < MAX_BTNS && (
                  <button type="button" className={styles.btnSmall} onClick={() => {
                    const id = newId(); setCtas(p => [...p, { id, type:'URL', text:'', url:'', phone_number:'' }]);
                  }}>
                    + Adicionar ({ctas.length}/{MAX_BTNS})
                  </button>
                )}
              </>
            )}

            {buttonMode === 'quick' && (
              <>
                {quicks.map(q => (
                  <div key={q.id} className={styles.inlineRow}>
                    <input
                      className={styles.inputSm}
                      placeholder="Texto curto"
                      value={q.text}
                      onChange={e => setQuicks(prev => prev.map(x => x.id === q.id ? { ...x, text:e.target.value } : x))}
                    />
                    <button type="button" className={styles.pillMini}
                      onClick={() => setQuicks(prev => prev.filter(x => x.id !== q.id))}>
                      Remover
                    </button>
                  </div>
                ))}
                {quicks.length < MAX_BTNS && (
                  <button type="button" className={styles.btnSmall} onClick={() => {
                    const id = newId(); setQuicks(p => [...p, { id, text:'' }]);
                  }}>
                    + Adicionar ({quicks.length}/{MAX_BTNS})
                  </button>
                )}
              </>
            )}
          </div>

          {/* “Adicionar tradução” (placeholder) */}
          <button type="button" className={styles.addTransBtn} onClick={(e)=>e.preventDefault()}>
            + Adicionar tradução
          </button>

          {/* Rodapé fixo do drawer */}
          <div className={styles.drawerFooter}>
            <button type="submit" className={styles.submitBar} disabled={!canSave || saving}>
              <SaveIcon size={16} /> {saving ? 'Enviando…' : 'Enviar para avaliação'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};

export default TemplateModal;
