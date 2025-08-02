import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState
} from 'react';

import MessageRow from './MessageRow';

/**
 * MessageList (versão paginada com botão "Ver mais")
 *
 * Props:
 *  - messages: array de mensagens ({ id, direction, content, timestamp, status, ... })
 *  - onImageClick, onPdfClick, onReply: callbacks
 *  - loaderRef: ref para scroll infinito (opcional)
 */

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(30); // mostra 30 inicialmente

    const visibleMessages = messages.slice(-visibleCount);

    // Método exposto para scroll manual
    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "auto"
          });
        }
      },
    }));

    // Scroll automático ao mudar mensagens (sem animação)
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [visibleMessages]);

    // Scroll automático ao voltar aba
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
        {/* Botão "ver mais mensagens" */}
        {messages.length > visibleCount && (
          <div className="ver-mais-wrapper">
            <button className="ver-mais-btn" onClick={() => setVisibleCount(c => c + 30)}>
              Ver mais mensagens
            </button>
          </div>
        )}

        {/* Loader opcional para scroll infinito */}
        {loaderRef && (
          <div ref={loaderRef} className="pagination-loader">
            Carregando mensagens mais antigas...
          </div>
        )}

        {/* Mensagens */}
        {visibleMessages.map((msg, index) => {
          if (!msg) return null;

          const isSystem = msg.direction === 'system' || msg.type === 'system';
          if (isSystem) {
            let systemText = '';
            if (typeof msg.content === 'string') {
              systemText = msg.content.replace(/^"(.*)"$/, '$1');
            } else if (typeof msg.content === 'object' && msg.content.text) {
              systemText = msg.content.text;
            }

            return (
              <div key={msg.id || index} className="ticket-divider">
                {systemText}
              </div>
            );
          }

          const replyToMessage = messages.find(m => m.whatsapp_message_id === msg.reply_to);
          const prevMsg = messages[index - 1];
          const isNewTicket = !prevMsg || msg.ticket_number !== prevMsg.ticket_number;

          return (
            <React.Fragment key={msg.id || index}>
              {index > 0 && isNewTicket && msg.ticket_number && (
                <div className="ticket-divider">Ticket #{msg.ticket_number}</div>
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
