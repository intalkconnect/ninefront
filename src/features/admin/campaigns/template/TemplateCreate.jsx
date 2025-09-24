import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
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

/* ---------------- Meta character limits ---------------- */
const LIMITS = {
  headerText: 60,
  bodyText: 1024,
  footerText: 60,
  ctaText: 20,
  quickText: 25,
};

/* ---------------- Media rules ---------------- */
const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const PDF_EXT = ['pdf'];
const MP4_EXT = ['mp4'];

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

const nowTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const clamp = (s, max) => (s?.length > max ? s.slice(0, max) : s || '');

const getUrlExt = (url = '') => {
  try {
    const u = new URL(url);
    const pathname = u.pathname || '';
    const last = pathname.split('/').pop() || '';
    const clean = last.split('?')[0].split('#')[0];
    const ext = (clean.split('.').pop() || '').toLowerCase();
    return ext;
  } catch {
    return '';
  }
};

const isValidHttpUrl = (value = '') => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const fitsTypeByExt = (type, ext) => {
  if (type === 'IMAGE') return IMG_EXT.includes(ext);
  if (type === 'DOCUMENT') return PDF_EXT.includes(ext);
  if (type === 'VIDEO') return MP4_EXT.includes(ext);
  return true;
};

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
  quicks,
}) {
  const hasButtons = (ctas?.length || 0) > 0 || (quicks?.length || 0) > 0;
  const hasMediaAbove = headerType !== 'TEXT' && headerType !== 'NONE';

  const [imgOk, setImgOk] = useState(false);
  const [mediaOk, setMediaOk] = useState(false);

  useEffect(() => {
    setImgOk(false);
    setMediaOk(false);
  }, [headerMediaUrl, headerType]);

  const mediaPreview = () => {
    if (!hasMediaAbove) return null;

    const ext = getUrlExt(headerMediaUrl);
    const isUrl = isValidHttpUrl(headerMediaUrl);

    if (!isUrl) {
      return (
        <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
          <div className={styles.mediaIcon}>
            {headerType === 'IMAGE' && <IconCamera />}
            {headerType === 'DOCUMENT' && <IconDoc />}
            {headerType === 'VIDEO' && <IconVideo />}
          </div>
          <div className={styles.mediaLabel}>URL inválida</div>
          {headerMediaUrl ? <div className={styles.mediaUrl}>{headerMediaUrl}</div> : null}
        </div>
      );
    }

    if (headerType === 'IMAGE') {
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`}>
          <img
            src={headerMediaUrl}
            alt="Imagem do Cabeçalho"
            className={styles.mediaImage}
            onLoad={() => { setImgOk(true); setMediaOk(true); }}
            onError={() => { setImgOk(false); setMediaOk(false); }}
          />
          {!imgOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconCamera /></div>
              <div className={styles.mediaLabel}>Carregando imagem…</div>
              <div className={styles.mediaUrl}>
                {headerMediaUrl.length > 40 ? `${headerMediaUrl.slice(0, 40)}…` : headerMediaUrl}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (headerType === 'DOCUMENT') {
      // PDF somente
      if (!PDF_EXT.includes(ext)) {
        return (
          <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
            <div className={styles.mediaIcon}><IconDoc /></div>
            <div className={styles.mediaLabel}>Apenas PDF é suportado</div>
            <div className={styles.mediaUrl}>{headerMediaUrl}</div>
          </div>
        );
      }
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`} style={{ height: 220 }}>
          <iframe
            title="PDF"
            src={headerMediaUrl}
            className={styles.mediaIframe}
            onLoad={() => setMediaOk(true)}
          />
          {!mediaOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconDoc /></div>
              <div className={styles.mediaLabel}>Carregando PDF…</div>
            </div>
          )}
        </div>
      );
    }

    if (headerType === 'VIDEO') {
      // MP4 somente
      if (!MP4_EXT.includes(ext)) {
        return (
          <div className={`${styles.mediaPlaceholder} ${styles.mediaAttached}`}>
            <div className={styles.mediaIcon}><IconVideo /></div>
            <div className={styles.mediaLabel}>Apenas MP4 é suportado</div>
            <div className={styles.mediaUrl}>{headerMediaUrl}</div>
          </div>
        );
      }
      return (
        <div className={`${styles.mediaImgWrap} ${styles.mediaAttached}`} style={{ height: 220 }}>
          <video
            className={styles.mediaVideo}
            src={headerMediaUrl}
            controls
            onCanPlay={() => setMediaOk(true)}
            onError={() => setMediaOk(false)}
          />
          {!mediaOk && (
            <div className={styles.mediaFallback}>
              <div className={styles.mediaIcon}><IconVideo /></div>
              <div className={styles.mediaLabel}>Carregando vídeo…</div>
            </div>
          )}
        </div>
      );
    }

    return null;
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
            {hasMediaAbove && (
              <div className={styles.mediaHeader}>
                {mediaPreview()}
              </div>
            )}

            {/* Message Bubble + Buttons */}
            <div className={styles.bubbleBlock}>
              <div
                className={[
                  styles.messageBubble,
                  hasMediaAbove && styles.bubbleAttachTop,
                  hasButtons && styles.bubbleAttachBottom,
                ].filter(Boolean).join(' ')}
              >
                {/* Header Text */}
                {headerType === 'TEXT' && headerText?.trim() && (
                  <div className={styles.headerText}>
                    <TokenRenderer text={headerText} />
                  </div>
                )}

                {/* Body Text */}
                <div className={styles.bodyText}>
                  {String(bodyText || 'Digite o corpo da mensagem...')
                    .split('\n')
                    .map((line, i) => (
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
              {(ctas?.length || 0) > 0 && (
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
              {(quicks?.length || 0) > 0 && (
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
        </div>
      </div>

      <div className={styles.previewLabel}>Prévia do Template</div>
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
  setCategory,
}) => (
  <section className={styles.card}>
    <div className={styles.cardHead}>
      <p className={styles.cardDesc}>Defina a categoria, idioma e identificação do template.</p>
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
  onChangeHeaderType,
  headerText,
  setHeaderText,
  headerMediaUrl,
  setHeaderMediaUrl,
  bodyText,
  setBodyText,
  footerText,
  setFooterText,
}) => {
  const headerTextLeft = LIMITS.headerText - (headerText?.length || 0);
  const bodyTextLeft = LIMITS.bodyText - (bodyText?.length || 0);
  const footerTextLeft = LIMITS.footerText - (footerText?.length || 0);

  const safeSetHeaderText = (val) => setHeaderText(clamp(val, LIMITS.headerText));
  const safeSetBodyText = (val) => setBodyText(clamp(val, LIMITS.bodyText));
  const safeSetFooterText = (val) => setFooterText(clamp(val, LIMITS.footerText));

  // valida ao digitar URL
  const onMediaUrlChange = (val) => {
    setHeaderMediaUrl(val);
    if (!val) return;
    if (!isValidHttpUrl(val)) return; // deixa o preview avisar
    const ext = getUrlExt(val);
    if (!fitsTypeByExt(headerType, ext)) {
      if (headerType === 'DOCUMENT') toast.error('Documento: apenas PDF é aceito (.pdf).');
      if (headerType === 'VIDEO') toast.error('Vídeo: apenas MP4 é aceito (.mp4).');
      if (headerType === 'IMAGE') toast.error('Imagem: use jpg, jpeg, png, webp ou gif.');
    }
  };

  return (
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
                onClick={() => onChangeHeaderType(h.value)}
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
              onChange={e => safeSetHeaderText(e.target.value)}
              placeholder="Digite o texto do cabeçalho"
            />
            <small className={styles.helper}>
              {headerTextLeft} caracteres restantes (máx. {LIMITS.headerText})
            </small>
          </div>
        </div>
      )}

      {headerType !== 'TEXT' && headerType !== 'NONE' && (
        <div className={styles.cardBodyGrid3}>
          <div className={styles.groupFull}>
            <label className={styles.label}>
              URL da Mídia {headerType === 'IMAGE' ? '(jpg, jpeg, png, webp, gif)' : headerType === 'DOCUMENT' ? '(apenas .pdf)' : '(apenas .mp4)'}
            </label>
            <input
              className={styles.input}
              value={headerMediaUrl}
              onChange={e => onMediaUrlChange(e.target.value)}
              placeholder={headerType === 'IMAGE' ? 'https://exemplo.com/arquivo.jpg' : headerType === 'DOCUMENT' ? 'https://exemplo.com/arquivo.pdf' : 'https://exemplo.com/video.mp4'}
            />
          </div>
        </div>
      )}

      {/* Body & Footer */}
      <div className={styles.cardBodyGrid3}>
        <div className={styles.groupFull}>
          <label className={styles.label}>Corpo da Mensagem *</label>
          <textarea
            className={styles.textarea}
            rows={5}
            value={bodyText}
            onChange={e => safeSetBodyText(e.target.value)}
            placeholder="Olá {{1}}, sua mensagem aqui..."
          />
          <small className={styles.helper}>
            {bodyTextLeft} caracteres restantes (máx. {LIMITS.bodyText})
          </small>
        </div>

        <div className={styles.groupWide}>
          <label className={styles.label}>Rodapé (opcional)</label>
          <input
            className={styles.input}
            value={footerText}
            onChange={e => safeSetFooterText(e.target.value)}
            placeholder="Texto do rodapé"
          />
          <small className={styles.helper}>
            {footerTextLeft} caracteres restantes (máx. {LIMITS.footerText})
          </small>
        </div>
      </div>
    </section>
  );
};

const ButtonsSection = ({
  buttonMode,
  setButtonMode,
  ctas,
  setCtas,
  quicks,
  setQuicks,
}) => {
  const newId = () => Date.now() + '-' + Math.random().toString(36).slice(2);

  const clampCtaText = (s) => clamp(s, LIMITS.ctaText);
  const clampQuickText = (s) => clamp(s, LIMITS.quickText);

  const addCta = () => {
    if (ctas.length >= MAX_BTNS) return;
    setCtas(prev => [...prev, { id: newId(), type: 'URL', text: '', url: '', phone_number: '' }]);
  };

  const addQuick = () => {
    if (quicks.length >= MAX_BTNS) return;
    setQuicks(prev => [...prev, { id: newId(), text: '' }]);
  };

  const removeCta = (id) => setCtas(prev => prev.filter(cta => cta.id !== id));
  const removeQuick = (id) => setQuicks(prev => prev.filter(quick => quick.id !== id));

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
              onClick={() => { setButtonMode('none'); setCtas([]); setQuicks([]); }}
            >
              Nenhum
            </button>
            <button
              type="button"
              className={`${styles.pill} ${buttonMode === 'cta' ? styles.pillActive : ''}`}
              onClick={() => { setButtonMode('cta'); setQuicks([]); }}
            >
              Call-to-Action
            </button>
            <button
              type="button"
              className={`${styles.pill} ${buttonMode === 'quick' ? styles.pillActive : ''}`}
              onClick={() => { setButtonMode('quick'); setCtas([]); }}
            >
              Resposta Rápida
            </button>
          </div>
        </div>
      </div>

      {buttonMode === 'cta' && (
        <div className={styles.cardBodyGrid3}>
          <div className={styles.groupFull}>
            {ctas.map(cta => {
              const left = LIMITS.ctaText - (cta.text?.length || 0);
              return (
                <div key={cta.id} className={styles.ctaEditRow}>
                  <select
                    className={styles.select}
                    value={cta.type}
                    onChange={e => setCtas(prev => prev.map(c => c.id === cta.id ? { ...c, type: e.target.value } : c))}
                  >
                    <option value="URL">Abrir URL</option>
                    <option value="PHONE_NUMBER">Chamar</option>
                  </select>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      className={styles.input}
                      placeholder="Texto do botão"
                      value={cta.text}
                      onChange={e => setCtas(prev => prev.map(c => c.id === cta.id ? { ...c, text: clampCtaText(e.target.value) } : c))}
                    />
                    {/* <small className={styles.helper}>
                      {left} restantes (máx. {LIMITS.ctaText})
                    </small> */}
                  </div>

                  {cta.type === 'URL' ? (
                    <input
                      className={styles.input}
                      placeholder="https://exemplo.com"
                      value={cta.url}
                      onChange={e => setCtas(prev => prev.map(c => c.id === cta.id ? { ...c, url: e.target.value } : c))}
                    />
                  ) : (
                    <input
                      className={styles.input}
                      placeholder="+5511999999999"
                      value={cta.phone_number}
                      onChange={e => setCtas(prev => prev.map(c => c.id === cta.id ? { ...c, phone_number: e.target.value } : c))}
                    />
                  )}

                  <button type="button" className={styles.btn} onClick={() => removeCta(cta.id)}>
                    Remover
                  </button>
                </div>
              );
            })}

            {ctas.length < MAX_BTNS && (
              <button type="button" className={styles.btnSecondary} onClick={addCta}>
                + Adicionar botão ({ctas.length}/{MAX_BTNS})
              </button>
            )}
          </div>
        </div>
      )}

      {buttonMode === 'quick' && (
        <div className={styles.cardBodyGrid3}>
          <div className={styles.groupFull}>
            {quicks.map(quick => {
              const left = LIMITS.quickText - (quick.text?.length || 0);
              return (
                <div key={quick.id} className={styles.quickEditRow}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <input
                      className={styles.input}
                      placeholder="Texto da resposta rápida"
                      value={quick.text}
                      onChange={e =>
                        setQuicks(prev => prev.map(q =>
                          q.id === quick.id ? { ...q, text: clampQuickText(e.target.value) } : q
                        ))
                      }
                    />
                    <small className={styles.helper}>
                      {left} restantes (máx. {LIMITS.quickText})
                    </small>
                  </div>

                  <button type="button" className={styles.btn} onClick={() => removeQuick(quick.id)}>
                    Remover
                  </button>
                </div>
              );
            })}

            {quicks.length < MAX_BTNS && (
              <button type="button" className={styles.btnSecondary} onClick={addQuick}>
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

  // trocar tipo de cabeçalho + limpar campos
  const handleChangeHeaderType = useCallback((nextType) => {
    if (nextType === headerType) return;
    setHeaderType(nextType);
    setHeaderText('');
    setHeaderMediaUrl('');
  }, [headerType]);

  // validações adicionais antes do submit
  const validateBeforeSubmit = () => {
    if (!name.trim()) { toast.error('Informe o nome do template.'); return false; }
    if (!bodyText.trim()) { toast.error('O corpo da mensagem é obrigatório.'); return false; }
    if (headerType === 'TEXT' && !headerText.trim()) { toast.error('O texto do cabeçalho é obrigatório.'); return false; }

    if (headerType !== 'TEXT' && headerType !== 'NONE') {
      if (!headerMediaUrl?.trim()) { toast.error('Informe a URL da mídia do cabeçalho.'); return false; }
      if (!isValidHttpUrl(headerMediaUrl)) { toast.error('URL de mídia inválida.'); return false; }
      const ext = getUrlExt(headerMediaUrl);
      if (!fitsTypeByExt(headerType, ext)) {
        toast.error(headerType === 'IMAGE'
          ? 'Imagem inválida. Use jpg, jpeg, png, webp ou gif.'
          : headerType === 'DOCUMENT'
          ? 'Documento inválido. Use apenas PDF (.pdf).'
          : 'Vídeo inválido. Use apenas MP4 (.mp4).'
        );
        return false;
      }
    }

    // checa limites (defensivo, já clampamos no input)
    if (headerText.length > LIMITS.headerText) { toast.error('Cabeçalho excede o limite.'); return false; }
    if (bodyText.length > LIMITS.bodyText) { toast.error('Corpo excede o limite.'); return false; }
    if (footerText.length > LIMITS.footerText) { toast.error('Rodapé excede o limite.'); return false; }

    if (buttonMode === 'cta') {
      for (const b of ctas) {
        if (!b.text?.trim()) { toast.error('Texto do botão CTA é obrigatório.'); return false; }
        if (b.text.length > LIMITS.ctaText) { toast.error('Texto do CTA excede o limite.'); return false; }
        if (b.type === 'URL' && !b.url?.trim()) { toast.error('URL do CTA é obrigatória.'); return false; }
        if (b.type === 'URL' && !isValidHttpUrl(b.url)) { toast.error('URL do CTA inválida.'); return false; }
        if (b.type === 'PHONE_NUMBER' && !b.phone_number?.trim()) { toast.error('Telefone do CTA é obrigatório.'); return false; }
      }
    }
    if (buttonMode === 'quick') {
      for (const q of quicks) {
        if (!q.text?.trim()) { toast.error('Texto da resposta rápida é obrigatório.'); return false; }
        if (q.text.length > LIMITS.quickText) { toast.error('Resposta rápida excede o limite.'); return false; }
      }
    }
    return true;
  };

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
    if (saving) return;
    if (!validateBeforeSubmit()) return;

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
  }, [saving, name, language, category, headerType, headerText, headerMediaUrl, bodyText, footerText, buttonMode, ctas, quicks, navigate]);

  const previewCtas = useMemo(() => buttonMode === 'cta' ? ctas : [], [buttonMode, ctas]);
  const previewQuicks = useMemo(() => buttonMode === 'quick' ? quicks : [], [buttonMode, quicks]);

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
          <p className={styles.pageSubtitle}>Crie o seu template de mensagem do WhatsApp Business e aguarda aprovação da Meta.</p>
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
            onChangeHeaderType={handleChangeHeaderType}
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
            onClick={() => navigate('/campaigns/templates')}
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
