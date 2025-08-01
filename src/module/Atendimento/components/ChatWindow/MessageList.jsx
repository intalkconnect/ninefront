import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import MessageRow from './MessageRow';

const MessageList = forwardRef(({ messages, onImageClick, onPdfClick, onReply }, ref) => {
  const containerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    scrollToBottomInstant: () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    },
  }));

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const messageMap = new Map(messages.map(m => [m.whatsapp_message_id, m]));

  return (
    <div ref={containerRef} className="chat-scroll-container">
      {Array.isArray(messages) &&
        messages.map((msg, index) => {
          if (msg.direction === 'system' || msg.type === 'system') {
            const raw = msg.content;
            const text = typeof raw === 'object' && raw !== null
              ? raw.text || ''
              : String(raw || '');
            return (
              <div key={msg.whatsapp_message_id || msg.id || index} className="ticket-divider">
                {text.replace(/^"(.*)"$/, '$1')}
              </div>
            );
          }

          const replyToMessage = msg.reply_to ? messageMap.get(msg.reply_to) : null;
          const prevMsg = messages[index - 1];
          const isNewTicket = !prevMsg || msg.ticket_number !== prevMsg.ticket_number;

          return (
            <React.Fragment key={msg.whatsapp_message_id || msg.id || index}>
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
});

export default MessageList;
