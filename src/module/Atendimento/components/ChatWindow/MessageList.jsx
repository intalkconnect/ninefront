import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState
} from 'react';

import MessageRow from './MessageRow';

function findReplyTarget(messages, refId) {
  if (!refId) return null;
  return messages.find(m => {
    const ids = [
      m.message_id,
      m.whatsapp_message_id,
      m.telegram_message_id,
      m.provider_id,
      m.id
    ].filter(Boolean);
    return ids.some((x) => String(x) === String(refId));
  }) || null;
}

/**
 * MessageList (versão com "Ver mais" e scroll no final)
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

    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [visibleMessages]);

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

    useEffect(() => {
      if (visibleCount > 30 && containerRef.current) {
        const newHeight = containerRef.current.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        containerRef.current.scrollTop = delta;
      }
    }, [visibleCount]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div ref={containerRef} className="chat-scroll-container">

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
            } else if (typeof msg.content === 'object' && msg.content?.text) {
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

          // 🧩 Resolução do alvo de resposta:
          // - aceita msg.replyTo (objeto)
          // - tenta achar pelo reply_to/context.message_id quando forem ids
          let replyToMessage = msg.replyTo || null;
          const replyId = msg.reply_to || msg.context?.message_id || null;
          if (!replyToMessage && typeof replyId === 'string' && replyId.trim() !== '') {
            replyToMessage = findReplyTarget(messages, replyId);
          }

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
