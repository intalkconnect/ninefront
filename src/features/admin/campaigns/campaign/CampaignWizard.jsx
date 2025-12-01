// File: CampaignWizard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Upload,
  Calendar,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../../../../shared/apiClient";
import styles from "../styles/AdminUI.module.css"; // ajuste o caminho se necessário
import { toast } from "react-toastify";

/* ---------- Helpers ---------- */

// Normaliza filas vindas da API
function normalizeQueues(queues) {
  return (Array.isArray(queues) ? queues : [])
    .map((q) => {
      if (typeof q === "string") return { id: q, nome: q };
      const id = q?.id ?? q?.nome ?? q?.name;
      const nome = q?.nome ?? q?.name ?? String(id || "");
      return { id: String(id), nome: String(nome) };
    })
    .filter((q) => q.id && q.nome);
}

/* ============================================================
 * Wrapper de página – usado direto na rota
 * ========================================================== */
export default function CampaignWizardPage() {
  const navigate = useNavigate();

  const handleCreated = () =>
    navigate("/management/campaigns", { state: { created: true } });

  const handleBack = () => navigate(-1);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <CampaignWizard onCreated={handleCreated} onBack={handleBack} />
      </div>
    </div>
  );
}

/* ============================================================
 * Wizard em si (lógica + UI)
 * ========================================================== */
function CampaignWizard({ onCreated, onBack }) {
  const [step, setStep] = useState(0); // 0..3
  const maxStep = 3;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // dados carregados
  const [templates, setTemplates] = useState([]);
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);

  // fluxo/blocos
  const [flowId, setFlowId] = useState(null);
  const [blocks, setBlocks] = useState([]); // [{key, name, type}]
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState(null);

  // formulário
  const [form, setForm] = useState({
    // Etapa 0 — Configuração
    name: "",
    sendType: "mass", // 'mass' | 'single'
    mode: "immediate", // 'immediate' | 'scheduled' (apenas mass)
    start_at: "",

    // Etapa 1 — Resposta
    actionType: "open_ticket", // 'open_ticket' | 'flow_goto'

    // open_ticket:
    fila: "",
    assigned_to: "",

    // flow_goto:
    flow_block: "",

    // Etapa 2 — Template & Destino
    template_id: "",
    file: null, // mass
    to: "", // single
  });

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => String(t.id) === String(form.template_id)) || null,
    [templates, form.template_id]
  );

  const queuesNorm = useMemo(() => normalizeQueues(queues), [queues]);
  const selectedQueue = useMemo(
    () => queuesNorm.find((q) => q.nome === form.fila) || null,
    [queuesNorm, form.fila]
  );

  // Atendentes por fila
  const agentsForQueue = useMemo(() => {
    if (!selectedQueue) return [];
    const wantNome = selectedQueue.nome;
    const wantId = selectedQueue.id;
    const norm = (arr) => (Array.isArray(arr) ? arr.map((x) => String(x)) : []);
    return (users || []).filter((u) => {
      const filas = norm(u.filas);
      return filas.includes(String(wantNome)) || filas.includes(String(wantId));
    });
  }, [users, selectedQueue]);

  /* ---------- Validações por etapa ---------- */

  const canNextFromStep0 = useMemo(() => {
    if (!form.name.trim()) return false;
    if (form.sendType === "mass" && form.mode === "scheduled" && !form.start_at)
      return false;
    return true;
  }, [form.name, form.sendType, form.mode, form.start_at]);

  const canNextFromStep1 = useMemo(() => {
    if (form.actionType === "open_ticket") {
      return !!String(form.fila || "").trim();
    }
    if (form.actionType === "flow_goto") {
      return !!String(form.flow_block || "").trim();
    }
    return false;
  }, [form.actionType, form.fila, form.flow_block]);

  const canNextFromStep2 = useMemo(() => {
    if (!selectedTemplate) return false;
    if (form.sendType === "mass") return Boolean(form.file);
    return !!form.to.trim();
  }, [selectedTemplate, form.file, form.to, form.sendType]);

  const canCreate = useMemo(
    () => canNextFromStep0 && canNextFromStep1 && canNextFromStep2,
    [canNextFromStep0, canNextFromStep1, canNextFromStep2]
  );

  /* ---------- Load inicial (templates/filas/usuários) ---------- */

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [tRes, qRes, uRes] = await Promise.all([
        apiGet("/templates?status=approved"),
        apiGet("/queues"),
        apiGet("/users"),
      ]);
      setTemplates(Array.isArray(tRes) ? tRes : []);
      setQueues(Array.isArray(qRes) ? qRes : []);
      setUsers(
        Array.isArray(uRes?.data)
          ? uRes.data
          : Array.isArray(uRes)
          ? uRes
          : []
      );
    } catch (e) {
      console.error(e);
      setError("Falha ao carregar dados (templates/filas/usuários).");
      toast.error("Falha ao carregar dados (templates/filas/usuários).");
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ---------- Load de blocos do fluxo ativo ---------- */

  const loadBlocks = useCallback(async () => {
    try {
      setBlocksLoading(true);
      setBlocksError(null);

      const latest = await apiGet("/flows/latest");
      const active = Array.isArray(latest)
        ? latest.find((f) => f.active) || latest[0]
        : latest?.find?.((f) => f.active) || latest || null;
      const id = active?.id;
      if (!id) {
        setFlowId(null);
        setBlocks([]);
        setBlocksError("Nenhum fluxo ativo encontrado.");
        return;
      }

      setFlowId(id);

      const data = await apiGet(`/flows/data/${encodeURIComponent(id)}`);
      const raw =
        data?.blocks || data?.data?.blocks || data?.flow?.blocks || {};

      const list = Object.entries(raw)
        .map(([key, b]) => ({
          key,
          name: b?.name || b?.title || b?.label || key,
          type: String(b?.type || "").toLowerCase(),
        }))
        .filter((b) => !["script", "api_call"].includes(b.type))
        .sort((a, b) => a.name.localeCompare(b.name));

      setBlocks(list);

      if (form.flow_block && !list.some((x) => x.key === form.flow_block)) {
        setField("flow_block", "");
      }
    } catch (e) {
      console.error(e);
      setBlocks([]);
      setBlocksError("Falha ao carregar blocos do fluxo ativo.");
    } finally {
      setBlocksLoading(false);
    }
  }, [form.flow_block]);

  useEffect(() => {
    if (step === 1 && form.actionType === "flow_goto") {
      loadBlocks();
    }
  }, [step, form.actionType, loadBlocks]);

  /* ---------- Navegação ---------- */

  function goPrev() {
    setStep((s) => Math.max(0, s - 1));
  }

  function goNext() {
    if (step === 0 && !canNextFromStep0) {
      toast.warn("Preencha os campos obrigatórios.");
      return;
    }
    if (step === 1 && !canNextFromStep1) {
      toast.warn(
        form.actionType === "open_ticket"
          ? "Selecione a fila."
          : "Selecione um bloco do fluxo."
      );
      return;
    }
    if (step === 2 && !canNextFromStep2) {
      toast.warn(
        form.sendType === "mass"
          ? "Selecione o template e o arquivo CSV."
          : "Informe o número do destinatário e o template."
      );
      return;
    }
    setStep((s) => Math.min(maxStep, s + 1));
  }

  function handlePickFile(e) {
    const f = e.target.files?.[0] || null;
    setField("file", f);
  }

  /* ---------- reply_* ---------- */

  const replyAction =
    form.actionType === "flow_goto" ? "flow_goto" : "open_ticket";

  const replyPayload = useMemo(() => {
    if (replyAction === "open_ticket") {
      return {
        fila: form.fila || null,
        ...(form.assigned_to ? { assigned_to: form.assigned_to } : {}),
      };
    }
    return { block: form.flow_block };
  }, [replyAction, form.fila, form.assigned_to, form.flow_block]);

  /* ---------- Criação / envio ---------- */

  async function handleCreate() {
    if (!canCreate) {
      toast.warn("Confira os campos obrigatórios.");
      return;
    }
    try {
      setLoading(true);
      setError(null);

      if (form.sendType === "mass") {
        const meta = {
          name: form.name.trim(),
          start_at:
            form.mode === "scheduled"
              ? new Date(form.start_at).toISOString()
              : null,
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
          },
          reply_action: replyAction,
          reply_payload: replyPayload,
        };

        const fd = new FormData();
        fd.append("file", form.file);
        fd.append("meta", JSON.stringify(meta));

        const res = await apiPost("/campaigns", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res?.ok) {
          toast.success(
            meta.start_at
              ? "Campanha agendada! O scheduler disparará no horário definido."
              : "Campanha criada! O scheduler iniciará o envio."
          );
          onCreated?.(res);
        } else {
          setError(res?.error || "Não foi possível criar a campanha.");
          toast.error(res?.error || "Não foi possível criar a campanha.");
        }
      } else {
        const payload = {
          to: form.to.trim(),
          origin: "individual",
          template: {
            name: selectedTemplate.name,
            language: { code: selectedTemplate.language_code },
          },
          reply_action: replyAction,
          reply_payload: replyPayload,
        };

        const res = await apiPost("/messages/send/template", payload);

        if (res?.enqueued || res?.success) {
          toast.success("Mensagem ativa enfileirada com sucesso.");
          onCreated?.(res);
        } else {
          setError(res?.error || "Não foi possível enviar a mensagem.");
          toast.error(res?.error || "Não foi possível enviar a mensagem.");
        }
      }
    } catch (e) {
      console.error(e);
      setError("Erro ao processar o envio.");
      toast.error("Erro ao processar o envio.");
    } finally {
      setLoading(false);
    }
  }

  const stepLabel = (i) =>
    ["Configuração", "Resposta", "Template & Destino", "Revisão"][i] || "";

  /* ---------- Render ---------- */

  return (
    <div>
      {/* HEADER NO PADRÃO DAS DEMAIS TELAS */}
      <header className={styles.header}>
        <button
          onClick={onBack}
          type="button"
          className={styles.backBtn}
          title="Voltar"
        >
          <ArrowLeft size={16} />
        </button>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Nova campanha</h1>
          <p className={styles.subtitle}>
            Configure o disparo em etapas antes de confirmar o envio.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconCircle}
            onClick={loadAll}
            title="Recarregar dados"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {/* Stepper logo abaixo do header */}
      <div className={styles.stepper} role="navigation" aria-label="Etapas">
        {[0, 1, 2, 3].map((i) => {
          const active = step === i;
          const done = step > i;
          return (
            <div
              key={i}
              className={`${styles.step} ${
                active ? styles.stepActive : ""
              } ${done ? styles.stepDone : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <span className={styles.stepIdx}>{i + 1}</span>
              <span className={styles.stepTxt}>{stepLabel(i)}</span>
            </div>
          );
        })}
      </div>

      {error && <div className={styles.alertErr}>⚠️ {error}</div>}

      {/* STEP 0 — Configuração */}
      {step === 0 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Configuração</h2>
            <p className={styles.cardDesc}>
              Defina nome, tipo de envio e, se for em massa, o agendamento.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.gridTwo}>
              <div className={styles.group}>
                <label className={styles.label}>Nome da campanha</label>
                <input
                  className={styles.input}
                  placeholder="Ex.: Black Friday Leads"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Tipo de envio</label>
                <div
                  className={styles.optionsRow}
                  role="radiogroup"
                  aria-label="Tipo de envio"
                >
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="sendType"
                      value="mass"
                      checked={form.sendType === "mass"}
                      onChange={() => setField("sendType", "mass")}
                    />
                    <span>Massa (CSV)</span>
                  </label>
                  <label className={styles.opt}>
                    <input
                      type="radio"
                      name="sendType"
                      value="single"
                      checked={form.sendType === "single"}
                      onChange={() => setField("sendType", "single")}
                    />
                    <span>Individual</span>
                  </label>
                </div>
              </div>

              {form.sendType === "mass" && (
                <>
                  <div className={styles.group}>
                    <label className={styles.label}>Modo de execução</label>
                    <div
                      className={styles.optionsRow}
                      role="radiogroup"
                      aria-label="Modo de execução"
                    >
                      <label className={styles.opt}>
                        <input
                          type="radio"
                          name="mode"
                          value="immediate"
                          checked={form.mode === "immediate"}
                          onChange={() => setField("mode", "immediate")}
                        />
                        <span>Imediata</span>
                      </label>
                      <label className={styles.opt}>
                        <input
                          type="radio"
                          name="mode"
                          value="scheduled"
                          checked={form.mode === "scheduled"}
                          onChange={() => setField("mode", "scheduled")}
                        />
                        <span>Agendada</span>
                      </label>
                    </div>
                  </div>

                  {form.mode === "scheduled" && (
                    <div className={styles.group}>
                      <label className={styles.label}>Agendar para</label>
                      <div className={styles.inputIconRow}>
                        <input
                          type="datetime-local"
                          className={styles.input}
                          value={form.start_at}
                          onChange={(e) =>
                            setField("start_at", e.target.value)
                          }
                        />
                        <Calendar size={16} />
                      </div>
                      <span className={styles.hint}>
                        Será convertido para ISO e enviado ao backend.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* STEP 1 — Resposta */}
      {step === 1 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Resposta do cliente</h2>
            <p className={styles.cardDesc}>
              Escolha o que acontece quando o cliente responder.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.group}>
              <label className={styles.label}>Ação ao responder</label>
              <div
                className={styles.optionsRow}
                role="radiogroup"
                aria-label="Ação de resposta"
              >
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="actionType"
                    value="open_ticket"
                    checked={form.actionType === "open_ticket"}
                    onChange={() => setField("actionType", "open_ticket")}
                  />
                  <span>Abrir ticket (fila/atendente)</span>
                </label>
                <label className={styles.opt}>
                  <input
                    type="radio"
                    name="actionType"
                    value="flow_goto"
                    checked={form.actionType === "flow_goto"}
                    onChange={() => setField("actionType", "flow_goto")}
                  />
                  <span>Enviar para bloco do fluxo</span>
                </label>
              </div>
            </div>

            {form.actionType === "open_ticket" ? (
              <div className={styles.gridTwo}>
                <div className={styles.group}>
                  <label className={styles.label}>Fila (obrigatório)</label>
                  <select
                    className={styles.input}
                    value={form.fila}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        fila: v,
                        assigned_to: "",
                      }));
                    }}
                  >
                    <option value="">Selecione…</option>
                    {queuesNorm.map((q) => (
                      <option key={q.id} value={q.nome}>
                        {q.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.group}>
                  <label className={styles.label}>Atendente (opcional)</label>
                  <select
                    className={styles.input}
                    value={form.assigned_to}
                    onChange={(e) => setField("assigned_to", e.target.value)}
                    disabled={!form.fila}
                  >
                    <option value="">Sem atendente específico</option>
                    {agentsForQueue.map((u) => {
                      const label = u.name
                        ? `${u.name}${u.lastname ? ` ${u.lastname}` : ""} — ${
                            u.email
                          }`
                        : u.email;
                      return (
                        <option key={u.email} value={u.email}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <small className={styles.hint}>
                    Lista exibe apenas atendentes vinculados à fila selecionada.
                  </small>
                </div>
              </div>
            ) : (
              <div className={styles.gridTwo}>
                <div className={styles.group}>
                  <label className={styles.label}>
                    Bloco de destino (obrigatório)
                  </label>
                  <div className={styles.blockRow}>
                    <select
                      className={styles.input}
                      value={form.flow_block}
                      onChange={(e) => setField("flow_block", e.target.value)}
                      disabled={blocksLoading || !!blocksError}
                    >
                      <option value="">
                        {blocksLoading
                          ? "Carregando blocos…"
                          : "Selecione um bloco…"}
                      </option>
                      {blocks.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.fileButton}
                      title="Atualizar blocos do fluxo"
                      onClick={loadBlocks}
                    >
                      <RefreshCw size={16} />
                      <span className={styles.btnText}>Atualizar</span>
                    </button>
                  </div>
                  {blocksError && (
                    <div className={styles.alertErr}>⚠️ {blocksError}</div>
                  )}
                  {flowId && !blocksError && (
                    <small className={styles.hint}>
                      Fluxo ativo: <b>#{flowId}</b>.
                    </small>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 2 — Template & Destino */}
      {step === 2 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Template & Destino</h2>
            <p className={styles.cardDesc}>
              Selecione o template aprovado e informe o destino conforme o tipo
              de envio.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.gridTwo}>
              <div className={styles.group}>
                <label className={styles.label}>Template aprovado</label>
                <select
                  className={styles.input}
                  value={form.template_id}
                  onChange={(e) => setField("template_id", e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {t.language_code}
                    </option>
                  ))}
                </select>
                {selectedTemplate && (
                  <small className={styles.hint}>
                    Idioma: <b>{selectedTemplate.language_code}</b>.
                  </small>
                )}
              </div>

              {form.sendType === "mass" ? (
                <div className={styles.group}>
                  <label className={styles.label}>Arquivo CSV</label>
                  <div className={styles.fileRow}>
                    <input
                      id="csvInput"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handlePickFile}
                      className={styles.fileNative}
                    />
                    <label htmlFor="csvInput" className={styles.fileButton}>
                      <Upload size={16} />
                      <span className={styles.btnText}>
                        {form.file ? "Trocar arquivo…" : "Selecionar arquivo…"}
                      </span>
                    </label>
                    <span className={styles.fileName}>
                      {form.file
                        ? form.file.name
                        : "Nenhum arquivo selecionado"}
                    </span>
                  </div>
                  <small className={styles.hint}>
                    O CSV deve conter a coluna <b>to</b> e as variáveis do
                    template.
                  </small>
                </div>
              ) : (
                <div className={styles.group}>
                  <label className={styles.label}>
                    Número do destinatário
                  </label>
                  <input
                    className={styles.input}
                    placeholder="Ex.: 5511999998888"
                    value={form.to}
                    onChange={(e) =>
                      setField("to", e.target.value.replace(/\s+/g, ""))
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* STEP 3 — Revisão */}
      {step === 3 && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Revisão</h2>
            <p className={styles.cardDesc}>
              Confira as informações antes de confirmar.
            </p>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.gridTwo}>
              <div className={styles.group}>
                <label className={styles.label}>Nome</label>
                <div className={styles.readonly}>
                  {form.name || "—"}
                </div>
              </div>

              <div className={styles.group}>
                <label className={styles.label}>Tipo de envio</label>
                <div className={styles.readonly}>
                  {form.sendType === "mass" ? "Massa (CSV)" : "Individual"}
                </div>
              </div>

              {form.sendType === "mass" ? (
                <>
                  <div className={styles.group}>
                    <label className={styles.label}>Execução</label>
                    <div className={styles.readonly}>
                      {form.mode === "scheduled"
                        ? form.start_at
                          ? new Date(form.start_at).toLocaleString("pt-BR")
                          : "Agendada (sem data)"
                        : "Imediata"}
                    </div>
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>Arquivo</label>
                    <div className={styles.readonly}>
                      {form.file?.name || "—"}
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.group}>
                  <label className={styles.label}>Destinatário</label>
                  <div className={styles.readonly}>
                    {form.to || "—"}
                  </div>
                </div>
              )}

              <div className={styles.group}>
                <label className={styles.label}>Ação de resposta</label>
                <div className={styles.readonly}>
                  {form.actionType === "open_ticket"
                    ? "Abrir ticket"
                    : "Ir para bloco do fluxo"}
                </div>
              </div>

              {form.actionType === "open_ticket" ? (
                <>
                  <div className={styles.group}>
                    <label className={styles.label}>Fila</label>
                    <div className={styles.readonly}>
                      {form.fila || "—"}
                    </div>
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>Atendente</label>
                    <div className={styles.readonly}>
                      {form.assigned_to || "—"}
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.group}>
                  <label className={styles.label}>Destino no fluxo</label>
                  <div className={styles.readonly}>
                    {blocks.find((b) => b.key === form.flow_block)?.name ||
                      "—"}
                  </div>
                </div>
              )}

              <div className={styles.group}>
                <label className={styles.label}>Template</label>
                <div className={styles.readonly}>
                  {selectedTemplate
                    ? `${selectedTemplate.name} • ${selectedTemplate.language_code}`
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer / Navegação */}
      <div
        className={styles.stickyFooter}
        role="region"
        aria-label="Ações do wizard"
      >
        <div className={styles.stickyInner}>
          <div />
          <div className={styles.footerButtons}>
            {step > 0 && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={goPrev}
              >
                Voltar
              </button>
            )}
            {step < maxStep && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={goNext}
                disabled={
                  (step === 0 && !canNextFromStep0) ||
                  (step === 1 && !canNextFromStep1) ||
                  (step === 2 && !canNextFromStep2)
                }
              >
                Avançar
              </button>
            )}
            {step === maxStep && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={loading || !canCreate}
              >
                {loading ? (
                  <Loader2 className={styles.spinning} size={16} />
                ) : null}
                {loading
                  ? "Processando…"
                  : form.sendType === "mass"
                  ? "Criar campanha"
                  : "Enviar mensagem"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
