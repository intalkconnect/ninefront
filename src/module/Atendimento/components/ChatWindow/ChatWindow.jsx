import React, { useEffect, useRef, useState, useCallback } from 'react';
import { connectSocket, getSocket } from '../../services/socket';
import { apiGet } from '../../services/apiClient';
import useConversationsStore from '../../store/useConversationsStore';

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

  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  const userEmail = useConversationsStore(state => state.userEmail);
  const userFilas = useConversationsStore(state => state.userFilas);

  const messageListRef = useRef(null);
  const loaderRef = useRef(null);
  const socketRef = useRef(null);
  const pageRef = useRef(1);
  const messageCacheRef = useRef(new Map());
  const messagesPerPage = 100;

  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * messagesPerPage);
    const newMessages = messages.slice(startIndex);
    setDisplayedMessages(newMessages);
    setHasMoreMessages(startIndex > 0);
  }, []);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socketRef.current = socket;
    return () => {
      socket.off('new_message');
      socket.off('update_message');
    };
  }, []);

  useEffect(() => {
  const socket = socketRef.current;
  if (!socket) return;

  // Quando reconectar, entra novamente na sala do usuário selecionado
  const handleReconnect = () => {
    if (userIdSelecionado) {
      console.log('Socket reconectado! Reentrando na sala:', userIdSelecionado);
      socket.emit('join_room', userIdSelecionado);
    }
  };

  socket.on('connect', handleReconnect);

  return () => {
    socket.off('connect', handleReconnect);
  };
}, [userIdSelecionado]);


  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleNew = (msg) => {
      if (msg.user_id !== userIdSelecionado) return;
      setAllMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        messageCacheRef.current.set(msg.user_id, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      });
    };

    const handleUpdate = (msg) => {
      if (msg.user_id !== userIdSelecionado) return;
      setAllMessages(prev => {
        const updated = prev.map(m => m.id === msg.id ? msg : m);
        messageCacheRef.current.set(msg.user_id, updated);
        updateDisplayedMessages(updated, pageRef.current);
        return updated;
      });
    };

    socket.on('new_message', handleNew);
    socket.on('update_message', handleUpdate);
    return () => {
      socket.off('new_message', handleNew);
      socket.off('update_message', handleUpdate);
    };
  }, [userIdSelecionado, updateDisplayedMessages]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userIdSelecionado) return;
    socket.emit('join_room', userIdSelecionado);
    return () => {
      socket.emit('leave_room', userIdSelecionado);
    };
  }, [userIdSelecionado]);

  useEffect(() => {
    if (!userIdSelecionado) return;
    pageRef.current = 1;
    setIsLoading(true);

    (async () => {
      try {
        const [msgRes, clienteRes, ticketRes] = await Promise.all([
          apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/clientes/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/tickets/${encodeURIComponent(userIdSelecionado)}`),
        ]);

        const { status, assigned_to, fila } = ticketRes;
        if (status !== 'open' || assigned_to !== userEmail || !userFilas.includes(fila)) {
          console.warn('Acesso negado ao ticket deste usuário.');
          return;
        }

        const msgs = msgRes;
        messageCacheRef.current.set(userIdSelecionado, msgs);
        setAllMessages(msgs);
        updateDisplayedMessages(msgs, 1);

        const lastMsg = msgs[msgs.length - 1] || {};
        mergeConversation(userIdSelecionado, {
          channel: lastMsg.channel || clienteRes.channel || 'desconhecido',
          ticket_number: clienteRes.ticket_number || '000000',
          fila: clienteRes.fila || fila || 'Orçamento',
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
        console.error('Erro ao buscar cliente:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, updateDisplayedMessages, setClienteAtivo]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        pageRef.current += 1;
        const cached = messageCacheRef.current.get(userIdSelecionado) || [];
        updateDisplayedMessages(cached, pageRef.current);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => loaderRef.current && observer.disconnect();
  }, [hasMoreMessages, userIdSelecionado, updateDisplayedMessages]);

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
        />
      </div>

      {modalImage && <ImageModal url={modalImage} onClose={() => setModalImage(null)} />}
      {pdfModal && <PdfModal url={pdfModal} onClose={() => setPdfModal(null)} />}
    </div>
  );
}
