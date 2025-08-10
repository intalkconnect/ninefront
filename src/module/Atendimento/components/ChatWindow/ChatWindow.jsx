// src/components/ChatWindow/ChatWindow.jsx
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

export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation = useConversationsStore(state => state.mergeConversation);
  const setClienteAtivo = useConversationsStore(state => state.setClienteAtivo);
  const userEmail = useConversationsStore(state => state.userEmail);
  const userFilas = useConversationsStore(state => state.userFilas);

  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
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
  const messagesPerPage = 100;

  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const id = msg.id || msg.message_id;
    const timestamp = msg.timestamp || msg.created_at || msg.createdAt || msg.updated_at || new Date().toISOString();
    return { id, ...msg, timestamp };
  }, []);

  const sameMessage = useCallback((a, b) => {
    if (!a || !b) return false;
    const aid = a.id || a.message_id;
    const bid = b.id || b.message_id;
    if (aid && bid && aid === bid) return true;
    if (a.message_id && (b.id === a.message_id || b.message_id === a.message_id)) return true;
    if (b.message_id && (a.id === b.message_id || a.message_id === b.message_id)) return true;
    return false;
  }, []);

  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * messagesPerPage);
    const newMessages = messages.slice(startIndex);
    setDisplayedMessages(newMessages);
    setHasMoreMessages(startIndex > 0);
  }, []);

  const handleMessageAdded = useCallback((incomingRaw) => {
    const incoming = normalizeMessage(incomingRaw);
    const ownerId = incoming.user_id || userIdSelecionado;

    setAllMessages(prev => {
      if (prev.some(m => sameMessage(m, incoming))) {
        const updated = prev.map(m => (sameMessage(m, incoming) ? { ...m, ...incoming } : m));
        messageCacheRef.current.set(ownerId, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      }
      const updated = [...prev, incoming].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      messageCacheRef.current.set(ownerId, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });
  }, [normalizeMessage, sameMessage, updateDisplayedMessages, userIdSelecionado]);

  // Conectar socket + listeners (somente os deste componente)
  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socketRef.current = socket;

    const onNew = (raw) => {
      const msg = normalizeMessage(raw);
      if (msg.user_id !== userIdSelecionado) return;

      setAllMessages(prev => {
        if (prev.find(m => sameMessage(m, msg))) return prev;
        const updated = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        messageCacheRef.current.set(msg.user_id, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      });
    };

    const onUpdate = (raw) => {
      const msg = normalizeMessage(raw);
      if (msg.user_id !== userIdSelecionado) return;

      setAllMessages(prev => {
        const updated = prev.map(m => (sameMessage(m, msg) ? { ...m, ...msg } : m));
        messageCacheRef.current.set(msg.user_id, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      });
    };

    const onConnect = () => {
      if (userIdSelecionado) socket.emit('join_room', userIdSelecionado);
    };

    // registra (sem limpar globais!)
    socket.on('new_message', onNew);
    socket.on('update_message', onUpdate);
    socket.on('connect', onConnect);

    return () => {
      socket.off('new_message', onNew);
      socket.off('update_message', onUpdate);
      socket.off('connect', onConnect);
    };
  }, [userIdSelecionado, normalizeMessage, sameMessage, updateDisplayedMessages]);

  // join/leave ao trocar de usuário
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userIdSelecionado) return;
    socket.emit('join_room', userIdSelecionado);
    return () => {
      socket.emit('leave_room', userIdSelecionado);
    };
  }, [userIdSelecionado]);

  // carregar dados iniciais
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
          apiGet(`/messages/check-24h/${encodeURIComponent(userIdSelecionado)}`)
        ]);

        const { status, assigned_to, fila } = ticketRes || {};
        if (status !== 'open' || assigned_to !== userEmail || !userFilas?.includes(fila)) {
          console.warn('Acesso negado ao ticket deste usuário.');
          setCanSendFreeform(false);
          setAllMessages([]);
          setDisplayedMessages([]);
          setClienteInfo(null);
          setClienteAtivo(null);
          return;
        }

        const msgsNorm = (msgRes || []).map(normalizeMessage).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        messageCacheRef.current.set(userIdSelecionado, msgsNorm);
        setAllMessages(msgsNorm);
        updateDisplayedMessages(msgsNorm, 1);

        const lastMsg = msgsNorm[msgsNorm.length - 1] || {};
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
        });

        try {
          marcarMensagensAntesDoTicketComoLidas(userIdSelecionado, msgsNorm);
        } catch (e) {
          console.warn('Falha ao marcar como lidas (seguindo em frente):', e);
        }

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

        if (check24hRes && typeof check24hRes.can_send_freeform === 'boolean') {
          setCanSendFreeform(!!check24hRes.can_send_freeform);
        } else if (typeof check24hRes === 'boolean') {
          setCanSendFreeform(!!check24hRes);
        } else {
          setCanSendFreeform(true);
        }
      } catch (err) {
        console.error('Erro ao buscar cliente:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, updateDisplayedMessages, setClienteAtivo, normalizeMessage]);

  // scroll infinito (topo)
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

  // refresh ao voltar o foco da aba (só reforça listeners locais + refetch)
  useEffect(() => {
    if (!userIdSelecionado) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const socket = getSocket();
      if (!socket.connected) socket.connect();

      const onNew = (raw) => {
        const msg = normalizeMessage(raw);
        if (msg.user_id !== userIdSelecionado) return;
        setAllMessages(prev => {
          if (prev.find(m => sameMessage(m, msg))) return prev;
          const updated = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          messageCacheRef.current.set(msg.user_id, updated);
          updateDisplayedMessages(updated, pageRef.current);
          return updated;
        });
      };
      const onUpdate = (raw) => {
        const msg = normalizeMessage(raw);
        if (msg.user_id !== userIdSelecionado) return;
        setAllMessages(prev => {
          const updated = prev.map(m => (sameMessage(m, msg) ? { ...m, ...msg } : m));
          messageCacheRef.current.set(msg.user_id, updated);
          updateDisplayedMessages(updated, pageRef.current);
          return updated;
        });
      };

      socket.on('new_message', onNew);
      socket.on('update_message', onUpdate);

      (async () => {
        try {
          const msgs = await apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`);
          const msgsNorm = (msgs || []).map(normalizeMessage).sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          setAllMessages(msgsNorm);
          messageCacheRef.current.set(userIdSelecionado, msgsNorm);
          updateDisplayedMessages(msgsNorm, pageRef.current);
        } catch (err) {
          console.error('Erro ao recarregar mensagens:', err);
        }
      })();

      // limpa só os handlers deste escopo
      return () => {
        socket.off('new_message', onNew);
        socket.off('update_message', onUpdate);
      };
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userIdSelecionado, updateDisplayedMessages, normalizeMessage, sameMessage]);

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

      <div className="chat-input">
        <SendMessageForm
          userIdSelecionado={userIdSelecionado}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          canSendFreeform={canSendFreeform}
          onMessageAdded={handleMessageAdded}
        />
      </div>

      {modalImage && <ImageModal url={modalImage} onClose={() => setModalImage(null)} />}
      {pdfModal && <PdfModal url={pdfModal} onClose={() => setPdfModal(null)} />}
    </div>
  );
}
