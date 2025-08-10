import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import MessageRow from './MessageRow';

const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [prevMessagesLength, setPrevMessagesLength] = useState(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    // Debug: Log de atualizações
    useEffect(() => {
      console.log('Messages updated - Count:', messages.length, 'Last message:', messages[messages.length - 1]);
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
      },
      setAutoScrollEnabled: (enabled) => setAutoScroll(enabled)
    }));

    // Efeito para scroll automático quando novas mensagens chegam
    useEffect(() => {
      if (!containerRef.current || messages.length === 0) return;

      const isNewMessage = messages.length > prevMessagesLength;
      setPrevMessagesLength(messages.length);

      // No carregamento inicial, rola para baixo imediatamente
      if (isInitialLoad) {
        setIsInitialLoad(false);
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'auto'
        });
        return;
      }

      // Se não for auto-scroll, não faz nada
      if (!autoScroll) return;

      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;

      // Se for uma nova mensagem e estiver perto do fundo, rola suavemente
      if (isNewMessage && isNearBottom) {
        containerRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }, [messages, autoScroll, prevMessagesLength, isInitialLoad]);

    // Observa mudanças no scroll para desativar auto-scroll se o usuário subir
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
        setAutoScroll(isAtBottom);
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
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

    const visibleMessages = messages.slice(-visibleCount);

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
