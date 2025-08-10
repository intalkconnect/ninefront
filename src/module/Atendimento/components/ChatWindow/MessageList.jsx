import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState
} from 'react';

import MessageRow from './MessageRow';

/**
 * MessageList (versão com "Ver mais" e scroll no final)
 *
 * Props:
 *  - messages: array de mensagens ({ id, direction, content, timestamp, status, ... })
 *  - onImageClick, onPdfClick, onReply: callbacks
 *  - loaderRef: ref para scroll infinito (opcional)
 */

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    const visibleMessages = messages.slice(-visibleCount);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'auto'
          });
        }
      },
    }));

    // Scroll automático ao mudar mensagens visíveis
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

    const handleShowMore = () => {
      if (containerRef.current) {
        setPrevScrollHeight(containerRef.current.scrollHeight);
        setVisibleCount((prev) => Math.min(prev + 30, messages.length));
      }
    };

    // Após carregar mais mensagens, corrige o scroll para não pular
    useEffect(() => {
      if (visibleCount > 30 && containerRef.current) {
        const newHeight = containerRef.current.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        containerRef.current.scrollTop = delta;
      }
    }, [visibleCount]);

    return (
      <div ref={containerRef} className="chat-scroll-container">
        {loaderRef && (
          <div ref={loaderRef} className="pagination-loader">
            Carregando mensagens mais antigas...
          </div>
        )}

        {messages.length > visibleMessages.length && (
          <div className="show-more-messages">
            <button onClick={handleShowMore}>Ver mais mensagens</button>
          </div>
        )}

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

          const fullIndex = messages.length - visibleMessages.length + index;
          const prevMsg = messages[fullIndex - 1];

          const showTicketDivider =
            msg.ticket_number &&
            (!prevMsg || msg.ticket_number !== prevMsg.ticket_number);

          const replyToMessage = messages.find(
            (m) => m.whatsapp_message_id === msg.reply_to
          );

          return (
            <React.Fragment key={msg.id || index}>
              {showTicketDivider && (
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
