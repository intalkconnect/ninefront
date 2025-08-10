// Substitua as partes relevantes do ChatWindow.jsx:

export default function ChatWindow({ userIdSelecionado }) {
  const mergeConversation = useConversationsStore(state => state.mergeConversation);
  const setClienteAtivo   = useConversationsStore(state => state.setClienteAtivo);
  const userEmail         = useConversationsStore(state => state.userEmail);
  const userFilas         = useConversationsStore(state => state.userFilas);
  
  // 🆕 NOVO: Usar cache do store
  const getMessagesFromCache = useConversationsStore(state => state.getMessagesFromCache);
  const setMessagesInCache = useConversationsStore(state => state.setMessagesInCache);
  const messageVersion = useConversationsStore(state => state.messageVersion);

  const [allMessages, setAllMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [modalImage, setModalImage] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [canSendFreeform, setCanSendFreeform] = useState(true);

  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const messageListRef = useRef(null);
  const loaderRef = useRef(null);
  const pageRef = useRef(1);
  const messagesPerPage = 100;

  // 🆕 NOVO: Sincronizar com cache do store
  useEffect(() => {
    if (!userIdSelecionado) return;

    const cachedMessages = getMessagesFromCache(userIdSelecionado);
    if (cachedMessages.length > 0) {
      console.log('🔄 [ChatWindow] Sincronizando com cache do store:', cachedMessages.length);
      setAllMessages(cachedMessages);
      updateDisplayedMessages(cachedMessages, pageRef.current);
    }
  }, [userIdSelecionado, messageVersion, getMessagesFromCache]);

  // ---------- Helpers ----------
  const normalizeMessage = useCallback((msg) => {
    if (!msg) return msg;
    const id = msg.id || msg.message_id;
    const timestamp =
      msg.timestamp || msg.created_at || msg.createdAt || msg.updated_at || new Date().toISOString();
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
    setLastUpdate(Date.now());

    requestAnimationFrame(() => {
      messageListRef.current?.scrollToBottomInstant?.();
    });
  }, []);

  // 🔄 MELHORADO: handleMessageAdded sincroniza com store
  const handleMessageAdded = useCallback((incomingRaw) => {
    const incoming = normalizeMessage(incomingRaw);
    const uid = String(userIdSelecionado);

    setAllMessages(prev => {
      const existingIndex = prev.findIndex(m => sameMessage(m, incoming));
      let updated;
      
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...incoming };
      } else {
        updated = [...prev, incoming].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
      }

      // 🆕 Sincronizar com store
      setMessagesInCache(uid, updated);
      updateDisplayedMessages(updated, pageRef.current);

      requestAnimationFrame(() => {
        messageListRef.current?.scrollToBottomSmooth?.();
      });

      return updated;
    });
  }, [normalizeMessage, sameMessage, updateDisplayedMessages, userIdSelecionado, setMessagesInCache]);

  // ---------- Carregar dados iniciais ----------
  useEffect(() => {
    if (!userIdSelecionado) return;
    pageRef.current = 1;
    setIsLoading(true);

    const loadInitialData = async () => {
      try {
        const uid = String(userIdSelecionado);
        console.log('🔄 [ChatWindow] Carregando dados para:', uid);

        const [msgRes, clienteRes, ticketRes, check24hRes] = await Promise.all([
          apiGet(`/api/v1/messages/${encodeURIComponent(uid)}`).catch(err => {
            console.error('❌ [ChatWindow] Erro em /messages:', err);
            return [];
          }),
          apiGet(`/api/v1/clientes/${encodeURIComponent(uid)}`).catch(err => {
            console.error('❌ [ChatWindow] Erro em /clientes:', err);
            return null;
          }),
          apiGet(`/api/v1/tickets/${encodeURIComponent(uid)}`).catch(err => {
            console.error('❌ [ChatWindow] Erro em /tickets:', err);
            return null;
          }),
          apiGet(`/api/v1/messages/check-24h/${encodeURIComponent(uid)}`).catch(err => {
            console.error('❌ [ChatWindow] Erro em /check-24h:', err);
            return { can_send_freeform: true };
          })
        ]);

        const { status, assigned_to, fila } = ticketRes || {};
        
        if (status !== 'open' || assigned_to !== userEmail || !userFilas?.includes(fila)) {
          console.warn('❌ [ChatWindow] Acesso negado');
          setCanSendFreeform(false);
          setAllMessages([]);
          setDisplayedMessages([]);
          setClienteInfo(null);
          setClienteAtivo(null);
          return;
        }

        const msgsNorm = (msgRes || [])
          .map(normalizeMessage)
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        console.log('✅ [ChatWindow] Mensagens carregadas:', msgsNorm.length);

        // 🆕 Sincronizar com store
        setMessagesInCache(uid, msgsNorm);
        setAllMessages(msgsNorm);
        updateDisplayedMessages(msgsNorm, 1);

        const lastMsg = msgsNorm[msgsNorm.length - 1] || {};
        mergeConversation(uid, {
          channel: lastMsg.channel || clienteRes?.channel,
          ticket_number: clienteRes?.ticket_number || '000000',
          fila: clienteRes?.fila || fila,
          name: clienteRes?.name || uid,
          email: clienteRes?.email || '',
          phone: clienteRes?.phone || '',
          documento: clienteRes?.document || '',
          user_id: uid,
          assigned_to,
          status,
          content: typeof lastMsg.content === 'string' ? lastMsg.content : (lastMsg.content?.text ?? '')
        });

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

        console.log('✅ [ChatWindow] Dados carregados com sucesso');
        
      } catch (err) {
        console.error('❌ [ChatWindow] Erro ao carregar dados:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [userIdSelecionado, userEmail, userFilas, mergeConversation, updateDisplayedMessages, setClienteAtivo, normalizeMessage, setMessagesInCache]);


  // ---------- Scroll infinito (topo) ----------
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreMessages) {
        pageRef.current += 1;
        const uid = String(userIdSelecionado);
        const cached = messageCacheRef.current.get(uid) || [];
        updateDisplayedMessages(cached, pageRef.current);

        // mesmo paginando pelo topo, mantemos no fim
        requestAnimationFrame(() => {
          messageListRef.current?.scrollToBottomInstant?.();
        });
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMoreMessages, userIdSelecionado, updateDisplayedMessages]);

  // ---------- Refetch ao voltar foco ----------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !userIdSelecionado) return;
      (async () => {
        try {
          const uid = String(userIdSelecionado);
          const msgs = await apiGet(`/api/v1/messages/${encodeURIComponent(uid)}`);
          const msgsNorm = (msgs || []).map(normalizeMessage).sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          setAllMessages(msgsNorm);
          messageCacheRef.current.set(uid, msgsNorm);
          updateDisplayedMessages(msgsNorm, pageRef.current);
        } catch (err) {
          console.error('Erro ao recarregar mensagens:', err);
        }
      })();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userIdSelecionado, updateDisplayedMessages, normalizeMessage]);

  // ---------- SSE ----------
  useEffect(() => {
    if (!userIdSelecionado) return;
    const uid = String(userIdSelecionado);

    const wrap = (raw) => {
      const msg = normalizeMessage(raw);
      if (!belongsToCurrent(msg, uid)) return;

      // se quiser garantir que SEMPRE tenha o user_id completo, descomente:
      // msg.user_id = uid; // <— DEIXADO COMENTADO DE PROPÓSITO

      try {
        mergeConversation(uid, {
          user_id: uid,
          content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
          timestamp: msg.timestamp,
          channel: msg.channel,
        });
      } catch {}

      handleMessageAdded(msg);
    };

    const offNew    = on('new_message',    wrap);
    const offStatus = on('message_status', wrap);
    const offUpdate = on('update_message', wrap);

    return () => { offNew?.(); offStatus?.(); offUpdate?.(); };
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
    <div className="chat-window" key={`chat-${userIdSelecionado}-${messageVersion}`}>
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
