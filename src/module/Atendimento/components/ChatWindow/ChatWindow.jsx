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

export default function ChatWindow({ userIdSelecionado }) {
  // ----- Store
  const setConversation  = useConversationsStore(s => s.setConversation);
  const mergeConversation = useConversationsStore(s => s.mergeConversation);
  const setClienteAtivo  = useConversationsStore(s => s.setClienteAtivo);
  const userEmail        = useConversationsStore(s => s.userEmail);
  const userFilas        = useConversationsStore(s => s.userFilas);

  // IMPORTANTe: evite retornar {} novo a cada render quando não há conversa
  const conversation = useConversationsStore(
    s => (userIdSelecionado ? s.conversations?.[String(userIdSelecionado)] ?? null : null)
  );
  const messagesFromStore = conversation?.messages ?? [];

  // ----- UI
  const [modalImage, setModalImage]   = useState(null);
  const [pdfModal, setPdfModal]       = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [replyTo, setReplyTo]         = useState(null);
  const [canSendFreeform, setCanSendFreeform] = useState(true);

  const messageListRef = useRef(null);

  // ----- Helpers
  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const id = msg.id || msg.message_id;
    const timestamp =
      msg.timestamp || msg.created_at || msg.createdAt || msg.updated_at || new Date().toISOString();
    return { id, ...msg, timestamp };
  }, []);

  const buildKey = useCallback((m) => {
    const contentStr =
      typeof m?.content === 'string'
        ? m.content
        : (m?.content?.text ?? (m?.content ? JSON.stringify(m.content) : ''));
    return (
      m?.id ||
      m?.message_id ||
      m?.whatsapp_message_id ||
      `${m?.timestamp || ''}-${m?.direction || ''}-${(contentStr || '').slice(0, 64)}`
    );
  }, []);

  // Upsert de mensagens na STORE em lote (ou unitário)
  const upsertMessages = useCallback((uidStr, incomingRaw) => {
    const incoming = Array.isArray(incomingRaw) ? incomingRaw : [incomingRaw];
    const norm = incoming.map(normalizeMessage);

    const state = useConversationsStore.getState();
    const prev  = state.conversations?.[uidStr]?.messages || [];

    const map = new Map();
    for (const m of prev) map.set(buildKey(m), m);
    for (const m of norm) {
      const k = buildKey(m);
      map.set(k, { ...map.get(k), ...m }); // overwrite/merge
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0)
    );

    // 1 só set na store -> evita cascata de renders
    setConversation(uidStr, { messages: merged });
  }, [setConversation, normalizeMessage, buildKey]);

  // Ordenação final só para passar ao filho (ele próprio tem paginação)
  const messagesSorted = useMemo(() => {
    const arr = messagesFromStore.slice();
    arr.sort((a, b) => new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0));
    return arr;
  }, [messagesFromStore]);

  // ----- SSE: entrar na sala do usuário
  useEffect(() => {
    if (!userIdSelecionado) return;
    const uid = String(userIdSelecionado);
    console.log('[SSE][ChatWindow] joinUserRoom ->', uid);
    joinUserRoom(uid);
  }, [userIdSelecionado]);

  // ----- Fetch inicial: cliente/ticket/mensagens -> upsert em lote
  useEffect(() => {
    if (!userIdSelecionado) return;
    setIsLoading(true);

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

        upsertMessages(uidStr, msgRes || []);

        const lastMsg = (msgRes && msgRes[msgRes.length - 1]) || {};
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
          const norm = (msgRes || []).map(normalizeMessage);
          marcarMensagensAntesDoTicketComoLidas(userIdSelecionado, norm);
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
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, setClienteAtivo, normalizeMessage, upsertMessages]);

  // ----- Refetch ao voltar a aba visível -> upsert em lote
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      try {
        const uidStr = String(userIdSelecionado);
        const uidEnc = encodeURIComponent(userIdSelecionado);
        const msgs = await apiGet(`/api/v1/messages/${uidEnc}`);
        upsertMessages(uidStr, msgs || []);
      } catch (err) {
        console.error('Erro ao recarregar mensagens:', err);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [userIdSelecionado, upsertMessages]);

  // ----- Envio otimista (1 msg): upsert unitário + scroll
  const handleMessageAdded = useCallback((raw) => {
    const uidStr = String(raw?.user_id || userIdSelecionado);
    upsertMessages(uidStr, raw);
    if (messageListRef.current) {
      messageListRef.current.setAutoScrollEnabled(true);
      messageListRef.current.scrollToBottomSmooth();
    }
  }, [upsertMessages, userIdSelecionado]);

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

      {/* Passa TODAS as mensagens ordenadas; o MessageList faz a própria paginação */}
      <MessageList
        ref={messageListRef}
        messages={messagesSorted}
        onImageClick={setModalImage}
        onPdfClick={setPdfModal}
        onReply={setReplyTo}
        // sem loaderRef aqui, para não duplicar lógica de paginação
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
