import React, { useEffect, useRef, useState, useCallback } from "react";
import { connectSocket, getSocket } from "../../services/socket";
import { apiGet } from "../../../../../shared/apiClient";
import useConversationsStore from "../../store/useConversationsStore";
import { marcarMensagensAntesDoTicketComoLidas } from "../../hooks/useSendMessage";

import SendMessageForm from "../SendMessageForm/SendMessageForm";
import MessageList from "./MessageList";
import ImageModal from "./modals/ImageModal";
import PdfModal from "./modals/PdfModal";
import ChatHeader from "./ChatHeader";

import "./ChatWindow.css";

const PAGE_LIMIT = 100;

/* -------------------- helpers -------------------- */
function extractText(c) {
  if (c == null) return "";
  if (typeof c === "string") {
    const s = c.trim();
    if (s.startsWith("{") || s.startsWith("[")) {
      try {
        const j = JSON.parse(s);
        return extractText(j);
      } catch {
        return s;
      }
    }
    return s;
  }
  if (typeof c === "object") {
    return String(c.text || c.caption || c.body || "").trim();
  }
  return String(c).trim();
}
function extractUrlOrFilename(c) {
  if (!c) return "";
  if (typeof c === "string") {
    try { const j = JSON.parse(c); return extractUrlOrFilename(j); } catch { return ""; }
  }
  if (typeof c === "object") {
    return String(c.url || c.filename || "").trim().toLowerCase();
  }
  return "";
}
function contentToText(content) {
  const t = extractText(content);
  if (t) return t;
  const uf = extractUrlOrFilename(content);
  if (uf) return "[arquivo]";
  return "[mensagem]";
}
const STATUS_RANK = { read: 5, delivered: 4, sent: 3, pending: 2, error: 1, undefined: 0, null: 0 };
function rankStatus(s) { return STATUS_RANK[s] ?? 0; }
function isOutgoing(m) { return m?.direction === "outgoing"; }
function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function findIndexByAnyId(list, msg) {
  const keys = new Set([msg?.id, msg?.message_id, msg?.provider_id, msg?.client_id].filter(Boolean).map(String));
  if (!keys.size) return -1;
  return list.findIndex(m => {
    const ks = [m?.id, m?.message_id, m?.provider_id, m?.client_id].filter(Boolean).map(String);
    return ks.some(k => keys.has(k));
  });
}
function mergeOutgoing(a, b) {
  const first = rankStatus(a.status) >= rankStatus(b.status) ? a : b;
  const second = first === a ? b : a;
  return {
    ...first,
    id: first.id || second.id,
    message_id: first.message_id || second.message_id,
    provider_id: first.provider_id || second.provider_id,
    client_id: first.client_id || second.client_id,
    pending: (first.pending && !first.id && !first.message_id && !first.provider_id) ? true : false,
    timestamp: first.timestamp || second.timestamp,
    content: first.content ?? second.content,
    channel: first.channel || second.channel,
    type: first.type || second.type,
    reply_to: first.reply_to ?? second.reply_to,
    reply_direction: first.reply_direction ?? second.reply_direction,
  };
}

/** Inserção ordenada ASC por timestamp (evita sort global) */
function insertSortedAsc(list, msg) {
  const t = tsOf(msg);
  if (!list.length || tsOf(list[list.length - 1]) <= t) return [...list, msg];
  let lo = 0, hi = list.length - 1, mid;
  while (lo <= hi) {
    mid = (lo + hi) >> 1;
    if (tsOf(list[mid]) <= t) lo = mid + 1;
    else hi = mid - 1;
  }
  const copy = list.slice();
  copy.splice(lo, 0, msg);
  return copy;
}
function upsertByKeySortedAsc(list, msg) {
  const idx = findIndexByAnyId(list, msg);
  if (idx >= 0) {
    const merged = mergeOutgoing(list[idx], msg);
    if (tsOf(merged) >= tsOf(list[idx])) {
      const copy = list.slice();
      copy[idx] = merged;
      return copy;
    }
    const copy = list.slice();
    copy.splice(idx, 1);
    return insertSortedAsc(copy, merged);
  }
  return insertSortedAsc(list, msg);
}

/* -------------------- componente -------------------- */
export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation = useConversationsStore((state) => state.mergeConversation);
  const setClienteAtivo   = useConversationsStore((state) => state.setClienteAtivo);
  const userEmail         = useConversationsStore((state) => state.userEmail);
  const userFilas         = useConversationsStore((state) => state.userFilas);

  const [allMessages, setAllMessages] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [canSendFreeform, setCanSendFreeform] = useState(true);

  const messageListRef   = useRef(null);
  const loaderRef        = useRef(null);
  const socketRef        = useRef(null);
  const messageCacheRef  = useRef(new Map());
  const bottomRef        = useRef(null);

  // paginação por cursor
  const oldestTsRef      = useRef(null);
  const fetchingMoreRef  = useRef(false);

  // rooms já aderidos (NÃO fazer leave_room)
  const joinedRoomsRef = useRef(new Set());

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socketRef.current = socket;
  }, []);

  /* ------ socket handlers ------ */
  const handleNewMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages((prev) => {
      const next = upsertByKeySortedAsc(prev, { ...msg, pending: false });
      messageCacheRef.current.set(msg.user_id, next);

      // atualiza card/snippet
      const ts = msg.timestamp || new Date().toISOString();
      mergeConversation(msg.user_id, {
        content: contentToText(msg.content),
        channel: msg.channel,
        direction: msg.direction,
        timestamp: ts,
        type: (msg.type || "text").toLowerCase(),
      });

      return next;
    });
  }, [userIdSelecionado, mergeConversation]);

  const handleUpdateMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages((prev) => {
      const next = upsertByKeySortedAsc(prev, { ...msg, pending: false });
      messageCacheRef.current.set(msg.user_id, next);

      const ts = msg.timestamp || new Date().toISOString();
      mergeConversation(msg.user_id, {
        content: contentToText(msg.content),
        channel: msg.channel,
        direction: msg.direction,
        timestamp: ts,
        status: msg.status,
        type: (msg.type || "text").toLowerCase(),
      });

      return next;
    });
  }, [userIdSelecionado, mergeConversation]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.on("new_message", handleNewMessage);
    socket.on("update_message", handleUpdateMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("update_message", handleUpdateMessage);
    };
  }, [handleNewMessage, handleUpdateMessage]);

  /* ------ rooms (sem leave_room) ------ */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userIdSelecionado) return;

    if (!joinedRoomsRef.current.has(userIdSelecionado)) {
      socket.emit("join_room", userIdSelecionado);
      joinedRoomsRef.current.add(userIdSelecionado);
    }
    const onConnect = () => {
      for (const room of joinedRoomsRef.current) {
        socket.emit("join_room", room);
      }
    };
    socket.on("connect", onConnect);
    return () => { socket.off("connect", onConnect); };
  }, [userIdSelecionado]);

  /* ------ load on user change (pega últimos N ASC + cursor) ------ */
  useEffect(() => {
    if (!userIdSelecionado) return;
    setIsLoading(true);

    (async () => {
      try {
        const [msgRes, clienteRes, ticketRes, check24hRes] = await Promise.all([
          apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}?limit=${PAGE_LIMIT}&sort=asc`),
          apiGet(`/customers/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/tickets/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/messages/check-24h/${encodeURIComponent(userIdSelecionado)}`),
        ]);

        const { status, assigned_to, fila } = (ticketRes || {});
        if (status !== "open" || assigned_to !== userEmail || !(userFilas || []).includes(fila)) {
          console.warn("Acesso negado ao ticket deste usuário.");
          setIsLoading(false);
          return;
        }

        const msgs = Array.isArray(msgRes) ? msgRes : (msgRes?.data || []);

        messageCacheRef.current.set(userIdSelecionado, msgs);
        setAllMessages(msgs);

        // cursor = TS da mais antiga carregada
        oldestTsRef.current = msgs.length ? (msgs[0].timestamp || msgs[0].created_at) : null;

        const lastMsg = msgs[msgs.length - 1] || {};
        const lastText = contentToText(lastMsg?.content);
        mergeConversation(userIdSelecionado, {
          channel: lastMsg.channel || clienteRes?.channel || "desconhecido",
          ticket_number: clienteRes?.ticket_number || "000000",
          fila: clienteRes?.fila || fila || "Orçamento",
          name: clienteRes?.name || userIdSelecionado,
          email: clienteRes?.email || "",
          phone: clienteRes?.phone || "",
          documento: clienteRes?.document || "",
          user_id: clienteRes?.user_id || userIdSelecionado,
          assigned_to,
          status,
          content: lastText,
          timestamp: lastMsg?.timestamp || lastMsg?.created_at,
          type: (lastMsg?.type || "text").toLowerCase(),
        });

        marcarMensagensAntesDoTicketComoLidas(userIdSelecionado, msgs);

        setClienteInfo({
          name: clienteRes?.name,
          phone: clienteRes?.phone,
          channel: clienteRes?.channel,
          ticket_number: clienteRes?.ticket_number,
          fila: clienteRes?.fila,
          assigned_to,
          status,
        });

        setClienteAtivo(clienteRes || null);
        setCanSendFreeform(check24hRes?.allowed ?? true);
      } catch (err) {
        console.error("Erro ao buscar cliente/conversa:", err);
      } finally {
        setIsLoading(false);
        setTimeout(scrollToBottom, 30);
      }
    })();
  }, [
    userIdSelecionado,
    userEmail,
    userFilas,
    mergeConversation,
    setClienteAtivo,
    scrollToBottom,
  ]);

  /* ------ infinite scroll (carrega mensagens mais antigas via cursor) ------ */
  useEffect(() => {
    const container = messageListRef.current?.getContainer?.();
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      if (!oldestTsRef.current || fetchingMoreRef.current) return;

      fetchingMoreRef.current = true;
      const prevHeight = container?.scrollHeight || 0;

      try {
        const qs = new URLSearchParams({
          limit: String(PAGE_LIMIT),
          before_ts: String(oldestTsRef.current),
          sort: "desc", // mais rápido no servidor
        });
        const older = await apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}?${qs.toString()}`);
        const arr = Array.isArray(older) ? older : (older?.data || []);
        arr.reverse(); // volta para ASC no cliente

        if (arr.length) {
          setAllMessages((prev) => {
            const next = [...arr, ...prev]; // preprende
            messageCacheRef.current.set(userIdSelecionado, next);
            return next;
          });
          oldestTsRef.current = arr[0].timestamp || arr[0].created_at;

          // mantém posição na tela após preprender
          requestAnimationFrame(() => {
            const newHeight = container?.scrollHeight || 0;
            if (container) container.scrollTop = newHeight - prevHeight;
          });
        } else {
          // acabou
          oldestTsRef.current = null;
        }
      } catch (e) {
        console.error("Erro ao paginar mensagens:", e);
      } finally {
        fetchingMoreRef.current = false;
      }
    }, { threshold: 0.01 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [userIdSelecionado]);

  /* ------ tab visible refresh (reconecta socket) ------ */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !userIdSelecionado) return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();
      // opcional: se quiser, busque apenas os últimos N novamente (mantive simples)
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [userIdSelecionado]);

  /* ------ envio otimista ------ */
  const onMessageAdded = useCallback((tempMsg) => {
    if (!tempMsg) return;

    const client_id = tempMsg.client_id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = {
      ...tempMsg,
      pending: true,
      direction: "outgoing",
      client_id,
      reply_to: tempMsg.reply_to || null,
    };

    setAllMessages((prev) => {
      const next = upsertByKeySortedAsc(prev, optimistic);
      messageCacheRef.current.set(userIdSelecionado, next);
      return next;
    });

    mergeConversation(userIdSelecionado, {
      content: contentToText(tempMsg.content),
      timestamp: tempMsg.timestamp || new Date().toISOString(),
      channel: tempMsg.channel || "whatsapp",
      direction: "outgoing",
      type: (tempMsg.type || "text").toLowerCase(),
    });

    setReplyTo(null);
    setTimeout(scrollToBottom, 0);
  }, [mergeConversation, userIdSelecionado, scrollToBottom]);

  /* ------ render ------ */
  if (!userIdSelecionado) {
    return (
      <div className="chat-window placeholder">
        <div className="chat-placeholder">
          <svg className="chat-icon" width="80" height="80" viewBox="0 0 24 24" fill="var(--color-border)">
            <path d="M4 2h16a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2H6l-4 4V4a2 2 0 0 1 2 -2z" />
          </svg>
          <h2 className="placeholder-title">Tudo pronto para atender</h2>
          <p className="placeholder-subtitle">Escolha um ticket na lista ao lado para abrir a conversa</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="chat-window loading">
        <div className="loading-container"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <ChatHeader userIdSelecionado={userIdSelecionado} clienteInfo={clienteInfo} />

      <MessageList
        ref={messageListRef}
        messages={allMessages}
        onImageClick={setModalImage}
        onPdfClick={setPdfModal}
        onReply={setReplyTo}
        loaderRef={oldestTsRef.current ? loaderRef : null}
      />

      <div ref={bottomRef} />

      <div className="chat-input">
        <SendMessageForm
          userIdSelecionado={userIdSelecionado}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          canSendFreeform={canSendFreeform}
          onMessageAdded={onMessageAdded}
        />
      </div>

      {modalImage && <ImageModal url={modalImage} onClose={() => setModalImage(null)} />}
      {pdfModal && <PdfModal url={pdfModal} onClose={() => setPdfModal(null)} />}
    </div>
  );
}
