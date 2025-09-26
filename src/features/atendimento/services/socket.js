// src/app/services/socket.js
import { Centrifuge } from "centrifuge";
import { getRuntimeConfig } from "../../../shared/runtimeConfig";
import { parseJwt } from "../../../app/utils/auth";

let centrifuge = null;
let connectPromise = null;
let isConnected = false;

const desiredRooms = new Set();
const subs = new Map();
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

// 🔹 helper: canal lógico -> conv:t:<tenant>:<room>
function toConvChannel(room) {
  const { tenant } = getRuntimeConfig();
  return room.startsWith("conv:") ? room : `conv:t:${tenant}:${room}`;
}

// 🔹 token de conexão: fetch DIRETO com X-Tenant + X-User-Id
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

// 🔹 subscribe token por canal conv:t:*
async function fetchSubscribeToken(channel, client) {
  const { apiBaseUrl, tenant } = getRuntimeConfig();
  const token = localStorage.getItem("token");
  const { email } = parseJwt(token) || {};
  const r = await fetch(`${apiBaseUrl}/realtime/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant": tenant,
      ...(email ? { "X-User-Id": email } : {})
    },
    body: JSON.stringify({ channel, client }),
    credentials: "include",
  });
  if (!r.ok) throw new Error("POST /realtime/subscribe failed");
  const { token: t } = await r.json();
  if (!t) throw new Error("subscribe token ausente");
  return t;
}

export function connectSocket() {
  if (centrifuge && (isConnected || connectPromise)) {
    return connectPromise ?? Promise.resolve(centrifuge);
  }

  connectPromise = (async () => {
    const WS_URL = normalizeWsUrl(import.meta.env.VITE_WS_URL || "");
    const INSECURE = String(import.meta.env.VITE_CENTRIFUGO_INSECURE || "").toLowerCase() === "true";

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
      centrifuge.id = ctx.client;
      console.log("[realtime] connected -> client:", ctx.client, "transport:", ctx.transport);

      for (const room of desiredRooms) {
        const sub = subs.get(room);
        if (!sub) { subscribeRoom(room); continue; }
        if (sub.state === "unsubscribed") {
          try { sub.subscribe(); } catch (e) { console.warn("[realtime] resubscribe fail:", room, e); }
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

export function getSocket() {
  return {
    get connected() { return isConnected; },
    get id() { return centrifuge?.id || null; },

    on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); },
    off(evt, fn) { const set = listeners.get(evt); if (!set) return; set.delete(fn); if (set.size === 0) listeners.delete(evt); },

    emit(name, payload) {
      if (name === "join_room")  return subscribeRoom(String(payload));
      if (name === "leave_room") return unsubscribeRoom(String(payload));
      if (name === "identify")   return;
    },

    connect() { centrifuge?.connect(); },

    _debug() {
      console.table([...subs.entries()].map(([room, sub]) => ({ room, state: sub.state })));
      console.log("desired:", [...desiredRooms]);
    }
  };
}

async function subscribeRoom(room) {
  desiredRooms.add(room);

  const existing = subs.get(room);
  if (existing) {
    if (existing.state === "unsubscribed") {
      try { existing.subscribe(); } catch (e) { console.warn("[realtime] subscribe fail:", room, e); }
    }
    return existing;
  }

  if (!centrifuge) await connectSocket();
  if (!isConnected) {
    const t = setInterval(() => { if (isConnected) { clearInterval(t); subscribeRoom(room); } }, 100);
    return;
  }

  // mapeia para conv:t:<tenant>:<room>
  const channel = toConvChannel(room);

  const sub = centrifuge.newSubscription(channel, {
    // conv:* exigem subscribe token
    getToken: async () => {
    // usa o id que salvamos em `on("connected")`
    const clientId = centrifuge?.id;
    if (!clientId) throw new Error("clientId ausente (centrifuge.id)");
    return fetchSubscribeToken(channel, clientId);
  },
  });

  sub.on("publication", (ctx) => {
    const data = ctx.data || {};
    const evt = data.event || data.type || null;
    const payload = data.payload ?? data;
    if (evt) emitLocal(evt, payload);
  });
  sub.on("subscribed", (ctx) => { console.log("[realtime] subscribed:", channel, "recovered:", ctx.recovered); });
  sub.on("unsubscribed", () => { console.log("[realtime] unsubscribed:", channel); });
  sub.on("error", (err) => { console.warn("[realtime] sub error:", channel, err); });

  subs.set(room, sub); // chaveia pelo "room lógico"
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


