import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect
} from 'react';

import MessageRow from './MessageRow';

function findReplyTarget(messages, refId) {
  if (!refId) return null;
  return (
    messages.find((m) => {
      const ids = [
        m.message_id,
        m.whatsapp_message_id,
        m.telegram_message_id,
        m.provider_id,
        m.id,
      ].filter(Boolean);
      return ids.some((x) => String(x) === String(refId));
    }) || null
  );
}

/**
 * MessageList (puro, sem paginação interna; usa um sentinel no topo para carregar mais)
 */

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'auto',
          });
        }
      },
      getContainer: () => containerRef.current,
    }));

    // sempre desce pro fim quando a lista muda
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages]);

    // ao voltar o foco pra aba, garante que está no fim
    useEffect(() => {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }, 50);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

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
            msg.ticket_number &&
            (!prevMsg || msg.ticket_number !== prevMsg.ticket_number);

          // 🧩 Resolução do alvo de resposta
          let replyToMessage = msg.replyTo || null;
          const replyId = msg.reply_to || msg.context?.message_id || null;
          if (!replyToMessage && typeof replyId === 'string' && replyId.trim() !== '') {
            replyToMessage = findReplyTarget(messages, replyId);
          }

          return (
            <React.Fragment key={msg.id || msg.message_id || index}>
              {showTicketDivider && (
                <div
                  className="ticket-divider"
                  data-ticket={msg.ticket_number}
                  id={`ticket-${msg.ticket_number}`}
                >
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
