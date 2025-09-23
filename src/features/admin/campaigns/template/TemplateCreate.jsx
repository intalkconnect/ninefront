import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save as SaveIcon } from 'lucide-react';
import { apiPost } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/TemplateCreate.module.css';

/* ---------------- Constants ---------------- */
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
  { value: 'NONE', label: 'Nenhum' },
  { value: 'TEXT', label: 'Texto' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'VIDEO', label: 'Vídeo' },
];

const MAX_BTNS = 3;

/* ---------------- Helpers ---------------- */
function sanitizeTemplateName(raw) {
  if (!raw) return '';
  let s = String(raw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  if (s.length > 512) s = s.slice(0, 512);
  return s;
}

const nowTime = () => new Date().toLocaleTimeString('pt-BR', { 
  hour: '2-digit', 
  minute: '2-digit' 
});

/* ---------------- SVG Icons ---------------- */
const IconReply = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" fill="currentColor"/>
  </svg>
);

const IconExternal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" fill="currentColor"/>
    <path d="M5 5h6v2H7v10h10v-4h2v6H5z" fill="currentColor"/>
  </svg>
);

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.56.57 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17.5 17.5 0 0 1 2.5 5a1 1 0 0 1 1-1H7a1 1 0 0 1 1 1c0 1.21.2 2.41.57 3.56a1 1 0 0 1-.25 1.01l-1.7 1.22z" fill="currentColor"/>
  </svg>
);

const IconCamera = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M9 3l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l2-2zM12 8a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 8zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="currentColor"/>
  </svg>
);

const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" opacity=".3"/>
    <path d="M14 2v6h6M8 13h8M8 9h4M8 17h8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const IconVideo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" className={styles.iMedia} aria-hidden="true">
    <path d="M4 5h12a2 2 0 0 1 2 2v2l3-2v10l-3-2v2a2 2 0 0 1-2 2H4z" fill="currentColor" opacity=".3"/>
    <path d="M4 7h12v10H4zM18 9l3-2v10l-3-2z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

/* ---------------- Token Renderer ---------------- */
const TokenRenderer = ({ text }) => {
  const parts = String(text || '').split(/(\{\{.*?\}\})/g);
  return parts.map((part, i) =>
    /\{\{.*\}\}/.test(part) ? (
      <span key={i} className={styles.token}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

/* ---------------- Live Preview Component ---------------- */
function LivePreview({ 
  name, 
  headerType, 
  headerText, 
  headerMediaUrl, 
  bodyText, 
  footerText, 
  ctas, 
  quicks 
}) {
  const getMediaIcon = () => {
    switch (headerType) {
      case 'IMAGE': return <IconCamera />;
      case 'DOCUMENT': return <IconDoc />;
      case 'VIDEO': return <IconVideo />;
      default: return null;
    }
  };

  const getMediaLabel = () => {
    switch (headerType) {
      case 'IMAGE': return 'Imagem';
      case 'DOCUMENT': return 'Documento';
      case 'VIDEO': return 'Vídeo';
      default: return 'Mídia';
    }
  };

  return (
    <aside className={styles.previewWrap} aria-label="Prévia do template">
      <div className={styles.phoneCard}>
        
        {/* WhatsApp Header */}
        <div className={styles.whatsappHeader}>
          <div className={styles.contactInfo}>
            <div className={styles.contactDetails}>
              <div className={styles.contactName}>{name || 'template_name'}</div>
              <div className={styles.contactStatus}>Template • WhatsApp Business</div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.headerBtn}>⋮</button>
          </div>
        </div>

        {/* Chat Area */}
        <div className={styles.chatArea}>
          <div className={styles.messageContainer}>
            
            {/* Media Header */}
            {headerType !== 'TEXT' && headerType !== 'NONE' && (
              <div className={styles.mediaHeader}>
                <div className={styles.mediaPlaceholder}>
                  <div className={styles.mediaIcon}>
                    {getMediaIcon()}
                  </div>
                  <div className={styles.mediaLabel}>{getMediaLabel()}</div>
                  {headerMediaUrl && (
                    <div className={styles.mediaUrl}>
                      {headerMediaUrl.length > 40 
                        ? `${headerMediaUrl.slice(0, 40)}...` 
                        : headerMediaUrl
                      }
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message Bubble */}
            <div className={styles.bubbleBlock}>
    <div
      className={`${styles.messageBubble} ${
        (ctas.length > 0 || quicks.length > 0) ? styles.attachedBubble : styles.standalone
      }`}
    >
      {/* Header Text */}
      {headerType === 'TEXT' && headerText?.trim() && (
        <div className={styles.headerText}>
          <TokenRenderer text={headerText} />
        </div>
      )}

      {/* Body Text */}
      <div className={styles.bodyText}>
        {String(bodyText || 'Digite o corpo da mensagem...').split('\n').map((line, i) => (
          <div key={i}><TokenRenderer text={line} /></div>
        ))}
      </div>

      {/* Footer Text */}
      {footerText?.trim() && (
        <div className={styles.footerText}>
          <TokenRenderer text={footerText} />
        </div>
      )}

      {/* Timestamp */}
      <div className={styles.timestamp}>{nowTime()}</div>
    </div>

    {/* CTA Buttons */}
    {ctas.length > 0 && (
      <div className={`${styles.buttonGroup} ${styles.buttonGroupAttached}`}>
        {ctas.map((btn, i) => (
          <div key={i} className={styles.ctaButton}>
            <div className={styles.btnIcon}>
              {btn.type === 'PHONE_NUMBER' ? <IconPhone /> : <IconExternal />}
            </div>
            <div className={styles.btnText}>{btn.text || 'Botão de Ação'}</div>
          </div>
        ))}
      </div>
    )}

    {/* Quick Reply Buttons */}
    {quicks.length > 0 && (
      <div className={`${styles.buttonGroup} ${styles.buttonGroupAttached}`}>
        {quicks.map((quick, i) => (
          <div key={i} className={styles.quickButton}>
            <div className={styles.btnIcon}><IconReply /></div>
            <div className={styles.btnText}>{quick.text || 'Resposta Rápida'}</div>
          </div>
        ))}
      </div>
    )}
  </div>
</div>

        {/* WhatsApp Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputPlaceholder}>
            <span>Digite uma mensagem</span>
          </div>
        </div>
      </div>

      <div className={styles.previewLabel}>
        📱 Prévia do Template
      </div>
    </aside>
  );
}

/* ---------------- Form Sections ---------------- */
const TemplateInfoSection = ({ 
  name, 
  setName, 
  language, 
  setLanguage, 
  category, 
  setCategory 
}) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle}>Informações do Template</h2>
      <p className={styles.cardDesc}>Configure a categoria, idioma e identificação do template.</p>
    </div>

    <div className={styles.infoGrid}>
      <div className={styles.group}>
        <label className={styles.label}>Categoria *</label>
        <select 
          className={styles.select} 
          value={category} 
          onChange={e => setCategory(e.target.value)}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>Idioma *</label>
        <select 
          className={styles.select} 
          value={language} 
          onChange={e => setLanguage(e.target.value)}
        >
          {LANGS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>
          Nome do Template *
          <span className={styles.helper}>[a-z0-9_] apenas</span>
        </label>
        <input
          className={styles.input}
          value={name}
          onChange={e => setName(sanitizeTemplateName(e.target.value))}
          placeholder="ex: welcome_message_1"
          inputMode="latin"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  </section>
);

const ContentSection = ({ 
  headerType, 
  setHeaderType, 
  headerText, 
  setHeaderText, 
  headerMediaUrl, 
  setHeaderMediaUrl, 
  bodyText, 
  setBodyText, 
  footerText, 
  setFooterText 
}) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle}>Conteúdo da Mensagem</h2>
      <p className={styles.cardDesc}>Configure o cabeçalho, corpo e rodapé da mensagem.</p>
    </div>

    {/* Header Type Selection */}
    <div className={styles.cardBodyGrid3}>
      <div className={styles.groupFull}>
        <label className={styles.label}>Tipo de Cabeçalho</label>
        <div className={styles.segmented} role="tablist">
          {HEADER_TYPES.map(h => (
            <button
              key={h.value}
              type="button"
              className={`${styles.segItem} ${headerType === h.value ? styles.segActive : ''}`}
              onClick={() => setHeaderType(h.value)}
              aria-pressed={headerType === h.value}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Header Content */}
    {headerType === 'TEXT' && (
      <div className={styles.cardBodyGrid3}>
        <div className={styles.groupFull}>
          <label className={styles.label}>Texto do Cabeçalho *</label>
          <input
            className={styles.input}
            value={headerText}
            onChange={e => setHeaderText(e.target.value)}
            placeholder="Digite o texto do cabeçalho"
          />
        </div>
      </div>
    )}

    {headerType !== 'TEXT' && headerType !== 'NONE' && (
      <div className={styles.cardBodyGrid3}>
        <div className={styles.groupFull}>
          <label className={styles.label}>URL da Mídia</label>
          <input
            className={styles.input}
            value={headerMediaUrl}
            onChange={e => setHeaderMediaUrl(e.target.value)}
            placeholder="https://exemplo.com/arquivo"
          />
        </div>
      </div>
    )}

    <div className={styles.cardBodyGrid3}>
      <div className={styles.groupFull}>
        <label className={styles.label}>Corpo da Mensagem *</label>
        <textarea
          className={styles.textarea}
          rows={5}
          value={bodyText}
          onChange={e => setBodyText(e.target.value)}
          placeholder="Olá {{1}}, sua mensagem aqui..."
        />
      </div>

      <div className={styles.groupWide}>
        <label className={styles.label}>Rodapé (opcional)</label>
        <input
          className={styles.input}
          value={footerText}
          onChange={e => setFooterText(e.target.value)}
          placeholder="Texto do rodapé"
        />
      </div>
    </div>
  </section>
);

const ButtonsSection = ({ 
  buttonMode, 
  setButtonMode, 
  ctas, 
  setCtas, 
  quicks, 
  setQuicks 
}) => {
  const newId = () => Date.now() + '-' + Math.random().toString(36).slice(2);

  const addCta = () => {
    if (ctas.length >= MAX_BTNS) return;
    setCtas(prev => [...prev, {
      id: newId(),
      type: 'URL',
      text: '',
      url: '',
      phone_number: ''
    }]);
  };

  const addQuick = () => {
    if (quicks.length >= MAX_BTNS) return;
    setQuicks(prev => [...prev, {
      id: newId(),
      text: ''
    }]);
  };

  const removeCta = (id) => {
    setCtas(prev => prev.filter(cta => cta.id !== id));
  };

  const removeQuick = (id) => {
    setQuicks(prev => prev.filter(quick => quick.id !== id));
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Botões de Ação</h2>
        <p className={styles.cardDesc}>Adicione botões de ação ou respostas rápidas.</p>
      </div>

    <div className={styles.cardBodyGrid3}>
      <div className={styles.groupFull}>
        <label className={styles.label}>Tipo de Botão</label>
        <div className={styles.pills} role="tablist">
          <button 
            type="button" 
            className={`${styles.pill} ${buttonMode === 'none' ? styles.pillActive : ''}`}
            onClick={() => {
              setButtonMode('none');
              setCtas([]);
              setQuicks([]);
            }}
          >
            Nenhum
          </button>
          <button 
            type="button" 
            className={`${styles.pill} ${buttonMode === 'cta' ? styles.pillActive : ''}`}
            onClick={() => {
              setButtonMode('cta');
              setQuicks([]);
            }}
          >
            Call-to-Action
          </button>
          <button 
            type="button" 
            className={`${styles.pill} ${buttonMode === 'quick' ? styles.pillActive : ''}`}
            onClick={() => {
              setButtonMode('quick');
              setCtas([]);
            }}
          >
            Resposta Rápida
          </button>
        </div>
      </div>
    </div>

    {/* CTA Buttons */}
    {buttonMode === 'cta' && (
      <div className={styles.cardBodyGrid3}>
        <div className={styles.groupFull}>
          {ctas.map(cta => (
            <div key={cta.id} className={styles.ctaEditRow}>
              <select
                className={styles.select}
                value={cta.type}
                onChange={e => setCtas(prev => prev.map(c => 
                  c.id === cta.id ? { ...c, type: e.target.value } : c
                ))}
              >
                <option value="URL">Abrir URL</option>
                <option value="PHONE_NUMBER">Chamar</option>
              </select>
              
              <input
                className={styles.input}
                placeholder="Texto do botão"
                value={cta.text}
                onChange={e => setCtas(prev => prev.map(c => 
                  c.id === cta.id ? { ...c, text: e.target.value } : c
                ))}
              />
              
              {cta.type === 'URL' ? (
                <input
                  className={styles.input}
                  placeholder="https://exemplo.com"
                  value={cta.url}
                  onChange={e => setCtas(prev => prev.map(c => 
                    c.id === cta.id ? { ...c, url: e.target.value } : c
                  ))}
                />
              ) : (
                <input
                  className={styles.input}
                  placeholder="+5511999999999"
                  value={cta.phone_number}
                  onChange={e => setCtas(prev => prev.map(c => 
                    c.id === cta.id ? { ...c, phone_number: e.target.value } : c
                  ))}
                />
              )}
              
              <button 
                type="button" 
                className={styles.btn} 
                onClick={() => removeCta(cta.id)}
              >
                Remover
              </button>
            </div>
          ))}
          
          {ctas.length < MAX_BTNS && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={addCta}
            >
              + Adicionar botão ({ctas.length}/{MAX_BTNS})
            </button>
          )}
        </div>
      </div>
    )}

    {/* Quick Reply Buttons */}
    {buttonMode === 'quick' && (
      <div className={styles.cardBodyGrid3}>
        <div className={styles.groupFull}>
          {quicks.map(quick => (
            <div key={quick.id} className={styles.quickEditRow}>
              <input
                className={styles.input}
                placeholder="Texto da resposta rápida"
                value={quick.text}
                onChange={e => setQuicks(prev => prev.map(q => 
                  q.id === quick.id ? { ...q, text: e.target.value } : q
                ))}
              />
              
              <button 
                type="button" 
                className={styles.btn} 
                onClick={() => removeQuick(quick.id)}
              >
                Remover
              </button>
            </div>
          ))}
          
          {quicks.length < MAX_BTNS && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={addQuick}
            >
              + Adicionar resposta ({quicks.length}/{MAX_BTNS})
            </button>
          )}
        </div>
      </div>
    )}
  </section>
  );
};

/* ---------------- Main Component ---------------- */
export default function TemplateCreate() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('MARKETING');

  const [headerType, setHeaderType] = useState('TEXT');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');

  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');

  const [buttonMode, setButtonMode] = useState('none');
  const [ctas, setCtas] = useState([]);
  const [quicks, setQuicks] = useState([]);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    if (buttonMode === 'cta' && ctas.some(b =>
      !b.text?.trim() || 
      (b.type === 'URL' && !b.url?.trim()) || 
      (b.type === 'PHONE_NUMBER' && !b.phone_number?.trim())
    )) return false;
    if (buttonMode === 'quick' && quicks.some(q => !q.text?.trim())) return false;
    return true;
  }, [name, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!canSave || saving) return;
    
    setSaving(true);
    try {
      let buttons = null;
      if (buttonMode === 'cta' && ctas.length) {
        buttons = ctas.map(b =>
          b.type === 'URL'
            ? { type: 'URL', text: b.text.trim(), url: b.url.trim() }
            : { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phone_number.trim() }
        );
      } else if (buttonMode === 'quick' && quicks.length) {
        buttons = quicks.map(q => ({ type: 'QUICK_REPLY', text: q.text.trim() }));
      }

      const payload = {
        name: sanitizeTemplateName(name),
        language_code: language,
        category,
        header_type: headerType || 'NONE',
        header_text: headerType === 'TEXT' ? (headerText.trim() || null) : null,
        header_media_url: headerType !== 'TEXT' && headerType !== 'NONE' ? (headerMediaUrl.trim() || null) : null,
        body_text: bodyText.trim(),
        footer_text: footerText.trim() || null,
        buttons,
        example: null,
      };

      const created = await apiPost('/templates', payload);
      await apiPost(`/templates/${created.id}/submit`, {});
      await apiPost(`/templates/${created.id}/sync`, {});
      
      toast.success('Template enviado para avaliação!');
      navigate('/management/templates');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao enviar template.');
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, name, language, category, headerType, headerText, headerMediaUrl, bodyText, footerText, buttonMode, ctas, quicks, navigate]);

  const previewCtas = useMemo(() => 
    buttonMode === 'cta' ? ctas : [], 
    [buttonMode, ctas]
  );
  
  const previewQuicks = useMemo(() => 
    buttonMode === 'quick' ? quicks : [], 
    [buttonMode, quicks]
  );

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/" className={styles.bcLink}>Dashboard</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><Link to="/management/templates" className={styles.bcLink}>Templates</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>Novo template</span></li>
        </ol>
      </nav>

      {/* Header */}
      <header className={styles.pageHeader}>
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>Criar Template</h1>
          <p className={styles.pageSubtitle}>Configure seu template de mensagem do WhatsApp Business.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Form Column */}
        <div className={styles.colForm}>
          <TemplateInfoSection
            name={name}
            setName={setName}
            language={language}
            setLanguage={setLanguage}
            category={category}
            setCategory={setCategory}
          />
          
          <ContentSection
            headerType={headerType}
            setHeaderType={setHeaderType}
            headerText={headerText}
            setHeaderText={setHeaderText}
            headerMediaUrl={headerMediaUrl}
            setHeaderMediaUrl={setHeaderMediaUrl}
            bodyText={bodyText}
            setBodyText={setBodyText}
            footerText={footerText}
            setFooterText={setFooterText}
          />
          
          <ButtonsSection
            buttonMode={buttonMode}
            setButtonMode={setButtonMode}
            ctas={ctas}
            setCtas={setCtas}
            quicks={quicks}
            setQuicks={setQuicks}
          />
        </div>

        {/* Preview Column */}
        <LivePreview
          name={sanitizeTemplateName(name)}
          headerType={headerType}
          headerText={headerText}
          headerMediaUrl={headerMediaUrl}
          bodyText={bodyText}
          footerText={footerText}
          ctas={previewCtas}
          quicks={previewQuicks}
        />
      </div>

      {/* Fixed Footer */}
      <div className={styles.stickyFooter}>
        <div className={styles.stickyInner}>
          <button 
            type="button" 
            className={styles.btn} 
            onClick={() => navigate('/management/templates')}
          >
            Cancelar
          </button>
          
          <button 
            type="button" 
            className={styles.btnPrimary} 
            onClick={handleSubmit} 
            disabled={!canSave || saving}
          >
            <SaveIcon size={16} /> 
            {saving ? 'Enviando…' : 'Enviar para Avaliação'}
          </button>
        </div>
      </div>
    </div>
  );
}
