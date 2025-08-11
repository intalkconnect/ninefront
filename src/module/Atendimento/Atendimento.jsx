import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiGet, apiPut } from "./services/apiClient";
import { connectSocket, getSocket } from "./services/socket";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Sidebar from "./components/Sidebar/Sidebar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import DetailsPanel from "./components/DetailsPanel/DetailsPanel";
import SocketDisconnectedModal from "./components/SocketDisconnectedModal";

import useConversationsStore from "./store/useConversationsStore";
import notificationSound from "./assets/notification.mp3";
import "./Atendimento.css";
import { parseJwt } from "../../utils/auth";

// Normaliza conteúdo para string segura (evita quebra no card)
function contentToText(content) {
  if (content == null) return "";
  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        return parsed.text || parsed.caption || parsed.body || "[mensagem]";
      }
      return content;
    } catch {
      return content;
    }
  }
  if (typeof content === "object") {
    return content.text || content.caption || content.body || "[mensagem]";
  }
  return String(content);
}

export default function Atendimento() {
  const audioPlayer = useRef(null);
  const socketRef = useRef(null);
  const isWindowActiveRef = useRef(true);

  const selectedUserId = useConversationsStore((s) => s.selectedUserId);
  const setSelectedUserId = useConversationsStore((s) => s.setSelectedUserId);
  const setUserInfo = useConversationsStore((s) => s.setUserInfo);
  const mergeConversation = useConversationsStore((s) => s.mergeConversation);
  const loadUnreadCounts = useConversationsStore((s) => s.loadUnreadCounts);
  const loadLastReadTimes = useConversationsStore((s) => s.loadLastReadTimes);
  const incrementUnread = useConversationsStore((s) => s.incrementUnread);
  const getContactName = useConversationsStore((s) => s.getContactName);
  const conversations = useConversationsStore((s) => s.conversations);
  const notifiedConversations = useConversationsStore((s) => s.notifiedConversations);
  const markNotified = useConversationsStore((s) => s.markNotified);
  const userEmail = useConversationsStore((s) => s.userEmail);
  const userFilas = useConversationsStore((s) => s.userFilas);
  const setSocketStatus = useConversationsStore((s) => s.setSocketStatus);

  const [isWindowActive, setIsWindowActive] = useState(true);

  // Bootstrap do atendente
  useEffect(() => {
    document.title = "HubHMG - Atendimento";
    const token = localStorage.getItem("token");
    if (!token) return;
    const { email } = parseJwt(token) || {};
    if (!email) return;

    setUserInfo({ email, filas: [] });

    (async () => {
      try {
        const data = await apiGet(`/atendentes/${email}`);
        if (data?.email) {
          setUserInfo({
            email: data.email,
            filas: data.filas || [],
            name: `${data.name || ""} ${data.lastname || ""}`.trim(),
          });
        }
      } catch (err) {
        console.error("Erro ao buscar dados do atendente:", err);
      }
    })();
  }, [setUserInfo]);

  // Áudio de notificação
  useEffect(() => {
    audioPlayer.current = new Audio(notificationSound);
    audioPlayer.current.volume = 0.3;
    return () => audioPlayer.current?.pause();
  }, []);

  // Foco/blur e permissão de notificação
  useEffect(() => {
    const onFocus = () => {
      isWindowActiveRef.current = true;
      setIsWindowActive(true);
    };
    const onBlur = () => {
      isWindowActiveRef.current = false;
      setIsWindowActive(false);
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Reforça a conexão ao voltar para a aba (sem mexer nos listeners globais)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const socket = getSocket();
      if (socket && !socket.connected) {
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Notificação desktop
  const showNotification = (message, contactName) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") showNotification(message, contactName);
      });
      return;
    }
    if (Notification.permission !== "granted") return;

    const body = contentToText(message.content);
    const notif = new Notification(`Nova mensagem de ${contactName || message.user_id}`, {
      body,
      icon: "/icons/whatsapp.png",
      vibrate: [200, 100, 200],
    });
    notif.onclick = () => {
      window.focus();
      setSelectedUserId(message.user_id);
    };
  };

  // Listener GLOBAL de novas mensagens
  const handleNewMessage = useCallback(
    async (message) => {
      if (!message || !message.content) return;

      const isFromMe = message.direction === "outgoing";
      const isActiveChat = message.user_id === selectedUserId;
      const isWindowFocused = isWindowActiveRef.current;

      // ✅ Atualiza SEMPRE o card (mesmo se a conversa não estiver aberta)
      mergeConversation(message.user_id, {
        ticket_number: message.ticket_number || message.ticket,
        timestamp: message.timestamp,
        content: contentToText(message.content),
        channel: message.channel || "whatsapp",
        direction: message.direction,
        assigned_to: message.assigned_to,
        status: message.status,
      });

      // A partir daqui, só efeitos para o atendente dono do ticket
      if (isFromMe || message.assigned_to !== userEmail) return;

      if (isActiveChat && isWindowFocused) {
        try {
          await apiPut(`/messages/read-status/${message.user_id}`, {
            last_read: new Date().toISOString(),
          });
          await loadUnreadCounts();
        } catch (e) {
          console.error("Erro ao marcar como lida:", e);
        }
      } else {
        incrementUnread(message.user_id, message.timestamp);
        await loadUnreadCounts();

        if (!isWindowFocused && !notifiedConversations[message.user_id]) {
          const contactName = getContactName(message.user_id);
          showNotification(message, contactName);
          try {
            const player = audioPlayer.current;
            if (player) {
              await player.pause();
              player.currentTime = 0;
              await player.play();
            }
          } catch (err) {
            console.error("Erro ao tocar som de notificação:", err);
          }
          markNotified(message.user_id);
        }
      }
    },
    [
      userEmail,
      selectedUserId,
      mergeConversation,
      incrementUnread,
      loadUnreadCounts,
      getContactName,
      markNotified,
      notifiedConversations,
    ]
  );

  // Carrega conversas e conecta socket
  useEffect(() => {
    if (!userEmail || !(userFilas || []).length) return;
    let mounted = true;

    (async () => {
      try {
        await Promise.all([fetchConversations(), loadLastReadTimes(), loadUnreadCounts()]);
        if (!mounted) return;

        connectSocket();
        const socket = getSocket();
        socketRef.current = socket;

        socket.on("connect", async () => {
          setSocketStatus?.("online");
          try {
            await apiPut(`/atendentes/session/${userEmail}`, { session: socket.id });
            window.sessionStorage.setItem("sessionReady", "true");
          } catch (err) {
            console.error("Erro ao informar sessão ao servidor:", err);
          }
          socket.emit("identify", { email: userEmail, rooms: userFilas });
        });

        socket.on("disconnect", () => setSocketStatus?.("offline"));

        // IMPORTANTE: registra handler global (e remove por referência no cleanup)
        socket.on("new_message", handleNewMessage);
      } catch (err) {
        console.error("Erro na inicialização:", err);
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (!socket) return;
      socket.off("connect");
      socket.off("disconnect");
      socket.off("new_message", handleNewMessage);
    };
  }, [userEmail, userFilas, handleNewMessage, loadUnreadCounts, loadLastReadTimes, setSocketStatus]);

  // Busca/merge das conversas para os cards
  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams({
        assigned_to: userEmail,
        filas: (userFilas || []).join(","),
      });
      const data = await apiGet(`/chats?${params.toString()}`);
      (data || []).forEach((conv) => {
        mergeConversation(conv.user_id, {
          ...conv,
          content: contentToText(conv.content),
        });
      });
    } catch (err) {
      console.error("Erro ao buscar /chats:", err);
    }
  };

  const conversaSelecionada = selectedUserId ? conversations?.[selectedUserId] : null;

  return (
    <>
      <SocketDisconnectedModal />
      <div className="app-layout">
        <div className="app-container">
          <aside className="sidebar-wrapper">
            <div className="sidebar">
              <Sidebar />
            </div>
          </aside>

          <main className="chat-container">
            <ChatWindow userIdSelecionado={selectedUserId} conversaSelecionada={conversaSelecionada} />
          </main>

          <aside className="details-panel">
            <DetailsPanel userIdSelecionado={selectedUserId} conversaSelecionada={conversaSelecionada} />
          </aside>
        </div>

        <ToastContainer position="bottom-right" style={{ zIndex: 9999 }} />
      </div>
    </>
  );
}
