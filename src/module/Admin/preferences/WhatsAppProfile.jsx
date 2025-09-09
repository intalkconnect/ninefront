// src/module/Admin/preferences/WhatsAppProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, ImagePlus, Trash2, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../shared/apiClient";
import styles from "./styles/ChannelEditor.module.css";

/* ============ utils ============ */
function getTenantFromHost() {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0] === "www" ? parts[1] : parts[0];
  return parts[0] || "";
}

const VERTICALS = [
  "AUTOMOTIVE",
  "BEAUTY",
  "CLOTHING_AND_APPAREL",
  "EDUCATION",
  "ENTERTAINMENT",
  "EVENT_PLANNING_AND_SERVICE",
  "FINANCE",
  "GROCERY",
  "GOVERNMENT",
  "HARDWARE_AND_HOME_IMPROVEMENT",
  "HEALTH",
  "HOSPITALITY",
  "INSURANCE",
  "LEGAL",
  "LOCAL_SERVICES",
  "MANUFACTURING",
  "MEDIA",
  "NON_PROFIT",
  "PROFESSIONAL_SERVICES",
  "PUBLIC_SERVICES",
  "SHOPPING_AND_RETAIL",
  "SPORTS_AND_RECREATION",
  "TRAVEL_AND_TRANSPORTATION",
  "UTILITIES",
  "OTHER",
];

export default function WhatsAppProfile() {
  const tenant = useMemo(() => getTenantFromHost(), []);
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.returnTo || "/channels";

  // loading/msgs
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // dados do número ativo e profile
  const [phone, setPhone] = useState(null);     // { id, display_phone_number, verified_name, ... }
  const [profile, setProfile] = useState(null); // { about, description, address, email, vertical, websites[], profile_picture_url }

  // form
  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [vertical, setVertical] = useState("");
  const [websites, setWebsites] = useState("");       // string separada por vírgula
  const [photoUrl, setPhotoUrl] = useState("");

  async function refresh() {
    setLoading(true); setErr(null); setOk(null);
    try {
      const res = await apiGet(`/waProfile?subdomain=${tenant}`);
      if (!res?.ok) throw new Error(res?.error || "Falha ao carregar perfil");

      const ph = res.phone || {};
      const pf = res.profile || {};

      setPhone(ph);
      setProfile(pf);

      setAbout(pf.about || "");
      setDescription(pf.description || "");
      setAddress(pf.address || "");
      setEmail(pf.email || "");
      setVertical(pf.vertical || "");
      setWebsites(Array.isArray(pf.websites) ? pf.websites.join(", ") : (pf.websites || ""));
    } catch (e) {
      setErr("Falha ao carregar o perfil do WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tenant]);

  async function handleSave() {
    setSaving(true); setErr(null); setOk(null);
    try {
      const body = {
        subdomain: tenant,
        about,
        description,
        address,
        email,
        vertical,
        websites, // o backend sanitiza string/list
      };
      const r = await apiPost("/waProfile", body);
      if (!r?.ok) throw new Error(r?.error || "Falha ao salvar");
      setOk("Perfil atualizado com sucesso.");
      // recarrega para pegar possíveis normalizações
      await refresh();
    } catch (e) {
      setErr("Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyPhoto() {
    if (!photoUrl.trim()) return;
    setPhotoBusy(true); setErr(null); setOk(null);
    try {
      const r = await apiPost("/waProfile/photo-from-url", {
        subdomain: tenant,
        file_url: photoUrl.trim(),
        // type opcional, backend assume 'image/jpeg' se não informado
      });
      if (!r?.ok) throw new Error(r?.error || "Falha ao aplicar foto");
      setOk("Foto de perfil atualizada.");
      setPhotoUrl("");
      await refresh();
    } catch (e) {
      setErr("Não foi possível aplicar a foto. Verifique a URL.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true); setErr(null); setOk(null);
    try {
      // usando fetch direto para DELETE (apiClient tem get/post apenas)
      const resp = await fetch(`/api/v1/waProfile/photo?subdomain=${encodeURIComponent(tenant)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "Falha ao remover");
      setOk("Foto de perfil removida.");
      await refresh();
    } catch (e) {
      setErr("Não foi possível remover a foto de perfil.");
    } finally {
      setPhotoBusy(false);
    }
  }

  const hasPhoto = !!profile?.profile_picture_url;

  return (
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        <span className={styles.bcLink} onClick={() => navigate("/channels")}>Canais</span>
        <span className={styles.bcSep}>/</span>
        <span>WhatsApp</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>WhatsApp — Perfil</h1>
          <div className={styles.metaRow}>
            Tenant: <strong>{tenant || "—"}</strong>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.backBtn} onClick={() => navigate(backTo)}>
            <ArrowLeft size={16}/> Voltar
          </button>
          <button className={styles.backBtn} onClick={refresh} disabled={loading}>
            <RefreshCw size={16}/> Recarregar
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={loading || saving}
          >
            <Save size={16} style={{marginRight:6}}/> {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Card */}
      <div className={styles.editorCard}>
        {loading ? (
          <div className={styles.loading}>Carregando…</div>
        ) : err ? (
          <div className={styles.alertErr}>{err}</div>
        ) : (
          <>
            {ok && <div className={styles.alertOk} style={{marginBottom:12}}>{ok}</div>}

            {/* Número ativo (metadados) */}
            <div className={styles.section}>
              <div className={styles.kv}>
                <div className={styles.k}>Phone ID</div>
                <div className={styles.v}>{phone?.id || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Número</div>
                <div className={styles.v}>{phone?.display_phone_number || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Nome verificado</div>
                <div className={styles.v}>{phone?.verified_name || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Qualidade</div>
                <div className={styles.v}>{phone?.quality_rating || "—"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Conta oficial</div>
                <div className={styles.v}>{phone?.is_official_business_account ? "Sim" : "Não"}</div>
              </div>
              <div className={styles.kv}>
                <div className={styles.k}>Modo</div>
                <div className={styles.v}>{phone?.account_mode || "—"}</div>
              </div>
              {phone?.code_verification_status && (
                <div className={styles.kv}>
                  <div className={styles.k}>Verificação</div>
                  <div className={styles.v}>{phone.code_verification_status}</div>
                </div>
              )}
            </div>

            <div className={styles.divider} />

            {/* Foto de perfil */}
            <div className={styles.section}>
              <div className={styles.kv} style={{ alignItems: "flex-start" }}>
                <div className={styles.k}>Foto atual</div>
                <div className={styles.v}>
                  {hasPhoto ? (
                    <img
                      src={profile.profile_picture_url}
                      alt="Foto de perfil"
                      style={{
                        width: 84, height: 84, borderRadius: "50%",
                        objectFit: "cover", border: "1px solid #e5e7eb"
                      }}
                    />
                  ) : (
                    <span className={styles.muted}>Sem foto</span>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Foto por URL</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8 }}>
                  <input
                    className={styles.input}
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={photoUrl}
                    onChange={(e)=>setPhotoUrl(e.target.value)}
                  />
                  <button
                    className={styles.btnPrimary}
                    onClick={handleApplyPhoto}
                    disabled={!photoUrl.trim() || photoBusy}
                    title="Aplicar foto por URL"
                  >
                    <ImagePlus size={16} style={{marginRight:6}}/> {photoBusy ? "Aplicando…" : "Aplicar"}
                  </button>
                  <button
                    className={styles.btnGhost}
                    onClick={handleRemovePhoto}
                    disabled={!hasPhoto || photoBusy}
                    title="Remover foto atual"
                  >
                    <Trash2 size={16} style={{marginRight:6}}/> Remover
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            {/* Form principal */}
            <div className={styles.section}>
              <div className={styles.formRow}>
                <label className={styles.label}>Sobre</label>
                <input
                  className={styles.input}
                  value={about}
                  onChange={(e)=>setAbout(e.target.value)}
                  placeholder="Texto curto (até ~139 chars)"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Descrição</label>
                <textarea
                  className={styles.input}
                  value={description}
                  onChange={(e)=>setDescription(e.target.value)}
                  placeholder="Descrição do negócio (até ~512 chars)"
                  rows={4}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Endereço</label>
                <input
                  className={styles.input}
                  value={address}
                  onChange={(e)=>setAddress(e.target.value)}
                  placeholder="Rua, número, cidade, UF"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Vertical</label>
                <select
                  className={styles.input}
                  value={vertical || ""}
                  onChange={(e)=>setVertical(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {VERTICALS.map(v => (
                    <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>Websites</label>
                <input
                  className={styles.input}
                  value={websites}
                  onChange={(e)=>setWebsites(e.target.value)}
                  placeholder="https://site1.com, https://site2.com"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
