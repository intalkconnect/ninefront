// src/components/ChatWindow/MessageList.jsx

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect
} from 'react';

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

    // Expondo método para scroll manual
    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      },
    }));

    // Scroll automático sempre que mensagens mudam
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [messages]);

    // Scroll automático quando aba voltar do inativo
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
        {messages.map((msg, index) => {
          if (!msg) return null;

          const isSystem = msg.direction === 'system' || msg.type === 'system';

          // Renderização da mensagem de sistema
          if (isSystem) {
            let systemText = '';
            if (typeof msg.content === 'string') {
              systemText = msg.content.replace(/^"(.*)"$/, '$1'); // remove aspas
            } else if (typeof msg.content === 'object' && msg.content.text) {
              systemText = msg.content.text;
            }

            return (
              <div key={msg.id || index} className="ticket-divider">
                {systemText}
              </div>
            );
          }

          // Renderização normal
          const replyToMessage = messages.find(m => m.whatsapp_message_id === msg.reply_to);
          const prevMsg = messages[index - 1];
          const isNewTicket = !prevMsg || msg.ticket_number !== prevMsg.ticket_number;

          return (
            <React.Fragment key={msg.id || index}>
              {index > 0 && isNewTicket && msg.ticket_number && (
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
