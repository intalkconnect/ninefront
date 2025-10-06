// shared/apiClient.js
import { getRuntimeConfig } from "./runtimeConfig";
const { apiBaseUrl, tenant } = getRuntimeConfig();

let actor = { id: null, name: null, email: null };
export function setActorContext(a = {}) {
  actor = {
    id:    a.id    ?? actor.id,
    name:  a.name  ?? actor.name,
    email: a.email ?? actor.email,
  };
}

function withTenantHeaders(extra = {}) {
  return {
    "X-Tenant": tenant,
    ...(actor?.id    ? { "X-User-Id":    String(actor.id) }    : {}),
    ...(actor?.name  ? { "X-User-Name":  String(actor.name) }  : {}),
    ...(actor?.email ? { "X-User-Email": String(actor.email) } : {}),
    ...extra,
  };
}

async function handle(res, method, path) {
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
  return res.json();
}

export async function apiGet(path) {
  const res = await fetch(`${apiBaseUrl}${path}`, { headers: withTenantHeaders() });
  return handle(res, "GET", path);
}
export async function apiPost(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data ?? {}),
  });
  return handle(res, "POST", path);
}
export async function apiPut(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data ?? {}),
  });
  return handle(res, "PUT", path);
}
export async function apiPatch(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data ?? {}),
  });
  return handle(res, "PATCH", path);
}
export async function apiDelete(path) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: withTenantHeaders(),
  });
  return handle(res, "DELETE", path);
}
