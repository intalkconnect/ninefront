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

// ---------- helpers ----------
function contentToText(content) {
  if (content == null) return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return parsed.text || parsed.caption || parsed.body || '[mensagem]';
      }
      return content;
    } catch { return content; }
  }
  if (typeof content === 'object') {
    return content.text || content.caption || content.body || '[mensagem]';
  }
  return String(content);
}

const STATUS_RANK = { read: 5, delivered: 4, sent: 3, pending: 2, error: 1, undefined: 0, null: 0 };

function rankStatus(s) { return STATUS_RANK[s] ?? 0; }

function normText(x) {
  return contentToText(x).trim().replace(/\s+/g, ' ').toLowerCase();
}

function isOutgoing(m) { return m?.direction === 'outgoing'; }

function closeInTime(a, b, windowMs = 15000) { // 15s p/ cobrir atrasos
  const ta = new Date(a.timestamp).getTime();
  const tb = new Date(b.timestamp).getTime();
  return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= windowMs;
}

// mesma mensagem? (client_id ou mesmo texto e tempo próximo)
function isSameOutgoing(a, b) {
  if (!a || !b || !isOutgoing(a) || !isOutgoing(b)) return false;
  if (a.client_id && b.client_id && a.client_id === b.client_id) return true;
  if (!closeInTime(a, b)) return false;
  return normText(a.content) === normText(b.content);
}

// mescla campos, priorizando a “melhor” (status maior, id real etc.)
function mergeOutgoing(a, b) {
  // define quem tem melhor status
  const first = rankStatus(a.status) >= rankStatus(b.status) ? a : b;
  const second = first === a ? b : a;

  return {
    ...first,
    id: first.id || second.id,
    client_id: first.client_id || second.client_id,
    pending: (first.pending && !first.id) ? true : false,
    // mantém timestamp do servidor se vier
    timestamp: first.id ? first.timestamp : (second.id ? second.timestamp : first.timestamp),
    // conserva content normalizado do melhor
    content: first.content ?? second.content,
    // conserva possíveis metadados úteis
    channel: first.channel || second.channel,
    reply_to: first.reply_to ?? second.reply_to,
    reply_direction: first.reply_direction ?? second.reply_direction,
  };
}

// garante que ao inserir/atualizar um outgoing não crie duplicata
function upsertOutgoing(list, msg) {
  const byId = msg.id ? list.findIndex(m => m.id === msg.id) : -1;
  if (byId >= 0) {
    const clone = [...list];
    clone[byId] = mergeOutgoing(clone[byId], msg);
    return clone;
  }

  // procura similar entre as últimas N (economiza)
  const N = 20;
  for (let i = Math.max(0, list.length - N); i < list.length; i++) {
    const m = list[i];
    if (isSameOutgoing(m, msg)) {
      const clone = [...list];
      clone[i] = mergeOutgoing(m, msg);
      return clone;
    }
  }

  // senão, adiciona e ordena
  const added = [...list, msg];
  added.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
  return added;
}

// ---------- componente ----------
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

  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * MESSAGES_PER_PAGE);
    const slice = messages.slice(startIndex);
    setDisplayed(slice);
    setHasMoreMessages(startIndex > 0);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    socketRef.current = socket;
  }, []);

  // ------ socket handlers ------
  const handleNewMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      // se já existe por id, atualiza e sai
      if (msg.id && prev.some(m => m.id === msg.id)) {
        const clone = prev.map(m => (m.id === msg.id ? mergeOutgoing(m, msg) : m));
        messageCacheRef.current.set(msg.user_id, clone);
        updateDisplayedMessages(clone, pageRef.current);
        return clone;
      }

      // trata outgoing: upsert sem duplicar
      if (isOutgoing(msg)) {
        const next = upsertOutgoing(prev, { ...msg, pending: false });
        messageCacheRef.current.set(msg.user_id, next);
        updateDisplayedMessages(next, pageRef.current);
        return next;
      }

      // incoming normal: adiciona
      const updated = [...prev, msg].sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
      messageCacheRef.current.set(msg.user_id, updated);
      updateDisplayedMessages(updated, pageRef.current);
      return updated;
    });
  }, [userIdSelecionado, updateDisplayedMessages]);

  const handleUpdateMessage = useCallback((msg) => {
    if (!msg || msg.user_id !== userIdSelecionado) return;

    setAllMessages(prev => {
      // por id
      if (msg.id) {
        const idx = prev.findIndex(m => m.id === msg.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = mergeOutgoing(clone[idx], msg);
          messageCacheRef.current.set(msg.user_id, clone);
          updateDisplayedMessages(clone, pageRef.current);
          return clone;
        }
      }

      // sem id ou não achou: se for outgoing, tenta conciliar por similaridade
      if (isOutgoing(msg)) {
        const next = upsertOutgoing(prev, { ...msg, pending: false });
        messageCacheRef.current.set(msg.user_id, next);
        updateDisplayedMessages(next, pageRef.current);
        return next;
      }

      return prev;
    });
  }, [userIdSelecionado, updateDisplayedMessages]);

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

  // ------ rooms ------
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !userIdSelecionado) return;
    socket.emit('join_room', userIdSelecionado);
    return () => socket.emit('leave_room', userIdSelecionado);
  }, [userIdSelecionado]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onConnect = () => { if (userIdSelecionado) socket.emit('join_room', userIdSelecionado); };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [userIdSelecionado]);

  // ------ load on user change ------
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
        msgs.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));

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

  // ------ infinite scroll ------
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

  // ------ tab visible refresh ------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();

      (async () => {
        try {
          const msgs = await apiGet(`/messages/${encodeURIComponent(userIdSelecionado)}`);
          const arr = Array.isArray(msgs) ? msgs : (msgs?.data || []);
          arr.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
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

  // ------ envio otimista ------
  const onMessageAdded = useCallback((tempMsg) => {
    if (!tempMsg) return;

    const client_id = tempMsg.client_id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const optimistic = {
      ...tempMsg,
      pending: true,
      direction: 'outgoing',
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
      channel: tempMsg.channel || 'whatsapp',
      direction: 'outgoing',
    });

    setReplyTo(null);
    setTimeout(scrollToBottom, 0);
  }, [mergeConversation, updateDisplayedMessages, userIdSelecionado, scrollToBottom]);

  // ------ render ------
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
