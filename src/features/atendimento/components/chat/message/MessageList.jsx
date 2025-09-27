import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';

import MessageRow from './MessageRow';

/* ===== helpers locais ===== */
function idKey(m) {
  return (
    m?.id ||
    m?.message_id ||
    m?.provider_id ||
    m?.client_id ||
    null
  );
}
function timeKey(m) {
  return m?.timestamp || m?.created_at || null;
}

/**
 * MessageList
 * - Inicializa já no final (useLayoutEffect no mount)
 * - Em mudanças de mensagens:
 *     • Se chegou item NOVO no fim → desce para o fim (sem efeito)
 *     • Se vieram itens no topo (paginações) → mantém posição
 * - Não tem auto-scroll “suave” / sem animação
 */
const MessageList = forwardRef(
  (
    {
      messages = [],
      onImageClick,
      onPdfClick,
      onReply,
      loaderRef = null, // sentinel no topo (IntersectionObserver vem do pai)
    },
    ref
  ) => {
    const containerRef = useRef(null);

    // guardas para detectar se a mudança foi append (fim) ou prepend (topo)
    const prevLastKeyRef  = useRef(null);
    const prevFirstKeyRef = useRef(null);
    const prevLenRef      = useRef(0);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        const el = containerRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight; // sem efeito
        }
      },
      getContainer: () => containerRef.current,
    }));

    // 1) Ao montar, já desce pro final (sem efeito)
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }, []);

    // 2) Ao mudar a lista de mensagens:
    //    - Detecta append vs prepend e decide se desce para o final
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const len = messages.length;
      if (len === 0) {
        prevLenRef.current = 0;
        prevFirstKeyRef.current = null;
        prevLastKeyRef.current = null;
        return;
      }

      const first = messages[0];
      const last  = messages[len - 1];

      // chaves para detectar mudança estrutural
      const firstKey = idKey(first) || timeKey(first);
      const lastKey  = idKey(last)  || timeKey(last);

      const prevFirst = prevFirstKeyRef.current;
      const prevLast  = prevLastKeyRef.current;
      const prevLen   = prevLenRef.current;

      // Caso 1: append (nova msg no final): lastKey mudou
      const appended = prevLen > 0 && lastKey && prevLast && lastKey !== prevLast;

      // Caso 2: prepend (mensagens antigas carregadas no topo): firstKey mudou e len aumentou
      const prepended = prevLen > 0 && firstKey && prevFirst && firstKey !== prevFirst && len > prevLen;

      if (appended) {
        // novas mensagens ao fim → acompanha a conversa
        el.scrollTop = el.scrollHeight; // sem efeito
      }
      // se foi prepend, não mexe no scroll (o pai já ajusta a posição ao carregar antigas)

      // atualiza guardas
      prevLenRef.current      = len;
      prevFirstKeyRef.current = firstKey || null;
      prevLastKeyRef.current  = lastKey || null;
    }, [messages]);

    return (
      <div ref={containerRef} className="chat-scroll-container">
        {/* Sentinel no topo para "carregar mais" via IntersectionObserver */}
        {loaderRef && <div ref={loaderRef} style={{ height: 1 }} />}

        {messages.map((msg, index) => {
          if (!msg) return null;

          const isSystem = msg.direction === 'system' || msg.type === 'system';
          if (isSystem) {
            let systemText = '';
            if (typeof msg.content === 'string') {
              systemText = msg.content.replace(/^"(.*)"$/, '$1');
            } else if (typeof msg.content === 'object' && msg.content?.text) {
              systemText = msg.content.text;
            }
            return (
              <div key={msg.id || index} className="ticket-divider">
                {systemText}
              </div>
            );
          }

          const prevMsg = messages[index - 1];
          const showTicketDivider =
            msg.ticket_number && (!prevMsg || msg.ticket_number !== prevMsg.ticket_number);

          // Resolução do alvo de resposta (preview)
          let replyToMessage = msg.replyTo || null;
          const replyId = msg.reply_to || msg.context?.message_id || null;
          if (!replyToMessage && typeof replyId === 'string' && replyId.trim() !== '') {
            const target = messages.find((m) => {
              const ids = [
                m.message_id,
                m.whatsapp_message_id,
                m.telegram_message_id,
                m.provider_id,
                m.id,
              ].filter(Boolean);
              return ids.some((x) => String(x) === String(replyId));
            });
            replyToMessage = target || null;
          }

          return (
            <React.Fragment key={msg.id || msg.message_id || index}>
              {showTicketDivider && (
                <div className="ticket-divider">
                  Ticket #{msg.ticket_number}
                </div>
              )}
              <MessageRow
                msg={{ ...msg, replyTo: replyToMessage }}
                onImageClick={onImageClick}
                onPdfClick={onPdfClick}
                onReply={onReply}
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

export default MessageList;
