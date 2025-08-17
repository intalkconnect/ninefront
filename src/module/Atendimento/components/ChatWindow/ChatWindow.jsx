import React, { useEffect, useRef, useState, useCallback } from "react";
import { connectSocket, getSocket } from "../../services/socket";
import { apiGet } from "../../services/apiClient";
import useConversationsStore from "../../store/useConversationsStore";
import { marcarMensagensAntesDoTicketComoLidas } from "../../hooks/useSendMessage";

import SendMessageForm from "../SendMessageForm/SendMessageForm";
import MessageList from "./MessageList";
import ImageModal from "./modals/ImageModal";
import PdfModal from "./modals/PdfModal";
import ChatHeader from "./ChatHeader";

import "./ChatWindow.css";
import "./ChatWindowPagination.css";

const MESSAGES_PER_PAGE = 100;

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

function normText(x) {
  return extractText(x).replace(/\s+/g, " ").toLowerCase();
}
function isOutgoing(m) { return m?.direction === "outgoing"; }

function tsOf(m) {
  const t = m?.timestamp || m?.created_at || null;
  const n = t ? new Date(t).getTime() : NaN;
  return Number.isFinite(n) ? n : 0;
}
function closeInTime(a, b, windowMs = 15000) {
  const ta = tsOf(a);
  const tb = tsOf(b);
  return Math.abs(ta - tb) <= windowMs;
}

// comparação por quaisquer chaves fortes
function sameByAnyId(a, b) {
  const keysA = new Set(
    [a?.id, a?.message_id, a?.provider_id, a?.client_id].filter(Boolean).map(String)
  );
  const keysB = [b?.id, b?.message_id, b?.provider_id, b?.client_id].filter(Boolean).map(String);
  return keysB.some(k => keysA.has(k));
}

// mesma mensagem? (regras mais seguras)
function isSameOutgoing(a, b) {
  if (!a || !b || !isOutgoing(a) || !isOutgoing(b)) return false;

  if (a.client_id && b.client_id && a.client_id === b.client_id) return true;

  if (!closeInTime(a, b)) return false;

  if ((a.type || "text") !== (b.type || "text")) return false;

  const ta = normText(a.content);
  const tb = normText(b.content);

  if (ta || tb) return ta === tb;

  const ua = extractUrlOrFilename(a.content);
  const ub = extractUrlOrFilename(b.content);
  if (ua && ub) return ua === ub;

  return false;
}

// mescla campos, priorizando a “melhor”
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

// acha índice por qualquer id forte
function findIndexByAnyId(list, msg) {
  const keys = new Set([msg?.id, msg?.message_id, msg?.provider_id, msg?.client_id].filter(Boolean).map(String));
  if (!keys.size) return -1;
  return list.findIndex(m => {
    const ks = [m?.id, m?.message_id, m?.provider_id, m?.client_id].filter(Boolean).map(String);
    return ks.some(k => keys.has(k));
  });
}

// garante que ao inserir/atualizar um outgoing não crie duplicata
function upsertOutgoing(list, msg) {
  const byStrong = findIndexByAnyId(list, msg);
  if (byStrong >= 0) {
    const clone = [...list];
    clone[byStrong] = mergeOutgoing(clone[byStrong], msg);
    clone.sort((a, b) => tsOf(a) - tsOf(b));
    return clone;
  }

  const N = 20;
  for (let i = Math.max(0, list.length - N); i < list.length; i++) {
    const m = list[i];
    if (isSameOutgoing(m, msg)) {
      const clone = [...list];
      clone[i] = mergeOutgoing(m, msg);
      clone.sort((a, b) => tsOf(a) - tsOf(b));
      return clone;
    }
  }

  const added = [...list, msg];
  added.sort((a, b) => tsOf(a) - tsOf(b));
  return added;
}

/* -------------------- componente -------------------- */
export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation = useConversationsStore(state => state.mergeConversation);
  const setClienteAtivo = useConversationsStore(state => state.setClienteAtivo);
  const userEmail = useConversationsStore(state => state.userEmail);
  const userFilas = useConversationsStore(state => state.userFilas);
  const appendOrUpdateMessageStore = useConversationsStore(state => state.appendOrUpdateMessage);
  const setMessagesStore = useConversationsStore(state => state.setMessages);

  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayed] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [canSendFreeform, setCanSendFreeform] = useState(true);

  const messageListRef = useRef(null);
  const loaderRef = useRef(null);
  const socketRef = useRef(null);
  const pageRef = useRef(1);
  const messageCacheRef = useRef(new Map());
  const bottomRef = useRef(null);

  // rooms já aderidos (NÃO fazer leave_room)
  const joinedRoomsRef = useRef(new Set());

  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * MESSAGES_PER_PAGE);
    const slice = messages.slice(startIndex);
    setDisplayed(slice);
    setHasMoreMessages(startIndex > 0);
  }, []);

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
    console.groupCollapsed("%cSOCKET → new_message", "color:#4caf50;font-weight:bold;");
    console.log("payload (obj):", msg);
    try { console.log("payload (json):", JSON.stringify(msg)); } catch {}
    console.log("userId selecionado:", userIdSelecionado);
    console.groupEnd();

    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      const idx = findIndexByAnyId(prev, msg);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = mergeOutgoing(clone[idx], msg);
        clone.sort((a, b) => tsOf(a) - tsOf(b));
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        appendOrUpdateMessageStore(userIdSelecionado, clone[idx]);
        return clone;
      }

      if (isOutgoing(msg)) {
        const next = upsertOutgoing(prev, { ...msg, pending: false });
        messageCacheRef.current.set(msg.user_id, next);
        updateDisplayedMessages(next, pageRef.current);
        appendOrUpdateMessageStore(userIdSelecionado, msg);
        return next;
      }

      const updated = [...prev, msg].sort((a, b) => tsOf(a) - tsOf(b));
      messageCacheRef.current.set(msg.user_id, updated);
      updateDisplayedMessages(updated, pageRef.current);
      appendOrUpdateMessageStore(userIdSelecionado, msg);
      return updated;
    });
  }, [userIdSelecionado, updateDisplayedMessages, appendOrUpdateMessageStore]);

  const handleUpdateMessage = useCallback((msg) => {
    console.groupCollapsed("%cSOCKET → update_message", "color:#fb8c00;font-weight:bold;");
    console.log("payload (obj):", msg);
    try { console.log("payload (json):", JSON.stringify(msg)); } catch {}
    console.groupEnd();

    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      const idx = findIndexByAnyId(prev, msg);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = mergeOutgoing(clone[idx], msg);
        clone.sort((a, b) => tsOf(a) - tsOf(b));
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        appendOrUpdateMessageStore(userIdSelecionado, clone[idx]);
        return clone;
      }

      if (isOutgoing(msg)) {
        const next = upsertOutgoing(prev, { ...msg, pending: false });
        messageCacheRef.current.set(msg.user_id, next);
        updateDisplayedMessages(next, pageRef.current);
        appendOrUpdateMessageStore(userIdSelecionado, msg);
        return next;
      }

      return prev;
    });
  }, [userIdSelecionado, updateDisplayedMessages, appendOrUpdateMessageStore]);

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

  /* ------ load on user change ------ */
  useEffect(() => {
    if (!userIdSelecionado) return;
    pageRef.current = 1;
    setIsLoading(true);

    (async () => {
      try {
        const [msgRes, clienteRes, ticketRes, check24hRes] = await Promise.all([
          apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/clientes/${encodeURIComponent(userIdSelecionado)}`),
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
        msgs.sort((a, b) => tsOf(a) - tsOf(b));

        messageCacheRef.current.set(userIdSelecionado, msgs);
        setAllMessages(msgs);
        updateDisplayedMessages(msgs, 1);
        setMessagesStore(userIdSelecionado, msgs); // sincroniza store

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
          content: lastText, // snippet string
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
    updateDisplayedMessages,
    setClienteAtivo,
    scrollToBottom,
    setMessagesStore,
  ]);

  /* ------ infinite scroll ------ */
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        pageRef.current += 1;
        const cached = messageCacheRef.current.get(userIdSelecionado) || [];
        updateDisplayedMessages(cached, pageRef.current);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, userIdSelecionado, updateDisplayedMessages]);

  /* ------ tab visible refresh ------ */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !userIdSelecionado) return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();

      (async () => {
        try {
          const msgs = await apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`);
          const arr = Array.isArray(msgs) ? msgs : (msgs?.data || []);
          arr.sort((a, b) => tsOf(a) - tsOf(b));
          setAllMessages(arr);
          messageCacheRef.current.set(userIdSelecionado, arr);
          updateDisplayedMessages(arr, pageRef.current);
          setMessagesStore(userIdSelecionado, arr); // mantém store em sincronia
        } catch (err) {
          console.error("Erro ao recarregar mensagens:", err);
        }
      })();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [userIdSelecionado, updateDisplayedMessages, setMessagesStore]);

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

    setAllMessages(prev => {
      const next = upsertOutgoing(prev, optimistic);
      messageCacheRef.current.set(userIdSelecionado, next);
      updateDisplayedMessages(next, pageRef.current);
      return next;
    });

    mergeConversation(userIdSelecionado, {
      content: contentToText(tempMsg.content),
      timestamp: tempMsg.timestamp || new Date().toISOString(),
      channel: tempMsg.channel || "whatsapp",
      direction: "outgoing",
      type: (tempMsg.type || "text").toLowerCase(),
    });

    appendOrUpdateMessageStore(userIdSelecionado, {
      ...optimistic,
      timestamp: optimistic.timestamp || new Date().toISOString(),
    });

    setReplyTo(null);
    setTimeout(scrollToBottom, 0);
  }, [mergeConversation, updateDisplayedMessages, userIdSelecionado, scrollToBottom, appendOrUpdateMessageStore]);

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
        initialKey={userIdSelecionado}
        ref={messageListRef}
        messages={displayedMessages}
        onImageClick={setModalImage}
        onPdfClick={setPdfModal}
        onReply={setReplyTo}
        loaderRef={hasMoreMessages ? loaderRef : null}
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
