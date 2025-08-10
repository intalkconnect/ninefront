// src/module/Atendimento/services/sse.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL';
const SSE_URL      = `${API_BASE_URL.replace(/\/$/, '')}/sse`;

let es;               // EventSource atual
let currentRooms = []; // rooms ativas
let listeners = {};   // { eventName: Set<fn> }
let statusCb = null;  // fn(status) -> 'online' | 'offline'

function buildUrl(rooms) {
  const params = new URLSearchParams();
  for (const r of rooms) params.append('room', r);
  return `${SSE_URL}?${params.toString()}`;
}

function notifyStatus(s) {
  if (statusCb) try { statusCb(s); } catch {}
}

export function onStatusChange(cb) { statusCb = cb; }

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(fn);
  return () => listeners[event].delete(fn);
}

function emitLocal(event, payload) {
  const set = listeners[event];
  if (set) for (const fn of set) { try { fn(payload); } catch {} }
  const any = listeners['message'];
  if (any && event !== 'message') for (const fn of any) { try { fn(payload); } catch {} }
}

export function connectSSE(initialRooms = []) {
  // fecha anterior
  if (es) { try { es.close(); } catch {} es = null; }
  currentRooms = Array.from(new Set(initialRooms)).filter(Boolean);
  if (currentRooms.length === 0) currentRooms = ['broadcast'];

  const url = buildUrl(currentRooms);
  es = new EventSource(url, { withCredentials: false });

  es.onopen = () => notifyStatus('online');
  es.onerror = () => notifyStatus('offline');

  // eventos nomeados
  es.addEventListener('ready', (e) => {
    try { emitLocal('ready', JSON.parse(e.data)); }
    catch { emitLocal('ready', {}); }
  });

  // fallback genérico
  es.onmessage = (e) => {
    try {
      const obj = JSON.parse(e.data);
      const ev  = obj?.event || 'message';
      emitLocal(ev, obj);
    } catch {
      emitLocal('message', { raw: e.data });
    }
  };

  // eventos mais usados
  for (const ev of ['new_message', 'message_status', 'typing', 'presence']) {
    es.addEventListener(ev, (e) => {
      try { emitLocal(ev, JSON.parse(e.data)); }
      catch { emitLocal(ev, {}); }
    });
  }

  return es;
}

export function setRooms(rooms) {
  const next = Array.from(new Set(rooms)).filter(Boolean);
  const same = next.length === currentRooms.length &&
               next.every((r, i) => r === currentRooms[i]);
  if (same) return;
  connectSSE(next); // reconecta com a nova lista
}

export function joinUserRoom(userId, prevUserId) {
  // mantém sempre broadcast + a sala do usuário selecionado
  const rooms = ['broadcast'];
  if (userId != null) rooms.push(`chat-${String(userId)}`);
  setRooms(rooms);
}

export function disconnectSSE() {
  if (es) { try { es.close(); } catch {} es = null; }
  notifyStatus('offline');
}
