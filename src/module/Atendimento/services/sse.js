// src/module/Atendimento/services/sse.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const SSE_URL      = `${API_BASE_URL.replace(/\/$/, '')}/sse`;

let es;               // EventSource atual
let currentRooms = []; // rooms ativas
let listeners = {};   // { eventName: Set<fn> }
let statusCb = null;  // fn(status) -> 'online' | 'offline'

function buildUrl(rooms) {
  const params = new URLSearchParams();
  for (const r of rooms) params.append('room', r);
  const url = `${SSE_URL}?${params.toString()}`;
 console.log('[SSE] buildUrl ->', url);
 return url;
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
  if (any) for (const fn of any) {
    try {
      // envia também o nome do evento para o catch-all
      fn({ __event: event, __raw: payload });
    } catch {}
  }
}


export function connectSSE(initialRooms = []) {
  // fecha anterior
  if (es) { try { es.close(); } catch {} es = null; }
  currentRooms = Array.from(new Set(initialRooms)).filter(Boolean);
  if (currentRooms.length === 0) currentRooms = ['broadcast'];
console.log('[SSE] connectSSE rooms ->', currentRooms);
  const url = buildUrl(currentRooms);
  es = new EventSource(url, { withCredentials: false });

  es.onopen = () => notifyStatus('online');
  es.onerror = () => notifyStatus('offline');

  // eventos nomeados
  es.addEventListener('ready', (e) => {
    try {+   const data = JSON.parse(e.data);
   console.log('[SSE] READY from server ->', data);
   emitLocal('ready', data); }
    catch { emitLocal('ready', {}); }
  });

  // fallback genérico
 es.onmessage = (e) => {
   try {
     const obj = JSON.parse(e.data);
     const payload = obj?.data ?? obj; // << desembrulha
     emitLocal(obj?.event || 'message', payload);
   } catch {
     emitLocal('message', { raw: e.data });
   }
 };

  // eventos mais usados
 for (const ev of ['new_message', 'update_message', 'message_status', 'typing', 'presence']) {
   es.addEventListener(ev, (e) => {
     try {
      const obj = JSON.parse(e.data);
       const payload = obj?.data ?? obj; // << idem
       emitLocal(ev, payload);
     } catch {
       emitLocal(ev, {});
     }
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
