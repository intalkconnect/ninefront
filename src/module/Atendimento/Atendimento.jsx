import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "./components/Sidebar/Sidebar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import DetailsPanel from "./components/DetailsPanel/DetailsPanel";
import SocketDisconnectedModal from "./components/SocketDisconnectedModal";

import useConversationsStore from "./store/useConversationsStore";

import { apiGet } from "./services/apiClient";
import { connectSocket, getSocket } from "./services/socket";

import notificationSound from "./assets/notification.mp3";
import "./Atendimento.css";

// Se você usa auth por JWT, ajuste/importe daqui:
import { parseJwt } from "../../utils/auth"; // ajuste o path se necessário

export default function Atendimento() {
  const audioPlayer = useRef(null);
  const socketRef = useRef(null);
  const isWindowActiveRef = useRef(true);

  // ---- Zustand store (ajuste nomes se seu store divergir) ----
  const {
    conversations,
    selectedUserId,
    setSelectedUserId,           // <- garanta que exista no seu store. Se for outro nome, ajuste aqui.
    mergeConversation,           // <- usado para atualizar o card com última mensagem, timestamp, etc.
    setSocketStatus,             // opcional: exibir status do socket
    socketStatus,                // opcional: status atual
  } = useConversationsStore((s) => ({
    conversations: s.conversations,
    selectedUserId: s.selectedUserId,
    setSelectedUserId: s.setSelectedUserId ?? s.selectConversation, // fallback
    mergeConversation: s.mergeConversation,
    setSocketStatus: s.setSocketStatus,
    socketStatus: s.socketStatus,
  }));

  const [isSocketModalOpen, setIsSocketModalOpen] = useState(false);

  // ---- Helpers ----
  const playNotification = useCallback(() => {
    try {
      if (audioPlayer.current) {
        audioPlayer.current.currentTime = 0;
        audioPlayer.current.play().catch(() => {});
      }
    } catch {}
  }, []);

  const notify = useCallback((msg) => {
    toast(msg, { type: "info", autoClose: 3000 });
  }, []);

  // ---- Foco da janela (p/ evitar barulho quando usuário fora) ----
  useEffect(() => {
    const onFocus = () => (isWindowActiveRef.current = true);
    const onBlur  = () => (isWindowActiveRef.current = false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // ---- Conexão de socket ----
  useEffect(() => {
    let mounted = true;

    const doConnect = async () => {
      try {
        // se você precisa de token/tenant/etc, recupere aqui
        const token = localStorage.getItem("token");
        const tenant = (() => {
          try {
            const parsed = parseJwt?.(token);
            return parsed?.tenant || parsed?.tenant_id || null;
          } catch {
            return null;
          }
        })();

        const socket = await connectSocket({ token, tenant });
        socketRef.current = socket;
        setSocketStatus?.("online");
        setIsSocketModalOpen(false);

        // -------- Handlers GLOBAIS (não remova em ChatWindow!) --------
        const onNewMessage = (message) => {
          // dados mínimos
          if (!message || !message.user_id || !message.timestamp) return;

          // card: sempre atualiza
          mergeConversation?.(message.user_id, {
            ticket_number: message.ticket_number || message.ticket,
            timestamp: message.timestamp,
            content: message.content,
            channel: message.channel || "whatsapp",
            direction: message.direction, // incoming/outgoing
          });

          // notificação sonora/visual
          const isActiveChat  = message.user_id === selectedUserId;
          const isFromMe      = message.direction === "outgoing";
          const windowFocused = isWindowActiveRef.current;

          if (!isFromMe) {
            if (!windowFocused || !isActiveChat) {
              playNotification();
            }
          }
        };

        const onUpdateMessage = (payload) => {
          // opcional: atualizar status/read, etc.
          if (!payload?.user_id) return;
          // Se precisar tocar no card quando “editada/entregue/lida”
          // mergeConversation?.(payload.user_id, { ... });
        };

        const onConnect = () => {
          setSocketStatus?.("online");
          setIsSocketModalOpen(false);
        };
        const onDisconnect = () => {
          setSocketStatus?.("offline");
          setIsSocketModalOpen(true);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("new_message", onNewMessage);
        socket.on("update_message", onUpdateMessage);

        // cleanup
        return () => {
          if (!mounted) return;
          try {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("new_message", onNewMessage);
            socket.off("update_message", onUpdateMessage);
            socket.close?.();
          } catch {}
        };
      } catch (err) {
        setSocketStatus?.("offline");
        setIsSocketModalOpen(true);
        console.error("Erro ao conectar socket:", err);
      }
    };

    doConnect();

    return () => {
      mounted = false;
      try {
        const s = getSocket?.();
        s?.close?.();
      } catch {}
    };
  }, [mergeConversation, playNotification, selectedUserId, setSocketStatus]);

  // ---- Seleção inicial (opcional) ----
  useEffect(() => {
    // Exemplo: se não houver seleção e existirem conversas, seleciona a primeira
    if (!selectedUserId) {
      const ids = Object.keys(conversations || {});
      if (ids.length > 0) {
        setSelectedUserId?.(ids[0]);
      }
    }
  }, [conversations, selectedUserId, setSelectedUserId]);

  const conversaSelecionada = useMemo(() => {
    return (conversations && selectedUserId && conversations[selectedUserId]) || null;
  }, [conversations, selectedUserId]);

  return (
    <>
      <audio ref={audioPlayer} src={notificationSound} preload="auto" />
      <div className="atendimento-root">
        <header className="topbar">
          <div className="brand">Atendimento</div>
          <div className={`socket-dot ${socketStatus === "online" ? "online" : "offline"}`} />
        </header>

        <div className="workspace">
          <aside className="sidebar">
            <Sidebar
              selectedUserId={selectedUserId}
              onSelectUser={(id) => setSelectedUserId?.(id)}
            />
          </aside>

          <main className="chat-area">
            {selectedUserId ? (
              <ChatWindow userIdSelecionado={selectedUserId} />
            ) : (
              <div className="empty-state">Selecione uma conversa ao lado</div>
            )}
          </main>

          <aside className="details-panel">
            <DetailsPanel
              userIdSelecionado={selectedUserId}
              conversaSelecionada={conversaSelecionada}
            />
          </aside>
        </div>

        <ToastContainer position="bottom-right" style={{ zIndex: 9999 }} />

        <SocketDisconnectedModal
          isOpen={isSocketModalOpen}
          onReconnect={() => {
            try {
              getSocket()?.connect?.();
            } catch {}
          }}
        />
      </div>
    </>
  );
}
