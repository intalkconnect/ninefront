// Runtime config baseado na URL acessada.
//
// - API e Socket usam a mesma origem (scheme + host + port) da página.
// - tenant = primeiro label do hostname (ex: hmg.dkdevs.com.br -> "hmg")
// - Em localhost, aceita ?tenant= ou localStorage.tenant como fallback.
// - Caminho base da API pode ser customizado por VITE_API_BASE_PATH
//   (padrão: "/api/v1").

const ENV_DEFAULT_TENANT =
  (import.meta?.env?.VITE_DEFAULT_TENANT || "").toString().trim() || "default";

const API_PATH =
  (import.meta?.env?.VITE_API_BASE_PATH || "/api/v1").toString().trim();

function fromHostnameToTenant(hostname) {
  if (!hostname) return ENV_DEFAULT_TENANT;

  const isLocal =
    /^localhost$/i.test(hostname) ||
    /^127\.0\.0\.1$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname);

  if (isLocal) {
    const qs = new URLSearchParams(window.location.search);
    const qTenant = (qs.get("tenant") || qs.get("t") || "").trim();
    const lsTenant = (window.localStorage.getItem("tenant") || "").trim();
    return (qTenant || lsTenant || ENV_DEFAULT_TENANT).toLowerCase();
  }

  // pega o que vem antes do primeiro "."
  return (hostname.split(".")[0] || ENV_DEFAULT_TENANT).toLowerCase();
}

export function getRuntimeConfig() {
  const { protocol, hostname, port } = window.location;
  const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

  const path = API_PATH.startsWith("/") ? API_PATH : `/${API_PATH}`;
  const apiBaseUrl = `${origin}${path}`; // ex: https://hmg.dkdevs.com.br/api/v1
  const socketUrl = origin;              // mesma origem da página
  const tenant = fromHostnameToTenant(hostname);

  if (!window.__RUNTIME_CFG_LOGGED__) {
    window.__RUNTIME_CFG_LOGGED__ = true;
    console.info("[runtime] origin:", origin, "| tenant:", tenant, "| api:", apiBaseUrl);
  }

  return { origin, hostname, apiBaseUrl, socketUrl, tenant };
}

// export prático caso queira importar direto
export const runtimeTenant = fromHostnameToTenant(window.location.hostname);
