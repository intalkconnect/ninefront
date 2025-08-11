import React, { useEffect, useRef, useState, useCallback } from 'react';
import { connectSocket, getSocket } from '../../services/socket';
import { apiGet } from '../../services/apiClient';
import useConversationsStore from '../../store/useConversationsStore';
import { marcarMensagensAntesDoTicketComoLidas } from '../../hooks/useSendMessage';

import SendMessageForm from '../SendMessageForm/SendMessageForm';
import MessageList from './MessageList';
import ImageModal from './modals/ImageModal';
import PdfModal from './modals/PdfModal';
import ChatHeader from './ChatHeader';

import './ChatWindow.css';
import './ChatWindowPagination.css';

const MESSAGES_PER_PAGE = 100;

// Normaliza qualquer formato de conteúdo para string segura de renderizar
function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed.text || parsed.caption || parsed.body || '[mensagem]';
      }
      return content;
    } catch {
      return content;
    }
  }
  if (typeof content === 'object') {
    return content.text || content.caption || content.body || '[mensagem]';
  }
  return String(content);
}

// Heurística para “casar” a mensagem oficial com a otimista
function areSameOutgoing(a, b) {
  if (!a || !b) return false;

  // melhor cenário
  if (a.client_id && b.client_id && a.client_id === b.client_id) return true;

  const bothOut = a.direction === 'outgoing' && b.direction === 'outgoing';
  if (!bothOut) return false;

  const ta = contentToText(a.content).trim().replace(/\s+/g, ' ').toLowerCase();
  const tb = contentToText(b.content).trim().replace(/\s+/g, ' ').toLowerCase();
  const sameText = ta === tb;

  const dt = Math.abs(new Date(a.timestamp) - new Date(b.timestamp));
  const closeInTime = dt < 7000; // 7s cobre latência/clock

  return sameText && closeInTime;
}

export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation   = useConversationsStore(state => state.mergeConversation);
  const setClienteAtivo     = useConversationsStore(state => state.setClienteAtivo);
  const userEmail           = useConversationsStore(state => state.userEmail);
  const userFilas           = useConversationsStore(state => state.userFilas);

  const [allMessages, setAllMessages]         = useState([]);
  const [displayedMessages, setDisplayed]     = useState([]);
  const [modalImage, setModalImage]           = useState(null);
  const [pdfModal, setPdfModal]               = useState(null);
  const [clienteInfo, setClienteInfo]         = useState(null);
  const [isLoading, setIsLoading]             = useState(false);
  const [replyTo, setReplyTo]                 = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [canSendFreeform, setCanSendFreeform] = useState(true);

  const messageListRef = useRef(null);
  const loaderRef      = useRef(null);
  const socketRef      = useRef(null);
  const pageRef        = useRef(1);
  const messageCacheRef= useRef(new Map());
  const bottomRef      = useRef(null);

  // paginação
  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * MESSAGES_PER_PAGE);
    const slice = messages.slice(startIndex);
    setDisplayed(slice);
    setHasMoreMessages(startIndex > 0);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, []);

  // conecta socket (idempotente)
  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socketRef.current = socket;
  }, []);

  // ===== Handlers de socket (locais) =====
  const handleNewMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      // 1) já existe por id?
      if (prev.some(m => m.id && m.id === msg.id)) return prev;

      // 2) existe uma otimista parecida? -> substitui (mesmo balão evolui)
      const idxApprox = prev.findIndex(m => m.pending === true && areSameOutgoing(m, msg));
      if (idxApprox >= 0) {
        const clone = [...prev];
        clone[idxApprox] = { ...clone[idxApprox], ...msg, pending: false };
        clone.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        return clone;
      }

      // 3) senão, adiciona normal
      const updated = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      messageCacheRef.current.set(msg.user_id, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });
  }, [userIdSelecionado, updateDisplayedMessages]);

  const handleUpdateMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      // 1) por id
      const idxById = prev.findIndex(m => m.id && m.id === msg.id);
      if (idxById >= 0) {
        const clone = [...prev];
        clone[idxById] = { ...clone[idxById], ...msg, pending: false };
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        return clone;
      }
      // 2) conciliação com otimista
      const idxApprox = prev.findIndex(m => m.pending === true && areSameOutgoing(m, msg));
      if (idxApprox >= 0) {
        const clone = [...prev];
        clone[idxApprox] = { ...clone[idxApprox], ...msg, pending: false };
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        return clone;
      }
      return prev;
    });
  }, [userIdSelecionado, updateDisplayedMessages]);

  // registra/deregistra listeners locais
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('new_message', handleNewMessage);
    socket.on('update_message', handleUpdateMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('update_message', handleUpdateMessage);
    };
  }, [handleNewMessage, handleUpdateMessage]);

  // ===== Salas =====
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userIdSelecionado) return;
    socket.emit('join_room', userIdSelecionado);
    return () => {
      socket.emit('leave_room', userIdSelecionado);
    };
  }, [userIdSelecionado]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onConnect = () => {
      if (userIdSelecionado) socket.emit('join_room', userIdSelecionado);
    };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [userIdSelecionado]);

  // ===== Carregamento quando troca de usuário =====
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
        if (status !== 'open' || assigned_to !== userEmail || !(userFilas || []).includes(fila)) {
          console.warn('Acesso negado ao ticket deste usuário.');
          setIsLoading(false);
          return;
        }

        const msgs = Array.isArray(msgRes) ? msgRes : (msgRes?.data || []);
        msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        messageCacheRef.current.set(userIdSelecionado, msgs);
        setAllMessages(msgs);
        updateDisplayedMessages(msgs, 1);

        const lastMsg = msgs[msgs.length - 1] || {};
        mergeConversation(userIdSelecionado, {
          channel: lastMsg.channel || clienteRes?.channel || 'desconhecido',
          ticket_number: clienteRes?.ticket_number || '000000',
          fila: clienteRes?.fila || fila || 'Orçamento',
          name: clienteRes?.name || userIdSelecionado,
          email: clienteRes?.email || '',
          phone: clienteRes?.phone || '',
          documento: clienteRes?.document || '',
          user_id: clienteRes?.user_id || userIdSelecionado,
          assigned_to,
          status,
          content: contentToText(lastMsg?.content),
          timestamp: lastMsg?.timestamp,
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
        console.error('Erro ao buscar cliente/conversa:', err);
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
  ]);

  // ===== Infinito: carrega página anterior ao chegar no topo =====
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

  // ===== Voltar para aba: garante conexão e refresh das mensagens =====
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();

      (async () => {
        try {
          const msgs = await apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`);
          const arr = Array.isArray(msgs) ? msgs : (msgs?.data || []);
          arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          setAllMessages(arr);
          messageCacheRef.current.set(userIdSelecionado, arr);
          updateDisplayedMessages(arr, pageRef.current);
        } catch (err) {
          console.error('Erro ao recarregar mensagens:', err);
        }
      })();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userIdSelecionado, updateDisplayedMessages]);

  // ===== Envio otimista + update do card + limpar reply =====
  const onMessageAdded = useCallback((tempMsg) => {
    if (!tempMsg) return;

    // gera um client_id local para auxiliar a conciliação quando o servidor responder
    const client_id = tempMsg.client_id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const optimistic = { ...tempMsg, pending: true, direction: 'outgoing', client_id };

    setAllMessages(prev => {
      const updated = [...prev, optimistic].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      messageCacheRef.current.set(userIdSelecionado, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });

    // atualiza card já com texto normalizado
    mergeConversation(userIdSelecionado, {
      content: contentToText(tempMsg.content),
      timestamp: tempMsg.timestamp || new Date().toISOString(),
      channel: tempMsg.channel || 'whatsapp',
      direction: 'outgoing',
    });

    // garante que não fique preso em reply
    setReplyTo(null);

    // rola pro fim
    setTimeout(scrollToBottom, 0);
  }, [mergeConversation, updateDisplayedMessages, userIdSelecionado, scrollToBottom]);

  // ===== Render =====
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
        <div className="loading-container"><div className="spinner"/></div>
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
