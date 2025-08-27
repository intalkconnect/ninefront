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
  const [ctas, setCtas] = useState([]);
  const [quicks, setQuicks] = useState([]);

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
    <div className={styles.tcOverlay} role="dialog" aria-modal="true" aria-label="Criar template" onMouseDown={onClose}>
      <aside className={styles.tcDrawer} onMouseDown={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.tcHeader}>
          <h3 className={styles.tcTitle}>Novo modelo de mensagem</h3>
          <button type="button" className={styles.tcClose} onClick={onClose} aria-label="Fechar">
            <XIcon size={18} />
          </button>
        </div>

        {/* Intro */}
        <div className={styles.tcIntro}>
          Preencha os campos abaixo para fazer a submissão de um modelo de mensagem.
          <br />
          Lembre-se de seguir as <a href="#" onClick={e=>e.preventDefault()}>regras e boas práticas</a> propostas pelo Facebook.
        </div>

        {/* Corpo */}
        <form className={styles.tcBody} onSubmit={handleSave}>
          <div className={styles.tcForm}>
            {err && <div style={{background:'#fff',border:'1px solid #fecaca',color:'#991b1b',padding:'8px 10px',borderRadius:8}}>{err}</div>}

            {/* Nome */}
            <div className={styles.tcGroup}>
              <label className={styles.tcLabel} htmlFor="tpl-name">Nome do modelo *</label>
              <input
                id="tpl-name"
                className={styles.tcInput}
                placeholder="Use letras minúsculas, números ou underline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Categoria */}
            <div className={styles.tcGroup}>
              <label className={styles.tcLabel} htmlFor="tpl-category">Categoria *</label>
              <select
                id="tpl-category"
                className={styles.tcSelect}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>Selecione</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Idioma */}
            <div className={styles.tcGroup}>
              <label className={styles.tcLabel} htmlFor="tpl-language">Idioma *</label>
              <select
                id="tpl-language"
                className={styles.tcSelect}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              >
                {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            <hr className={styles.tcHr} />

            {/* Tipo de cabeçalho */}
            <div className={styles.tcSegmented} role="tablist" aria-label="Tipo de cabeçalho">
              {HEADER_TYPES.map(h => (
                <button
                  key={h.value}
                  type="button"
                  className={styles.tcSegItem}
                  aria-pressed={headerType === h.value}
                  onClick={() => setHeaderType(h.value)}
                >
                  {h.label}
                </button>
              ))}
            </div>

            {/* Cabeçalho / Mídia */}
            {headerType === 'TEXT' ? (
              <div className={styles.tcGroup}>
                <label className={styles.tcLabel}>Cabeçalho</label>
                <input
                  className={styles.tcInput}
                  placeholder="Texto do cabeçalho"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              </div>
            ) : (
              <div className={styles.tcGroup}>
                <label className={styles.tcLabel}>
                  {headerType === 'IMAGE' ? 'Imagem' : headerType === 'DOCUMENT' ? 'Documento' : 'Vídeo'}
                </label>
                <input
                  className={styles.tcInput}
                  placeholder={
                    headerType === 'IMAGE' ? 'Link da imagem'
                    : headerType === 'DOCUMENT' ? 'Link do documento'
                    : 'Link do vídeo'
                  }
                  value={headerMediaUrl}
                  onChange={(e) => setHeaderMediaUrl(e.target.value)}
                />
                <div className={styles.tcHelp}>Compatível com formatos padrão. O link é apenas para prévia local.</div>
              </div>
            )}

            {/* Corpo */}
            <div className={styles.tcGroup}>
              <label className={styles.tcLabel}>Corpo *</label>
              <textarea
                className={styles.tcTextarea}
                placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                required
              />
              <div className={styles.tcHelp}>Use variáveis <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>…</div>
            </div>

            {/* Rodapé */}
            <div className={styles.tcGroup}>
              <label className={styles.tcLabel}>Rodapé (opcional)</label>
              <input
                className={styles.tcInput}
                placeholder="Mensagem do rodapé"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>

            {/* Botões: CTAs vs Quick */}
            <div className={styles.tcPills}>
              <button
                type="button"
                className={`${styles.tcPill} ${buttonMode==='cta' ? styles.tcActive : ''}`}
                onClick={() => { setButtonMode('cta'); setQuicks([]); }}
              >
                Botões de ação
              </button>
              <button
                type="button"
                className={`${styles.tcPill} ${buttonMode==='quick' ? styles.tcActive : ''}`}
                onClick={() => { setButtonMode('quick'); setCtas([]); }}
              >
                Respostas rápidas
              </button>
              <button
                type="button"
                className={`${styles.tcPill} ${buttonMode==='none' ? styles.tcActive : ''}`}
                onClick={() => { setButtonMode('none'); setCtas([]); setQuicks([]); }}
              >
                Nenhum
              </button>
            </div>

            {buttonMode === 'cta' && (
  <>
    <div className={styles.tcBtnList}>…</div>
    {ctas.length < MAX_BTNS && (
      <button type="button" className={styles.tcAddBtn} onClick={…}>
        + Adicionar ({ctas.length}/{MAX_BTNS})
      </button>
    )}
  </>
)}

{buttonMode === 'quick' && (
  <>
    <div className={styles.tcBtnList}>…</div>
    {quicks.length < MAX_BTNS && (
      <button type="button" className={styles.tcAddBtn} onClick={…}>
        + Adicionar ({quicks.length}/{MAX_BTNS})
      </button>
    )}
  </>
)}

            {buttonMode === 'quick' && (
              <>
                <div className={styles.tcBtnList} role="list">
                  {quicks.map(q => (
                    <div key={q.id} className={styles.tcBtnItem} role="listitem">
                      <div className={styles.tcBtnHead}>
                        <span className={styles.tcLabel}>Resposta rápida</span>
                        <button type="button" className={styles.tcBtnRemove}
                          onClick={() => setQuicks(prev => prev.filter(x => x.id !== q.id))}>
                          Remover
                        </button>
                      </div>
                      <input
                        className={styles.tcInput}
                        placeholder="Texto da resposta (curto)"
                        value={q.text}
                        onChange={e => setQuicks(prev => prev.map(x => x.id === q.id ? { ...x, text:e.target.value } : x))}
                      />
                    </div>
                  ))}
                </div>

                {quicks.length < MAX_BTNS && (
                  <button
                    type="button"
                    className={styles.tcAddBtn}
                    onClick={() => setQuicks(p => [...p, { id:newId(), text:'' }])}
                  >
                    + Adicionar resposta ({quicks.length}/{MAX_BTNS})
                  </button>
                )}
              </>
            )}

            {/* “Adicionar tradução” – como botão leve */}
            <button type="button" className={styles.tcAddBtn} onClick={(e)=>e.preventDefault()}>
              + Adicionar tradução
            </button>
          </div>

          {/* Rodapé fixo */}
          <div className={styles.tcFooter}>
            <button type="submit" className={styles.tcSubmit} disabled={!canSave || saving}>
              <SaveIcon size={16} /> {saving ? 'Enviando…' : 'Enviar para avaliação'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
};

export default TemplateModal;
