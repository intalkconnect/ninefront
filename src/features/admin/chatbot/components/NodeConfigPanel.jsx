import React, { useState, useRef, useCallback } from "react";
import {
  Trash2,
  Plus,
  X,
  MoreHorizontal,
  PencilLine,
  ArrowLeft,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Edit2
} from "lucide-react";
import styles from "./styles/NodeConfigPanel.module.css";

export default function NodeConfigPanel({
  selectedNode,
  onChange,
  onClose,
  allNodes = [],
  onConnectNodes,
  setShowScriptEditor,
  setScriptCode,
}) {
  if (!selectedNode || !selectedNode.data) return null;

  /* --------------- helpers --------------- */
  const deep = (o) =>
    typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o ?? {}));
  const ensureArr = (v) => (Array.isArray(v) ? v : []);
  const clamp = (s = "", n = 100) => (s || "").toString().slice(0, n);
  const makeIdFromTitle = (t, n = 24) => clamp((t || "").trim(), n);
  const pretty = (obj) => { try { return JSON.stringify(obj ?? {}, null, 2); } catch { return "{}"; } };
  const parse = (txt, fb) => { try { return txt?.trim() ? JSON.parse(txt) : fb; } catch { return fb; } };

  /* --------------- base data --------------- */
  const block = selectedNode.data.block || {};
  const {
    type,
    content = {},
    awaitResponse,
    awaitTimeInSeconds,
    sendDelayInSeconds,
    actions = [],
    method,
    url,
    headers,
    body,
    timeout,
    outputVar,
    statusVar,
    function: fnName,
    saveResponseVar,
    defaultNext,
    onEnter = [],
    onExit = [],
  } = block;

  const isHuman = type === "human";

  /* --------------- write helpers (auto-save) --------------- */
  const updateBlock = (patch) =>
    onChange({ ...selectedNode, data: { ...selectedNode.data, block: { ...block, ...patch } } });

  const setContent = (patch) => updateBlock({ content: { ...deep(content), ...patch } });
  const setActions = (arr) => updateBlock({ actions: deep(arr) });
  const setEnter = (arr) => updateBlock({ onEnter: deep(arr) });
  const setExit = (arr) => updateBlock({ onExit: deep(arr) });

  /* --------------- overlay (drawer) --------------- */
  // 'none' | 'conteudo' | 'regras' | 'await' | 'especiais'
  const [overlay, setOverlay] = useState("none");
  const open = (m) => setOverlay(m);
  const close = () => setOverlay("none");

  /* --------------- keyboard guard --------------- */
  const panelRef = useRef(null);
  const isEditable = (el) => {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const t = el.tagName?.toUpperCase?.();
    if (t === "TEXTAREA") return true;
    if (t === "INPUT") {
      const ty = (el.type || "").toLowerCase();
      const whitelist = ["text","search","url","tel","email","password","number","date","datetime-local","time"];
      return whitelist.includes(ty) && !el.readOnly && !el.disabled;
    }
    return false;
  };
  const onKeyDownCapture = useCallback((e) => {
    if (!panelRef.current?.contains(e.target)) return;
    if (isEditable(e.target)) {
      const k = e.key?.toLowerCase?.() || "";
      const del = e.key === "Delete" || e.key === "Backspace";
      const undo = (e.ctrlKey || e.metaKey) && !e.shiftKey && k === "z";
      const redo = (e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey));
      if (del || undo || redo) e.stopPropagation();
    }
  }, []);

  /* --------------- regras: helpers --------------- */
  const varOptions = isHuman
    ? [
        { value: "lastUserMessage", label: "Resposta do usuário" },
        { value: "offhours", label: "Fora do expediente" },
        { value: "offhours_reason", label: "Motivo do off-hours" },
        { value: "custom", label: "Variável personalizada" },
      ]
    : [
        { value: "lastUserMessage", label: "Resposta do usuário" },
        { value: "custom", label: "Variável personalizada" },
      ];

  const ValueInput = ({ cond, onChange }) => {
    if (cond.type === "exists") return null;
    if (cond.variable === "offhours") {
      return (
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Valor</label>
          <select
            className={styles.selectStyle}
            value={cond.value ?? "true"}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      );
    }
    if (cond.variable === "offhours_reason") {
      return (
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Valor</label>
          <select
            className={styles.selectStyle}
            value={cond.value ?? "holiday"}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="holiday">holiday</option>
            <option value="closed">closed</option>
          </select>
        </div>
      );
    }
    return (
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Valor</label>
        <input
          className={styles.inputStyle}
          value={cond.value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Valor para comparação"
        />
      </div>
    );
  };

  const addOffhours = (kind) => {
    let conds = [];
    if (kind === "offhours_true") conds = [{ variable: "offhours", type: "equals", value: "true" }];
    if (kind === "reason_holiday") conds = [{ variable: "offhours_reason", type: "equals", value: "holiday" }];
    if (kind === "reason_closed") conds = [{ variable: "offhours_reason", type: "equals", value: "closed" }];
    setActions([...(actions || []), { next: "", conditions: conds }]);
  };

  /* --------------- preview --------------- */
  const QuickReplies = () => {
    if (type !== "interactive" || content?.type !== "button") return null;
    const btns = content?.action?.buttons || [];
    if (!btns.length) return null;
    return (
      <div className={styles.quickReplies}>
        {btns.map((b, i) => (
          <span key={i} className={styles.quickReplyChip}>{b?.reply?.title || "Botão"}</span>
        ))}
      </div>
    );
  };

  const ListPreview = () => {
    if (type !== "interactive" || content?.type !== "list") return null;
    const rows = content?.action?.sections?.[0]?.rows || [];
    if (!rows.length) return null;
    return (
      <div className={styles.listPreview}>
        {rows.slice(0, 3).map((row, i) => (
          <div key={i} className={styles.listRow}>
            <span className={styles.listDot} />
            <div className={styles.listTexts}>
              <strong>{row?.title || "Item"}</strong>
              {row?.description ? <small>{row.description}</small> : null}
            </div>
          </div>
        ))}
        {rows.length > 3 && <small className={styles.moreHint}>e mais {rows.length - 3}…</small>}
      </div>
    );
  };

  const SpecialChips = () => {
    const list = [...ensureArr(onEnter), ...ensureArr(onExit)].filter((a) => (a?.title || a?.key));
    if (!list.length) return null;
    const max = 3, extra = list.length - max;
    return (
      <div className={styles.specialStrip}>
        {list.slice(0, max).map((a, i) => (
          <span key={i} className={styles.specialChip} onClick={() => open("especiais")}>
            {a.title || a.key}
          </span>
        ))}
        {extra > 0 && (
          <span className={styles.specialChipMuted} onClick={() => open("especiais")}>+{extra}</span>
        )}
      </div>
    );
  };

  const ChatPreview = () => (
    <div className={styles.chatPreviewCard}>
      <div className={styles.floatingBtns}>
        <button className={styles.iconGhost} title="Editar conteúdo" onClick={() => open("conteudo")}><PencilLine size={16}/></button>
        <button className={styles.iconGhost} title="Regras de saída" onClick={() => open("regras")}><MoreHorizontal size={16}/></button>
        <button className={styles.iconGhost} title="Ações especiais" onClick={() => open("especiais")}><SlidersHorizontal size={16}/></button>
      </div>

      <div className={styles.chatArea}>
        <div className={styles.typingDot}>•••</div>

        <div className={styles.bubble}>
          <div className={styles.bubbleText}>
            {type === "text" && (block.content || <em className={styles.placeholder}>Sem mensagem</em>)}

            {type === "interactive" && (
              <>
                <div>{content?.body?.text || <em className={styles.placeholder}>Sem corpo</em>}</div>
                <QuickReplies />
                <ListPreview />
              </>
            )}

            {type === "media" && (
              <>
                <div><strong>Mídia:</strong> {content?.mediaType || "image"}</div>
                <div>{content?.caption || <em className={styles.placeholder}>Sem legenda</em>}</div>
              </>
            )}

            {type === "location" && (
              <>
                <div><strong>{content?.name || "Local"}</strong></div>
                <small>{content?.address || "Endereço"}</small>
              </>
            )}

            {isHuman && (
              <div className={styles.infoBlock}>
                Este bloco transfere a conversa para <strong>atendimento humano</strong>.
              </div>
            )}
          </div>
        </div>

        <SpecialChips />

        <button type="button" className={styles.userInputChip} onClick={() => open("await")} title="Configurar aguardar resposta">
          Entrada do usuário <span className={styles.caret} />
        </button>
      </div>
    </div>
  );

  /* --------------- overlays --------------- */

  const OverlayAwait = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={close} title="Voltar"><ArrowLeft size={18}/></button>
        <div className={styles.overlayTitle}>Entrada do usuário</div>
        <button className={styles.iconGhost} onClick={close} title="Fechar"><X size={16}/></button>
      </div>
      <div className={styles.overlayBody}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Aguardar resposta</h4></div>
          <div className={styles.sectionContent}>
            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Ativar</label>
                <select
                  className={styles.selectStyle}
                  value={String(!!awaitResponse)}
                  onChange={(e) => updateBlock({ awaitResponse: e.target.value === "true" })}
                >
                  <option value="true">Sim</option><option value="false">Não</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Atraso de envio (s)</label>
                <input
                  className={styles.inputStyle}
                  type="number"
                  value={sendDelayInSeconds ?? 0}
                  onChange={(e) => updateBlock({ sendDelayInSeconds: parseInt(e.target.value || "0", 10) })}
                />
              </div>
            </div>

            <div className={styles.rowTwoCols}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tempo de inatividade (s)</label>
                <input
                  className={styles.inputStyle}
                  type="number"
                  value={awaitTimeInSeconds ?? 0}
                  onChange={(e) => updateBlock({ awaitTimeInSeconds: parseInt(e.target.value || "0", 10) })}
                />
                <small className={styles.helpText}>0 para desativar</small>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Salvar resposta do usuário em</label>
                <input
                  className={styles.inputStyle}
                  placeholder="ex.: context.inputMenuPrincipal"
                  value={saveResponseVar || ""}
                  onChange={(e) => updateBlock({ saveResponseVar: e.target.value })}
                />
                <small className={styles.helpText}>Se vazio, não salva.</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const OverlayConteudo = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={close} title="Voltar"><ArrowLeft size={18}/></button>
        <div className={styles.overlayTitle}>Conteúdo</div>
        <button className={styles.iconGhost} onClick={close} title="Fechar"><X size={16}/></button>
      </div>

      <div className={styles.overlayBody}>
        {type === "text" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mensagem</h4></div>
            <div className={styles.sectionContent}>
              <textarea
                rows={10}
                className={styles.textareaStyle}
                value={block.content || ""}
                onChange={(e) => updateBlock({ content: e.target.value })}
              />
            </div>
          </div>
        )}

        {type === "interactive" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Interativo</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Tipo</label>
                <select
                  className={styles.selectStyle}
                  value={content.type || "button"}
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType === "list") {
                      updateBlock({
                        content: deep({
                          type: "list",
                          body: { text: "Escolha um item da lista:" },
                          footer: { text: "Toque para selecionar" },
                          header: { text: "Menu de Opções", type: "text" },
                          action: { button: "Abrir lista", sections: [{ title: "Seção 1", rows: [{ id: "Item 1", title: "Item 1", description: "" }]}] }
                        }),
                      });
                    } else {
                      updateBlock({
                        content: deep({
                          type: "button",
                          body: { text: "Escolha uma opção:" },
                          footer: { text: "" },
                          action: { buttons: [
                            { type: "reply", reply: { id: "Opção 1", title: "Opção 1" } },
                            { type: "reply", reply: { id: "Opção 2", title: "Opção 2" } },
                          ]},
                        }),
                      });
                    }
                  }}
                >
                  <option value="button">Quick Reply</option>
                  <option value="list">Menu List</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Corpo</label>
                <input
                  className={styles.inputStyle}
                  value={content.body?.text || ""}
                  onChange={(e) => setContent({ body: { ...(deep(content.body) || {}), text: e.target.value } })}
                />
              </div>

              {(content.type === "button") && (
                <>
                  {(content.action?.buttons || []).map((btn, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <input
                        className={styles.inputStyle}
                        value={btn.reply?.title || ""}
                        maxLength={20}
                        placeholder="Texto do botão"
                        onChange={(e) => {
                          const value = clamp(e.target.value, 20);
                          const buttons = deep(content.action?.buttons || []);
                          buttons[idx] = { ...(buttons[idx] || { type: "reply", reply: { id: "", title: "" } }),
                            reply: { ...(buttons[idx]?.reply || {}), title: value, id: value } };
                          setContent({ action: { ...(deep(content.action) || {}), buttons } });
                        }}
                      />
                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        title="Remover"
                        onClick={() => {
                          const buttons = deep(content.action?.buttons || []);
                          buttons.splice(idx, 1);
                          setContent({ action: { ...(deep(content.action) || {}), buttons } });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    className={styles.addButton}
                    onClick={() => {
                      const current = deep(content.action?.buttons || []);
                      if (current.length >= 3) return;
                      const newBtn = { type: "reply", reply: { id: "Novo botão", title: "Novo botão" } };
                      setContent({ action: { ...(deep(content.action) || {}), buttons: [...current, newBtn] } });
                    }}
                  >+ Adicionar botão</button>
                </>
              )}

              {(content.type === "list") && (
                <>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Texto do botão (abrir lista)</label>
                    <input
                      className={styles.inputStyle}
                      maxLength={20}
                      value={content.action?.button || ""}
                      onChange={(e) => {
                        const next = { ...(deep(content.action) || {}) };
                        next.button = e.target.value.slice(0, 20);
                        next.sections = deep(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
                        setContent({ action: next });
                      }}
                    />
                  </div>

                  {(content.action?.sections?.[0]?.rows || []).map((row, idx) => (
                    <div key={idx} className={styles.rowItemStyle}>
                      <input
                        className={styles.inputStyle}
                        value={row.title}
                        maxLength={24}
                        placeholder="Título"
                        onChange={(e) => {
                          const sections = deep(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          const title = clamp(e.target.value, 24);
                          rows[idx] = { ...(rows[idx] || {}), title, id: makeIdFromTitle(title, 24) };
                          sections[0] = { ...(sections[0] || {}), rows };
                          setContent({ action: { ...(deep(content.action) || {}), sections } });
                        }}
                      />
                      <input
                        className={styles.inputStyle}
                        value={row.description}
                        placeholder="Descrição"
                        onChange={(e) => {
                          const sections = deep(content.action?.sections || [{ title: "Seção 1", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows[idx] = { ...(rows[idx] || {}), description: e.target.value };
                          sections[0] = { ...(sections[0] || {}), rows };
                          setContent({ action: { ...(deep(content.action) || {}), sections } });
                        }}
                      />
                      <Trash2
                        size={18}
                        className={styles.trashIcon}
                        title="Remover"
                        onClick={() => {
                          const sections = deep(content.action?.sections || [{ title: "", rows: [] }]);
                          const rows = [...(sections[0]?.rows || [])];
                          rows.splice(idx, 1);
                          sections[0] = { ...(sections[0] || {}), rows };
                          setContent({ action: { ...(deep(content.action) || {}), sections } });
                        }}
                      />
                    </div>
                  ))}

                  <button
                    className={styles.addButton}
                    onClick={() => {
                      const sections = deep(content.action?.sections || [{ title: "", rows: [] }]);
                      const rows = sections[0]?.rows || [];
                      const n = rows.length + 1;
                      const title = `Item ${n}`;
                      const item = { id: makeIdFromTitle(title, 24), title, description: "" };
                      const nextRows = [...rows, item];
                      const nextSections = [{ ...(sections[0] || {}), rows: nextRows }];
                      setContent({ action: { ...(deep(content.action) || {}), sections: nextSections } });
                    }}
                  >+ Adicionar item</button>
                </>
              )}
            </div>
          </div>
        )}

        {type === "media" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Mídia</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.rowThreeCols}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Tipo</label>
                  <select
                    className={styles.selectStyle}
                    value={content.mediaType || "image"}
                    onChange={(e) => setContent({ mediaType: e.target.value })}
                  >
                    <option value="image">Imagem</option>
                    <option value="document">Documento</option>
                    <option value="audio">Áudio</option>
                    <option value="video">Vídeo</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>URL</label>
                  <input className={styles.inputStyle} value={content.url || ""} onChange={(e) => setContent({ url: e.target.value })}/>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Legenda</label>
                  <input className={styles.inputStyle} value={content.caption || ""} onChange={(e) => setContent({ caption: e.target.value })}/>
                </div>
              </div>
            </div>
          </div>
        )}

        {type === "location" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Localização</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Nome</label>
                  <input className={styles.inputStyle} value={content.name || ""} onChange={(e) => setContent({ name: e.target.value })}/></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Endereço</label>
                  <input className={styles.inputStyle} value={content.address || ""} onChange={(e) => setContent({ address: e.target.value })}/></div>
              </div>
              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Latitude</label>
                  <input className={styles.inputStyle} value={content.latitude || ""} onChange={(e) => setContent({ latitude: e.target.value })}/></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Longitude</label>
                  <input className={styles.inputStyle} value={content.longitude || ""} onChange={(e) => setContent({ longitude: e.target.value })}/></div>
              </div>
            </div>
          </div>
        )}

        {type === "script" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Script</h4></div>
            <div className={styles.sectionContent}>
              <button
                onClick={() => { setScriptCode(selectedNode?.data?.block?.code || ""); setShowScriptEditor(true); }}
                className={styles.addButton}
              >Abrir editor de código</button>

              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Função</label>
                  <input className={styles.inputStyle} value={fnName || ""} onChange={(e) => updateBlock({ function: e.target.value })}/></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Variável de saída</label>
                  <input className={styles.inputStyle} value={outputVar || ""} onChange={(e) => updateBlock({ outputVar: e.target.value })}/></div>
              </div>
            </div>
          </div>
        )}

        {type === "api_call" && (
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Requisição HTTP</h4></div>
            <div className={styles.sectionContent}>
              <div className={styles.rowThreeCols}>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Método</label>
                  <select className={styles.selectStyle} value={method || "GET"} onChange={(e) => updateBlock({ method: e.target.value })}>
                    <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option>
                  </select></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>URL</label>
                  <input className={styles.inputStyle} value={url || ""} onChange={(e) => updateBlock({ url: e.target.value })}/></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Timeout (ms)</label>
                  <input className={styles.inputStyle} type="number" value={timeout ?? 10000} onChange={(e) => updateBlock({ timeout: parseInt(e.target.value || "0", 10) })}/></div>
              </div>

              <div className={styles.inputGroup}><label className={styles.inputLabel}>Headers (JSON)</label>
                <textarea className={styles.textareaStyle} rows={3} defaultValue={pretty(headers)} onBlur={(e) => updateBlock({ headers: parse(e.target.value, headers || {}) })}/></div>

              <div className={styles.inputGroup}><label className={styles.inputLabel}>Body (JSON)</label>
                <textarea className={styles.textareaStyle} rows={4} defaultValue={pretty(body)} onBlur={(e) => updateBlock({ body: parse(e.target.value, body || {}) })}/></div>

              <div className={styles.rowTwoCols}>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Variável de saída</label>
                  <input className={styles.inputStyle} value={outputVar || "apiResponse"} onChange={(e) => updateBlock({ outputVar: e.target.value })}/></div>
                <div className={styles.inputGroup}><label className={styles.inputLabel}>Variável de status</label>
                  <input className={styles.inputStyle} value={statusVar || "apiStatus"} onChange={(e) => updateBlock({ statusVar: e.target.value })}/></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const OverlayRegras = () => (
    <>
      <div className={styles.overlayHeader}>
        <button className={styles.backBtn} onClick={close} title="Voltar"><ArrowLeft size={18}/></button>
        <div className={styles.overlayTitle}>Regras de saída</div>
        <button className={styles.iconGhost} onClick={close} title="Fechar"><X size={16}/></button>
      </div>

      <div className={styles.overlayBody}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeaderStatic}>
            <h4 className={styles.sectionTitle}>Regras</h4>
            <span className={styles.sectionCount}>({actions.length}/25)</span>
          </div>
          <div className={styles.sectionContent}>
            {isHuman && (
              <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                <button className={styles.addButtonSmall} onClick={() => addOffhours("offhours_true")}>+ Se offhours = true</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhours("reason_holiday")}>+ Se motivo = holiday</button>
                <button className={styles.addButtonSmall} onClick={() => addOffhours("reason_closed")}>+ Se motivo = closed</button>
              </div>
            )}

            {actions.map((action, actionIdx) => (
              <React.Fragment key={actionIdx}>
                {actionIdx > 0 && (
                  <div className={styles.dividerContainer}>
                    <div className={styles.dividerLine}></div>
                    <span className={styles.dividerText}>OU</span>
                  </div>
                )}

                <div className={styles.actionBox}>
                  <div className={styles.actionHeader}>
                    <strong className={styles.actionTitle}>Regra {actionIdx + 1}</strong>
                    <Trash2 size={16} className={styles.trashIcon}
                      onClick={() => { const up = deep(actions); up.splice(actionIdx, 1); setActions(up); }}/>
                  </div>

                  {(action.conditions || []).map((cond, condIdx) => (
                    <div key={condIdx} className={styles.conditionRow}>
                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Variável</label>
                        <select
                          className={styles.selectStyle}
                          value={
                            varOptions.some((v) => v.value === cond.variable)
                              ? cond.variable
                              : cond.variable ? "custom" : "lastUserMessage"
                          }
                          onChange={(e) => {
                            const nv = e.target.value;
                            const up = deep(actions);
                            if (nv === "custom") up[actionIdx].conditions[condIdx].variable = "";
                            else {
                              up[actionIdx].conditions[condIdx].variable = nv;
                              if (!up[actionIdx].conditions[condIdx].type) up[actionIdx].conditions[condIdx].type = "equals";
                              if (nv === "offhours") up[actionIdx].conditions[condIdx].value = "true";
                              if (nv === "offhours_reason") up[actionIdx].conditions[condIdx].value = "closed";
                            }
                            setActions(up);
                          }}
                        >
                          {varOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                      </div>

                      {(!varOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel}>Nome da variável</label>
                          <input
                            className={styles.inputStyle}
                            value={cond.variable || ""}
                            onChange={(e) => {
                              const up = deep(actions);
                              up[actionIdx].conditions[condIdx].variable = e.target.value;
                              setActions(up);
                            }}
                            placeholder="ex.: context.meuCampo"
                          />
                        </div>
                      )}

                      <div className={styles.inputGroup}>
                        <label className={styles.inputLabel}>Tipo de condição</label>
                        <select
                          className={styles.selectStyle}
                          value={cond.type || ""}
                          onChange={(e) => {
                            const up = deep(actions);
                            up[actionIdx].conditions[condIdx].type = e.target.value;
                            if (e.target.value === "exists") up[actionIdx].conditions[condIdx].value = "";
                            setActions(up);
                          }}
                        >
                          <option value="">Selecione...</option>
                          <option value="exists">Existe</option>
                          <option value="equals">Igual a</option>
                          <option value="not_equals">Diferente de</option>
                          <option value="contains">Contém</option>
                          <option value="not_contains">Não contém</option>
                          <option value="starts_with">Começa com</option>
                          <option value="ends_with">Termina com</option>
                        </select>
                      </div>

                      <ValueInput
                        cond={cond}
                        onChange={(v) => {
                          const up = deep(actions);
                          up[actionIdx].conditions[condIdx].value = v;
                          setActions(up);
                        }}
                      />

                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.deleteButtonSmall}
                          onClick={() => {
                            const up = deep(actions);
                            up[actionIdx].conditions.splice(condIdx, 1);
                            setActions(up);
                          }}
                        >
                          <Trash2 size={14}/> Remover condição
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Ir para</label>
                    <select
                      className={styles.selectStyle}
                      value={action.next || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const up = deep(actions);
                        up[actionIdx].next = id;
                        setActions(up);
                        if (onConnectNodes && id) onConnectNodes({ source: selectedNode.id, target: id });
                      }}
                    >
                      <option value="">Selecione um bloco...</option>
                      {allNodes.filter((n) => n.id !== selectedNode.id).map((n) => (
                        <option key={n.id} value={n.id}>{n.data.label || n.id}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </React.Fragment>
            ))}

            <div className={styles.buttonGroup}>
              <button
                className={styles.addButton}
                onClick={() => setActions([...(actions || []), { next:"", conditions:[{ variable:"lastUserMessage", type:"exists", value:""}]}])}
              >
                <Plus size={16}/> Adicionar regra
              </button>
            </div>

            <div className={styles.sectionContainer} style={{ marginTop: 12 }}>
              <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Saída padrão</h4></div>
              <div className={styles.sectionContent}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Próximo bloco</label>
                  <select
                    className={styles.selectStyle}
                    value={defaultNext || ""}
                    onChange={(e) => updateBlock({ defaultNext: e.target.value })}
                  >
                    <option value="">Selecione um bloco...</option>
                    {allNodes.filter((n) => n.id !== selectedNode.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.data.label || n.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );

  /* --------- AÇÕES ESPECIAIS (cards com edição inline + auto-save) --------- */

  const ConditionRow = ({ list, setList, i, cond, cIdx }) => {
    return (
      <div className={styles.conditionRow}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Variável</label>
          <select
            className={styles.selectStyle}
            value={
              varOptions.some((v) => v.value === cond.variable) ? cond.variable :
              cond.variable ? "custom" : "lastUserMessage"
            }
            onChange={(e) => {
              const nv = e.target.value;
              const up = deep(list);
              if (nv === "custom") up[i].conditions[cIdx].variable = "";
              else {
                up[i].conditions[cIdx].variable = nv;
                if (!up[i].conditions[cIdx].type) up[i].conditions[cIdx].type = "equals";
                if (nv === "offhours") up[i].conditions[cIdx].value = "true";
                if (nv === "offhours_reason") up[i].conditions[cIdx].value = "closed";
              }
              setList(up);
            }}
          >
            {varOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>

        {(!varOptions.some((v) => v.value === cond.variable) || cond.variable === "") && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Nome da variável</label>
            <input
              className={styles.inputStyle}
              placeholder="ex.: context.flag"
              value={cond.variable || ""}
              onChange={(e) => {
                const up = deep(list); up[i].conditions[cIdx].variable = e.target.value; setList(up);
              }}
            />
          </div>
        )}

        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Tipo</label>
          <select
            className={styles.selectStyle}
            value={cond.type || ""}
            onChange={(e) => {
              const up = deep(list);
              up[i].conditions[cIdx].type = e.target.value;
              if (e.target.value === "exists") up[i].conditions[cIdx].value = "";
              setList(up);
            }}
          >
            <option value="">Selecione…</option>
            <option value="exists">Existe</option>
            <option value="equals">Igual a</option>
            <option value="not_equals">Diferente de</option>
            <option value="contains">Contém</option>
            <option value="not_contains">Não contém</option>
            <option value="starts_with">Começa com</option>
            <option value="ends_with">Termina com</option>
          </select>
        </div>

        <ValueInput
          cond={cond}
          onChange={(v) => {
            const up = deep(list); up[i].conditions[cIdx].value = v; setList(up);
          }}
        />

        <div className={styles.buttonGroup}>
          <button
            className={styles.deleteButtonSmall}
            onClick={() => { const up = deep(list); up[i].conditions.splice(cIdx, 1); setList(up); }}
          >
            <Trash2 size={14}/> Remover condição
          </button>
        </div>
      </div>
    );
  };

  const ActionCard = ({ list, setList, i }) => {
    const item = list[i] || {};
    const [openEditor, setOpenEditor] = useState(false);

    // garante título a partir da key (quando vazio)
    if ((item.key || "").trim() && !(item.title || "").trim()) {
      const up = deep(list); up[i].title = item.key; setList(up);
    }

    const pills = ensureArr(item.conditions).slice(0, 3).map((c, idx) => {
      const label = c.type === "exists"
        ? `${c.variable || "var"} existe`
        : `${c.variable || "var"} ${c.type?.replace("_"," ") || "="} ${c.value ?? ""}`;
      return <span key={idx} className={styles.pill}>{label}</span>;
    });

    return (
      <div className={styles.actionCard}>
        <div className={styles.cardHeaderRow}>
          <div className={styles.cardTitleCol}>
            <div className={styles.cardTitle}>{item.title || item.key || "Sem título"}</div>
            <div className={styles.cardSub}>{item.scope || "context"} · {item.key || "chave"} · {String(item.value ?? "")}</div>
          </div>
          <div className={styles.cardActions}>
            <button className={styles.iconGhost} title="Editar" onClick={() => setOpenEditor(v => !v)}><Edit2 size={14}/></button>
            <button className={styles.deleteButtonSmall} onClick={() => { const up = deep(list); up.splice(i,1); setList(up); }}>Remover</button>
          </div>
        </div>

        {!!pills.length && <div className={styles.pillRow}>{pills}{(ensureArr(item.conditions).length > 3) && <span className={styles.pillMuted}>+{ensureArr(item.conditions).length - 3}</span>}</div>}

        {openEditor && (
          <div className={styles.cardEditor}>
            <div className={styles.inputGroup}><label className={styles.inputLabel}>Título (aparece na lista)</label>
              <input className={styles.inputStyle} value={item.title || ""} onChange={(e) => { const up=deep(list); up[i].title = e.target.value; setList(up); }}/></div>

            <div className={styles.rowThreeCols}>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Escopo</label>
                <select className={styles.selectStyle} value={item.scope || "context"} onChange={(e) => { const up=deep(list); up[i].scope = e.target.value; setList(up); }}>
                  <option value="context">context</option><option value="contact">contact</option><option value="contact.extra">contact.extra</option>
                </select></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Chave</label>
                <input className={styles.inputStyle} value={item.key || ""} onChange={(e) => { const up=deep(list); up[i].key = e.target.value; setList(up); }}/></div>
              <div className={styles.inputGroup}><label className={styles.inputLabel}>Valor</label>
                <input className={styles.inputStyle} value={item.value || ""} onChange={(e) => { const up=deep(list); up[i].value = e.target.value; setList(up); }}/></div>
            </div>

            <button className={styles.condToggle} onClick={() => {
              const up = deep(list); up[i].__condOpen = !up[i].__condOpen; setList(up);
            }}>
              {(item.__condOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>)} Executar somente se (opcional)
            </button>

            {item.__condOpen && (
              <div className={styles.condWrap}>
                {ensureArr(item.conditions).map((c, cIdx) => (
                  <ConditionRow key={cIdx} list={list} setList={setList} i={i} cond={c} cIdx={cIdx}/>
                ))}
                <button
                  className={styles.addButtonSmall}
                  onClick={() => {
                    const up = deep(list);
                    const cc = ensureArr(up[i].conditions);
                    cc.push({ variable: "lastUserMessage", type: "exists", value: "" });
                    up[i].conditions = cc; setList(up);
                  }}
                >+ adicionar condição</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const AddMenu = ({ where }) => (
    <div className={styles.addMenu}>
      <div className={styles.addMenuTitle}>Adicionar em {where === "enter" ? "entrada" : "saída"}</div>
      <div className={styles.addMenuGrid}>
        {["context","contact","contact.extra"].map((val) => (
          <button
            key={val}
            className={styles.addMenuItem}
            onClick={() => {
              const base = { title:"", scope: val, key:"", value:"", conditions: [] };
              if (where === "enter") setEnter([...(onEnter || []), base]);
              else setExit([...(onExit || []), base]);
            }}
          >
            <span className={styles.addMenuLabel}>{val}</span>
            <ChevronRight size={14}/>
          </button>
        ))}
      </div>
    </div>
  );

  const OverlayEspeciais = () => {
    const [menuEnter, setMenuEnter] = useState(false);
    const [menuExit, setMenuExit] = useState(false);

    return (
      <>
        <div className={styles.overlayHeader}>
          <button className={styles.backBtn} onClick={close} title="Voltar"><ArrowLeft size={18}/></button>
          <div className={styles.overlayTitle}>Ações especiais</div>
          <button className={styles.iconGhost} onClick={close} title="Fechar"><X size={16}/></button>
        </div>

        <div className={styles.overlayBody}>
          {/* Entrada */}
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Ao entrar no bloco</h4></div>
            <div className={styles.sectionContent}>
              {ensureArr(onEnter).map((_, i) => (
                <ActionCard key={`en-${i}`} list={onEnter} setList={setEnter} i={i}/>
              ))}
              <div className={styles.addRow}>
                <button className={styles.addButtonSmall} onClick={() => setMenuEnter(v=>!v)}>+ adicionar na entrada</button>
                {menuEnter && <AddMenu where="enter" />}
              </div>
            </div>
          </div>

          {/* Saída */}
          <div className={styles.sectionContainer}>
            <div className={styles.sectionHeaderStatic}><h4 className={styles.sectionTitle}>Ao sair do bloco</h4></div>
            <div className={styles.sectionContent}>
              {ensureArr(onExit).map((_, i) => (
                <ActionCard key={`ex-${i}`} list={onExit} setList={setExit} i={i}/>
              ))}
              <div className={styles.addRow}>
                <button className={styles.addButtonSmall} onClick={() => setMenuExit(v=>!v)}>+ adicionar na saída</button>
                {menuExit && <AddMenu where="exit" />}
              </div>
            </div>
          </div>

          <div className={styles.tipBox}>
            Para usar valores definidos aqui no fluxo, referencie como
            <code className={styles.inlineCode}>{"{{"}context.chave{"}}"}</code>,
            <code className={styles.inlineCode}>{"{{"}contact.chave{"}}"}</code> ou
            <code className={styles.inlineCode}>{"{{"}contact.extra.chave{"}}"}</code>.
          </div>
        </div>
      </>
    );
  };

  /* --------------- render --------------- */
  return (
    <aside ref={panelRef} className={styles.asidePanel} data-stop-hotkeys="true" onKeyDownCapture={onKeyDownCapture}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          {selectedNode.data.type === "human" ? "atendimento humano" : (selectedNode.data.label || "Novo Bloco")}
        </h3>
        <button onClick={onClose} className={styles.closeButton} title="Fechar"><X size={20} /></button>
      </div>

      <div className={styles.tabContent}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel}>Nome do Bloco</label>
          {selectedNode.data.nodeType === "start" ? (
            <div className={styles.startNodeInfo}>Este é o <strong>bloco inicial</strong> do fluxo.</div>
          ) : selectedNode.data.type === "human" ? (
            <input className={styles.inputStyle} type="text" value="atendimento humano" disabled />
          ) : (
            <input
              className={styles.inputStyle}
              type="text"
              value={selectedNode.data.label}
              onChange={(e) => onChange({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } })}
              placeholder="Nomeie este bloco"
            />
          )}
        </div>

        <ChatPreview />
      </div>

      <div className={`${styles.overlay} ${overlay !== "none" ? styles.overlayOpen : ""}`}>
        {overlay === "await" && <OverlayAwait />}
        {overlay === "conteudo" && <OverlayConteudo />}
        {overlay === "regras" && <OverlayRegras />}
        {overlay === "especiais" && <OverlayEspeciais />}
      </div>
    </aside>
  );
}
