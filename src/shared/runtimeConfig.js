// src/shared/runtimeConfig.js
const ENV_DEFAULT_TENANT =
  (import.meta?.env?.VITE_DEFAULT_TENANT || '').toString().trim() || 'default';

function fromHostnameToTenant(hostname) {
  if (!hostname) return ENV_DEFAULT_TENANT;

  const isLocal =
    /^localhost$/i.test(hostname) ||
    /^127\.0\.0\.1$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname);

  if (isLocal) {
    const qs = new URLSearchParams(window.location.search);
    const qTenant = (qs.get('tenant') || qs.get('t') || '').trim();
    const lsTenant = (window.localStorage.getItem('tenant') || '').trim();
    const chosen = qTenant || lsTenant || ENV_DEFAULT_TENANT;
    return chosen.toLowerCase();
  }

  const firstLabel = hostname.split('.')[0] || ENV_DEFAULT_TENANT;
  return firstLabel.toLowerCase();
}

let cached = null;

export function getRuntimeConfig() {
  if (cached) return cached;

  const { protocol, hostname, port } = window.location;
  const origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  const tenant = fromHostnameToTenant(hostname);

  const apiBaseUrl = `${origin}/api/v1`;
  const socketUrl = origin;

  if (!window.__RUNTIME_CFG_LOGGED__) {
    window.__RUNTIME_CFG_LOGGED__ = true;
    console.info('[runtime] origin:', origin, '| tenant:', tenant);
  }

  cached = {
    origin,
    hostname,
    isSecure: protocol === 'https:',
    apiBaseUrl,
    socketUrl,
    tenant,
  };
  return cached;
}

export function getTenant() {
  return getRuntimeConfig().tenant;
}
