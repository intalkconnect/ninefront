import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect
} from 'react';

import MessageRow from './MessageRow';

// ---------- helpers ----------
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

function isNearBottom(el, threshold = 80) {
  if (!el) return true;
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
  return dist <= threshold;
}

function getOffsetTopWithin(el, ancestor) {
  // calcula o top relativo do elemento dentro do container rolável
  let y = 0, n = el;
  while (n && n !== ancestor) { y += n.offsetTop; n = n.offsetParent; }
  return y;
}

/**
 * MessageList (puro, sem paginação interna; usa um sentinel no topo para carregar mais)
 */
const MessageList = forwardRef(
  (
    {
      messages,
      onImageClick,
      onPdfClick,
      onReply,
      loaderRef = null,
      autoScrollMode = 'ifAtBottom', // 'always' | 'ifAtBottom' | 'off'
    },
    ref
  ) => {
    const containerRef = useRef(null);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        const c = containerRef.current;
        if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'auto' });
      },
      getContainer: () => containerRef.current,

      /**
       * Salta instantaneamente até a âncora do ticket (sem animação longa).
       * Retorna true se encontrou e rolou, senão false.
       */
      scrollToTicketInstant: (ticketNumber, { center = true } = {}) => {
        const c = containerRef.current;
        if (!c) return false;
        const anchor = c.querySelector(
          `[data-ticket="${CSS.escape(String(ticketNumber))}"]`
        );
        if (!anchor) return false;

        const top = getOffsetTopWithin(anchor, c);
        const targetTop = center
          ? Math.max(0, top - Math.max(0, (c.clientHeight / 2) - (anchor.clientHeight / 2)))
          : top;

        const prev = c.style.scrollBehavior;
        c.style.scrollBehavior = 'auto';
        c.scrollTop = targetTop;
        c.style.scrollBehavior = prev || '';

        // realce visual leve (opcional)
        anchor.classList.add('ticket-flash');
        setTimeout(() => anchor.classList.remove('ticket-flash'), 600);

        return true;
      },
    }));

    // auto-scroll controlado quando a lista muda
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      if (autoScrollMode === 'always' || (autoScrollMode === 'ifAtBottom' && isNearBottom(el))) {
        el.scrollTop = el.scrollHeight;
      }
    }, [messages, autoScrollMode]);

    // ao voltar o foco pra aba, só desce se permitido
    useEffect(() => {
      const handleVisibility = () => {
        if (document.visibilityState !== 'visible') return;
        const el = containerRef.current;
        if (!el) return;
        if (autoScrollMode === 'off') return;
        if (autoScrollMode === 'always' || (autoScrollMode === 'ifAtBottom' && isNearBottom(el))) {
          setTimeout(() => {
            el.scrollTop = el.scrollHeight;
          }, 50);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [autoScrollMode]);

    return (
      <div ref={containerRef} className="chat-scroll-container">
        {/* Sentinel no topo para "carregar mais" via IntersectionObserver */}
        {loaderRef && <div ref={loaderRef} style={{ height: 1 }} />}

        {messages.map((msg, index) => {
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

          const prevMsg = messages[index - 1];

          const showTicketDivider =
            msg.ticket_number &&
            (!prevMsg || msg.ticket_number !== prevMsg.ticket_number);

          // 🧩 Resolução do alvo de resposta
          let replyToMessage = msg.replyTo || null;
          const replyId = msg.reply_to || msg.context?.message_id || null;
          if (!replyToMessage && typeof replyId === 'string' && replyId.trim() !== '') {
            replyToMessage = findReplyTarget(messages, replyId);
          }

          return (
            <React.Fragment key={msg.id || msg.message_id || index}>
              {showTicketDivider && (
                <div
                  className="ticket-divider"
                  data-ticket={msg.ticket_number}
                  id={`ticket-${msg.ticket_number}`}
                >
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
