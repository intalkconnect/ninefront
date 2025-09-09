import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Save, RotateCcw, Image as ImageIcon, Trash2,
  Briefcase, MapPin, Mail, Globe, FileText, MessageSquare
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import styles from "./styles/ChannelEditor.module.css";

/* -------- tenant -------- */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

/* -------- verticais -------- */
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

const limit = (s = "", n) => String(s).slice(0, n);
const count = (s) => (s ? String(s).length : 0);
const initials = (name) =>
  (name || "WA").toString().trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

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
  return VERTICALS.find(x => x[1] === v)?.[0] || null;
}

function verifyChip(code) {
  const c = (code || "").toUpperCase();
  if (c === "VERIFIED")   return <span className={`${styles.chip} ${styles.chipOk}`}>Verificado</span>;
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

/* ======================================================== */
export default function WhatsAppProfile() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/channels";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // número
  const [phone, setPhone] = useState(null);

  // perfil
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

  const verifiedName   = phone?.verified_name || "";
  const displayNumber  = phone?.display_phone_number || "";
  const quality        = phone?.quality_rating || "";
  const oba            = !!phone?.is_official_business_account;
  const verifyStatus   = phone?.code_verification_status || "";
  const avatarSrc      = profilePic || "";

  async function loadAll() {
    if (!tenant) return;
    setLoading(true); setErr(null); setOk(null);
    try {
      const num = await apiGet(`/waProfile/number?subdomain=${tenant}`);
      if (num?.ok) setPhone(num.phone || null);

      const pf = await apiGet(`/waProfile?subdomain=${tenant}`);
      if (pf?.ok) {
        const p = pf.profile || {};
        setAbout(limit(p.about || "", 139));
        setDescription(limit(p.description || "", 512));
        setAddress(limit(p.address || "", 256));
        setEmail(limit(p.email || "", 128));
        setVertical(p.vertical || "");
        const sites = Array.isArray(p.websites) ? p.websites : [];
        setWeb1(sites[0] || ""); setWeb2(sites[1] || "");
        setProfilePic(p.profile_picture_url || "");
      }
    } catch (e) {
      console.error(e);
      setErr("Falha ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [tenant]);

  async function handleSave() {
    setSaving(true); setErr(null); setOk(null);
    try {
      const websites = [web1, web2].filter(Boolean);
      await apiPost("/waProfile", {
        subdomain: tenant, about, description, address, email, vertical, websites,
      });
      setOk("Perfil atualizado com sucesso.");
    } catch (e) {
      console.error(e);
      setErr("Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function applyPhoto() {
    if (!photoUrl.trim()) return;
    setErr(null); setOk(null);
    try {
      setProfilePic(photoUrl.trim()); // preview otimista
      await apiPost("/waProfile/photo-from-url", { subdomain: tenant, file_url: photoUrl.trim() });
      setOk("Foto aplicada.");
      setPhotoUrl("");
      await loadAll();
    } catch (e) {
      console.error(e);
      setErr("Falha ao aplicar foto.");
    }
  }

  async function removePhoto() {
    setErr(null); setOk(null);
    try {
      await apiPost("/waProfile/photo", { _method: "DELETE", subdomain: tenant });
      setOk("Foto removida.");
      setProfilePic("");
      await loadAll();
    } catch (e) {
      console.error(e);
      setErr("Falha ao remover foto.");
    }
  }

  const vertLabel = verticalLabel(vertical);

  // --- itens do preview (com ícones) ---
  const previewItems = [
    about && { icon: <MessageSquare size={16}/>, text: about },
    description && { icon: <FileText size={16}/>, text: description },
    vertLabel && { icon: <Briefcase size={16}/>, text: vertLabel },
    address && { icon: <MapPin size={16}/>, text: address },
    email && { icon: <Mail size={16}/>, text: email },
    web1 && { icon: <Globe size={16}/>, text: web1, link: true },
    web2 && { icon: <Globe size={16}/>, text: web2, link: true },
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate("/channels")}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>WhatsApp</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>WhatsApp — Perfil</h1>
          <div className={styles.metaRow}>Tenant: <strong>{tenant || "—"}</strong></div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.btnGhost} onClick={loadAll} disabled={loading}>
            <RotateCcw size={16} style={{marginRight:6}}/> Recarregar
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading || saving}>
            <Save size={16} style={{marginRight:6}}/> Salvar
          </button>
        </div>
      </div>

      {err && <div className={styles.alertErr} style={{marginBottom:12}}>{err}</div>}
      {ok &&  <div className={styles.alertOk}  style={{marginBottom:12}}>{ok}</div>}

      <div className={styles.grid}>
        {/* ===== esquerda ===== */}
        <section className={styles.left}>
          <div className={styles.infoTable}>
            <div className={styles.row}><div className={styles.k}>Phone ID</div><div className={styles.v}>{phone?.id || "—"}</div></div>
            <div className={styles.row}><div className={styles.k}>Número</div><div className={styles.v}>{displayNumber || "—"}</div></div>
            <div className={styles.row}><div className={styles.k}>Nome verificado</div><div className={styles.v}>{verifiedName || "—"}</div></div>
            <div className={styles.row}><div className={styles.k}>Qualidade</div><div className={styles.v}>{qualityBadge(quality)}</div></div>
            <div className={styles.row}>
              <div className={styles.k}>Conta oficial</div>
              <div className={styles.v}>
                {oba ? <span className={`${styles.chip} ${styles.chipOk}`}>Sim</span> : <span className={`${styles.chip} ${styles.chipOff}`}>Não</span>}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.k}>Verificação</div>
              <div className={styles.v}>{verifyChip(verifyStatus)}</div>
            </div>
          </div>

          {/* Foto por URL */}
          <div className={styles.section}>
            <label className={styles.labelStrong}>Foto por URL</label>
            <div className={styles.inlinePhoto}>
              <input
                className={styles.input}
                placeholder="https://exemplo.com/imagem.jpg"
                value={photoUrl}
                onChange={(e)=>setPhotoUrl(e.target.value)}
              />
              <button className={styles.btnBlue} onClick={applyPhoto} disabled={!photoUrl.trim()}>
                <ImageIcon size={16} style={{marginRight:6}}/> Aplicar
              </button>
              <button className={styles.btnGhost} onClick={removePhoto} disabled={!avatarSrc}>
                <Trash2 size={16} style={{marginRight:6}}/> Remover
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
              onChange={(e)=>setAbout(limit(e.target.value,139))}
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
              onChange={(e)=>setDescription(limit(e.target.value,512))}
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
              onChange={(e)=>setAddress(limit(e.target.value,256))}
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
              onChange={(e)=>setEmail(limit(e.target.value,128))}
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
                onChange={(e)=>setVertical(e.target.value)}
              >
                {VERTICALS.map(([label,val]) => (
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
              onChange={(e)=>setWeb1(e.target.value)}
              placeholder="https://site1.com/"
            />
            <input
              className={styles.input}
              style={{ marginTop: 8 }}
              value={web2}
              onChange={(e)=>setWeb2(e.target.value)}
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

              <div className={styles.prevPhone}>+{displayNumber || "--"}</div>
              <button className={styles.shareBtn}>Compartilhar</button>
            </div>

            <div className={styles.prevBody}>
              <div className={styles.prevList}>
                {previewItems.map((it, idx) => (
                  <div className={styles.prevItem} key={idx}>
                    <span className={styles.prevIcon}>{it.icon}</span>
                    <div className={styles.prevText}>
                      {it.link ? (
                        <a href={it.text} target="_blank" rel="noopener noreferrer" className={styles.link}>
                          {it.text}
                        </a>
                      ) : it.text}
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
    </div>
  );
}
