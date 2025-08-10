import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useMemo
} from 'react';
import MessageRow from './MessageRow';

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);
    const [lastMessageId, setLastMessageId] = useState(null);

    const visibleMessages = useMemo(() => messages.slice(-visibleCount), [messages, visibleCount]);

    // Debug: Log quando as mensagens mudam
    useEffect(() => {
      console.log('Messages updated:', messages.length, 'Last message:', messages[messages.length - 1]?.id);
    }, [messages]);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'auto'
          });
        }
      },
      scrollToBottomSmooth: () => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    }));

    // Efeito principal para scroll automático
    useEffect(() => {
      if (!containerRef.current || messages.length === 0) return;

      const lastMsg = messages[messages.length - 1];
      const isNewMessage = lastMsg.id !== lastMessageId;
      setLastMessageId(lastMsg.id);

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;

      if (isNewMessage && isNearBottom) {
        containerRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }, [messages, lastMessageId]);

    // Scroll ao voltar para a aba
    useEffect(() => {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && containerRef.current) {
          setTimeout(() => {
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: 'auto'
            });
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

    // Ajuste de scroll ao carregar mais mensagens
    useEffect(() => {
      if (visibleCount > 30 && containerRef.current) {
        const newHeight = containerRef.current.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        containerRef.current.scrollTop = delta;
      }
    }, [visibleCount, prevScrollHeight]);

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
            <React.Fragment key={msg.id || `${msg.timestamp}-${index}`}>
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
