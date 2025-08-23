// src/pages/Templates/Templates.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X as XIcon, Plus, RefreshCw } from "lucide-react";
import styles from "./styles/Templates.module.css";

const api = {
  get: (u) => fetch(u).then(r => r.json()),
  post: (u, b) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json()),
  del: (u) => fetch(u, { method: "DELETE" }).then(r => r.json()),
};

const StatusPill = ({ s }) => {
  const map = {
    draft: styles.pillDraft,
    submitted: styles.pillSubmitted,
    approved: styles.pillApproved,
    rejected: styles.pillRejected,
  };
  return <span className={`${styles.pill} ${map[s] || ""}`}>{s}</span>;
};

export default function Templates() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.get(`/api/v1/templates${tab === "all" ? "" : `?status=${tab}`}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Falha ao carregar templates.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tab]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = [...items];
    if (!term) return base;
    return base.filter(t =>
      String(t.name).toLowerCase().includes(term) ||
      String(t.body_text || "").toLowerCase().includes(term)
    );
  }, [items, q]);

  const submit = async (id) => {
    setErr(null);
    const r = await api.post(`/api/v1/templates/${id}/submit`);
    if (r?.error) setErr(r.error);
    else { setOk("Template enviado para aprovação."); load(); }
    setTimeout(() => setOk(null), 1800);
  };

  const sync = async (id) => {
    setErr(null);
    const r = await api.post(`/api/v1/templates/${id}/sync`);
    if (r?.error) setErr(r.error);
    else { setOk("Status sincronizado."); load(); }
    setTimeout(() => setOk(null), 1600);
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir template local?")) return;
    await api.del(`/api/v1/templates/${id}`);
    load();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Templates</h1>
          <p className={styles.subtitle}>Crie e acompanhe templates de WhatsApp (Cloud API).</p>
          {err && (
            <div className={styles.alertErr}>
              <span>{err}</span>
              <button className={styles.alertClose} onClick={() => setErr(null)} aria-label="Fechar">
                <XIcon size={16}/>
              </button>
            </div>
          )}
          {ok && (
            <div className={styles.alertOk}>
              <CheckCircle2 size={16} aria-hidden/>
              <span>{ok}</span>
              <button className={styles.alertClose} onClick={() => setOk(null)} aria-label="Fechar">
                <XIcon size={16}/>
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.tabs}>
            {["all","draft","submitted","approved","rejected"].map(t => (
              <button key={t} className={`${styles.tab} ${tab===t?styles.tabActive:""}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <button className={styles.btnPrimary} onClick={() => setModalOpen(true)}>
            <Plus size={16}/> Criar template
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Templates {tab === "all" ? "" : `– ${tab}`}</div>
          <div className={styles.cardActions}>
            <div className={styles.searchGroup}>
              <input className={styles.searchInput} placeholder="Buscar por nome ou corpo…" value={q} onChange={e=>setQ(e.target.value)}/>
              {!!q && <button className={styles.searchClear} onClick={()=>setQ("")}><XIcon size={14}/></button>}
            </div>
            <button className={styles.btn} onClick={load} title="Atualizar">
              <RefreshCw size={16}/> Atualizar
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{minWidth:220}}>Nome</th>
                <th>Linguagem</th>
                <th>Categoria</th>
                <th>Header</th>
                <th>Corpo</th>
                <th>Status</th>
                <th style={{width:260}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className={styles.loading}><div className={styles.spinner}/><span>Carregando…</span></td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className={styles.empty}>Nenhum template encontrado.</td></tr>
              )}
              {!loading && filtered.map(t => (
                <tr key={t.id} className={styles.row}>
                  <td data-label="Nome">
                    <div className={styles.name}>{t.name}</div>
                    <div className={styles.mono}>id: {t.id}</div>
                  </td>
                  <td data-label="Linguagem">{t.language_code}</td>
                  <td data-label="Categoria">{t.category}</td>
                  <td data-label="Header">{t.header_type}</td>
                  <td data-label="Corpo"><div className={styles.bodyPreview} title={t.body_text}>{t.body_text}</div></td>
                  <td data-label="Status"><StatusPill s={t.status}/></td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    {t.status === "draft" || t.status === "rejected" ? (
                      <button className={styles.btnPrimary} onClick={() => submit(t.id)}>Enviar</button>
                    ) : null}
                    {t.status === "submitted" ? (
                      <button className={styles.btn} onClick={() => sync(t.id)}>Sincronizar</button>
                    ) : null}
                    <button className={styles.btnDanger} onClick={() => remove(t.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <CreateTemplateModal
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); setOk("Template criado."); load(); }}
      />}
    </div>
  );
}

function CreateTemplateModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt_BR");
  const [category, setCategory] = useState("UTILITY");
  const [headerType, setHeaderType] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const create = async () => {
    setBusy(true); setErr(null);
    const payload = {
      name,
      language_code: language,
      category,
      header_type: headerType,
      header_text: headerType === "TEXT" ? headerText : null,
      body_text: body,
      footer_text: footer || null,
    };
    const r = await fetch("/api/v1/templates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok || data?.error) { setErr(data?.error || "Falha ao criar"); }
    else onCreated();
    setBusy(false);
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Novo template</h2>
          <button className={styles.btn} onClick={onClose}><XIcon size={16}/></button>
        </div>

        <div className={styles.formGrid}>
          {err && <div className={styles.alertErr} style={{marginTop:0}}>{err}</div>}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Nome *</label>
            <input className={styles.input} value={name} onChange={e=>setName(e.target.value)} placeholder="ex.: boas_vindas_v1" />
          </div>

          <div className={styles.formRow2}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Idioma *</label>
              <select className={styles.input} value={language} onChange={e=>setLanguage(e.target.value)}>
                {["pt_BR","en_US","es_ES"].map(l=> <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Categoria *</label>
              <select className={styles.input} value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow2}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Header</label>
              <select className={styles.input} value={headerType} onChange={e=>setHeaderType(e.target.value)}>
                <option value="NONE">NONE</option>
                <option value="TEXT">TEXT</option>
                <option value="IMAGE" disabled>IMAGE (via submit)</option>
                <option value="DOCUMENT" disabled>DOCUMENT (via submit)</option>
                <option value="VIDEO" disabled>VIDEO (via submit)</option>
              </select>
            </div>
            {headerType === "TEXT" && (
              <div className={styles.inputGroup}>
                <label className={styles.label}>Header (texto)</label>
                <input className={styles.input} value={headerText} onChange={e=>setHeaderText(e.target.value)} />
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Corpo *</label>
            <textarea className={styles.textarea} rows={6} value={body} onChange={e=>setBody(e.target.value)} />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Rodapé</label>
            <input className={styles.input} value={footer} onChange={e=>setFooter(e.target.value)} />
          </div>
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={create} disabled={busy || !name.trim() || !body.trim()}>
            <Plus size={16}/> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
