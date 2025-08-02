import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiGet, apiPut } from "./services/apiClient";
import { connectSocket, getSocket } from "./services/socket";
import Sidebar from "./components/Sidebar/Sidebar";
import ChatWindow from "./components/ChatWindow/ChatWindow";
import DetailsPanel from "./components/DetailsPanel/DetailsPanel";
import SocketDisconnectedModal from "./components/SocketDisconnectedModal";
import useConversationsStore from "./store/useConversationsStore";
import notificationSound from "./assets/notification.mp3";
import "./Atendimento.css";
import { parseJwt } from "../../utils/auth";

export default function Atendimento() {
  const audioPlayer = useRef(null);

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
  const clearNotified = useConversationsStore((s) => s.clearNotified); // precisa existir na store!
  const clearUnread = useConversationsStore((s) => s.clearUnread);     // precisa existir na store!
  const userEmail = useConversationsStore((s) => s.userEmail);
  const userFilas = useConversationsStore((s) => s.userFilas);
  const setSocketStatus = useConversationsStore((s) => s.setSocketStatus);

  // Controle janela ativa
  const isWindowActiveRef = useRef(true);

  useEffect(() => {
    document.title = "HubHMG - Atendimento";
    const token = localStorage.getItem("token");
    if (!token) return;
    const { email } = parseJwt(token);
    if (!email) return;
    setUserInfo({ email, filas: [] });
    (async () => {
      try {
        const data = await apiGet(`/atendentes/${email}`);
        if (data?.email) setUserInfo({ email: data.email, filas: data.filas || [] });
      } catch (err) {
        console.error("Erro ao buscar dados do atendente:", err);
      }
    })();
  }, [setUserInfo]);

  useEffect(() => {
    audioPlayer.current = new Audio(notificationSound);
    audioPlayer.current.volume = 0.3;
    return () => audioPlayer.current?.pause();
  }, []);

  // Janela ativa/inativa e permissão de notificação
  useEffect(() => {
    const onFocus = () => { isWindowActiveRef.current = true; };
    const onBlur = () => { isWindowActiveRef.current = false; };
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

  // Ao selecionar conversa, limpa notified + unread (para permitir novas notificações do mesmo user)
  useEffect(() => {
    if (selectedUserId) {
      clearNotified(selectedUserId);
      clearUnread(selectedUserId);
    }
  }, [selectedUserId, clearNotified, clearUnread]);

  // Força reconexão do socket quando volta para aba
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const socket = getSocket();
        if (socket && !socket.connected) socket.connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Handler principal de mensagens novas (socket)
  const handleNewMessage = useCallback(
    async (message) => {
      if (!message || !message.content || message.assigned_to !== userEmail) return;
      const isFromMe = message.direction === "outgoing";
      const isActiveChat = message.user_id === selectedUserId;
      const isWindowFocused = isWindowActiveRef.current;

      mergeConversation(message.user_id, {
        ticket_number: message.ticket_number || message.ticket,
        timestamp: message.timestamp,
        content: message.content,
        channel: message.channel,
      });
      if (isFromMe) return;

      if (isActiveChat && isWindowFocused) {
        await apiPut(`/messages/read-status/${message.user_id}`, { last_read: new Date().toISOString() });
        await loadUnreadCounts();
      } else {
        incrementUnread(message.user_id, message.timestamp);
        await loadUnreadCounts();

        // Só notifica se a janela NÃO estiver ativa E nunca notificou para essa conversa desde última visualização
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
            // não trava se não tocar
          }
          markNotified(message.user_id); // marca como já notificado até o user abrir o chat
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

  // Inicialização, listeners do socket
  useEffect(() => {
    if (!userEmail || !userFilas.length) return;
    let mounted = true;
    (async () => {
      try {
        await Promise.all([
          fetchConversations(),
          loadLastReadTimes(),
          loadUnreadCounts(),
        ]);
        if (!mounted) return;
        connectSocket();
        const socket = getSocket();
        socket.on("connect", async () => {
          setSocketStatus("online");
          const sessionId = socket.id;
          try {
            await apiPut(`/atendentes/session/${userEmail}`, { session: sessionId });
            window.sessionStorage.setItem("sessionReady", "true");
          } catch (err) { }
          socket.emit("identify", { email: userEmail, rooms: userFilas });
        });
        socket.on("disconnect", () => setSocketStatus("offline"));
        socket.on("new_message", handleNewMessage);
      } catch (err) {
        console.error("Erro na inicialização:", err);
      }
    })();
    return () => {
      mounted = false;
      const socket = getSocket();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("new_message");
    };
  }, [
    userEmail,
    userFilas,
    handleNewMessage,
    loadUnreadCounts,
    loadLastReadTimes,
  ]);

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams({
        assigned_to: userEmail,
        filas: userFilas.join(","),
      });
      const data = await apiGet(`/chats?${params.toString()}`);
      data.forEach((conv) => mergeConversation(conv.user_id, conv));
    } catch (err) {
      console.error("Erro ao buscar /chats:", err);
    }
  };

  // Gera notificação visual browser
  const showNotification = (message, contactName) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") showNotification(message, contactName);
      });
      return;
    }
    if (Notification.permission !== "granted") return;

    let body;
    try {
      const parsed = JSON.parse(message.content);
      body = parsed.text || parsed.caption || "[mensagem]";
    } catch {
      body =
        typeof message.content === "string" && message.content.length > 50
          ? message.content.slice(0, 47) + "..."
          : message.content;
    }
    const notif = new Notification(
      `Nova mensagem de ${contactName || message.user_id}`,
      {
        body,
        icon: "/icons/whatsapp.png",
        vibrate: [200, 100, 200],
      }
    );
    notif.onclick = () => {
      window.focus();
      setSelectedUserId(message.user_id);
    };
  };

  const conversaSelecionada = selectedUserId
    ? conversations[selectedUserId]
    : null;

  return (
    <>
      <SocketDisconnectedModal />
      <div className="app-layout">
        <div className="app-container section-wrapper">
          <aside className="sidebar">
            <Sidebar />
          </aside>
          <main className="chat-container">
            <ChatWindow
              userIdSelecionado={selectedUserId}
              conversaSelecionada={conversaSelecionada}
            />
          </main>
          <aside className="details-panel">
            <DetailsPanel
              userIdSelecionado={selectedUserId}
              conversaSelecionada={conversaSelecionada}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
