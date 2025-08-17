import { getRuntimeConfig } from "./runtimeConfig";

const { apiBaseUrl } = getRuntimeConfig();

// === helpers com fetch (sem header X-Tenant) ===
// Obs: como é mesma origem, normalmente não precisa credentials: "include".
// Se seu backend usa cookie de sessão, pode adicionar { credentials: "include" }.

export async function apiGet(path) {
  const url = `${apiBaseUrl}${path}`;
  console.debug('[api] GET', url);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    console.error('[api] HTTP', res.status, 'body:', text.slice(0, 200));
    throw new Error(`GET ${path} ${res.status}`);
  }
  try { return JSON.parse(text); }
  catch (e) {
    console.error('[api] not JSON, body:', text.slice(0, 200));
    throw e;
  }
}


export async function apiPost(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}

export async function apiPut(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed`);
  return res.json();
}

export async function apiPatch(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed`);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${apiBaseUrl}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed`);
  return res.json();
}

