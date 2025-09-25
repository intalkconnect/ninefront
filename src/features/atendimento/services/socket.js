// Adaptador Centrifugo mantendo API compatível com o app:
//
// - connectSocket(), getSocket()
// - socket.on/off("new_message" | "update_message" | "queue_push" | "queue_pop" | "queue_count" | "ticket_created" | "ticket_closed")
// - socket.emit("join_room", room)  -> subscribe(room)
// - socket.emit("leave_room", room) -> unsubscribe(room)
// - socket.id                       -> clientId do Centrifugo

import { Centrifuge } from "centrifuge";
import { apiGet } from "../../../shared/apiClient";

let centrifuge = null;
let connected = false;
const subs = new Map();            // room -> subscription
const listeners = new Map();       // event -> Set<fn>

function emitLocal(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch {}
  }
}

function normalizeWsUrl(raw) {
  if (!raw) return "";
  // garante o sufixo /connection/websocket
  if (!/\/connection\/websocket$/.test(raw)) {
    return raw.replace(/\/+$/, "") + "/connection/websocket";
  }
  return raw;
}

// Busca token no backend (deve responder { token: "<jwt>" })
async function fetchToken() {
  const data = await apiGet("/realtime/token");
  if (!data?.token) throw new Error("token ausente");
  return data.token;
}

// Conecta no Centrifugo.
// VITE_WS_URL               => wss://realtime.northgate.ninechat.com.br/connection/websocket
// VITE_CENTRIFUGO_INSECURE  => "true" para permitir conexão sem token (apenas testes)
export async function connectSocket() {
  if (centrifuge && connected) return centrifuge;

  const WS_URL_RAW = import.meta.env.VITE_WS_URL || "";
  const WS_URL = normalizeWsUrl(WS_URL_RAW);
  const ALLOW_INSECURE = String(import.meta.env.VITE_CENTRIFUGO_INSECURE || "").toLowerCase() === "true";

  if (!WS_URL) {
    console.warn("[realtime] VITE_WS_URL não definido");
    return null;
  }

  // Use o hook getToken para o Centrifuge renovar token quando necessário.
  let getToken;
  if (!ALLOW_INSECURE) {
    getToken = async () => {
      try {
        return await fetchToken();
      } catch (e) {
        console.error("[realtime] falha ao buscar token:", e?.message || e);
        throw e;
      }
    };
  }

  centrifuge = new Centrifuge(WS_URL, {
    // se insecure=false no servidor, `getToken` é obrigatório
    // se insecure=true no servidor, pode conectar sem token (apenas testes)
    ...(getToken ? { getToken } : {}),
    // ajustes de reconexão (opcional)
    minReconnectDelay: 500,
    maxReconnectDelay: 5000,
  });

  centrifuge.on("connected", (ctx) => {
    connected = true;
    // compat com socket.io: expor um "id"
    centrifuge.id = ctx.client;
    console.log("[realtime] connected -> client:", ctx.client, "transport:", ctx.transport);
  });

  centrifuge.on("disconnected", (ctx) => {
    connected = false;
    console.warn("[realtime] disconnected ->", ctx.reason);
  });

  centrifuge.on("error", (err) => {
    console.warn("[realtime] error ->", err);
  });

  centrifuge.connect();
  return centrifuge;
}

export function getSocket() {
  if (!centrifuge) return null;

  return {
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

    emit(name, payload) {
      if (name === "join_room") {
        return subscribeRoom(String(payload));
      }
      if (name === "leave_room") {
        return unsubscribeRoom(String(payload));
      }
      if (name === "identify") {
        // no-op no Centrifugo
        return;
      }
      // demais emits não são necessários: publicações vêm do back via HTTP publish/API
    },

    connect() { centrifuge?.connect(); },
    disconnect() { centrifuge?.disconnect(); },
  };
}

// ---------------- Subscriptions ----------------

function subscribeRoom(room) {
  if (!centrifuge) return;
  if (subs.has(room)) return;

  const sub = centrifuge.newSubscription(room);

  sub.on("publication", (ctx) => {
    // Publicamos do back como { event: "new_message", payload: {...} }
    const data = ctx.data || {};
    const evt = data.event || data.type || null;
    const payload = data.payload != null ? data.payload : data;
    if (evt) emitLocal(evt, payload);
  });

  sub.on("subscribed", (ctx) => {
    console.log("[realtime] subscribed:", room, "recovered:", ctx.recovered);
  });
  sub.on("error", (err) => {
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
