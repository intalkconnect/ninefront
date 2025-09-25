// src/app/services/socket.js
// Adaptador Centrifugo compatível com a API do app:
// - connectSocket(), getSocket()
// - socket.on/off("new_message" | "update_message" | "queue_push" | "queue_pop" | "queue_count" | "ticket_created" | "ticket_closed")
// - socket.emit("join_room", room)  -> assina canal
// - socket.emit("leave_room", room) -> desassina canal
// - socket.id                       -> clientId do Centrifugo

import { Centrifuge } from "centrifuge";
import { apiGet } from "../../../shared/apiClient";

let centrifuge = null;
let connectPromise = null;
let isConnected = false;

// Rooms que o app deseja manter ativas (para re-subscribe após reconnect)
const desiredRooms = new Set();
// room -> Subscription
const subs = new Map();
// event -> Set<fn>
const listeners = new Map();

// ---------------- utils ----------------
function emitLocal(evt, payload) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch {}
  }
}

function normalizeWsUrl(raw) {
  if (!raw) return "";
  return /\/connection\/websocket$/.test(raw)
    ? raw
    : raw.replace(/\/+$/, "") + "/connection/websocket";
}

async function fetchToken() {
  const { token } = await apiGet("/realtime/token"); // seu backend deve retornar { token }
  if (!token) throw new Error("token ausente");
  return token;
}

// ---------------- conexão (singleton) ----------------
export function connectSocket() {
  // se já tem cliente e já está conectando/conectado, reutiliza
  if (centrifuge && (isConnected || connectPromise)) {
    return connectPromise ?? Promise.resolve(centrifuge);
  }

  connectPromise = (async () => {
    const WS_URL = normalizeWsUrl(import.meta.env.VITE_WS_URL || "");
    const INSECURE =
      String(import.meta.env.VITE_CENTRIFUGO_INSECURE || "").toLowerCase() === "true";

    if (!WS_URL) {
      console.warn("[realtime] VITE_WS_URL não definido");
      connectPromise = null;
      return null;
    }

    let getToken;
    if (!INSECURE) {
      getToken = async () => {
        try { return await fetchToken(); }
        catch (e) { console.error("[realtime] token:", e?.message || e); throw e; }
      };
    }

    centrifuge = new Centrifuge(WS_URL, {
      ...(getToken ? { getToken } : {}),
      minReconnectDelay: 500,
      maxReconnectDelay: 5000,
    });

    centrifuge.on("connected", (ctx) => {
      isConnected = true;
      centrifuge.id = ctx.client; // compat com socket.io
      console.log("[realtime] connected -> client:", ctx.client, "transport:", ctx.transport);

      // 🔁 re-ativa todas as rooms desejadas sem criar duplicatas
      for (const room of desiredRooms) {
        const sub = subs.get(room);
        if (!sub) {
          // nunca criamos sub para esse room ainda (primeira conexão)
          subscribeRoom(room);
          continue;
        }
        // se já existe, apenas garante que esteja assinada
        if (sub.state === "unsubscribed") {
          try { sub.subscribe(); } catch (e) {
            console.warn("[realtime] resubscribe fail:", room, e);
          }
        }
        // estados "subscribing" ou "subscribed": não fazer nada
      }
    });

    centrifuge.on("disconnected", (ctx) => {
      isConnected = false;
      console.warn("[realtime] disconnected ->", ctx.reason);
      // não dá unsubscribe aqui; o Centrifuge fará recover/handshake.
    });

    centrifuge.on("error", (err) => {
      console.warn("[realtime] error ->", err);
    });

    centrifuge.connect();
    return centrifuge;
  })();

  return connectPromise.finally(() => { connectPromise = null; });
}

// ---------------- API compatível ----------------
export function getSocket() {
  return {
    get connected() { return isConnected; },
    get id() { return centrifuge?.id || null; },

    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
    },
    off(evt, fn) {
      const set = listeners.get(evt);
      if (!set) return;
      set.delete(fn);
      if (set.size === 0) listeners.delete(evt);
    },

    emit(name, payload) {
      if (name === "join_room")  return subscribeRoom(String(payload));
      if (name === "leave_room") return unsubscribeRoom(String(payload));
      if (name === "identify")   return; // no-op no Centrifugo
      // outros emits: publicações devem vir do back via HTTP /api (publish)
    },

    connect() { centrifuge?.connect(); },
    // não usar disconnect() em unmount comuns — isso derruba as rooms
    // deixe o Centrifuge reconectar sozinho

    // util de depuração
    _debug() {
      console.table([...subs.entries()].map(([room, sub]) => ({
        room, state: sub.state
      })));
      console.log("desired:", [...desiredRooms]);
    }
  };
}

// ---------------- subscriptions ----------------
async function subscribeRoom(room) {
  desiredRooms.add(room);

  // se já temos sub criada para o room, apenas garante que esteja ativa
  const existing = subs.get(room);
  if (existing) {
    if (existing.state === "unsubscribed") {
      try { existing.subscribe(); } catch (e) {
        console.warn("[realtime] subscribe fail:", room, e);
      }
    }
    return existing;
  }

  if (!centrifuge) await connectSocket();

  // se ainda não conectou, agenda subscribe após conectar
  if (!isConnected) {
    const t = setInterval(() => {
      if (isConnected) { clearInterval(t); subscribeRoom(room); }
    }, 100);
    return;
  }

  const sub = centrifuge.newSubscription(room);

  sub.on("publication", (ctx) => {
    // O worker publica como: { event: "new_message", payload: {...} }
    const data = ctx.data || {};
    const evt = data.event || data.type || null;
    const payload = data.payload ?? data;
    if (evt) emitLocal(evt, payload);
  });
  sub.on("subscribed", (ctx) => {
    console.log("[realtime] subscribed:", room, "recovered:", ctx.recovered);
  });
  sub.on("unsubscribed", () => {
    console.log("[realtime] unsubscribed:", room);
  });
  sub.on("error", (err) => {
    console.warn("[realtime] sub error:", room, err);
  });

  // registra ANTES de assinar para evitar duplicatas em reconnect
  subs.set(room, sub);
  sub.subscribe();
  return sub;
}

function unsubscribeRoom(room) {
  desiredRooms.delete(room);
  const sub = subs.get(room);
  if (!sub) return;
  try { sub.unsubscribe(); } catch {}
  subs.delete(room);
}
