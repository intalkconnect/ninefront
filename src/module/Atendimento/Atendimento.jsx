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
  const notifiedConversations = useConversationsStore(
    (s) => s.notifiedConversations
  );
  const markNotified = useConversationsStore((s) => s.markNotified);
  const userEmail = useConversationsStore((s) => s.userEmail);
  const userFilas = useConversationsStore((s) => s.userFilas);
  const setSocketStatus = useConversationsStore((s) => s.setSocketStatus);

  const [isWindowActive, setIsWindowActive] = useState(true);

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
        if (data?.email) {
          setUserInfo({ email: data.email, filas: data.filas || [] });
        }
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

  const handleNewMessage = useCallback(
    async (message) => {
      if (!message || !message.content || message.assigned_to !== userEmail) {
        console.warn(
          "[Notificação] Mensagem ignorada: dados incompletos ou não atribuída a este atendente."
        );
        return;
      }

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
        await apiPut(`/messages/read-status/${message.user_id}`, {
          last_read: new Date().toISOString(),
        });
        await loadUnreadCounts();
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
        socketRef.current = socket;

        socket.on("connect", async () => {
          setSocketStatus("online");
          const sessionId = socket.id;
          try {
            await apiPut(`/atendentes/session/${userEmail}`, {
              session: sessionId,
            });

            // ✅ Sinalizar que está pronto para SocketDisconnectedModal
            window.sessionStorage.setItem("sessionReady", "true");
          } catch (err) {
            console.error("Erro ao informar sessão ao servidor:", err);
          }

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

  const showNotification = (message, contactName) => {
    if (!("Notification" in window)) {
      console.warn("[Notificação] API Notification não está disponível.");
      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          showNotification(message, contactName);
        } else {
          console.warn("[Notificação] Permissão negada.");
        }
      });
      return;
    }

    if (Notification.permission !== "granted") {
      console.warn("[Notificação] Permissão não concedida.");
      return;
    }

    let body;
    try {
      const parsed = JSON.parse(message.content);
      body = parsed.text || parsed.caption || "[mensagem]";
    } catch {
      body =
        message.content.length > 50
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
