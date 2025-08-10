// src/module/Atendimento/services/sse.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const SSE_URL      = `${API_BASE_URL.replace(/\/$/, '')}/sse`;

// --- debug helper ---
const DEBUG_SSE = true;
const log = (...args) => { if (DEBUG_SSE) console.log('[SSE]', ...args); };
// ---------------------

let es;                // EventSource atual
let currentRooms = []; // rooms ativas
let listeners = {};    // { eventName: Set<fn> }
let statusCb = null;   // fn(status) -> 'online' | 'offline'

function buildUrl(rooms) {
  const params = new URLSearchParams();
  for (const r of rooms) params.append('room', r);
  const url = `${SSE_URL}?${params.toString()}`;
  log('buildUrl ->', url);
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
  if (any && event !== 'message') for (const fn of any) { try { fn(payload); } catch {} }
}

export function connectSSE(initialRooms = []) {
  // fecha anterior
  if (es) { try { es.close(); } catch {} es = null; }

  currentRooms = Array.from(new Set(initialRooms)).filter(Boolean);
  if (currentRooms.length === 0) currentRooms = ['broadcast'];

  const url = buildUrl(currentRooms);
  log('connectSSE rooms:', currentRooms);

  es = new EventSource(url, { withCredentials: false });

  es.onopen = () => {
    log('Conexão aberta', { rooms: currentRooms, readyState: es?.readyState });
    notifyStatus('online');
  };

  es.onerror = (err) => {
    console.warn('[SSE] Erro de conexão:', err);
    notifyStatus('offline');
  };

  // eventos nomeados
  es.addEventListener('ready', (e) => {
    log('Evento "ready":', e.data);
    try { emitLocal('ready', JSON.parse(e.data)); }
    catch { emitLocal('ready', {}); }
  });

  // fallback genérico
  es.onmessage = (e) => {
    log('Mensagem genérica:', e.data);
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
      log(`Evento "${ev}":`, e.data);
      try {
        const obj = JSON.parse(e.data);
        const payload = obj?.data ?? obj;
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
  log('setRooms pedido:', next);

  const same = next.length === currentRooms.length &&
               next.every((r, i) => r === currentRooms[i]);
  if (same) {
    log('setRooms ignorado (mesmo conjunto).');
    return;
  }
  connectSSE(next); // reconecta com a nova lista
}

export function joinUserRoom(userId, prevUserId) {
  const rooms = ['broadcast'];
  if (userId != null) rooms.push(`chat-${String(userId)}`);

  log('joinUserRoom -> prev:', prevUserId, 'novo:', userId, 'rooms:', rooms);
  setRooms(rooms);
}

export function disconnectSSE() {
  if (es) { try { es.close(); } catch {} es = null; }
  notifyStatus('offline');
}
