// src/utils/auth.js
function b64urlToB64(s) {
  // troca URL-safe e adiciona padding
  let out = s.replace(/-/g, '+').replace(/_/g, '/');
  while (out.length % 4) out += '=';
  return out;
}

export function parseJwt(token) {
  try {
    const [, payload] = String(token).split('.');
    if (!payload) return null;
    const json = atob(b64urlToB64(payload));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isJwtExpired(token, skewSeconds = 30) {
  const p = parseJwt(token);
  if (!p || !p.exp) return true;                // sem exp → trate como expirado
  const now = Math.floor(Date.now() / 1000);
  return now >= (Number(p.exp) - Number(skewSeconds || 0));
}

export function msUntilExpiry(token, skewMs = 2000) {
  const p = parseJwt(token);
  if (!p || !p.exp) return 0;
  const ms = (Number(p.exp) * 1000) - Date.now() - Number(skewMs || 0);
  return ms > 0 ? ms : 0;
}
