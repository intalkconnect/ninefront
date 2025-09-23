import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save as SaveIcon } from 'lucide-react';
import { apiPost } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/TemplateCreate.module.css';

/* ---------------- Options ---------------- */
const CATEGORIES = [
  { value: 'UTILITY',        label: 'Utility' },
  { value: 'MARKETING',      label: 'Marketing' },
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

/* ---------------- Helpers ---------------- */
// Nome Meta: minúscula + sem acento + apenas [a-z0-9_], colapsa e trunca
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
const nowTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/* ---------------- SVG ícones ---------------- */
const IconReply = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iBlue} aria-hidden="true">
    <path d="M10 8V5l-7 7 7 7v-3h4a7 7 0 0 0 7-7V7.5A9.5 9.5 0 0 1 14.5 17H10v-3H6l4-4z" fill="currentColor"/>
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
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iDark} aria-hidden="true">
    <path d="M9 3l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l2-2zM12 8a5 5 0 1 0 .001 10.001A5 5 0 0 0 12 8zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" fill="currentColor"/>
  </svg>
);
const IconDoc = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iDark} aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" opacity=".2"/>
    <path d="M14 2v6h6M8 13h8M8 9h4M8 17h8" fill="none" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);
const IconVideo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className={styles.iDark} aria-hidden="true">
    <path d="M4 5h12a2 2 0 0 1 2 2v2l3-2v10l-3-2v2a2 2 0 0 1-2 2H4z" fill="currentColor" opacity=".2"/>
    <path d="M4 7h12v10H4zM18 9l3-2v10l-3-2z" fill="none" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);

/* ---------------- Prévia ---------------- */
function LivePreview({ name, headerType, headerText, headerMediaUrl, bodyText, footerText, ctas, quicks }) {
  const renderWithTokens = (txt) => {
    const parts = String(txt || '').split(/(\{\{.*?\}\})/g);
    return parts.map((p, i) =>
      /\{\{.*\}\}/.test(p) ? <span key={i} className={styles.token}>{p}</span> : <span key={i}>{p}</span>
    );
  };
  const mediaLabel = headerType === 'IMAGE' ? 'Imagem' : headerType === 'DOCUMENT' ? 'Documento' : 'Vídeo';
  const MediaIcon = headerType === 'IMAGE' ? IconCamera : headerType === 'DOCUMENT' ? IconDoc : IconVideo;

  return (
    <aside className={styles.previewWrap} aria-label="Prévia do template">
      <div className={styles.phoneCard}>
        <div className={styles.phoneTop}>Seu modelo</div>
        <div className={styles.phoneScreen}>
          {headerType !== 'TEXT' && headerType !== 'NONE' && (
            <div className={styles.mediaBox}>
              <span className={styles.mediaBadge}>
                <MediaIcon /> <span>{mediaLabel}</span>
              </span>
            </div>
          )}

          <div className={styles.bubble}>
            {headerType === 'TEXT' && headerText?.trim() && (
              <div className={styles.headLine}>{renderWithTokens(headerText)}</div>
            )}
            <div className={styles.bodyLines}>
              {String(bodyText || '—').split('\n').map((ln, i) => (
                <div key={i}>{renderWithTokens(ln)}</div>
              ))}
            </div>
            {footerText?.trim() && <div className={styles.footerLine}>{renderWithTokens(footerText)}</div>}
            <div className={styles.timeMark}>{nowTime()}</div>
          </div>

          {ctas.length > 0 && (
            <div className={styles.ctaGroup} role="group" aria-label="Ações">
              {ctas.map((b, i) => (
                <div key={i} className={styles.ctaRow}>
                  <span className={styles.ctaIcon}>
                    {b.type === 'PHONE_NUMBER' ? <IconPhone /> : <IconExternal />}
                  </span>
                  <span className={styles.ctaText}>{b.text || 'Ação'}</span>
                </div>
              ))}
            </div>
          )}

          {quicks.length > 0 && (
            <div className={styles.quickGroup} role="group" aria-label="Respostas rápidas">
              {quicks.map((q, i) => (
                <div key={i} className={styles.quickRow}>
                  <span className={styles.quickIcon}><IconReply /></span>
                  <span className={styles.quickText}>{q.text || 'Resposta'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.phoneBottom}>{name || 'nome_do_modelo'}</div>
      </div>
    </aside>
  );
}

/* ---------------- Página ---------------- */
export default function TemplateCreate(){
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

  const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    if (buttonMode === 'cta' && ctas.some(b =>
      !b.text?.trim() || (b.type === 'URL' && !b.url?.trim()) || (b.type === 'PHONE_NUMBER' && !b.phone_number?.trim())
    )) return false;
    if (buttonMode === 'quick' && quicks.some(q => !q.text?.trim())) return false;
    return true;
  }, [name, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const addCta   = () => setCtas(p => (p.length>=MAX_BTNS?p:[...p,{id:newId(),type:'URL',text:'',url:'',phone_number:''}]));
  const addQuick = () => setQuicks(p => (p.length>=MAX_BTNS?p:[...p,{id:newId(),text:''}]));

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!canSave || saving) return;
    setSaving(true);
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
        name: sanitizeTemplateName(name),
        language_code: language,
        category,
        header_type: headerType || 'NONE',
        header_text: headerType === 'TEXT' ? (headerText.trim() || null) : null,
        header_media_url: headerType !== 'TEXT' ? (headerMediaUrl.trim() || null) : null,
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
      setSaving(false);
    }
  }, [canSave, saving, name, language, category, headerType, headerText, headerMediaUrl, bodyText, footerText, buttonMode, ctas, quicks, navigate]);

  const previewCtas   = useMemo(() => buttonMode === 'cta'   ? ctas   : [], [buttonMode, ctas]);
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
          <h1 className={styles.pageTitle}>Novo template</h1>
          <p className={styles.pageSubtitle}>Preencha os campos e veja a prévia ao lado.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {/* Coluna esquerda (form) */}
        <div className={styles.colForm}>

          {/* Informações */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Informações do modelo</h2>
              <p className={styles.cardDesc}>Categoria, idioma e identificação.</p>
            </div>

            <div className={`${styles.cardBodyGrid3} ${styles.alignTop}`}>
              <div className={styles.group}>
                <label className={styles.label}>Categoria *</label>
                <select className={styles.select} value={category} onChange={e=>setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Idioma *</label>
                <select className={styles.select} value={language} onChange={e=>setLanguage(e.target.value)}>
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>
                  Nome * <span className={styles.helper}>[a-z0-9_], sem acentos ou espaços</span>
                </label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={e=>setName(sanitizeTemplateName(e.target.value))}
                  placeholder="ex.: account_update_1"
                  inputMode="latin"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </section>

          {/* Conteúdo */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Conteúdo</h2>
              <p className={styles.cardDesc}>Cabeçalho, corpo e rodapé.</p>
            </div>

            {/* linha: segmented + campo do cabeçalho (lado a lado) */}
            <div className={`${styles.cardBodyGrid3} ${styles.headerRow}`}>
              <div className={styles.group}>
                <label className={styles.label}>Tipo de cabeçalho</label>
                <div className={styles.segmented} role="tablist">
                  {HEADER_TYPES.map(h => (
                    <button
                      key={h.value}
                      type="button"
                      className={`${styles.segItem} ${headerType===h.value ? styles.segActive : ''}`}
                      onClick={()=>setHeaderType(h.value)}
                      aria-pressed={headerType===h.value}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {headerType === 'TEXT' ? (
                <div className={styles.groupWide}>
                  <label className={styles.label}>Cabeçalho (texto)</label>
                  <input
                    className={styles.input}
                    value={headerText}
                    onChange={e=>setHeaderText(e.target.value)}
                    placeholder="Texto do cabeçalho"
                  />
                </div>
              ) : (
                <div className={styles.groupWide}>
                  <label className={styles.label}>Mídia do cabeçalho (URL)</label>
                  <input
                    className={styles.input}
                    value={headerMediaUrl}
                    onChange={e=>setHeaderMediaUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.groupFull}>
                <label className={styles.label}>Corpo *</label>
                <textarea
                  className={styles.textarea}
                  rows={5}
                  value={bodyText}
                  onChange={e=>setBodyText(e.target.value)}
                  placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                />
              </div>

              <div className={styles.groupWide}>
                <label className={styles.label}>Rodapé (opcional)</label>
                <input
                  className={styles.input}
                  value={footerText}
                  onChange={e=>setFooterText(e.target.value)}
                  placeholder="Mensagem do rodapé"
                />
              </div>
            </div>
          </section>

          {/* Botões */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Botões</h2>
              <p className={styles.cardDesc}>Ação (CTA) ou respostas rápidas.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>Tipo</label>
                <div className={styles.pills} role="tablist">
                  <button type="button" className={`${styles.pill} ${buttonMode==='cta'?styles.pillActive:''}`} onClick={()=>{setButtonMode('cta');setQuicks([]);}}>Ação</button>
                  <button type="button" className={`${styles.pill} ${buttonMode==='quick'?styles.pillActive:''}`} onClick={()=>{setButtonMode('quick');setCtas([]);}}>Resposta rápida</button>
                  <button type="button" className={`${styles.pill} ${buttonMode==='none'?styles.pillActive:''}`} onClick={()=>{setButtonMode('none');setCtas([]);setQuicks([]);}}>Nenhum</button>
                </div>
              </div>

              {buttonMode === 'cta' && (
                <div className={styles.groupFull}>
                  {ctas.map(b => (
                    <div key={b.id} className={styles.ctaEditRow}>
                      <select
                        className={styles.select}
                        value={b.type}
                        onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,type:e.target.value}:x))}
                      >
                        <option value="URL">Abrir URL</option>
                        <option value="PHONE_NUMBER">Chamar</option>
                      </select>
                      <input
                        className={styles.input}
                        placeholder="Rótulo"
                        value={b.text}
                        onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,text:e.target.value}:x))}
                      />
                      {b.type === 'URL' ? (
                        <input
                          className={styles.input}
                          placeholder="https://exemplo.com/{{1}}"
                          value={b.url}
                          onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,url:e.target.value}:x))}
                        />
                      ) : (
                        <input
                          className={styles.input}
                          placeholder="+55XXXXXXXXXXX"
                          value={b.phone_number||''}
                          onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,phone_number:e.target.value}:x))}
                        />
                      )}
                      <button type="button" className={styles.btn} onClick={()=>setCtas(p=>p.filter(x=>x.id!==b.id))}>Remover</button>
                    </div>
                  ))}
                  {ctas.length < MAX_BTNS && (
                    <button type="button" className={styles.btnSecondary} onClick={addCta}>
                      + Adicionar botão ({ctas.length}/{MAX_BTNS})
                    </button>
                  )}
                </div>
              )}

              {buttonMode === 'quick' && (
                <div className={styles.groupFull}>
                  {quicks.map(q => (
                    <div key={q.id} className={styles.quickEditRow}>
                      <input
                        className={styles.input}
                        placeholder="Texto curto"
                        value={q.text}
                        onChange={e=>setQuicks(p=>p.map(x=>x.id===q.id?{...x,text:e.target.value}:x))}
                      />
                      <button type="button" className={styles.btn} onClick={()=>setQuicks(p=>p.filter(x=>x.id!==q.id))}>Remover</button>
                    </div>
                  ))}
                  {quicks.length < MAX_BTNS && (
                    <button type="button" className={styles.btnSecondary} onClick={addQuick}>
                      + Adicionar resposta ({quicks.length}/{MAX_BTNS})
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Coluna direita (prévia) */}
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

      {/* Footer fixo */}
      <div className={styles.stickyFooter}>
        <div className={styles.stickyInner}>
          <button type="button" className={styles.btn} onClick={()=>navigate('/management/templates')}>Cancelar</button>
          <button type="button" className={styles.btnPrimary} onClick={handleSubmit} disabled={!canSave || saving}>
            <SaveIcon size={16}/> {saving ? 'Enviando…' : 'Enviar para avaliação'}
          </button>
        </div>
      </div>
    </div>
  );
}
