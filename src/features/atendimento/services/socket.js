// src/app/services/socket.js
// Adaptador Centrifugo que preserva a API usada pelo app:
// - connectSocket(), getSocket()
// - socket.on/off("new_message" | "update_message" | "queue_push" | "queue_pop" | "queue_count" | "ticket_created" | "ticket_closed")
// - socket.emit("join_room", room)  -> subscribe(room)
// - socket.emit("leave_room", room) -> unsubscribe(room)
// - socket.id                       -> clientId do Centrifugo

import { Centrifuge } from "centrifuge";
import { apiGet } from "../../../shared/apiClient";

let centrifuge = null;
let connected = false;

// Tabela de assinaturas por canal (room)
const subs = new Map();

// Bus publicador → lista de handlers por 'event' lógico
const listeners = new Map(); // key = eventName, value = Set<fn>

function emitLocal(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    try { fn(payload); } catch {}
  }
}

// Conecta no Centrifugo pegando o token do seu backend.
// Seu back deve expor algo como GET /realtime/token (JWT Centrifugo).
export async function connectSocket() {
  if (centrifuge && connected) return centrifuge;

  // Você pode usar envs no Vite:
  // VITE_WS_URL exemplo: wss://realtime.northgate.ninechat.com.br/connection/websocket
  const WS_URL = import.meta.env.VITE_WS_URL || "";
  if (!WS_URL) {
    console.warn("[realtime] VITE_WS_URL não definido");
    return null;
  }

  // Pega token de conexão no back (outra opção é embutir HS, mas recomendado é token curto)
  let token = "";
  try {
    const t = await apiGet("/realtime/token"); // implemente no back retornando { token }
    token = t?.token || "";
  } catch (e) {
    console.error("[realtime] falha ao buscar token", e);
  }

  centrifuge = new Centrifuge(WS_URL, {
    token: token || undefined,
    // reconexão padrão já inclusa
  });

  centrifuge.on("connected", ctx => {
    connected = true;
    // expõe um id estilo socket.id
    centrifuge.id = ctx.client; // compat
    console.log("[realtime] connected", ctx.client);
  });

  centrifuge.on("disconnected", ctx => {
    connected = false;
    console.warn("[realtime] disconnected", ctx.reason);
  });

  centrifuge.on("error", err => {
    console.warn("[realtime] error", err);
  });

  centrifuge.connect();
  return centrifuge;
}

export function getSocket() {
  if (!centrifuge) return null;

  // “Socket compatível” para o resto do app
  return {
    // compat c/ socket.io
    get connected() { return connected; },
    get id() { return centrifuge?.id || null; },

    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    },

    // “emit” só precisa tratar join/leave; demais ficaram no back via HTTP normal
    emit(name, payload) {
      if (name === "join_room") {
        const room = String(payload);
        return subscribeRoom(room);
      }
      if (name === "leave_room") {
        const room = String(payload);
        return unsubscribeRoom(room);
      }
      if (name === "identify") {
        // no-op (no Centrifugo não há namespace/socket room por identify)
        return;
      }
      // outros emits não são necessários aqui
    },

    connect() { centrifuge?.connect(); },
    disconnect() { centrifuge?.disconnect(); },
  };
}

// --- Subscriptions -------------------------------------------------

function subscribeRoom(room) {
  if (!centrifuge) return;
  if (subs.has(room)) return; // já assinado

  const sub = centrifuge.newSubscription(room);

  sub.on("publication", ctx => {
    // Esperamos que o back publique como: {event: "new_message", payload: {...}}
    // (isso você já preparou no worker/publicação)
    const data = ctx.data || {};
    const evt = data.event || data.type || null;
    const payload = data.payload != null ? data.payload : data;

    if (!evt) return;
    // Normaliza nomes já usados no front:
    // new_message, update_message, queue_push, queue_pop, queue_count, ticket_created, ticket_closed
    emitLocal(evt, payload);
  });

  sub.on("subscribed", ctx => {
    console.log("[realtime] subscribed:", room, "recoverable:", ctx.recovered);
  });
  sub.on("error", err => {
    console.warn("[realtime] sub error:", room, err);
  });
  sub.on("unsubscribed", () => {
    console.log("[realtime] unsubscribed:", room);
  });

  sub.subscribe();
  subs.set(room, sub);
}

function unsubscribeRoom(room) {
  const sub = subs.get(room);
  if (!sub) return;
  try { sub.unsubscribe(); } catch {}
  subs.delete(room);
}
