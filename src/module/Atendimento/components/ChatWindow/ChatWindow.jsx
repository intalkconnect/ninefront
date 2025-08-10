import React, { useEffect, useRef, useState, useCallback } from 'react';
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

import { on } from '../../services/sse';

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

  // “forçadores” de re-render quando a lista muda
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [messageVersion, setMessageVersion] = useState(0);

  const messageListRef = useRef(null);
  const loaderRef = useRef(null);
  const pageRef = useRef(1);
  const messageCacheRef = useRef(new Map());
  const messagesPerPage = 100;

  // ---------- Helpers de normalização/identificação ----------
  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const id = msg.id || msg.message_id;
    const timestamp =
      msg.timestamp ||
      msg.created_at ||
      msg.createdAt ||
      msg.updated_at ||
      new Date().toISOString();
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

  const sameUser = (a, b) => String(a) === String(b);

  // tenta deduzir o "dono" da msg quando o backend varia o campo
  const getPossibleOwner = (msg) =>
    msg?.user_id ??
    msg?.owner_id ??
    msg?.client_id ??
    msg?.chat_id ??
    msg?.whatsapp_user_id ??
    msg?.from_user_id ??
    msg?.to_user_id ??
    null;

  // se não há dono claro, assumimos que pertence ao chat aberto
  const belongsToCurrent = (msg, uid) => {
    const candidate = getPossibleOwner(msg);
    if (candidate == null) return true;
    return sameUser(candidate, uid);
  };

  const updateDisplayedMessages = useCallback((messages, page) => {
    const startIndex = Math.max(0, messages.length - page * messagesPerPage);
    const newMessages = messages.slice(startIndex);
    setDisplayedMessages(newMessages);
    setHasMoreMessages(startIndex > 0);

    // Forçar atualização do MessageList
    setLastUpdate(Date.now());
  }, []);

  const handleMessageAdded = useCallback((incomingRaw) => {
    const base = normalizeMessage(incomingRaw);
    const ownerId = String(getPossibleOwner(base) ?? userIdSelecionado);
    // garantimos que a mensagem tenha um user_id consistente
    const incoming = { user_id: ownerId, ...base };

    setAllMessages(prev => {
      const existingIndex = prev.findIndex(m => sameMessage(m, incoming));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...incoming };
        messageCacheRef.current.set(ownerId, updated);
        updateDisplayedMessages(updated, pageRef.current);
        setMessageVersion(v => v + 1);
        return updated;
      }

      const updated = [...prev, incoming].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      messageCacheRef.current.set(ownerId, updated);
      updateDisplayedMessages(updated, pageRef.current);
      setMessageVersion(v => v + 1);
      return updated;
    });
  }, [normalizeMessage, sameMessage, updateDisplayedMessages, userIdSelecionado]);

  // ---------- Carregar dados iniciais ----------
  useEffect(() => {
    if (!userIdSelecionado) return;
    pageRef.current = 1;
    setIsLoading(true);

    const loadInitialData = async () => {
      try {
        const [msgRes, clienteRes, ticketRes, check24hRes] = await Promise.all([
          apiGet(`/api/v1/messages/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/api/v1/clientes/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/api/v1/tickets/${encodeURIComponent(userIdSelecionado)}`),
          apiGet(`/api/v1/messages/check-24h/${encodeURIComponent(userIdSelecionado)}`)
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

        messageCacheRef.current.set(String(userIdSelecionado), msgsNorm);
        setAllMessages(msgsNorm);
        updateDisplayedMessages(msgsNorm, 1);

        const lastMsg = msgsNorm[msgsNorm.length - 1] || {};
        mergeConversation(String(userIdSelecionado), {
          channel: lastMsg.channel || clienteRes?.channel,
          ticket_number: clienteRes?.ticket_number || '000000',
          fila: clienteRes?.fila || fila,
          name: clienteRes?.name || String(userIdSelecionado),
          email: clienteRes?.email || '',
          phone: clienteRes?.phone || '',
          documento: clienteRes?.document || '',
          user_id: clienteRes?.user_id || String(userIdSelecionado),
          assigned_to,
          status,
        });

        try {
          marcarMensagensAntesDoTicketComoLidas(userIdSelecionado, msgsNorm);
        } catch (e) {
          console.warn('Falha ao marcar como lidas:', e);
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
    };

    loadInitialData();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, updateDisplayedMessages, setClienteAtivo, normalizeMessage]);

  // ---------- Scroll infinito (topo) ----------
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        pageRef.current += 1;
        const cached = messageCacheRef.current.get(String(userIdSelecionado)) || [];
        updateDisplayedMessages(cached, pageRef.current);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, userIdSelecionado, updateDisplayedMessages]);

  // ---------- Refetch ao voltar foco (sincronismo) ----------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      (async () => {
        try {
          const msgs = await apiGet(`/api/v1/messages/${encodeURIComponent(userIdSelecionado)}`);
          const msgsNorm = (msgs || []).map(normalizeMessage).sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          setAllMessages(msgsNorm);
          messageCacheRef.current.set(String(userIdSelecionado), msgsNorm);
          updateDisplayedMessages(msgsNorm, pageRef.current);
        } catch (err) {
          console.error('Erro ao recarregar mensagens:', err);
        }
      })();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userIdSelecionado, updateDisplayedMessages, normalizeMessage]);

  // ---------- SSE: agora “relaxado” e robusto ----------
  useEffect(() => {
    if (!userIdSelecionado) return;
    const uid = String(userIdSelecionado);

    const wrap = (raw) => {
      const msg = normalizeMessage(raw);
      if (!belongsToCurrent(msg, uid)) return;

      // Se o evento vier sem user_id, forçamos para a conversa aberta:
      // msg.user_id = uid; // <— deixe assim comentado para você ligar/desligar ao testar

      // Mantém Sidebar sincronizado: atualiza o “card” com resumo
      try {
        mergeConversation(uid, {
          user_id: uid,
          content:
            typeof msg.content === 'string'
              ? msg.content
              : (msg.content?.text ?? ''),
          timestamp: msg.timestamp,
          channel: msg.channel,
        });
      } catch {}

      handleMessageAdded(msg);
    };

    const offNew    = on('new_message',    wrap);
    const offStatus = on('message_status', wrap);
    const offUpdate = on('update_message', wrap);

    return () => {
      offNew?.();
      offStatus?.();
      offUpdate?.();
    };
  }, [userIdSelecionado, normalizeMessage, handleMessageAdded, mergeConversation]);

  // ---------- Render ----------
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
    <div className="chat-window" key={`chat-${userIdSelecionado}-${lastUpdate}`}>
      <ChatHeader userIdSelecionado={userIdSelecionado} clienteInfo={clienteInfo} />

      <MessageList
        key={`${userIdSelecionado}-${messageVersion}`}
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
