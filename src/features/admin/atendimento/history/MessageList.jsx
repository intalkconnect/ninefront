import React, {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
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
 * MessageList (sem auto-rolagem; carrega tudo e vai para a última mensagem)
 */
const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply }, ref) => {
    const containerRef = useRef(null);

    // expõe um helper opcional caso você queira chamar manualmente
    useImperativeHandle(ref, () => ({
      scrollToBottom: () => {
        if (!containerRef.current) return;
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      },
    }));

    // Ao montar/alterar a lista, posiciona no fim apenas uma vez
    useEffect(() => {
      if (!containerRef.current) return;
      // sem animação/suavização
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, [messages?.length]); // apenas quando muda a quantidade

    return (
      <div ref={containerRef} className="chat-scroll-container">
        {messages.map((msg, index) => {
          if (!msg) return null;

          // Mensagens de sistema (divisor)
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

          // Resolução do alvo de resposta (por objeto ou id/context)
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
