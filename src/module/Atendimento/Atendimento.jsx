import React, { useEffect, useRef, useState, useCallback } from "react";
import { getRuntimeConfig } from "../../shared/runtimeConfig";
import { apiGet, apiPut } from "../../shared/apiClient";
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

/** Converte diferentes formatos de content para texto */
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

/** Texto curto para o card da sidebar (independe do canal) */
function buildPreview(msg) {
  const c = msg?.content || {};
  const plain =
    c.text ||
    c.body ||
    c.caption ||
    c.message ||
    contentToText(c) ||
    "";

  if (plain) return String(plain).slice(0, 120);

  // rótulos para mídias
  if (c.image || c.photo || c.url?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i)) return "📷 Imagem";
  if (c.document || c.url?.match(/\.(pdf|docx?|xlsx?|pptx?)$/i)) return "📄 Documento";
  if (c.audio || c.voice) return "🎙️ Áudio";
  if (c.video) return "🎬 Vídeo";
  if (c.location || (c.latitude && c.longitude)) return "📍 Localização";
  return "[mensagem]";
}

export default function Atendimento() {
  const audioPlayer        = useRef(null);
  const socketRef          = useRef(null);
  const isWindowActiveRef  = useRef(true);

  // agregador de notificações
  const notifBucketRef     = useRef({ total: 0, perUser: new Map() });
  const notifTimerRef      = useRef(null);

  // rooms já aderidos (evita re-join repetido)
  const joinedRoomsRef     = useRef(new Set());

  const selectedUserId     = useConversationsStore((s) => s.selectedUserId);
  const setSelectedUserId  = useConversationsStore((s) => s.setSelectedUserId);
  const setUserInfo        = useConversationsStore((s) => s.setUserInfo);
  const mergeConversation  = useConversationsStore((s) => s.mergeConversation);
  const loadUnreadCounts   = useConversationsStore((s) => s.loadUnreadCounts);
  const loadLastReadTimes  = useConversationsStore((s) => s.loadLastReadTimes);
  const incrementUnread    = useConversationsStore((s) => s.incrementUnread);
  const conversations      = useConversationsStore((s) => s.conversations);
  const userEmail          = useConversationsStore((s) => s.userEmail);
  const userFilas          = useConversationsStore((s) => s.userFilas);
  const setSocketStatus    = useConversationsStore((s) => s.setSocketStatus);
  const heartbeatRef = useRef(null);
  

  const [isWindowActive, setIsWindowActive] = useState(true);

useEffect(() => {
  const onRoomClosed = (e) => {
    const rid = e?.detail?.userId;
    if (!rid) return;

   // opcional: garante leave no servidor também (idempotente)
   try {
     const s = getSocket();
     if (s?.connected) s.emit('leave_room', rid);
   } catch {}

    if (joinedRoomsRef.current.has(rid)) {
      joinedRoomsRef.current.delete(rid); // impede re-join futuro
    }
  };
  window.addEventListener('room-closed', onRoomClosed);
  return () => window.removeEventListener('room-closed', onRoomClosed);
}, []);

  // ————— utils —————
  const joinRoom = useCallback((userId) => {
    if (!userId) return;
    if (joinedRoomsRef.current.has(userId)) return;
    const s = getSocket();
    if (!s) return;
    s.emit("join_room", userId);
    joinedRoomsRef.current.add(userId);
  }, []);

  // agrega notificações e mostra uma única popup (todas as origens/canais)
  const flushAggregateNotification = useCallback(async () => {
    const bucket = notifBucketRef.current;
    const total  = bucket.total;
    const convs  = bucket.perUser.size;

    if (!total) return;

    if (!("Notification" in window)) {
      bucket.total = 0; bucket.perUser.clear();
      return;
    }
    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    if (Notification.permission !== "granted") {
      bucket.total = 0; bucket.perUser.clear();
      return;
    }

    const title = `Você tem ${total} nova${total > 1 ? "s" : ""} mensagem${total > 1 ? "s" : ""}`;
    const body  = convs > 1 ? `em ${convs} conversas` : `em 1 conversa`;

    try {
      const n = new Notification(title, {
        body,
        icon: "/logo-front.png",
        tag: "new-messages",  // substitui a anterior
        renotify: true,
        vibrate: [200, 100, 200],
      });
      n.onclick = () => { window.focus(); };
      // som 1x por flush
      try {
        const player = audioPlayer.current;
        if (player) {
          await player.pause();
          player.currentTime = 0;
          await player.play();
        }
      } catch (err) { console.error("Erro ao tocar som de notificação:", err); }
    } finally {
      bucket.total = 0;
      bucket.perUser.clear();
    }
  }, []);

  const queueAggregateNotification = useCallback((msg) => {
    // só notifica se a aba NÃO estiver ativa
    if (isWindowActiveRef.current) return;

    const bucket = notifBucketRef.current;
    const uid    = msg?.user_id;
    bucket.total += 1;
    if (uid) bucket.perUser.set(uid, (bucket.perUser.get(uid) || 0) + 1);

    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(flushAggregateNotification, 800);
  }, [flushAggregateNotification]);

  // ————— bootstrap do atendente —————
  useEffect(() => {
    document.title = "NineChat - Atendimento";
    const token = localStorage.getItem("token");
    if (!token) return;
    const { email } = parseJwt(token) || {};
    if (!email) return;

    setUserInfo({ email, filas: [] });

    (async () => {
      try {
        const data = await apiGet(`/agents/${email}`);
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

  // som de notificação e limpeza
  useEffect(() => {
    audioPlayer.current = new Audio(notificationSound);
    audioPlayer.current.volume = 0.3;
    return () => {
      audioPlayer.current?.pause();
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    };
  }, []);

  // foco/blur
  useEffect(() => {
    const onFocus = () => { isWindowActiveRef.current = true; setIsWindowActive(true); };
    const onBlur  = () => { isWindowActiveRef.current = false; setIsWindowActive(false); };
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

  // reforça conexão ao voltar pro foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const socket = getSocket();
      if (socket && !socket.connected) socket.connect();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const { apiBaseUrl } = getRuntimeConfig();

// encerra sessão ao fechar/atualizar a aba (marca INATIVO no back)
useEffect(() => {
  const onBeforeUnload = () => {
    try {
      const token = localStorage.getItem("token");
      const { email } = parseJwt(token) || {};
      if (!email) return;

      const url = `${apiBaseUrl}/agents/presence/${encodeURIComponent(email)}`;
      const body = JSON.stringify({ status: "inativo" }); // Mude para "inativo"
      const blob = new Blob([body], { type: "application/json" });

      navigator.sendBeacon?.(url, blob);
    } catch {
      const token = localStorage.getItem("token");
      const { email } = parseJwt(token) || {};
      if (!email) return;
      apiPut(`/atendentes/presence/${email}`, { status: "inativo" }).catch(() => {}); // Mude para "inativo"
    }
  };

  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
}, []);


  // ————— handlers de realtime —————

  // Atualiza cards, unread e notificação agregada (todos os canais)
  const handleNewMessage = useCallback(
    async (message) => {
      if (!message || !message.content) return;

      const isFromMe     = message.direction === "outgoing";
      const isActiveChat = message.user_id === selectedUserId;
      const ts           = message.timestamp || new Date().toISOString();
      const preview      = buildPreview(message);

      // Atualiza card (preview/horário)
      mergeConversation(message.user_id, {
        ticket_number: message.ticket_number || message.ticket,
        content: contentToText(message.content),
        channel: message.channel,
        direction: message.direction,
        timestamp: ts,
        last_message: preview,
        last_message_at: ts,
        updated_at: ts
      });

      // Determina se a conversa é “minha”:
      const state       = useConversationsStore.getState();
      const convStore   = state.conversations?.[message.user_id];
      const assignedTo  = message.assigned_to ?? convStore?.assigned_to;
      const isMine      = assignedTo ? (assignedTo === userEmail) : true; // fallback seguro

      if (isMine) joinRoom(message.user_id);
      if (isFromMe) return; // saídas não geram unread/notificação

      if (isMine) {
        if (isActiveChat && isWindowActiveRef.current) {
          try {
            await apiPut(`/messages/read-status/${message.user_id}`, {
              last_read: new Date().toISOString(),
            });
            await loadUnreadCounts();
          } catch (e) {
            console.error("Erro ao marcar como lida:", e);
          }
        } else {
          incrementUnread(message.user_id, ts);
          await loadUnreadCounts();
          // 🔔 agrega notificação (independe do canal)
          queueAggregateNotification(message);
        }
      }
    },
    [
      userEmail,
      selectedUserId,
      mergeConversation,
      incrementUnread,
      loadUnreadCounts,
      joinRoom,
      queueAggregateNotification,
    ]
  );

  // Confirmações/erros de envio também atualizam o card
  const handleUpdateMessage = useCallback(
    async (message) => {
      if (!message) return;
      const ts      = message.timestamp || new Date().toISOString();
      const preview = buildPreview(message);

      mergeConversation(message.user_id, {
        content: contentToText(message.content),
        channel: message.channel,
        direction: message.direction,
        timestamp: ts,
        last_message: preview,
        last_message_at: ts,
        updated_at: ts,
        status: message.status,
      });

      const state       = useConversationsStore.getState();
      const convStore   = state.conversations?.[message.user_id];
      const assignedTo  = message.assigned_to ?? convStore?.assigned_to;
      const isMine      = assignedTo ? (assignedTo === userEmail) : true;
      if (isMine) joinRoom(message.user_id);
    },
    [mergeConversation, joinRoom, userEmail]
  );

  // ————— bootstrap socket + listeners —————
useEffect(() => {
  if (!userEmail || !(userFilas || []).length) return;
  let mounted = true;

  const startHeartbeat = (socket) => {
    try { if (heartbeatRef.current) clearInterval(heartbeatRef.current); } catch {}
    heartbeatRef.current = setInterval(async () => {
      try {
        // console.debug('[hb] ping', new Date().toISOString(), socket.id);
        await apiPut(`/agents/heartbeat`, { session: socket.id, email: userEmail });
      } catch {
        // silencioso
      }
    }, 30000); // 30s
  };

  const onConnect = async () => {
    if (!mounted) return;
    setSocketStatus?.("online");
// marca o atendente como INATIVO no refresh (por EMAIL)

    const sock = getSocket();
    sock.emit("identify", { email: userEmail, rooms: userFilas });

    // rejoin rooms conhecidos
    for (const rid of joinedRoomsRef.current) {
      sock.emit("join_room", rid);
    }

    startHeartbeat(sock);
  };

  const onDisconnect = () => {
    setSocketStatus?.("offline");
    try { if (heartbeatRef.current) clearInterval(heartbeatRef.current); } catch {}
  };

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

      socket.off("connect", onConnect);
      socket.on("connect", onConnect);

      socket.off("disconnect", onDisconnect);
      socket.on("disconnect", onDisconnect);

      socket.off("new_message", handleNewMessage);
      socket.on("new_message", handleNewMessage);

      socket.off("update_message", handleUpdateMessage);
      socket.on("update_message", handleUpdateMessage);

      // se já estiver conectado, roda o fluxo agora
      if (socket.connected) {
        await onConnect();
      }
    } catch (err) {
      console.error("Erro na inicialização:", err);
    }
  })();

  return () => {
    mounted = false;
    const socket = getSocket();
    if (socket) {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new_message", handleNewMessage);
      socket.off("update_message", handleUpdateMessage);
    }
    try { if (heartbeatRef.current) clearInterval(heartbeatRef.current); } catch {}
  };
}, [
  userEmail,
  userFilas,
  handleNewMessage,
  handleUpdateMessage,
  loadUnreadCounts,
  loadLastReadTimes,
  setSocketStatus,
]);

  // ————— carga inicial de conversas + auto-join rooms atribuídos —————
  const fetchConversations = async () => {
    try {
      const params = new URLSearchParams({
        assigned_to: userEmail,
        filas: (userFilas || []).join(","),
      });
      const data = await apiGet(`/conversations?${params.toString()}`);

      const socket = getSocket();

      (data || []).forEach((conv) => {
        const ts = conv.timestamp || conv.updated_at || new Date().toISOString();

// já vem com last_message e last_message_at do backend
mergeConversation(conv.user_id, {
  ...conv,
  content: conv.last_message,        // opcional manter compat
  last_message: conv.last_message,   // já pronto do back
  last_message_at: conv.last_message_at,
  updated_at: conv.last_message_at || conv.updated_at
});


        // se está atribuído e aberto, entra no room
        const isMine = conv.assigned_to === userEmail;
        const isOpen = !conv.status || String(conv.status).toLowerCase() === "open";
        if (socket && isMine && isOpen) {
          joinRoom(conv.user_id);
        }
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
