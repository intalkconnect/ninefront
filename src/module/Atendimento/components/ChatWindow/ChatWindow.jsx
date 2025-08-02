import React, { useEffect, useRef, useState, useCallback } from "react";
import { connectSocket, getSocket } from "../../../../services/socket";
import { apiGet } from "../../../../services/apiClient";
import useConversationsStore from "../../../../store/useConversationsStore";
import { useStableSocketListeners } from "../../../../hooks/useStableSocketListeners";
import { notifyUser } from "../../../../utils/notifications";

import SendMessageForm from "../SendMessageForm/SendMessageForm";
import MessageList from "./MessageList";
import ImageModal from "./modals/ImageModal";
import PdfModal from "./modals/PdfModal";
import ChatHeader from "./ChatHeader";

import "./ChatWindow.css";
import "./ChatWindowPagination.css";

const MESSAGES_PER_PAGE = 100;

export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation = useConversationsStore((s) => s.mergeConversation);
  const setClienteAtivo = useConversationsStore((s) => s.setClienteAtivo);

  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  const userEmail = useConversationsStore((s) => s.userEmail);
  const userFilas = useConversationsStore((s) => s.userFilas);

  const messageListRef = useRef(null);
  const loaderRef = useRef(null);
  const pageRef = useRef(1);
  const messageCacheRef = useRef(new Map());

  // Atualização otimizada: não faz sort toda vez
  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * MESSAGES_PER_PAGE);
    setDisplayedMessages(messages.slice(startIndex));
    setHasMoreMessages(startIndex > 0);
  }, []);

  // Novo handler otimizado para mensagem nova
  const handleNewMessage = useCallback((msg) => {
    setAllMessages((prev) => {
      if (prev.find((m) => m.id === msg.id)) return prev;
      // Insere ordenado se necessário
      let updated;
      if (!prev.length || new Date(msg.timestamp) >= new Date(prev[prev.length-1]?.timestamp)) {
        updated = [...prev, msg];
      } else {
        updated = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
      messageCacheRef.current.set(msg.user_id, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });

    // Notificação (fora de foco)
    if (document.visibilityState !== "visible") {
      notifyUser({
        title: "Nova mensagem",
        body: msg.content?.text || msg.content || "[Mensagem]",
        icon: "/icons/whatsapp.png"
      });
    }
  }, [updateDisplayedMessages]);

  // Handler para atualização de mensagem
  const handleUpdateMessage = useCallback((msg) => {
    setAllMessages((prev) => {
      const updated = prev.map((m) => (m.id === msg.id ? msg : m));
      messageCacheRef.current.set(msg.user_id, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });
  }, [updateDisplayedMessages]);

  // Listeners sempre fresh!
  useStableSocketListeners({
    userId: userIdSelecionado,
    onNew: handleNewMessage,
    onUpdate: handleUpdateMessage,
  });

  // Join na sala ao trocar de usuário
  useEffect(() => {
    const socket = getSocket();
    if (!userIdSelecionado) return;
    socket.emit("join_room", userIdSelecionado);
    return () => socket.emit("leave_room", userIdSelecionado);
  }, [userIdSelecionado]);

  // Carrega as mensagens iniciais ao selecionar usuário
  useEffect(() => {
    if (!userIdSelecionado) return;
    setIsLoading(true);
    pageRef.current = 1;

    (async () => {
      try {
        const [msgRes, clienteRes, ticketRes] = await Promise.all([
          apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/clientes/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/tickets/${encodeURIComponent(userIdSelecionado)}`),
        ]);
        const { status, assigned_to, fila } = ticketRes;
        if (status !== "open" || assigned_to !== userEmail || !userFilas.includes(fila)) {
          setAllMessages([]);
          setDisplayedMessages([]);
          setHasMoreMessages(false);
          return;
        }
        messageCacheRef.current.set(userIdSelecionado, msgRes);
        setAllMessages(msgRes);
        updateDisplayedMessages(msgRes, 1);

        const lastMsg = msgRes[msgRes.length - 1] || {};
        mergeConversation(userIdSelecionado, {
          channel: lastMsg.channel || clienteRes.channel || "desconhecido",
          ticket_number: clienteRes.ticket_number || "000000",
          fila: clienteRes.fila || fila || "Orçamento",
          name: clienteRes.name || userIdSelecionado,
          assigned_to, status,
        });
        setClienteInfo({
          name: clienteRes.name,
          phone: clienteRes.phone,
          channel: clienteRes.channel,
          ticket_number: clienteRes.ticket_number,
          fila: clienteRes.fila,
          assigned_to, status,
        });
        setClienteAtivo(clienteRes);
      } catch (err) {
        setAllMessages([]);
        setDisplayedMessages([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, setClienteAtivo, updateDisplayedMessages]);

  // Scroll infinito otimizado
  useEffect(() => {
    const observer = new window.IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        pageRef.current += 1;
        const cached = messageCacheRef.current.get(userIdSelecionado) || [];
        updateDisplayedMessages(cached, pageRef.current);
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => loaderRef.current && observer.disconnect();
  }, [hasMoreMessages, userIdSelecionado, updateDisplayedMessages]);

  // Limpeza ao trocar usuário
  useEffect(() => {
    setReplyTo(null);
    setModalImage(null);
    setPdfModal(null);
  }, [userIdSelecionado]);

  // Renderização
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
      <div className="chat-input">
        <SendMessageForm
          userIdSelecionado={userIdSelecionado}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
        />
      </div>
      {modalImage && <ImageModal url={modalImage} onClose={() => setModalImage(null)} />}
      {pdfModal && <PdfModal url={pdfModal} onClose={() => setPdfModal(null)} />}
    </div>
  );
}
