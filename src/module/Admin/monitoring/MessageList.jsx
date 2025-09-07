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
      const ids = [m.message_id, m.whatsapp_message_id, m.telegram_message_id, m.provider_id, m.id].filter(Boolean);
      return ids.some((x) => String(x) === String(refId));
    }) || null
  );
}

/**
 * MessageList
 * - Começa já no fim (sem efeito) usando useLayoutEffect e somente 1x
 * - NÃO faz auto-scroll quando chegam novas mensagens
 * - “Ver mais” carrega 30 acima e mantém a âncora visual
 */
const MessageList = forwardRef(
  ({ messages, onImageClick, onPdfClick, onReply, loaderRef = null }, ref) => {
    const containerRef = useRef(null);

    const [visibleCount, setVisibleCount] = useState(30);
    const [prevScrollHeight, setPrevScrollHeight] = useState(0);

    // apenas uma rolagem inicial
    const didInitialScroll = useRef(false);
    const prevLenRef = useRef(messages?.length || 0);

    const visibleMessages = messages.slice(-visibleCount);

    useImperativeHandle(ref, () => ({
      scrollToBottomInstant: () => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight;
        el.style.scrollBehavior = prev || 'auto';
      },
    }));

    // ===== 1) Força o scroll no fim APENAS na primeira vez que houver mensagens,
    //          e o faz antes do paint (sem efeito visual).
    useLayoutEffect(() => {
      const el = containerRef.current;
      const len = messages?.length || 0;

      // Se ainda não temos mensagens, não há o que rolar
      if (!el || len === 0) return;

      // Se já fizemos a rolagem inicial, não rolar de novo
      if (didInitialScroll.current) return;

      // Primeira vez que aparecem mensagens: rola pro fim sem suavização
      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = el.scrollHeight;
      el.style.scrollBehavior = prev || 'auto';

      didInitialScroll.current = true;
      prevLenRef.current = len;
    }, [messages?.length]); // roda quando a lista "passa" de 0 para >0

    // ===== 2) NÃO auto-scroll em updates normais
    // (Intencionalmente não há efeito que role ao mudar mensagens)

    // ===== 3) “Ver mais mensagens”: mantém âncora visual (rolando o delta)
    const handleShowMore = () => {
      if (!containerRef.current) return;
      setPrevScrollHeight(containerRef.current.scrollHeight);
      setVisibleCount((prev) => Math.min(prev + 30, messages.length));
    };

    useLayoutEffect(() => {
      // Quando aumenta o visibleCount (via "Ver mais"), mantemos a âncora
      if (visibleCount > 30 && containerRef.current) {
        const el = containerRef.current;
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';
        const newHeight = el.scrollHeight;
        const delta = newHeight - prevScrollHeight;
        // move a janela para baixo exatamente o que cresceu acima
        el.scrollTop = (el.scrollTop || 0) + delta;
        el.style.scrollBehavior = prev || 'auto';
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleCount]);

    // Opcional: se houver algum CSS global com scroll suave, garante "auto"
    useEffect(() => {
      if (!containerRef.current) return;
      containerRef.current.style.scrollBehavior = 'auto';
    }, []);

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

          // resolve reply
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
