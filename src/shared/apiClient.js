import { getRuntimeConfig } from "./runtimeConfig";

const { apiBaseUrl, tenant } = getRuntimeConfig();

// ator atual (preenchido pelo Admin.jsx)
let __actor = null; // { id, name, email }
export function setActorContext(actor) {
  __actor = actor || null;
}

// helper p/ juntar headers e garantir X-Tenant
function withTenantHeaders(extra = {}) {
  const actorHeaders = __actor ? {
    "X-User-Id": __actor.id   ?? __actor.email ?? __actor.name ?? "",
    "X-User-Name": __actor.name ?? __actor.email ?? "",
    "X-User-Email": __actor.email ?? "",
  } : {};
  return { "X-Tenant": tenant, ...actorHeaders, ...extra };
}

// === helpers com fetch (agora COM X-Tenant) ===
// se usa cookie de sessão, adicione { credentials: "include" } onde precisar

export async function apiGet(path) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    headers: withTenantHeaders(),
  });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export async function apiPost(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`POST ${path} failed`);
  return res.json();
}

export async function apiPut(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PUT",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed`);
  return res.json();
}

export async function apiPatch(path, data) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: withTenantHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed`);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: withTenantHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE ${path} failed`);
  return res.json();
}

