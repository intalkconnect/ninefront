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
 * - Inicia já no fim (sem “efeito”): esconde o conteúdo até aplicar o scroll
 * - Não auto-scroll em updates
 * - “Ver mais” preserva a posição (âncora pelo delta)
 * - Força scroll-behavior: auto !important via JS
 */
const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);

    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    // controle de inicialização
    const didInitialScroll = useRef(false);
    const [ready, setReady] = useState(false); // controla visibilidade do conteúdo

    const visibleMessages = messages.slice(-visibleCount);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        const el = containerRef.current;
        if (!el) return;
        el.style.setProperty('scroll-behavior', 'auto', 'important');
        el.scrollTop = el.scrollHeight;
      },
    }));

    // Força comportamento de scroll instantâneo no container
    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.style.setProperty('scroll-behavior', 'auto', 'important');
      el.style.setProperty('overscroll-behavior', 'contain');
    }, []);

    // Scroll inicial (antes do paint) e só então mostramos o conteúdo
    useLayoutEffect(() => {
      const el = containerRef.current;
      const len = messages?.length || 0;

      if (!el) return;

      // se não há mensagens, já pode mostrar (sem scroll)
      if (len === 0) {
        setReady(true);
        return;
      }

      // se ainda não aplicamos o scroll inicial, fazemos agora
      if (!didInitialScroll.current) {
        el.style.setProperty('scroll-behavior', 'auto', 'important');
        el.scrollTop = el.scrollHeight; // rola até o fim ANTES do paint
        didInitialScroll.current = true;
        setReady(true); // só agora liberamos a visibilidade do conteúdo
      }
    }, [messages?.length]);

    // “Ver mais”: mantém a âncora visual
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
        // compensa o crescimento para não "pular"
        el.scrollTop = (el.scrollTop || 0) + delta;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleCount]);

    // Garantia extra: se o nó mudar, mantém scroll instantâneo
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.style.setProperty('scroll-behavior', 'auto', 'important');
    });

    return (
      <div
        ref={containerRef}
        className="chat-scroll-container"
        // esconde o conteúdo até o scroll inicial estar aplicado
        style={{ visibility: ready ? 'visible' : 'hidden', scrollBehavior: 'auto' }}
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
