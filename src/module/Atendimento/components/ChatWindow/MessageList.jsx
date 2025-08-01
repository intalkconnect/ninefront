import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import MessageRow from './MessageRow';

/**
 * MessageList (versão “carrega tudo”)
 *
 * - Renderiza todas as mensagens de uma só vez usando map().
 * - O scroll fica a cargo do navegador (overflow-y: auto), sem virtualização.
 * - Expondo via ref() o método scrollToBottomInstant() para rolar automaticamente.
 *
 * Props:
 *  - messages: array de objetos de mensagem ({ id, direction, content, timestamp, status, ... })
 *  - onImageClick, onPdfClick, onReply: callbacks para tratar anexos e resposta
 */

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply }, ref) => {
    const containerRef = useRef(null);

    // Expor scroll instantâneo para o componente pai
    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      },
    }));

    // Scroll automático ao receber novas mensagens
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages]);

    const renderedTickets = new Set();

    return (
      <div ref={containerRef} className="chat-scroll-container">
        {messages.map((msg, index) => {
          const replyToMessage = messages.find(m => m.whatsapp_message_id === msg.reply_to);

          const shouldRenderDivider =
            msg.ticket_number &&
            !renderedTickets.has(msg.ticket_number);

          if (shouldRenderDivider) {
            renderedTickets.add(msg.ticket_number);
          }

          return (
            <React.Fragment key={msg.id || index}>
              {shouldRenderDivider && (
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
