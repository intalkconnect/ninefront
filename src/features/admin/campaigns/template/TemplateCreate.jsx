import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save as SaveIcon } from 'lucide-react';
import { apiPost } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/TemplateCreate.module.css';

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

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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

  const [buttonMode, setButtonMode] = useState('none'); // 'none' | 'cta' | 'quick'
  const [ctas, setCtas] = useState([]);     // [{id,type:'URL'|'PHONE_NUMBER',text,url,phone_number}]
  const [quicks, setQuicks] = useState([]); // [{id,text}]
  const [saving, setSaving] = useState(false);

  const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    if (buttonMode === 'cta' && ctas.some(b =>
      !b.text.trim() || (b.type === 'URL' && !b.url.trim()) || (b.type === 'PHONE_NUMBER' && !b.phone_number.trim())
    )) return false;
    if (buttonMode === 'quick' && quicks.some(q => !q.text.trim())) return false;
    return true;
  }, [name, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const previewButtons = useMemo(() => {
    if (buttonMode === 'cta') {
      return ctas.map(b =>
        b.type === 'URL'
          ? { type:'URL', text:b.text || 'Abrir', url:b.url || '' }
          : { type:'PHONE_NUMBER', text:b.text || 'Ligar', phone_number:b.phone_number || '' }
      );
    }
    if (buttonMode === 'quick') {
      return quicks.map(q => ({ type:'QUICK_REPLY', text:q.text || 'Responder' }));
    }
    return [];
  }, [buttonMode, ctas, quicks]);

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
        name: name.trim(),
        language_code: language,
        category,
        header_type: headerType || 'NONE',
        header_text: headerType === 'TEXT' ? headerText.trim() : null,
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
      setSaving(false);
    }
  }, [canSave, saving, name, language, category, headerType, headerText, headerMediaUrl, bodyText, footerText, buttonMode, ctas, quicks, navigate]);

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
          <p className={styles.pageSubtitle}>Preencha os campos e visualize à direita como ficará no WhatsApp.</p>
        </div>
      </header>

      {/* Layout com preview lateral */}
      <div className={styles.split}>
        {/* Coluna form (scrolla independente) */}
        <div className={styles.leftCol}>
          {/* Card: principais */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Informações do modelo</h2>
              <p className={styles.cardDesc}>Categoria, idioma e identificação.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
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
                <label className={styles.label}>Nome *</label>
                <input className={styles.input} value={name} onChange={e=>setName(e.target.value)} placeholder="ex.: promo_outubro_2025"/>
              </div>
            </div>
          </section>

          {/* Card: conteúdo */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Conteúdo</h2>
              <p className={styles.cardDesc}>Cabeçalho, corpo e rodapé.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>Tipo de cabeçalho</label>
                <div className={styles.segmented}>
                  {HEADER_TYPES.map(h => (
                    <button
                      key={h.value}
                      type="button"
                      className={`${styles.segItem} ${headerType===h.value ? styles.segActive : ''}`}
                      onClick={()=>setHeaderType(h.value)}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {headerType === 'TEXT' ? (
                <div className={styles.groupWide}>
                  <label className={styles.label}>Cabeçalho (texto)</label>
                  <input className={styles.input} value={headerText} onChange={e=>setHeaderText(e.target.value)} placeholder="Texto do cabeçalho"/>
                </div>
              ) : (
                <div className={styles.groupWide}>
                  <label className={styles.label}>Mídia do cabeçalho (URL)</label>
                  <input className={styles.input} value={headerMediaUrl} onChange={e=>setHeaderMediaUrl(e.target.value)} placeholder="https://..."/>
                </div>
              )}

              <div className={styles.groupFull}>
                <label className={styles.label}>Corpo *</label>
                <textarea
                  className={styles.textarea}
                  rows={6}
                  value={bodyText}
                  onChange={e=>setBodyText(e.target.value)}
                  placeholder="Olá {{1}}, seu pedido {{2}} foi enviado…"
                />
              </div>

              <div className={styles.groupWide}>
                <label className={styles.label}>Rodapé (opcional)</label>
                <input className={styles.input} value={footerText} onChange={e=>setFooterText(e.target.value)} placeholder="Mensagem do rodapé"/>
              </div>
            </div>
          </section>

          {/* Card: botões */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Botões</h2>
              <p className={styles.cardDesc}>Ação (CTA) ou respostas rápidas.</p>
            </div>

            <div className={styles.cardBodyGrid3}>
              <div className={styles.group}>
                <label className={styles.label}>Tipo</label>
                <div className={styles.pills}>
                  <button type="button" className={`${styles.pill} ${buttonMode==='cta'?styles.pillActive:''}`} onClick={()=>{setButtonMode('cta');setQuicks([]);}}>Ação</button>
                  <button type="button" className={`${styles.pill} ${buttonMode==='quick'?styles.pillActive:''}`} onClick={()=>{setButtonMode('quick');setCtas([]);}}>Resposta rápida</button>
                  <button type="button" className={`${styles.pill} ${buttonMode==='none'?styles.pillActive:''}`} onClick={()=>{setButtonMode('none');setCtas([]);setQuicks([]);}}>Nenhum</button>
                </div>
              </div>

              {buttonMode === 'cta' && (
                <div className={styles.groupFull}>
                  {ctas.map(b => (
                    <div key={b.id} className={styles.ctaRow}>
                      <select className={styles.select} value={b.type} onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,type:e.target.value}:x))}>
                        <option value="URL">Abrir URL</option>
                        <option value="PHONE_NUMBER">Chamar</option>
                      </select>
                      <input className={styles.input} placeholder="Rótulo" value={b.text} onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,text:e.target.value}:x))}/>
                      {b.type === 'URL' ? (
                        <input className={styles.input} placeholder="https://exemplo.com/{{1}}" value={b.url} onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,url:e.target.value}:x))}/>
                      ) : (
                        <input className={styles.input} placeholder="+55XXXXXXXXXXX" value={b.phone_number||''} onChange={e=>setCtas(p=>p.map(x=>x.id===b.id?{...x,phone_number:e.target.value}:x))}/>
                      )}
                      <button type="button" className={styles.btn} onClick={()=>setCtas(p=>p.filter(x=>x.id!==b.id))}>Remover</button>
                    </div>
                  ))}
                  {ctas.length < MAX_BTNS && (
                    <button type="button" className={styles.btnSecondary} onClick={addCta}>+ Adicionar botão ({ctas.length}/{MAX_BTNS})</button>
                  )}
                </div>
              )}

              {buttonMode === 'quick' && (
                <div className={styles.groupFull}>
                  {quicks.map(q => (
                    <div key={q.id} className={styles.quickRow}>
                      <input className={styles.input} placeholder="Texto curto" value={q.text} onChange={e=>setQuicks(p=>p.map(x=>x.id===q.id?{...x,text:e.target.value}:x))}/>
                      <button type="button" className={styles.btn} onClick={()=>setQuicks(p=>p.filter(x=>x.id!==q.id))}>Remover</button>
                    </div>
                  ))}
                  {quicks.length < MAX_BTNS && (
                    <button type="button" className={styles.btnSecondary} onClick={addQuick}>+ Adicionar resposta ({quicks.length}/{MAX_BTNS})</button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Coluna preview (sticky) */}
        <aside className={styles.rightCol} aria-label="Pré-visualização">
          <div className={styles.previewCard}>
            <div className={styles.previewTitle}>Prévia</div>
            <div className={styles.waCard}>
              <div className={styles.waTopBar}>{name || 'Seu modelo'}</div>
              <div className={styles.waScreen}>
                {/* header media/text */}
                {headerType !== 'NONE' && headerType !== 'TEXT' && (
                  <div className={styles.waAttachment}>
                    {headerType === 'IMAGE'    && (headerMediaUrl ? <img src={headerMediaUrl} alt="Imagem do cabeçalho" /> : '📷 Imagem')}
                    {headerType === 'VIDEO'    && (headerMediaUrl ? <video src={headerMediaUrl} controls /> : '🎬 Vídeo')}
                    {headerType === 'DOCUMENT' && '📄 Documento'}
                  </div>
                )}

                <div className={styles.waBubble}>
                  {headerType === 'TEXT' && headerText && <div className={styles.waHeader}>{headerText}</div>}
                  <div className={styles.waBody}>
                    {(bodyText || '—').split('\n').map((line, i) => (
                      <div key={i}>{line || <>&nbsp;</>}</div>
                    ))}
                  </div>
                  {footerText && <div className={styles.waFooter}>{footerText}</div>}
                  <div className={styles.waTime}>{fmtTime()}</div>
                </div>

                {previewButtons.length > 0 && (
                  <div className={styles.waButtons}>
                    {previewButtons.map((b, i) => (
                      <button
                        key={i}
                        type="button"
                        className={(b?.type || '').toUpperCase() === 'QUICK_REPLY'
                          ? styles.waBtnReply
                          : styles.waBtnCta}
                        title={b?.type || 'BUTTON'}
                      >
                        {b?.text || 'Botão'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.previewHints}>
              <span><strong>Idioma:</strong> {LANGS.find(l=>l.value===language)?.label || language}</span>
              <span><strong>Categoria:</strong> {CATEGORIES.find(c=>c.value===category)?.label || category}</span>
            </div>
          </div>
        </aside>
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
