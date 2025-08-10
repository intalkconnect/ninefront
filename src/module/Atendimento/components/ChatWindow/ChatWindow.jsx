import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

import { joinUserRoom } from '../../services/sse';

const PAGE_SIZE = 100;

export default function ChatWindow({ userIdSelecionado }) {
  // ----- Store
  const mergeConversation = useConversationsStore(s => s.mergeConversation);
  const setClienteAtivo  = useConversationsStore(s => s.setClienteAtivo);
  const appendMessage    = useConversationsStore(s => s.appendMessage);
  const userEmail        = useConversationsStore(s => s.userEmail);
  const userFilas        = useConversationsStore(s => s.userFilas);

  const conversation     = useConversationsStore(
    s => s.conversations?.[String(userIdSelecionado)] || {}
  );
  const messagesFromStore = conversation.messages || [];

  // ----- Estado de UI
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal]     = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [replyTo, setReplyTo]       = useState(null);
  const [canSendFreeform, setCanSendFreeform] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const messageListRef = useRef(null);
  const loaderRef      = useRef(null);

  // ----- Helpers
  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const id = msg.id || msg.message_id;
    const timestamp = msg.timestamp || msg.created_at || msg.createdAt || msg.updated_at || new Date().toISOString();
    return { id, ...msg, timestamp };
  }, []);

  const makeKey = useCallback((m) => {
    const contentStr = typeof m?.content === 'string'
      ? m.content
      : (m?.content?.text ?? JSON.stringify(m?.content ?? ''));
    return (
      m?.id ||
      m?.message_id ||
      `${m?.whatsapp_message_id || ''}::${m?.timestamp || ''}::${m?.direction || ''}::${(contentStr || '').slice(0, 50)}`
    );
  }, []);

  const addMessagesToStore = useCallback((uidStr, msgs) => {
    const current = useConversationsStore.getState().conversations?.[uidStr]?.messages || [];
    const existingKeys = new Set(current.map(makeKey));
    for (const raw of msgs) {
      const m = normalizeMessage(raw);
      const k = makeKey(m);
      if (!existingKeys.has(k)) {
        appendMessage(uidStr, m);
        existingKeys.add(k);
      }
    }
  }, [appendMessage, makeKey, normalizeMessage]);

  // Ordenação (asc) e paginação
  const messagesSorted = useMemo(() => {
    const arr = (messagesFromStore || []).slice();
    arr.sort((a, b) => new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0));
    return arr;
  }, [messagesFromStore]);

  const visibleMessages = useMemo(() => {
    const total = messagesSorted.length;
    if (!total) return [];
    const start = Math.max(0, total - visibleCount);
    return messagesSorted.slice(start);
  }, [messagesSorted, visibleCount]);

  const hasMoreMessages = messagesSorted.length > visibleCount;

  // ----- Entrar na sala do usuário no SSE
  useEffect(() => {
    if (!userIdSelecionado) return;
    const uid = String(userIdSelecionado);
    console.log('[SSE][ChatWindow] joinUserRoom ->', uid);
    joinUserRoom(uid);
  }, [userIdSelecionado]);

  // ----- Fetch inicial (cliente/ticket/mensagens) -> injeta na STORE (com dedupe)
  useEffect(() => {
    if (!userIdSelecionado) return;
    setIsLoading(true);
    setVisibleCount(PAGE_SIZE); // reset paginação a cada troca de conversa

    const load = async () => {
      try {
        const uidStr = String(userIdSelecionado);
        const uidEnc = encodeURIComponent(userIdSelecionado);

        const [msgRes, clienteRes, ticketRes, check24hRes] = await Promise.all([
          apiGet(`/api/v1/messages/${uidEnc}`),
          apiGet(`/api/v1/clientes/${uidEnc}`),
          apiGet(`/api/v1/tickets/${uidEnc}`),
          apiGet(`/api/v1/messages/check-24h/${uidEnc}`)
        ]);

        const { status, assigned_to, fila } = ticketRes || {};
        if (status !== 'open' || assigned_to !== userEmail || !userFilas?.includes(fila)) {
          console.warn('Acesso negado ao ticket deste usuário.');
          setCanSendFreeform(false);
          setClienteInfo(null);
          setClienteAtivo(null);
          return;
        }

        const msgsNorm = (msgRes || [])
          .map(normalizeMessage)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // injeta mensagens na store (dedupe)
        addMessagesToStore(uidStr, msgsNorm);

        // metadados da conversa
        const lastMsg = msgsNorm[msgsNorm.length - 1] || {};
        mergeConversation(uidStr, {
          channel: lastMsg.channel || clienteRes?.channel || 'desconhecido',
          ticket_number: clienteRes?.ticket_number || '000000',
          fila: clienteRes?.fila || fila || 'Orçamento',
          name: clienteRes?.name || uidStr,
          email: clienteRes?.email || '',
          phone: clienteRes?.phone || '',
          documento: clienteRes?.document || '',
          user_id: clienteRes?.user_id || uidStr,
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

    load();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, setClienteAtivo, normalizeMessage, addMessagesToStore]);

  // ----- Refetch ao voltar a aba visível -> atualiza a STORE (dedupe)
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      try {
        const uidStr = String(userIdSelecionado);
        const uidEnc = encodeURIComponent(userIdSelecionado);
        const msgs = await apiGet(`/api/v1/messages/${uidEnc}`);
        const msgsNorm = (msgs || [])
          .map(normalizeMessage)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        addMessagesToStore(uidStr, msgsNorm);
      } catch (err) {
        console.error('Erro ao recarregar mensagens:', err);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [userIdSelecionado, normalizeMessage, addMessagesToStore]);

  // ----- Infinite scroll (carregar mais antigas ao chegar no topo)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, messagesSorted.length));
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, messagesSorted.length]);

  // ----- Envio otimista: injeta na store e faz scroll
  const handleMessageAdded = useCallback((raw) => {
    const msg = normalizeMessage(raw);
    const uidStr = String(msg.user_id || userIdSelecionado);
    appendMessage(uidStr, msg);
    if (messageListRef.current) {
      messageListRef.current.setAutoScrollEnabled(true);
      messageListRef.current.scrollToBottomSmooth();
    }
  }, [appendMessage, normalizeMessage, userIdSelecionado]);

  // ----- Render
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
        messages={visibleMessages}
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
