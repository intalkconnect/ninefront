// File: src/pages/admin/atendimento/history/MessageList.jsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useLayoutEffect,
  useEffect,
  useState
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
        m.id
      ].filter(Boolean);
      return ids.some((x) => String(x) === String(refId));
    }) || null
  );
}

/**
 * MessageList
 * - Força scroll-behavior: auto !important via JS (sem depender de CSS global)
 * - Rola para o fim 1x antes do paint (sem efeito)
 * - NÃO auto-scroll em novas mensagens
 * - “Ver mais” preserva a posição visual
 */
const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);

    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    // apenas uma rolagem inicial
    const didInitialScroll = useRef(false);

    const visibleMessages = messages.slice(-visibleCount);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      },
    }));

    // (A) Força scroll-behavior: auto !important no container (1x no mount)
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      // força inline com prioridade !important
      el.style.setProperty('scroll-behavior', 'auto', 'important');
      // (opcional) impedir polidez externa
      el.style.setProperty('overscroll-behavior', 'contain');
    }, []);

    // (B) Scroll inicial até o fim (apenas 1x, e antes do paint)
    useLayoutEffect(() => {
      const el = containerRef.current;
      const len = messages?.length || 0;
      if (!el || len === 0 || didInitialScroll.current) return;
      el.scrollTop = el.scrollHeight; // sem “efeito” (já é auto !important)
      didInitialScroll.current = true;
    }, [messages?.length]);

    // (C) “Ver mais”: preserva âncora visual
    const handleShowMore = () => {
      const el = containerRef.current;
      if (!el) return;
      setPrevScrollHeight(el.scrollHeight);
      setVisibleCount((prev) => Math.min(prev + 30, messages.length));
    };

    useLayoutEffect(() => {
      if (visibleCount > 30 && containerRef.current) {
        const el = containerRef.current;
        const newHeight = el.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        el.scrollTop = (el.scrollTop || 0) + delta;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleCount]);

    // (D) Como garantia extra, re-aplica auto !important se o nó trocar
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.style.setProperty('scroll-behavior', 'auto', 'important');
    });

    return (
      <div
        ref={containerRef}
        className="chat-scroll-container"
        // redundante, mas ajuda caso algum CSS global troque depois
        style={{ scrollBehavior: 'auto' }}
      >
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

          // resolve reply alvo
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
