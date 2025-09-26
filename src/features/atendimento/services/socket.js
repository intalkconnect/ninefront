// src/app/services/socket.js
// Adaptador Centrifugo compatível com a API do app:
// - connectSocket(), getSocket()
// - socket.on/off("new_message" | "update_message" | "queue_push" | "queue_pop" | "queue_count" | "ticket_created" | "ticket_closed")
// - socket.emit("join_room", room)  -> assina canal
// - socket.emit("leave_room", room) -> desassina canal
// - socket.id                       -> clientId do Centrifugo

import { Centrifuge } from "centrifuge";
import { getRuntimeConfig } from "../../../shared/runtimeConfig";
import { parseJwt } from "../../../app/utils/auth";

let centrifuge = null;
let connectPromise = null;
let isConnected = false;

// Rooms que o app deseja manter ativas (para re-subscribe após reconnect)
const desiredRooms = new Set();
// room lógico -> Subscription
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

// mapeia room lógico p/ canal real no Centrifugo:
// - rooms "queue:*" permanecem como estão (para casar com o publish do worker)
// - demais rooms viram "conv:t:<tenant>:<room>"
function toChannel(room) {
  const { tenant } = getRuntimeConfig();
  if (room.startsWith("queue:")) return room;
  return room.startsWith("conv:") ? room : `conv:t:${tenant}:${room}`;
}

// ---------------- tokens ----------------
async function fetchConnectToken() {
  const { apiBaseUrl, tenant } = getRuntimeConfig();
  const token = localStorage.getItem("token");
  const { email } = parseJwt(token) || {};

  const r = await fetch(`${apiBaseUrl}/realtime/token`, {
    headers: {
      "X-Tenant": tenant,
      ...(email ? { "X-User-Id": email } : {})
    },
    credentials: "include",
  });
  if (!r.ok) throw new Error("GET /realtime/token failed");
  const { token: t } = await r.json();
  if (!t) throw new Error("token ausente");
  return t;
}

async function fetchSubscribeToken(channel, client) {
  const { apiBaseUrl, tenant } = getRuntimeConfig();
  const token = localStorage.getItem("token");
  const { email } = parseJwt(token) || {};

  const r = await fetch(`${apiBaseUrl}/realtime/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant": tenant,
      ...(email ? { "X-User-Id": email } : {}),
    },
    body: JSON.stringify({ channel, client }),
    credentials: "include",
  });
  if (!r.ok) throw new Error("POST /realtime/subscribe failed");
  const { token: t } = await r.json();
  if (!t) throw new Error("subscribe token ausente");
  return t;
}

// ---------------- conexão (singleton) ----------------
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
        try { return await fetchConnectToken(); }
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
          // primeira conexão
          subscribeRoom(room);
          continue;
        }
        if (sub.state === "unsubscribed") {
          try { sub.subscribe(); } catch (e) {
            console.warn("[realtime] resubscribe fail:", room, e);
          }
        }
      }
    });

    centrifuge.on("disconnected", (ctx) => {
      isConnected = false;
      console.warn("[realtime] disconnected ->", ctx.reason);
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

  const channel = toChannel(room);

  // conv:* e queue:* privados → exigem subscribe token
  const needsSubToken = channel.startsWith("conv:") || channel.startsWith("queue:");

  const sub = centrifuge.newSubscription(
    channel,
    needsSubToken ? {
      getToken: async () => {
        const clientId = centrifuge?.id;
        if (!clientId) throw new Error("clientId ausente (centrifuge.id)");
        return fetchSubscribeToken(channel, clientId);
      }
    } : undefined
  );

  sub.on("publication", (ctx) => {
    // O worker publica como: { event: "new_message", payload: {...} }
    const data = ctx.data || {};
    const evt = data.event || data.type || null;
    const payload = data.payload ?? data;
    if (evt) emitLocal(evt, payload);
  });
  sub.on("subscribed", (ctx) => {
    console.log("[realtime] subscribed:", channel, "recovered:", ctx.recovered);
  });
  sub.on("unsubscribed", () => {
    console.log("[realtime] unsubscribed:", channel);
  });
  sub.on("error", (err) => {
    console.warn("[realtime] sub error:", channel, err);
  });

  // registra ANTES de assinar para evitar duplicatas em reconnect
  subs.set(room, sub); // mapeado pelo "room lógico"
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
