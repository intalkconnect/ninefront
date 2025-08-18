import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiGet, apiPut, apiPatch  } from "../../shared/apiClient";
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

    // encerra sessão ao fechar/atualizar a aba
  useEffect(() => {
    const onBeforeUnload = async () => {
      const s = getSocket();
      const sid = s?.id;
      if (!sid) return;
      try {
       // usa o MESMO resolvedor do apiClient (mesmo padrão do apiPut)
       const url = apiPath(`/atendentes/status/${encodeURIComponent(sid)}`);
       navigator.sendBeacon?.(url, new Blob([], { type: "application/json" }));
      } catch {
        // fallback “fire and forget”
        try { await apiPut(`/atendentes/status/${sid}`); } catch {}
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
    let heartbeatTimer = null;

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
          setSocketStatus?.("online");
          try {
            await apiPut(`/atendentes/session/${userEmail}`, { session: socket.id });
            window.sessionStorage.setItem("sessionReady", "true");
          } catch (err) {
            console.error("Erro ao informar sessão ao servidor:", err);
          }
          // identificação opcional
          socket.emit("identify", { email: userEmail, rooms: userFilas });

          // reentra em todos os rooms conhecidos após reconectar
          for (const rid of joinedRoomsRef.current) {
            socket.emit("join_room", rid);
          }
                   // ❤️ heartbeat periódico
          try { if (heartbeatTimer) clearInterval(heartbeatTimer); } catch {}
          heartbeatTimer = setInterval(async () => {
            try {
              await apiPut(`/atendentes/heartbeat`, { session: socket.id });
           } catch (e) {
              // silencioso: se cair, próxima batida tenta de novo
            }
          }, 30000); // 30s
        });

        socket.on("disconnect", () => setSocketStatus?.("offline"));
        socket.on("new_message", handleNewMessage);
        socket.on("update_message", handleUpdateMessage);

      } catch (err) {
        console.error("Erro na inicialização:", err);
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("new_message", handleNewMessage);
      socket.off("update_message", handleUpdateMessage);
      try { if (heartbeatTimer) clearInterval(heartbeatTimer); } catch {}
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
      const data = await apiGet(`/chats?${params.toString()}`);

      const socket = getSocket();

      (data || []).forEach((conv) => {
        const ts = conv.timestamp || conv.updated_at || new Date().toISOString();

        // atualiza card com preview
        mergeConversation(conv.user_id, {
          ...conv,
          content: contentToText(conv.content),
          last_message: buildPreview(conv),
          last_message_at: ts,
          updated_at: ts,
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
