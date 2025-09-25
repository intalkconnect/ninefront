// src/app/services/socket.js
// Adaptador Centrifugo compatível com a API do app (join_room/leave_room, on/off, socket.id)
import { Centrifuge } from "centrifuge";
import { apiGet } from "../../../shared/apiClient";

let centrifuge = null;
let connectPromise = null;
let isConnected = false;

// rooms que o app QUER manter ativas (para re-subscribe automático)
const desiredRooms = new Set();
// room -> Subscription
const subs = new Map();
// event -> Set<fn>
const listeners = new Map();

function emitLocal(evt, payload) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of set) { try { fn(payload); } catch {} }
}

function normalizeWsUrl(raw) {
  if (!raw) return "";
  return /\/connection\/websocket$/.test(raw)
    ? raw
    : raw.replace(/\/+$/, "") + "/connection/websocket";
}

async function fetchToken() {
  const { token } = await apiGet("/realtime/token");
  if (!token) throw new Error("token ausente");
  return token;
}

// ---------- CONEXÃO (singleton) ----------
export function connectSocket() {
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
      centrifuge.id = ctx.client; // compat socket.id
      console.log("[realtime] connected -> client:", ctx.client, "transport:", ctx.transport);

      // 🔁 re-assina tudo que o app marcou como desejado
      for (const room of desiredRooms) {
        const sub = subs.get(room);
        if (!sub || sub.state !== "subscribed") {
          try { subscribeRoom(room); } catch {}
        }
      }
    });

    centrifuge.on("disconnected", (ctx) => {
      isConnected = false;
      console.warn("[realtime] disconnected ->", ctx.reason);
      // NÃO chamar unsubscribe aqui; Centrifuge fará recover.
    });

    centrifuge.on("error", (err) => {
      console.warn("[realtime] error ->", err);
    });

    centrifuge.connect();
    return centrifuge;
  })();

  return connectPromise.finally(() => { connectPromise = null; });
}

// “socket compatível” para o resto do app
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
      if (name === "identify")   return;
    },

    connect() { centrifuge?.connect(); },
    // NÃO chame disconnect() em unmount normais – isso derruba as rooms.
    // Deixe o Centrifuge reconectar sozinho.
    _debug() {
      console.table([...subs.entries()].map(([room, sub]) => ({ room, state: sub.state })));
      console.log("desired:", [...desiredRooms]);
    }
  };
}

// ---------- SUBSCRIÇÕES ----------
async function subscribeRoom(room) {
  desiredRooms.add(room);

  const existing = subs.get(room);
  if (existing && existing.state === "subscribed") return existing;

  if (!centrifuge) await connectSocket();

  // se ainda não conectou, tenta de novo quando conectar
  if (!isConnected) {
    const t = setInterval(() => {
      if (isConnected) { clearInterval(t); subscribeRoom(room); }
    }, 100);
    return;
  }

  const sub = centrifuge.newSubscription(room);

  sub.on("publication", (ctx) => {
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

  sub.subscribe();
  subs.set(room, sub);
  return sub;
}

function unsubscribeRoom(room) {
  desiredRooms.delete(room);
  const sub = subs.get(room);
  if (!sub) return;
  try { sub.unsubscribe(); } catch {}
  subs.delete(room);
}
