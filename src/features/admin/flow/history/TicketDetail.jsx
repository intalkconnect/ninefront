import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Download, Paperclip } from "lucide-react";
import { toast } from "react-toastify";
import ChatThread from "./ChatThread";
import styles from "./styles/TicketDetail.module.css";
import { apiGet } from "../../../../shared/apiClient";

function fmtDT(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const fmtBytes = (n) => {
  if (!n && n !== 0) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let b = Number(n);
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
};

export default function TicketDetail() {
  const { id, flowId: flowIdParam } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  // flowId pode vir da URL (FlowHub) ou do state
  const flowIdFromState =
    location.state?.flowId || location.state?.meta?.flowId || null;
  const flowId = flowIdParam || flowIdFromState || null;

  // rota base de histórico
  const historyRootPath = useMemo(() => {
    if (flowId) {
      return `/development/flowhub/${encodeURIComponent(
        flowId
      )}/ticket-history`;
    }
    return "/management/ticket-history";
  }, [flowId]);

  const backTo = useMemo(
    () => location.state?.returnTo || historyRootPath,
    [location.state, historyRootPath]
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [activeTab, setActiveTab] = useState("conversation");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      if (!flowId) {
        if (alive) {
          setErr(new Error("flow_id ausente"));
          setLoading(false);
          toast.error("flow_id é obrigatório para carregar o histórico.");
        }
        return;
      }

      try {
        const qs = new URLSearchParams();
        qs.set("include", "messages,attachments");
        qs.set("messages_limit", "500");
        qs.set("flow_id", flowId);

        const res = await apiGet(`/tickets/history/${id}?${qs.toString()}`);
        if (alive) setData(res);
      } catch (e) {
        if (alive) {
          setErr(e);
          toast.error("Falha ao carregar o ticket.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, flowId]);

  const titleNum = data?.ticket_number
    ? String(data.ticket_number).padStart(6, "0")
    : "—";
  const messages = data?.messages || [];
  const attachments = data?.attachments || [];

  const canExport = !loading && !err && messages.length > 0;

  async function downloadFile(url, filename = "arquivo") {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error("Falha no download");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  }

  async function handleExportPdf() {
    if (!canExport) return;
    try {
      const resp = await fetch(`/api/v1/tickets/history/${id}/pdf`, {
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Falha ao gerar PDF");
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ticket-${titleNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`PDF do ticket #${titleNum} gerado!`);
    } catch {
      toast.error("Não foi possível exportar o PDF.");
    }
  }

  return (
    <div className={styles.page}>
      {/* breadcrumb */}
      {/* HEADER: voltar à esquerda, ticket ao centro, export à direita */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => nav(backTo)}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.title}>Ticket #{titleNum}</div>
          <div className={styles.metaRow}>
            Criado em {fmtDT(data?.created_at)}
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleExportPdf}
            disabled={!canExport}
            title={canExport ? "Exportar PDF" : "Sem mensagens para exportar"}
            aria-disabled={!canExport}
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* COLUNAS */}
      <div className={styles.columns}>
        {/* sidebar fixa */}
        <aside className={styles.sidebar}>
          <div className={styles.card}>
            <div className={styles.section}>
              <div className={styles.profile}>
                <div className={styles.avatar}>
                  {(data?.customer_name || "C").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className={styles.personName}>
                    {data?.customer_name || "Cliente"}
                  </div>
                  <div className={styles.personId}>
                    {data?.customer_phone || data?.user_id || "—"}
                  </div>
                </div>
              </div>

              <div className={styles.infoList}>
                <div className={styles.infoItem}>
                  <div className={styles.label}>Fila</div>
                  <div className={styles.value}>{data?.fila || "—"}</div>
                </div>

                <div className={styles.infoItem}>
                  <div className={styles.label}>Atendente</div>
                  <div className={styles.value}>
                    {data?.assigned_to || "—"}
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <div className={styles.label}>Status</div>
                  <div className={styles.value}>
                    <span className={styles.pill}>{data?.status || "—"}</span>
                  </div>
                </div>

                <div className={styles.infoItem}>
                  <div className={styles.label}>Última atualização</div>
                  <div className={styles.value}>
                    {fmtDT(data?.updated_at)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.tagsWrap}>
              <div className={styles.tagsTitle}>Tags</div>
              <div className={styles.tags}>
                {data?.tags && data.tags.length ? (
                  data.tags.map((t, i) => (
                    <span key={i} className={styles.chip}>
                      {t}
                    </span>
                  ))
                ) : (
                  <span className={styles.personId}>Sem tags</span>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* coluna direita: chat / anexos */}
        <section className={styles.main}>
          <div className={styles.chatCard}>
            <div className={styles.cardHead}>
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${
                    activeTab === "conversation" ? styles.tabActive : ""
                  }`}
                  onClick={() => setActiveTab("conversation")}
                >
                  Conversa
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${
                    activeTab === "attachments" ? styles.tabActive : ""
                  }`}
                  onClick={() => setActiveTab("attachments")}
                >
                  <Paperclip size={14} style={{ marginRight: 6 }} /> Anexos
                </button>
              </div>
            </div>

            <div className={styles.chatBody}>
              {loading ? (
                <div className={styles.loading}>Carregando…</div>
              ) : activeTab === "conversation" ? (
                messages.length ? (
                  <ChatThread messages={messages} />
                ) : (
                  <div className={styles.emptyState}>
                    <div>
                      <div className={styles.emptyTitle}>
                        Sem histórico de mensagens
                      </div>
                      <div className={styles.emptySub}>
                        Este ticket não possui mensagens.
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className={styles.attachWrap}>
                  {attachments.length ? (
                    <div className={styles.attachList}>
                      {attachments.map((a) => (
                        <div key={a.id} className={styles.attachItem}>
                          <div className={styles.attachLeft}>
                            <div className={styles.fileIcon}>
                              {(a.type || "file").slice(0, 1).toUpperCase()}
                            </div>
                            <div className={styles.fileText}>
                              <div className={styles.fileName}>
                                {a.filename || "arquivo"}
                              </div>
                              <div className={styles.fileMeta}>
                                {a.mime_type || "arquivo"}
                                {a.size ? ` • ${fmtBytes(a.size)}` : ""} •{" "}
                                {fmtDT(a.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className={styles.attachActions}>
                            <button
                              type="button"
                              className={`${styles.btnPrimary} ${styles.btnSm}`}
                              onClick={() =>
                                downloadFile(a.url, a.filename || "arquivo")
                              }
                              title="Baixar"
                              aria-label={`Baixar ${a.filename || "arquivo"}`}
                            >
                              <Download
                                size={16}
                                style={{ marginRight: 6 }}
                              />{" "}
                              Baixar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div>
                        <div className={styles.emptyTitle}>Nenhum anexo</div>
                        <div className={styles.emptySub}>
                          Arquivos enviados aparecerão aqui.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
