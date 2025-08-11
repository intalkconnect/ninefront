import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../services/apiClient";
import { getSocket } from "../../services/socket";

import useConversationsStore from "../../store/useConversationsStore";

import SendMessageForm from "../SendMessageForm/SendMessageForm";
import MessageList from "./MessageList";
import ChatHeader from "./ChatHeader";
// Se você tiver modais de mídia, importe-os se usar:
import ImageModal from "./modals/ImageModal";
import PdfModal from "./modals/PdfModal";

import "./ChatWindow.css";
import "./ChatWindowPagination.css";

const PAGE_SIZE = 100;

export default function ChatWindow({ userIdSelecionado }) {
  const socket = getSocket?.();

  const {
    mergeConversation, // atualiza card
  } = useConversationsStore((s) => ({
    mergeConversation: s.mergeConversation,
  }));

  const [allMessages, setAllMessages] = useState([]);   // cache completo da conversa selecionada
  const [displayed, setDisplayed] = useState([]);       // mensagens paginadas
  const pageRef = useRef(1);
  const messageCacheRef = useRef(new Map());

  const [clienteInfo, setClienteInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef(null);

  // -------------- Helpers de paginação/scroll --------------
  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * PAGE_SIZE);
    const slice = messages.slice(startIndex);
    setDisplayed(slice);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, []);

  // -------------- Carrega conversa e cliente --------------
  const fetchConversation = useCallback(async (userId) => {
    setLoading(true);
    try {
      // Ajuste os endpoints conforme seu backend
      const [msgsRes, clienteRes] = await Promise.all([
        apiGet(`/conversations/${userId}/messages`),
        apiGet(`/clients/${userId}`),
      ]);

      const msgs = (msgsRes?.data || []).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      messageCacheRef.current.set(userId, msgs);
      setAllMessages(msgs);
      pageRef.current = 1;
      updateDisplayedMessages(msgs, 1);

      setClienteInfo({
        name: clienteRes?.data?.name || clienteRes?.name,
        phone: clienteRes?.data?.phone || clienteRes?.phone,
        channel: clienteRes?.data?.channel || clienteRes?.channel || "whatsapp",
        ticket_number: clienteRes?.data?.ticket_number || clienteRes?.ticket_number,
      });

    } catch (e) {
      console.error("Erro ao buscar conversa:", e);
    } finally {
      setLoading(false);
      // rola pro final quando carrega
      setTimeout(scrollToBottom, 50);
    }
  }, [scrollToBottom, updateDisplayedMessages]);

  // -------------- Monta/desmonta ao trocar de conversa --------------
  useEffect(() => {
    if (!userIdSelecionado) return;
    const cached = messageCacheRef.current.get(userIdSelecionado);
    if (cached) {
      setAllMessages(cached);
      pageRef.current = 1;
      updateDisplayedMessages(cached, 1);
      setTimeout(scrollToBottom, 0);
    } else {
      fetchConversation(userIdSelecionado);
    }
  }, [userIdSelecionado, fetchConversation, scrollToBottom, updateDisplayedMessages]);

  // -------------- Handlers de socket (APENAS LOCAIS) --------------
  const handleNewMessage = useCallback((message) => {
    if (!message || message.user_id !== userIdSelecionado) return;

    setAllMessages((prev) => {
      const updated = [...prev, message].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      messageCacheRef.current.set(userIdSelecionado, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });

    // não atualizamos o card aqui — o Atendimento já tem um handler GLOBAL
    // que faz o mergeConversation para todas as mensagens recebidas.
  }, [updateDisplayedMessages, userIdSelecionado]);

  const handleUpdateMessage = useCallback((payload) => {
    if (!payload || payload.user_id !== userIdSelecionado) return;

    setAllMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === payload.id ? { ...m, ...payload } : m
      );
      messageCacheRef.current.set(userIdSelecionado, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });
  }, [updateDisplayedMessages, userIdSelecionado]);

  // Registrar handlers SEM NUNCA chamar off global (correção do bug #2)
  useEffect(() => {
    if (!socket) return;

    socket.on("new_message", handleNewMessage);
    socket.on("update_message", handleUpdateMessage);

    return () => {
      try {
        socket.off("new_message", handleNewMessage);
        socket.off("update_message", handleUpdateMessage);
      } catch {}
    };
  }, [socket, handleNewMessage, handleUpdateMessage]);

  // -------------- Envio: atualização otimista + atualização do card --------------
  const onMessageAdded = useCallback(
    (tempMsg) => {
      if (!tempMsg) return;

      // 1) Atualiza o chat imediatamente (otimista)
      setAllMessages((prev) => {
        const updated = [...prev, tempMsg].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        messageCacheRef.current.set(userIdSelecionado, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      });

      // 2) Atualiza o card imediatamente
      const contentStr =
        typeof tempMsg.content === "object"
          ? tempMsg.content?.text ||
            tempMsg.content?.caption ||
            "[mensagem]"
          : tempMsg.content ?? "";

      mergeConversation?.(userIdSelecionado, {
        content: contentStr,
        timestamp: tempMsg.timestamp || new Date().toISOString(),
        channel: tempMsg.channel || "whatsapp",
        direction: "outgoing",
      });

      // 3) rolar pra baixo
      setTimeout(scrollToBottom, 0);
    },
    [mergeConversation, scrollToBottom, updateDisplayedMessages, userIdSelecionado]
  );

  // -------------- Paginação (carregar mais) --------------
  const handleLoadMore = useCallback(() => {
    const total = allMessages.length;
    const nextPage = pageRef.current + 1;
    const maxPage = Math.ceil(total / PAGE_SIZE);
    if (nextPage > maxPage) return;

    pageRef.current = nextPage;
    updateDisplayedMessages(allMessages, nextPage);
  }, [allMessages, updateDisplayedMessages]);

  const canLoadMore = useMemo(() => {
    return allMessages.length > displayed.length;
  }, [allMessages.length, displayed.length]);

  // -------------- UI --------------
  if (loading && !displayed.length) {
    return <div className="chat-window loading">Carregando…</div>;
  }

  return (
    <div className="chat-window">
      <ChatHeader cliente={clienteInfo} />

      <div className="message-list-container">
        {canLoadMore && (
          <button className="load-more" onClick={handleLoadMore}>
            Carregar mensagens anteriores
          </button>
        )}

        <MessageList messages={displayed} />
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <SendMessageForm
          userIdSelecionado={userIdSelecionado}
          // Passe SEMPRE o callback para garantir update otimista (correção do bug #1)
          onMessageAdded={onMessageAdded}
        />
      </div>

      {/* Se usar modais de mídia, mantenha-os montados/condicionais */}
      <ImageModal />
      <PdfModal />
    </div>
  );
}
