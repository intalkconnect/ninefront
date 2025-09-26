import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Clipboard } from "lucide-react";
import { apiGet } from "../../../../shared/apiClient";

/* ===== utils ===== */
function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function sortAsc(a, b) { return tsOf(a) - tsOf(b); }
function msgText(m) {
  const c = m?.content;
  if (c == null) return "";
  if (typeof c === "string") {
    try { return msgText(JSON.parse(c)); } catch { return c.trim(); }
  }
  if (typeof c === "object") {
    return String(c.text || c.caption || c.body || c.filename || c.url || "").trim();
  }
  return String(c).trim();
}

/* Busca capítulo:
   1) filtra do cache em memória (messagesInMemory)
   2) tenta endpoint dedicado /tickets/:ticket/messages?user_id=...
   3) pagina para trás em /messages/:userId até achar msgs do ticket */
async function fetchChapterMessages({ userId, ticketNumber, messagesInMemory, beforeTsRef, pageLimit = 100 }) {
  const local = (messagesInMemory || []).filter(m => String(m.ticket_number) === String(ticketNumber));
  if (local.length) return local.sort(sortAsc);

  try {
    const byApi = await apiGet(`/tickets/${encodeURIComponent(ticketNumber)}/messages?user_id=${encodeURIComponent(userId)}`);
    const payload = Array.isArray(byApi) ? byApi : byApi?.data;
    if (Array.isArray(payload) && payload.length) return payload.sort(sortAsc);
  } catch (_) {}

  let found = [];
  let keep = true;

  while (keep) {
    const qs = new URLSearchParams({ limit: String(pageLimit), sort: "desc" });
    if (beforeTsRef.current) qs.set("before_ts", String(beforeTsRef.current));

    const older = await apiGet(`/messages/${encodeURIComponent(userId)}?${qs.toString()}`);
    const arr = Array.isArray(older) ? older : (older?.data || []);
    if (!arr.length) break;

    const olderAsc = [...arr].reverse();
    beforeTsRef.current = olderAsc[0]?.timestamp || olderAsc[0]?.created_at || null;

    const chunk = olderAsc.filter(m => String(m.ticket_number) === String(ticketNumber));
    if (chunk.length) found = [...chunk, ...found];

    if (!beforeTsRef.current || olderAsc.length < pageLimit) keep = false;
  }

  return found.sort(sortAsc);
}

/* ===== Modal ===== */
export default function TicketChapterModal({
  open,
  onClose,
  userId,
  ticketNumber,
  messagesInMemory = [],
}) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const beforeTsRef = useRef(null);

  const title = useMemo(() => `Capítulo • Ticket #${ticketNumber}`, [ticketNumber]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const msgs = await fetchChapterMessages({
        userId, ticketNumber, messagesInMemory, beforeTsRef,
      });
      setMessages(msgs);
    } catch (e) {
      setError(e?.message || "Falha ao carregar capítulo");
    } finally {
      setLoading(false);
    }
  }, [open, userId, ticketNumber, messagesInMemory]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async () => {
    const lines = messages.map(m => {
      const when = new Date(tsOf(m)).toLocaleString();
      const who  = m.direction === "outgoing" ? "Agente" :
                  (m.direction === "incoming" ? "Cliente" : "Sistema");
      return `[${when}] ${who}: ${msgText(m) || "[mensagem]"}`;
    });
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch {}
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="chapter-modal__backdrop"
      style={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="chapter-modal__card" style={styles.card}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button onClick={onClose} style={styles.iconBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          {loading && <div style={styles.center}>Carregando capítulo…</div>}
          {error && <div style={{ ...styles.center, color: "#c00" }}>{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div style={styles.center}>Nenhuma mensagem encontrada.</div>
          )}
          {!loading && !error && messages.length > 0 && (
            <div style={styles.list}>
              {messages.map((m, i) => {
                const ts = new Date(tsOf(m)).toLocaleString();
                const who = m.direction === "outgoing" ? "Agente" :
                            (m.direction === "incoming" ? "Cliente" : "Sistema");
                return (
                  <div key={m.id || m.message_id || m.provider_id || i} style={styles.row}>
                    <div style={styles.rowMeta}>
                      <span style={styles.pill}>{who}</span>
                      <span style={styles.when}>{ts}</span>
                    </div>
                    <div style={styles.text}>{msgText(m) || "[mensagem]"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={handleCopy} style={styles.secondaryBtn}>
            <Clipboard size={16} style={{ marginRight: 6 }} /> Copiar transcrição
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={styles.primaryBtn}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* estilos inline simples */
const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
  },
  card: {
    width: "min(920px, 96vw)",
    maxHeight: "84vh",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex", flexDirection: "column", overflow: "hidden",
  },
  header: {
    padding: "14px 16px", borderBottom: "1px solid #eee",
    display: "flex", alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: 600, margin: 0 },
  iconBtn: { marginLeft: "auto", border: 0, background: "transparent", width: 32, height: 32, borderRadius: 6, cursor: "pointer" },
  body: { padding: 12, overflow: "auto", minHeight: 180 },
  center: { textAlign: "center", padding: "24px 0", color: "#666" },
  list: { display: "grid", gap: 10 },
  row: { padding: 10, border: "1px solid #eee", borderRadius: 8 },
  rowMeta: { display: "flex", gap: 10, alignItems: "center", marginBottom: 6 },
  pill: { background: "#eef6ff", color: "#1677ff", padding: "2px 8px", borderRadius: 999, fontSize: 12 },
  when: { color: "#888", fontSize: 12 },
  text: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14 },
  footer: { padding: 12, borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: 8 },
  primaryBtn: { padding: "10px 14px", background: "#1677ff", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontWeight: 600 },
  secondaryBtn: { padding: "8px 12px", background: "#f5f5f5", border: "1px solid #e5e5e5", borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center" }
};
