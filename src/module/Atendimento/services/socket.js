// services/socket.js
import { io } from 'socket.io-client';

// ====== ENV ======
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';
const DEFAULT_TENANT = import.meta.env.VITE_TENANT_ID || undefined;

// ====== SINGLETON ======
let socket = null;
let hasBaseListeners = false;

// credenciais do handshake (podem ser atualizadas via setAuth)
let currentAuth = {
  tenantId: DEFAULT_TENANT,
  token: null,
};

// tenta obter token salvo (opcional)
function getStoredToken() {
  return import.meta.env.VITE_SOCKET_TOKEN || null;
}


function buildClientOptions() {
  const opts = {
    path: '/socket.io',
    autoConnect: true,
    reconnectionAttempts: 3,
    transports: ['websocket'], // força WS (sem CORS)
  };

  const query = {};
  const auth = {};

  const tenant = currentAuth.tenantId ?? DEFAULT_TENANT;
  const token = currentAuth.token ?? getStoredToken();

  if (tenant) query.tenant_id = tenant;
  if (token) auth.token = token;

  if (Object.keys(query).length) opts.query = query;
  if (Object.keys(auth).length) opts.auth = auth;

  return opts;
}

function ensureSocket() {
  if (socket) return socket;
  if (!SOCKET_URL) throw new Error('VITE_SOCKET_URL não definido');

  socket = io(SOCKET_URL, buildClientOptions());

  socket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err?.message || err);
  });

  return socket;
}

/**
 * Atualiza tenant/token usados no handshake e reconecta se necessário.
 * @param {{ tenantId?: string, token?: string|null }} param0
 */
export function setAuth({ tenantId, token } = {}) {
  if (tenantId !== undefined) currentAuth.tenantId = tenantId || undefined;
  if (token !== undefined) currentAuth.token = token || null;

  if (!socket) return;

  // aplica no socket existente
  if (currentAuth.tenantId) {
    socket.io.opts.query = { ...(socket.io.opts.query || {}), tenant_id: currentAuth.tenantId };
  } else if (socket.io.opts.query?.tenant_id) {
    delete socket.io.opts.query.tenant_id;
  }

  if (currentAuth.token) {
    socket.auth = { ...(socket.auth || {}), token: currentAuth.token };
  } else if (socket.auth?.token) {
    delete socket.auth.token;
  }

  // se já está conectado, reconecta para aplicar o novo handshake
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

/**
 * Retorna o singleton do socket (cria se necessário).
 */
export function getSocket() {
  return ensureSocket();
}

/**
 * Conecta (se ainda não) e registra listeners base uma única vez.
 * Mantém compatibilidade: pode ser chamado sem args.
 * Se `userId` vier, faz join na sala desse usuário ao conectar.
 */
export function connectSocket(userId) {
  const s = ensureSocket();

  if (!s.connected) {
    console.log('[socket] Connecting to', SOCKET_URL);
    s.connect();
  }

  // listeners base globais — só uma vez
  if (!hasBaseListeners) {
    s.on('connect', () => {
      console.log('[socket] Connected:', s.id);
    });
    hasBaseListeners = true;
  }

  // compat: se passar userId, entra/saí da sala conforme seu fluxo atual
  if (userId) {
    const onConnect = () => s.emit('join_room', userId);
    if (s.connected) onConnect();
    s.off('connect', onConnect); // evita duplicar
    s.on('connect', onConnect);
  }

  return s;
}

// NÃO exporte o objeto socket diretamente.
// Use getSocket(), connectSocket() e setAuth().

