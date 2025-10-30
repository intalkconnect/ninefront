import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Save, RotateCcw, Image as ImageIcon, Trash2,
  Briefcase, MapPin, Mail, Globe, FileText, MessageSquare
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../../../shared/apiClient";
import styles from "./styles/WhatsAppProfile.module.css";
import { toast } from "react-toastify";

/* --------------------------------- helpers --------------------------------- */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname || "";
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

const VERTICALS = [
  ["Selecione...", ""],
  ["Serviços profissionais", "PROFESSIONAL_SERVICES"],
  ["Automotivo", "AUTOMOTIVE"],
  ["Beleza, spa e salão", "BEAUTY_SPA_AND_SALON"],
  ["Roupas e vestuário", "CLOTHING_AND_APPAREL"],
  ["Educação", "EDUCATION"],
  ["Entretenimento", "ENTERTAINMENT"],
  ["Eventos e serviços", "EVENT_PLANNING_AND_SERVICE"],
  ["Finanças e bancos", "FINANCE_AND_BANKING"],
  ["Alimentos e mercearia", "FOOD_AND_GROCERY"],
  ["Serviço público", "PUBLIC_SERVICE"],
  ["Hotelaria e hospedagem", "HOTEL_AND_LODGING"],
  ["Saúde", "MEDICAL_AND_HEALTH"],
  ["ONG / Sem fins lucrativos", "NON_PROFIT"],
  ["Varejo / compras", "SHOPPING_AND_RETAIL"],
  ["Viagem e transporte", "TRAVEL_AND_TRANSPORTATION"],
  ["Restaurante", "RESTAURANT"],
  ["Outros", "OTHER"],
];

const limit = (s = "", n) => String(s || "").slice(0, n);
const count = (s) => (s ? String(s).length : 0);
const initials = (name) =>
  (name || "WA")
    .toString()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function qualityBadge(q) {
  const val = (q || "").toUpperCase();
  let cls = styles.qGrey, label = val || "UNKNOWN";
  if (val === "GREEN") { cls = styles.qGreen; label = "GREEN"; }
  else if (val === "YELLOW") { cls = styles.qYellow; label = "YELLOW"; }
  else if (val === "RED") { cls = styles.qRed; label = "RED"; }
  return <span className={`${styles.qBadge} ${cls}`}><i /> {label}</span>;
}

function verticalLabel(v) {
  if (!v || v === "UNDEFINED") return null;
  return VERTICALS.find((x) => x[1] === v)?.[0] || null;
}

function verifyChip(code) {
  const c = (code || "").toUpperCase();
  if (c === "VERIFIED") return <span className={`${styles.chip} ${styles.chipOk}`}>Verificado</span>;
  if (c === "IN_REVIEW" || c === "PENDING") return <span className={`${styles.chip} ${styles.chipWarn}`}>Em análise</span>;
  if (c === "NOT_VERIFIED" || !c) return <span className={`${styles.chip} ${styles.chipOff}`}>Não verificado</span>;
  return <span className={`${styles.chip} ${styles.chipOff}`}>{c}</span>;
}

const VerifiedBadge = ({ show }) => {
  if (!show) return null;
  return (
    <span className={styles.obaBadge} title="Conta empresarial oficial">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="10" fill="#22c55e"></circle>
        <path d="M5.8 10.4l2.7 2.6 5.7-6.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
};

/* --------------------------------- página ---------------------------------- */
export default function WhatsAppProfile() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/channels";

  // Preferências vindas da navegação de FlowChannels
  const flowId     = location.state?.flowId || null;         // id do flow
  const channelKey = location.state?.channelKey || null;     // phone_id (se já vinculado)

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // número e perfil
  const [phone, setPhone] = useState(null);
  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [vertical, setVertical] = useState("");
  const [web1, setWeb1] = useState("");
  const [web2, setWeb2] = useState("");

  // foto
  const [photoUrl, setPhotoUrl] = useState("");
  const [profilePic, setProfilePic] = useState("");

  // refs para evitar state updates após unmount
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // Derivados
  const verifiedName   = phone?.verified_name || "";
  const displayNumber  = phone?.display_phone_number || "";
  const quality        = phone?.quality_rating || "";
  const oba            = !!phone?.is_official_business_account;
  const verifyStatus   = phone?.code_verification_status || "";
  const avatarSrc      = profilePic || "";

  // Query string para backend: prioridade phone_id > flow_id
  const qParams = useMemo(() => {
    const base = tenant ? `subdomain=${encodeURIComponent(tenant)}` : "";
    if (!base) return "";
    if (channelKey) return `${base}&phone_id=${encodeURIComponent(String(channelKey))}`;
    if (flowId)     return `${base}&flow_id=${encodeURIComponent(String(flowId))}`;
    return base;
  }, [tenant, channelKey, flowId]);

  useEffect(() => {
    if (!tenant) {
      toast.error("Tenant não identificado.");
    }
  }, [tenant]);

  async function loadAll() {
    if (!tenant) return;
    if (!qParams) return;

    setLoading(true);
    try {
      // 1) número  **ENDPOINT CORRETO: /wa/**
      try {
        const num = await apiGet(`/whatsapp/number?${qParams}`);
        if (alive.current && num?.ok) setPhone(num.phone || null);
      } catch (e) {
        if (alive.current) setPhone(null);
        toast.error("Falha ao carregar número do WhatsApp.");
      }

      // 2) perfil  **ENDPOINT CORRETO: /wa/**
      try {
        const pf = await apiGet(`/whatsapp/profile?${qParams}`);
        if (alive.current && pf?.ok) {
          const p = pf.profile || {};
          setAbout(limit(p.about || "", 139));
          setDescription(limit(p.description || "", 512));
          setAddress(limit(p.address || "", 256));
          setEmail(limit(p.email || "", 128));
          setVertical(p.vertical || "");
          const sites = Array.isArray(p.websites) ? p.websites : [];
          setWeb1(sites[0] || "");
          setWeb2(sites[1] || "");
          setProfilePic(p.profile_picture_url || "");
        }
      } catch (e) {
        toast.error("Falha ao carregar perfil do WhatsApp.");
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParams]);

  function buildScopedBody(extra = {}) {
    const base = { subdomain: tenant, ...extra };
    if (channelKey) return { ...base, phone_id: channelKey };
    if (flowId)     return { ...base, flow_id: flowId };
    return base;
  }

  async function handleSave() {
    if (!tenant) return toast.warn("Tenant não identificado.");
    setSaving(true);
    const toastId = toast.loading("Salvando perfil…");
    try {
      const websites = [web1, web2].map((s) => s.trim()).filter(Boolean);
      await apiPost("/whatsapp/profile", buildScopedBody({
        about, description, address, email, vertical, websites,
      }));
      toast.update(toastId, { render: "Perfil atualizado com sucesso.", type: "success", isLoading: false, autoClose: 2200 });
    } catch (e) {
      toast.update(toastId, { render: "Não foi possível salvar o perfil.", type: "error", isLoading: false, autoClose: 3200 });
    } finally {
      setSaving(false);
    }
  }

  async function applyPhoto() {
    if (!tenant) return toast.warn("Tenant não identificado.");
    const url = photoUrl.trim();
    if (!url) return toast.warn("Informe a URL da imagem.");
    const toastId = toast.loading("Aplicando foto…");
    try {
      setProfilePic(url); // preview otimista
      await apiPost("/whatsapp/photo-from-url", buildScopedBody({ file_url: url }));
      toast.update(toastId, { render: "Foto aplicada.", type: "success", isLoading: false, autoClose: 1800 });
      setPhotoUrl("");
      await loadAll();
    } catch (e) {
      toast.update(toastId, { render: "Falha ao aplicar foto.", type: "error", isLoading: false, autoClose: 3000 });
    }
  }

  async function removePhoto() {
    if (!tenant) return toast.warn("Tenant não identificado.");
    const toastId = toast.loading("Removendo foto…");
    try {
      // método override para ambientes que não suportem DELETE no apiClient
      await apiPost("/whatsapp/profile/photo", buildScopedBody({ _method: "DELETE" }));
      setProfilePic("");
      await loadAll();
      toast.update(toastId, { render: "Foto removida.", type: "success", isLoading: false, autoClose: 1800 });
    } catch (e) {
      toast.update(toastId, { render: "Falha ao remover foto.", type: "error", isLoading: false, autoClose: 3000 });
    }
  }

  const vertLabel = verticalLabel(vertical);
  const previewItems = [
    about && { icon: <MessageSquare size={16}/>, text: about },
    description && { icon: <FileText size={16}/>, text: description },
    vertLabel && { icon: <Briefcase size={16}/>, text: vertLabel },
    address && { icon: <MapPin size={16}/>, text: address },
    email && { icon: <Mail size={16}/>, text: email },
    web1 && { icon: <Globe size={16}/>, text: web1, link: true },
    web2 && { icon: <Globe size={16}/>, text: web2, link: true },
  ].filter(Boolean);

  const metaLine = (
    <>
      Tenant: <strong>{tenant || "—"}</strong>
      {flowId ? <span style={{ marginLeft: 12 }}>• Flow: <strong>{flowId}</strong></span> : null}
      {channelKey ? <span style={{ marginLeft: 12 }}>• Phone ID: <strong>{channelKey}</strong></span> : null}
    </>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>WhatsApp - Perfil</h1>
          <div className={styles.metaRow}>{metaLine}</div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.btnGhost} onClick={loadAll} disabled={loading}>
            <RotateCcw size={16} style={{ marginRight: 6 }}/> Recarregar
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading || saving}>
            <Save size={16} style={{ marginRight: 6 }}/> Salvar
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando…</div>
      ) : (
        <div className={styles.grid}>
          {/* ===== esquerda ===== */}
          <section className={styles.left}>
            {/* === META DADOS EM GRADE === */}
            <section className={styles.kpiGrid}>
              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Phone ID</div>
                <div className={`${styles.kvValue} ${styles.mono}`}>{phone?.id || "—"}</div>
              </div>

              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Número</div>
                <div className={styles.kvValue}>
                  {displayNumber || "—"}
                </div>
              </div>

              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Nome verificado</div>
                <div className={styles.kvValue}>{verifiedName || "—"}</div>
              </div>

              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Qualidade</div>
                <div className={styles.kvValue}>{qualityBadge(quality)}</div>
              </div>

              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Conta oficial</div>
                <div className={styles.kvValue}>
                  {oba ? (
                    <span className={`${styles.chip} ${styles.chipOk}`}>Sim</span>
                  ) : (
                    <span className={`${styles.chip} ${styles.chipOff}`}>Não</span>
                  )}
                </div>
              </div>

              <div className={styles.kvCard}>
                <div className={styles.kvTitle}>Verificação</div>
                <div className={styles.kvValue}>{verifyChip(verifyStatus)}</div>
              </div>
            </section>

            {/* Foto por URL */}
            <div className={styles.section}>
              <label className={styles.labelStrong}>Foto por URL</label>
              <div className={styles.inlinePhoto}>
                <input
                  className={styles.input}
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
                <button className={styles.btnBlue} onClick={applyPhoto} disabled={!photoUrl.trim()}>
                  <ImageIcon size={16} style={{ marginRight: 6 }}/> Aplicar
                </button>
                <button className={styles.btnGhost} onClick={removePhoto} disabled={!avatarSrc}>
                  <Trash2 size={16} style={{ marginRight: 6 }}/> Remover
                </button>
              </div>
            </div>

            {/* Campos editáveis */}
            <div className={styles.section}>
              <label className={styles.labelStrong}>Sobre</label>
              <input
                className={styles.input}
                value={about}
                maxLength={139}
                onChange={(e) => setAbout(limit(e.target.value, 139))}
                placeholder="Hey there! I am using WhatsApp."
              />
              <div className={styles.counter}>{count(about)}/139</div>
            </div>

            <div className={styles.section}>
              <label className={styles.labelStrong}>Descrição</label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={description}
                maxLength={512}
                onChange={(e) => setDescription(limit(e.target.value, 512))}
                placeholder="Descrição do negócio (até ~512 chars)"
              />
              <div className={styles.counter}>{count(description)}/512</div>
            </div>

            <div className={styles.section}>
              <label className={styles.labelStrong}>Endereço</label>
              <input
                className={styles.input}
                value={address}
                maxLength={256}
                onChange={(e) => setAddress(limit(e.target.value, 256))}
                placeholder="Rua, número, cidade, UF"
              />
              <div className={styles.counter}>{count(address)}/256</div>
            </div>

            <div className={styles.section}>
              <label className={styles.labelStrong}>Email</label>
              <input
                className={styles.input}
                type="email"
                value={email}
                maxLength={128}
                onChange={(e) => setEmail(limit(e.target.value, 128))}
                placeholder="contato@empresa.com"
              />
              <div className={styles.counter}>{count(email)}/128</div>
            </div>

            <div className={styles.section}>
              <label className={styles.labelStrong}>Categoria</label>
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={vertical}
                  onChange={(e) => setVertical(e.target.value)}
                >
                  {VERTICALS.map(([label, val]) => (
                    <option key={val || "empty"} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.section}>
              <label className={styles.labelStrong}>Websites</label>
              <input
                className={styles.input}
                value={web1}
                onChange={(e) => setWeb1(e.target.value)}
                placeholder="https://site1.com/"
              />
              <input
                className={styles.input}
                style={{ marginTop: 8 }}
                value={web2}
                onChange={(e) => setWeb2(e.target.value)}
                placeholder="https://site2.com/"
              />
            </div>
          </section>

          {/* ===== direita: preview ===== */}
          <aside className={styles.preview}>
            <div className={styles.previewCard}>
              <div className={styles.prevHeader}>
                <div className={styles.prevAvatar}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="logo" />
                  ) : (
                    <span>{initials(verifiedName || "WA")}</span>
                  )}
                </div>

                <div className={styles.nameRow}>
                  <div className={styles.prevName}>{verifiedName || "—"}</div>
                  <VerifiedBadge show={oba} />
                </div>

                <div className={styles.prevPhone}>
                  {displayNumber || "--"}
                </div>
                <button className={styles.shareBtn}>Compartilhar</button>
              </div>

              <div className={styles.prevBody}>
                <div className={styles.prevList}>
                  {previewItems.map((it, idx) => (
                    <div className={styles.prevItem} key={idx}>
                      <span className={styles.prevIcon}>{it.icon}</span>
                      <div className={styles.prevText}>
                        {it.link ? (
                          <a
                            href={it.text}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.link}
                          >
                            {it.text}
                          </a>
                        ) : (
                          it.text
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.prevFoot}>
                Esta experiência pode variar dependendo do dispositivo.
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
