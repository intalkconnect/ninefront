import React, { useMemo, useState } from 'react';
import { apiPost } from '../../../shared/apiClient';
import styles from './styles/Templates.module.css';
import {
  X as XIcon,
  Save as SaveIcon,
  Type,
  Image as ImgIcon,
  FileText,
  Film,
  Plus,
  Trash2
} from 'lucide-react';

const CATEGORIES = [
  { value: 'UTILITY', label: 'Utility' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Authentication' },
];

const LANGS = [
  { code: 'pt_BR', label: 'Português (BR)' },
  { code: 'pt_PT', label: 'Português (PT)' },
  { code: 'en_US', label: 'Inglês (US)' },
  { code: 'en_GB', label: 'Inglês (UK)' },
  { code: 'es_ES', label: 'Espanhol (ES)' },
  { code: 'es_MX', label: 'Espanhol (MX)' },
  { code: 'fr_FR', label: 'Francês (FR)' },
  { code: 'de_DE', label: 'Alemão (DE)' },
  { code: 'it_IT', label: 'Italiano (IT)' },
];

const HEADER_TYPES = [
  { value: 'TEXT', label: 'Texto', icon: Type },
  { value: 'IMAGE', label: 'Imagem', icon: ImgIcon },
  { value: 'DOCUMENT', label: 'Documento', icon: FileText },
  { value: 'VIDEO', label: 'Vídeo', icon: Film },
];

const MAX_ACTION = 2;
const MAX_QUICK = 10;

export default function TemplateModal({ isOpen, onClose, onCreated }) {
  // básicos
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('MARKETING');

  // cabeçalho
  const [headerType, setHeaderType] = useState('TEXT');
  const [headerText, setHeaderText] = useState('');   // TEXT
  const [headerLink, setHeaderLink] = useState('');   // mídia (info)

  // corpo/rodapé
  const [bodyText, setBodyText] = useState('Olá {{1}}, seu pedido {{2}} foi enviado…');
  const [footerText, setFooterText] = useState('');

  // botões
  const [btnMode, setBtnMode] = useState('none');     // none | action | quick
  const [actionBtns, setActionBtns] = useState([]);
  const [quickBtns, setQuickBtns] = useState([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!bodyText.trim()) return false;
    if (headerType === 'TEXT' && !headerText.trim()) return false;

    if (btnMode === 'action') {
      if (actionBtns.length > MAX_ACTION) return false;
      return actionBtns.every(b =>
        b.text?.trim() &&
        ((b.kind === 'url' && b.url?.trim()) || (b.kind === 'phone' && b.phone?.trim()))
      );
    }
    if (btnMode === 'quick') {
      if (quickBtns.length > MAX_QUICK) return false;
      return quickBtns.every(b => b.text?.trim());
    }
    return true;
  }, [name, bodyText, headerType, headerText, btnMode, actionBtns, quickBtns]);

  // helpers de botões
  const addActionBtn = () => {
    if (actionBtns.length >= MAX_ACTION) return;
    setActionBtns(v => [...v, { kind: 'url', text: '', url: '' }]);
  };
  const updActionBtn = (idx, patch) => setActionBtns(v => v.map((b,i)=> i===idx ? { ...b, ...patch } : b));
  const delActionBtn = (idx) => setActionBtns(v => v.filter((_,i)=> i!==idx));

  const addQuickBtn = () => {
    if (quickBtns.length >= MAX_QUICK) return;
    setQuickBtns(v => [...v, { text: '' }]);
  };
  const updQuickBtn = (idx, patch) => setQuickBtns(v => v.map((b,i)=> i===idx ? { ...b, ...patch } : b));
  const delQuickBtn = (idx) => setQuickBtns(v => v.filter((_,i)=> i!==idx));

  async function handleSave(e) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);
    setErr(null);

    try {
      let buttons = null;
      if (btnMode === 'action' && actionBtns.length) {
        buttons = actionBtns.map(b =>
          b.kind === 'url'
            ? { type:'URL', text:b.text.trim(), url:b.url.trim() }
            : { type:'PHONE_NUMBER', text:b.text.trim(), phone_number:b.phone.trim() }
        );
      }
      if (btnMode === 'quick' && quickBtns.length) {
        buttons = quickBtns.map(b => ({ type:'QUICK_REPLY', text:b.text.trim() }));
      }

      const payload = {
        name: name.trim(),
        language_code: language,
        category,
        header_type: headerType,
        header_text: headerType === 'TEXT' ? (headerText || '').trim() : null,
        body_text: bodyText.trim(),
        footer_text: footerText.trim() || null,
        buttons,
        example: headerLink?.trim() ? { header_url: headerLink.trim() } : null,
      };

      await apiPost('/templates', payload);
      onCreated?.();
    } catch (e) {
      console.error('Erro ao criar template:', e);
      setErr(e?.message || 'Falha ao criar template.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Criar template">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Novo modelo de mensagem</h3>
          <button className={styles.btn} onClick={onClose} aria-label="Fechar"><XIcon size={16}/></button>
        </div>

        {/* Conteúdo rolável */}
        <div className={styles.modalContent}>
          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>

              {err && <div className={styles.alertErr}>{err}</div>}

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

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-category">Categoria *</label>
                <select
                  id="tpl-category"
                  className={`${styles.input} ${styles.select}`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="tpl-language">Idioma *</label>
                <select
                  id="tpl-language"
                  className={`${styles.input} ${styles.select}`}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  required
                >
                  {LANGS.map(l => (
                    <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                  ))}
                </select>
                <div className={styles.inputHelper}>Formato Meta: pt_BR, en_US, es_ES…</div>
              </div>

              {/* Cabeçalho */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Cabeçalho</label>
                <div className={styles.headerTabs}>
                  {HEADER_TYPES.map(h => {
                    const Icon = h.icon;
                    const active = headerType === h.value;
                    return (
                      <button
                        key={h.value}
                        type="button"
                        className={`${styles.headerTab} ${active ? styles.headerTabActive : ''}`}
                        onClick={() => setHeaderType(h.value)}
                      >
                        <Icon size={18} /> {h.label}
                      </button>
                    );
                  })}
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
                      placeholder={headerType === 'IMAGE' ? 'Link da imagem'
                                   : headerType === 'DOCUMENT' ? 'Link do documento'
                                   : 'Link do vídeo'}
                      value={headerLink}
                      onChange={(e) => setHeaderLink(e.target.value)}
                    />
                    <div className={styles.inputHelper}>
                      Compatível com formatos padrão. *O envio para avaliação não usa esse link — serve como referência.
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
                  <button type="button" className={`${styles.pill} ${btnMode==='none'?styles.pillActive:''}`} onClick={()=>setBtnMode('none')}>Nenhum</button>
                  <button type="button" className={`${styles.pill} ${btnMode==='action'?styles.pillActive:''}`} onClick={()=>setBtnMode('action')}>Botões de ação</button>
                  <button type="button" className={`${styles.pill} ${btnMode==='quick'?styles.pillActive:''}`} onClick={()=>setBtnMode('quick')}>Respostas rápidas</button>
                </div>

                {btnMode === 'action' && (
                  <>
                    <div className={styles.inputHelper}>Até {MAX_ACTION} botões.</div>
                    <div className={styles.btnList}>
                      {actionBtns.map((b, idx) => (
                        <div key={idx} className={styles.btnItem}>
                          <div className={styles.btnItemHeader}>
                            <div className={styles.grid3}>
                              <select
                                className={`${styles.input} ${styles.select}`}
                                value={b.kind}
                                onChange={(e)=>updActionBtn(idx, { kind:e.target.value })}
                              >
                                <option value="url">Abrir URL</option>
                                <option value="phone">Telefonar</option>
                              </select>
                              <input
                                className={styles.input}
                                placeholder="Rótulo do botão"
                                value={b.text}
                                onChange={(e)=>updActionBtn(idx, { text:e.target.value })}
                              />
                              {b.kind === 'url' ? (
                                <input
                                  className={styles.input}
                                  placeholder="https://exemplo.com/{{1}}"
                                  value={b.url || ''}
                                  onChange={(e)=>updActionBtn(idx, { url:e.target.value })}
                                />
                              ) : (
                                <input
                                  className={styles.input}
                                  placeholder="+55 11 99999-0000"
                                  value={b.phone || ''}
                                  onChange={(e)=>updActionBtn(idx, { phone:e.target.value })}
                                />
                              )}
                            </div>
                            <button type="button" className={styles.btnRemove} onClick={()=>delActionBtn(idx)} title="Remover">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={styles.btnSmall} onClick={addActionBtn}><Plus size={16}/> Adicionar botão</button>
                  </>
                )}

                {btnMode === 'quick' && (
                  <>
                    <div className={styles.inputHelper}>Até {MAX_QUICK} respostas rápidas.</div>
                    <div className={styles.btnList}>
                      {quickBtns.map((b, idx) => (
                        <div key={idx} className={styles.btnItem}>
                          <div className={styles.btnItemHeader}>
                            <input
                              className={styles.input}
                              placeholder="Texto da resposta"
                              value={b.text}
                              onChange={(e)=>updQuickBtn(idx, { text:e.target.value })}
                            />
                            <button type="button" className={styles.btnRemove} onClick={()=>delQuickBtn(idx)} title="Remover">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={styles.btnSmall} onClick={addQuickBtn}><Plus size={16}/> Adicionar resposta</button>
                  </>
                )}
              </div>
            </div>

            {/* Ações ficam fora do fluxo rolável, coladas no rodapé do modal */}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSmallAlt} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary} disabled={!canSave || saving}>
                <SaveIcon size={16}/> {saving ? 'Salvando…' : 'Enviar para avaliação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
