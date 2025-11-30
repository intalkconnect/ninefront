import React, { useEffect, useRef, useState } from "react";
import { Shield, Plus, Trash2, RefreshCw, Copy } from "lucide-react";
import { apiGet, apiPost } from "../../../../shared/apiClient";
import styles from "./styles/Tokens.module.css";
import { toast } from "react-toastify";

// Prévia ofuscada: 8 chars do segredo + bullets (sem ID)
function shortPreview(preview = "") {
  const parts = String(preview).split(".");
  const secretPart = parts.length > 1 ? parts[1] : parts[0] || "";
  const raw = secretPart.replace(/[^0-9a-f]/gi, "");
  const first8 = raw.slice(0, 8);
  const bullets = "•".repeat(Math.max(0, 64 - first8.length));
  return `${first8}${bullets}`;
}

export default function TokensSecurity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const nameRef = useRef(null);

  const [justCreated, setJustCreated] = useState(null); // { id, token, name? }

  const load = async () => {
    setLoading(true);
    try {
      const j = await apiGet("/security/tokens");
      if (!j?.ok) throw new Error("Fail");
      setItems(j.items || []);
    } catch {
      toast.error("Falha ao carregar tokens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copyToClipboard = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const createToken = async (e) => {
    e?.preventDefault?.();
    if (creating) return;

    const name = (newName || "").trim();
    if (!name) {
      toast.warn("Informe o nome do token.");
      nameRef.current?.focus();
      return;
    }

    setCreating(true);
    const tid = toast.loading("Criando token…");
    try {
      const j = await apiPost("/security/tokens", {
        name,
        is_default: false,
      });
      if (!j?.ok || !j?.token)
        throw new Error(j?.message || "Falha ao criar token");

      setJustCreated({ id: j.id, token: j.token, name });
      setNewName("");
      await load();
      toast.update(tid, {
        render:
          "Token criado. Copie agora — ele não será mostrado novamente.",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });
    } catch (e2) {
      const msg =
        e2?.response?.data?.message ||
        e2?.message ||
        "Falha ao criar token.";
      toast.update(tid, {
        render: msg,
        type: "error",
        isLoading: false,
        autoClose: 3500,
      });
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    if (!id) return;
    if (
      !confirm("Revogar este token? Esta ação não pode ser desfeita.")
    )
      return;
    const tid = toast.loading("Revogando token…");
    try {
      const j = await apiPost(`/security/tokens/${id}/revoke`, {});
      if (!j?.ok && !j?.already) throw new Error("Falha ao revogar");
      toast.update(tid, {
        render: "Token revogado.",
        type: "success",
        isLoading: false,
        autoClose: 2500,
      });
      await load();
    } catch {
      toast.update(tid, {
        render: "Não foi possível revogar o token.",
        type: "error",
        isLoading: false,
        autoClose: 3500,
      });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* HEADER card no padrão novo */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Shield size={18} />
            </div>
            <div className={styles.headerTextBlock}>
              <h1 className={styles.title}>Tokens de segurança</h1>
              <p className={styles.subtitle}>
                Tokens de acesso para integrações externas e automações.
              </p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={load}
              disabled={loading}
              title="Recarregar lista"
            >
              <RefreshCw
                size={16}
                className={loading ? styles.spin : ""}
              />
              Recarregar
            </button>
          </div>
        </header>

        {/* Card: criar novo */}
        <section className={styles.card}>
          <div className={styles.cardBody}>
            <form
              className={styles.createInline}
              onSubmit={createToken}
              noValidate
            >
              <div className={styles.fieldCompact}>
                <label className={styles.label}>Nome do token</label>
                <input
                  ref={nameRef}
                  className={styles.input}
                  placeholder="Ex.: integração CRM, webhook, BI"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={creating}
                />
              </div>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={creating || !newName.trim()}
                title={
                  !newName.trim()
                    ? "Informe o nome do token"
                    : "Criar token"
                }
              >
                <Plus size={16} />
                Criar token
              </button>
            </form>

            {justCreated?.token && (
              <div
                className={styles.notice}
                role="status"
                aria-live="polite"
              >
                <div className={styles.noticeTitle}>
                  Token criado{" "}
                  {justCreated.name
                    ? `(${justCreated.name})`
                    : ""} — copie agora
                </div>
                <div className={styles.tokenBox}>
                  <code className={styles.tokenValue}>
                    {justCreated.token}
                  </code>
                  <button
                    type="button"
                    className={styles.btnTiny}
                    onClick={() => copyToClipboard(justCreated.token)}
                    title="Copiar token completo"
                  >
                    <Copy size={14} /> Copiar
                  </button>
                </div>
                <div className={styles.noticeHelp}>
                  Por segurança, o valor completo do token não será
                  exibido novamente.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Card: lista */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Tokens do workspace</div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Criado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  items.map((r) => (
                    <tr key={r.id} className={styles.rowHover}>
                      <td className={styles.tokenCell}>
                        <code className={styles.code}>
                          {shortPreview(r.preview)}
                        </code>
                      </td>
                      <td>{r.name || "—"}</td>
                      <td>
                        {r.status === "revoked" ? (
                          <span className={styles.badgeWarn}>
                            Revogado
                          </span>
                        ) : (
                          <span className={styles.badge}>Ativo</span>
                        )}
                      </td>
                      <td>
                        {r.created_at
                          ? new Date(
                              r.created_at
                            ).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className={styles.actions}>
                        {r.is_default ? (
                          <span className={styles.muted}>
                            Não alterável
                          </span>
                        ) : r.status !== "revoked" ? (
                          <button
                            className={styles.btnDanger}
                            onClick={() => revoke(r.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                {loading && (
                  <tr>
                    <td colSpan={5} className={styles.loading}>
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Nenhum token criado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
