import { getRuntimeConfig } from "./runtimeConfig";

const { apiBaseUrl, tenant, currentUserId } = getRuntimeConfig();

// helper p/ juntar headers e garantir X-Tenant-Id + X-User-Id
function withTenantHeaders(extra = {}) {
  return {
    "X-Tenant-Id": tenant,            // <-- nome que o back lê
    ...(currentUserId ? { "X-User-Id": currentUserId } : {}),
    ...extra,
  };
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


