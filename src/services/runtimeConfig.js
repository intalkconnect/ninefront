// Gera configuração em tempo de execução com base na URL acessada.
// Regras:
// - API e Socket usam a mesma origem (scheme+host+port) da página.
// - DEFAULT_TENANT é o que vem antes do primeiro '.' do hostname.
// - Em localhost, usa ?tenant= ou localStorage.tenant como fallback.

const ENV_DEFAULT_TENANT =
  (import.meta?.env?.VITE_DEFAULT_TENANT || "").toString().trim() || "default";

function fromHostnameToTenant(hostname) {
  if (!hostname) return ENV_DEFAULT_TENANT;

  // Em dev/local não há subdomínio; deixa escolher via query/localStorage
  const isLocal =
    /^localhost$/i.test(hostname) ||
    /^127\.0\.0\.1$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname);

  if (isLocal) {
    const qs = new URLSearchParams(window.location.search);
    const qTenant = (qs.get("tenant") || qs.get("t") || "").trim();
    const lsTenant = (window.localStorage.getItem("tenant") || "").trim();
    const chosen = qTenant || lsTenant || ENV_DEFAULT_TENANT;
    return chosen.toLowerCase();
  }

  // Pega tudo antes do primeiro ponto
  const firstLabel = hostname.split(".")[0] || ENV_DEFAULT_TENANT;
  return firstLabel.toLowerCase();
}

export function getRuntimeConfig() {
  const { protocol, hostname, port } = window.location;
  const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  const isSecure = protocol === "https:";
  const tenant = fromHostnameToTenant(hostname);

  // Quer ignorar qualquer env e FORÇAR sempre a origem da página?
  // Basta deixar assim (sem ler ENVs):
  const apiBaseUrl = origin;
  const socketUrl = origin;

  // Logs de diagnóstico (uma vez por load)
  if (!window.__RUNTIME_CFG_LOGGED__) {
    window.__RUNTIME_CFG_LOGGED__ = true;
    // eslint-disable-next-line no-console
    console.info("[runtime] origin:", origin, "| tenant:", tenant);
  }

  return { origin, hostname, isSecure, apiBaseUrl, socketUrl, tenant };
}
