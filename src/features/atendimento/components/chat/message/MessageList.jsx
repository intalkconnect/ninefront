import React, { forwardRef, useImperativeHandle, useRef, useLayoutEffect } from 'react';
import MessageRow from './MessageRow';

/* ===== helpers locais ===== */
function idKey(m) {
  return (m?.id || m?.message_id || m?.provider_id || m?.client_id || null);
}
function timeKey(m) {
  return (m?.timestamp || m?.created_at || null);
}

/**
 * MessageList
 * - Inicializa no final
 * - Detecta append vs prepend
 */
const MessageList = forwardRef(
  ({ messages = [], onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);

    const prevLastKeyRef  = useRef(null);
    const prevFirstKeyRef = useRef(null);
    const prevLenRef      = useRef(0);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      },
      getContainer: () => containerRef.current,
    }));

    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    }, []);

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

      const firstKey = idKey(first) || timeKey(first);
      const lastKey  = idKey(last)  || timeKey(last);

      const prevFirst = prevFirstKeyRef.current;
      const prevLast  = prevLastKeyRef.current;
      const prevLen   = prevLenRef.current;

      const appended  = prevLen > 0 && lastKey && prevLast && lastKey !== prevLast;
      const prepended = prevLen > 0 && firstKey && prevFirst && firstKey !== prevFirst && len > prevLen;

      if (appended) el.scrollTop = el.scrollHeight;

      prevLenRef.current      = len;
      prevFirstKeyRef.current = firstKey || null;
      prevLastKeyRef.current  = lastKey || null;
    }, [messages]);

    return (
      <div ref={containerRef} className="chat-scroll-container">
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
              <div key={msg.id || msg.message_id || msg.provider_id || msg.client_id || index} className="ticket-divider">
                {systemText}
              </div>
            );
          }

          const prevMsg = messages[index - 1];
          const showTicketDivider = msg.ticket_number && (!prevMsg || msg.ticket_number !== prevMsg.ticket_number);

          // Resolve preview de resposta
          let replyToMessage = msg.replyTo || null;
          const replyId = msg.reply_to || msg.context?.message_id || null;
          if (!replyToMessage && typeof replyId === 'string' && replyId.trim() !== '') {
            const target = messages.find((m) => {
              const ids = [m.message_id, m.whatsapp_message_id, m.telegram_message_id, m.provider_id, m.id].filter(Boolean);
              return ids.some((x) => String(x) === String(replyId));
            });
            replyToMessage = target || null;
          }

          return (
            <React.Fragment key={msg.id || msg.message_id || msg.provider_id || msg.client_id || index}>
              {showTicketDivider && <div className="ticket-divider">Ticket #{msg.ticket_number}</div>}
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
