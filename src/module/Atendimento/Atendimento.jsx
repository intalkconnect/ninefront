import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiGet, apiPut } from "./services/apiClient";
import { connectSSE, on, onStatusChange, setRooms } from "./services/sse";
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

export default function Atendimento() {
  const audioPlayer = useRef(null);
  const isWindowActiveRef = useRef(true);

  const selectedUserId = useConversationsStore((s) => s.selectedUserId);
  const setSelectedUserId = useConversationsStore((s) => s.setSelectedUserId);
  const setUserInfo = useConversationsStore((s) => s.setUserInfo);
const mergeConversation = useConversationsStore((s) => s.mergeConversation);
 const appendMessage     = useConversationsStore((s) => s.appendMessage);
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

  // boot + dados do atendente
  useEffect(() => {
    document.title = "HubHMG - Atendimento";
    const token = localStorage.getItem("token");
    if (!token) return;

    const { email } = parseJwt(token) || {};
    if (!email) return;

    setUserInfo({ email, filas: [] }); // limpa antes

    (async () => {
      try {
        const data = await apiGet(`/api/v1/atendentes/${email}`);
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

  // som de notificação
  useEffect(() => {
    audioPlayer.current = new Audio(notificationSound);
    audioPlayer.current.volume = 0.3;
    return () => audioPlayer.current?.pause();
  }, []);

  // detectar foco da janela + pedir permissão de Notification
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

  // reconectar ao voltar para a aba (com SSE basta reconectar)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Reabre a conexão SSE ouvindo as salas atuais
      const rooms = ["broadcast"];
      if (selectedUserId) rooms.push(`chat-${String(selectedUserId)}`);
      connectSSE(rooms);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [selectedUserId]);


  // handler para novas mensagens (mantido)
  const handleNewMessage = useCallback(
    async (message) => {
      if (!message || !message.content) return;

      const isFromMe = message.direction === "outgoing";
      const isActiveChat = String(message.user_id) === String(selectedUserId);
      const isWindowFocused = isWindowActiveRef.current;

      // tenta descobrir se é “minha” conversa usando a store como fallback
      const conv = conversations[message.user_id];
      const assignedToMe = message.assigned_to
        ? message.assigned_to === userEmail
        : (conv?.assigned_to ? conv.assigned_to === userEmail : true); // default: true
      const inMyQueue = conv?.fila ? userFilas.includes(conv?.fila) : true;

      mergeConversation(message.user_id, {
        ticket_number: message.ticket_number || message.ticket,
        timestamp: message.timestamp,
        content: message.content,
        channel: message.channel,
        assigned_to: message.assigned_to ?? conv?.assigned_to,
        fila: message.fila ?? conv?.fila,
      });

       // >>> atualiza a thread aberta (imutável)
 appendMessage(message.user_id, message);
      
      if (isFromMe) return;

      if (isActiveChat && isWindowFocused && assignedToMe && inMyQueue) {
        await apiPut(`/api/v1/messages/read-status/${message.user_id}`, {
          last_read: new Date().toISOString(),
        });
        await loadUnreadCounts();
      } else {
        if (assignedToMe && inMyQueue) {
          incrementUnread(message.user_id, message.timestamp);
          await loadUnreadCounts();
        }

        if (!isWindowFocused && !notifiedConversations[message.user_id] && assignedToMe && inMyQueue) {
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
      conversations,
      userFilas,
      mergeConversation,
      incrementUnread,
      loadUnreadCounts,
      getContactName,
      markNotified,
      notifiedConversations,
    ]
  );

    // Adicione este debug no useEffect do SSE
useEffect(() => {
  if (!userEmail) return;

  const offNew = on('new_message', (raw) => {
    console.log('SSE new_message received:', raw); // Debug
    handleNewMessage(raw);
  });

  return () => offNew?.();
}, [userEmail, handleNewMessage]);

  // inicialização do SSE + listeners
  useEffect(() => {
    if (!userEmail || !userFilas.length) return;

    let mounted = true;

    // Conectar SSE ouvindo broadcast (base). A sala do chat selecionado é gerenciada abaixo.
    connectSSE(["broadcast"]);
    onStatusChange(setSocketStatus);

    (async () => {
      try {
        await Promise.all([fetchConversations(), loadLastReadTimes(), loadUnreadCounts()]);
        if (!mounted) return;

        const offNew = on("new_message", handleNewMessage);
        const offStatus = on("message_status", (payload) => {
          // se você já tem um handler específico, mantenha aqui
          // ex.: atualizar status de mensagem na UI
          // console.debug('message_status', payload);
        });

        // cleanup
        return () => {
          offNew?.();
          offStatus?.();
        };
      } catch (err) {
        console.error("Erro na inicialização:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userEmail, userFilas, handleNewMessage, loadUnreadCounts, loadLastReadTimes, setSocketStatus]);

  // ajustar rooms conforme a conversa selecionada muda
  useEffect(() => {
    const rooms = ["broadcast"];
    if (selectedUserId) rooms.push(`chat-${String(selectedUserId)}`);
    console.log('[SSE][Atendimento] setRooms ->', rooms);
    setRooms(rooms);
  }, [selectedUserId]);

  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams({
        assigned_to: userEmail,
        filas: userFilas.join(","),
      });
      const data = await apiGet(`/api/v1/chats?${params.toString()}`);
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
      body = message.content.length > 50 ? message.content.slice(0, 47) + "..." : message.content;
    }

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

  const conversaSelecionada = selectedUserId ? conversations[selectedUserId] : null;

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

        <ToastContainer position="bottom-right" style={{ zIndex: 9999 }} />
      </div>
    </>
  );
}
