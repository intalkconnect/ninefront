import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save as SaveIcon } from 'lucide-react';
import { apiPost } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import styles from './styles/TemplateCreate.module.css';

/* ==========================
   Constantes
========================== */
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

/* ==========================
   Helpers
========================== */
// Regex oficial que a Meta impõe para "name"
const META_NAME_RE = /^[a-z0-9_]+$/;

// remoção de acentos e normalização para minúsculas + underscore
function sanitizeTemplateName(raw = '') {
  let s = String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')        // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')           // só a-z 0-9 _
    .replace(/^_+|_+$/g, '')                // tira _ das pontas
    .replace(/__+/g, '_');                  // compacta
  return s;
}

/* ==========================
   Preview (estilo Meta)
========================== */
function Preview({ name, headerType, headerText, bodyText, footerText, buttonMode, ctas, quicks }) {
  const btns = useMemo(() => {
    if (buttonMode === 'cta' && ctas?.length) return ctas.map(b => ({ ...b, _kind: 'CTA' }));
    if (buttonMode === 'quick' && quicks?.length) return quicks.map(q => ({ ...q, _kind: 'REPLY', type: 'QUICK_REPLY' }));
    return [];
  }, [buttonMode, ctas, quicks]);

  const highlight = (txt='') =>
    txt.split(/(\{\{.*?\}\})/g).map((c,i) => /\{\{.*?\}\}/.test(c)
      ? <span key={i} className={styles.var}>{c}</span>
      : <span key={i}>{c}</span>
    );

  return (
    <aside className={styles.previewAside} aria-label="Prévia">
      <div className={styles.metaCard}>
        <div className={styles.metaTop}>Seu modelo</div>

        <div className={styles.metaScreen}>
          {/* Balão */}
          <div className={styles.bubble}>
            {headerType === 'TEXT' && headerText?.trim() && (
              <div className={styles.hdr}>{highlight(headerText)}</div>
            )}
            <div className={styles.body}>
              {(bodyText||'').split('\n').map((l, i) => (
                <div key={i}>{l ? highlight(l) : <>&nbsp;</>}</div>
              ))}
            </div>
            {footerText?.trim() && <div className={styles.ftr}>{highlight(footerText)}</div>}
            <div className={styles.time}>
              {new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date())}
            </div>
          </div>

          {/* Painel de ações (linhas) */}
          {btns.length > 0 && (
            <div className={styles.actionPanel} role="list">
              {btns.map((b, i) => {
                const isReply = (b._kind === 'REPLY' || (b.type||'').toUpperCase()==='QUICK_REPLY');
                return (
                  <div key={i} className={styles.actionRow} role="listitem">
                    <span className={isReply ? styles.iconReply : styles.iconLink} aria-hidden="true" />
                    <span className={styles.actionText}>{b.text || b.title || 'Botão'}</span>
                    {!isReply && <span className={styles.chev} aria-hidden="true">›</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.metaBottom}>{name || 'nome_do_modelo'}</div>
      </div>
    </aside>
  );
}

/* ==========================
   Página
========================== */
export default function TemplateCreate(){
  const navigate = useNavigate();
  const topRef = useRef(null);

  // form
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
  const [touched, setTouched] = useState({ name:false });

  const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const nameSanitized = useMemo(() => sanitizeTemplateName(name), [name]);
  const nameInvalid = !nameSanitized || !META_NAME_RE.test(nameSanitized);

  const canSave = useMemo(() => {
    if (nameInvalid) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;
    if (buttonMode === 'cta' && ctas.some(b =>
      !b.text?.trim() || (b.type === 'URL' && !b.url?.trim()) || (b.type === 'PHONE_NUMBER' && !b.phone_number?.trim())
    )) return false;
    if (buttonMode === 'quick' && quicks.some(q => !q.text?.trim())) return false;
    return true;
  }, [nameInvalid, bodyText, headerType, headerText, buttonMode, ctas, quicks]);

  const addCta   = () => setCtas(p => (p.length>=MAX_BTNS?p:[...p,{id:newId(),type:'URL',text:'',url:'',phone_number:''}]));
  const addQuick = () => setQuicks(p => (p.length>=MAX_BTNS?p:[...p,{id:newId(),text:''}]));

  const handleNameChange = (e) => {
    const raw = e.target.value;
    const san = sanitizeTemplateName(raw);
    setName(san);
  };

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    setTouched(t => ({...t, name:true}));
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
        name: nameSanitized,
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

      // Cria local (draft), envia e sincroniza
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
  }, [canSave, saving, nameSanitized, language, category, headerType, headerText, headerMediaUrl, bodyText, footerText, buttonMode, ctas, quicks, navigate]);

  return (
    <div className={styles.page} ref={topRef}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
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
        {/* Coluna Principal */}
        <div className={styles.mainCol}>
          {/* Informações */}
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
                <label className={styles.label}>
                  Nome * <span className={styles.mono}>[a-z0-9_]</span>
                </label>
                <input
                  className={`${styles.input} ${touched.name && nameInvalid ? styles.invalid : ''}`}
                  value={name}
                  onChange={handleNameChange}
                  onBlur={() => setTouched(t => ({...t, name:true}))}
                  placeholder="ex.: account_update_1"
                  inputMode="latin"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {touched.name && nameInvalid && (
                  <span className={styles.errMsg}>
                    Use somente letras minúsculas, números e underline (sem acentos).
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Conteúdo */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Conteúdo</h2>
              <p className={styles.cardDesc}>Cabeçalho, corpo e rodapé.</p>
            </div>

            {/* Linha com tipo (pílulas) + campo do cabeçalho */}
            <div className={styles.rowTwoCols}>
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
                <div className={styles.group}>
                  <label className={styles.label}>Cabeçalho (texto)</label>
                  <input
                    className={styles.input}
                    value={headerText}
                    onChange={e=>setHeaderText(e.target.value)}
                    placeholder="Texto do cabeçalho"
                  />
                </div>
              ) : (
                <div className={styles.group}>
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

        {/* Coluna Preview */}
        <div className={styles.sideCol}>
          <Preview
            name={nameSanitized}
            headerType={headerType}
            headerText={headerText}
            bodyText={bodyText}
            footerText={footerText}
            buttonMode={buttonMode}
            ctas={ctas}
            quicks={quicks}
          />
        </div>
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
