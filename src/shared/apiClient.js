// src/shared/apiClient.js
import { getRuntimeConfig } from "./runtimeConfig";

const { apiBaseUrl, tenant } = getRuntimeConfig();

// pega token salvo via ?token= (localStorage) ou sessionStorage
function getBearer() {
  try {
    const ls = localStorage.getItem("token");
    if (ls) return ls;
  } catch {}
  try {
    const ss = sessionStorage.getItem("token");
    if (ss) return ss;
  } catch {}
  return null;
}

// detecta se é mesma origem (pra decidir credentials)
function isSameOrigin(url) {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return true;
  }
}

// headers padrão: X-Tenant + Authorization quando existir
function withAuthHeaders(extra = {}) {
  const h = { ...(extra || {}) };
  if (tenant) h["X-Tenant"] = tenant;           // ✅ padrão alinhado: X-Tenant
  const bearer = getBearer();
  if (bearer) h["Authorization"] = `Bearer ${bearer}`;
  return h;
}

async function doFetch(path, init = {}) {
  const url = `${apiBaseUrl}${path}`;
  const opts = {
    ...init,
    headers: withAuthHeaders(init.headers),
  };
  // envia cookies quando for mesma origem
  if (isSameOrigin(url)) {
    opts.credentials = "include";
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${init.method || "GET"} ${path} failed (${res.status}) ${txt}`);
  }
  // pode vir 204
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet(path) {
  return doFetch(path);
}
export async function apiPost(path, data) {
  return doFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
}
export async function apiPut(path, data) {
  return doFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
}
export async function apiPatch(path, data) {
  return doFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
}
export async function apiDelete(path) {
  return doFetch(path, { method: "DELETE" });
}
