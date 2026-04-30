// Se o REACT_APP_BACKEND_URL apontar para um host diferente do navegador
// (cenário de preview onde cada job tem URL própria), usa o origin atual
// para evitar problemas de CORS via proxy intermediário (ex: Cloudflare).
// Em produção real (mesmo domínio), o comportamento não muda.
function resolveApiBase() {
  const envUrl = process.env.REACT_APP_BACKEND_URL || '';
  if (typeof window === 'undefined') return envUrl;
  try {
    const env = new URL(envUrl);
    if (env.host !== window.location.host) {
      return window.location.origin;
    }
  } catch (e) { /* envUrl invalido — cai pro fallback */ }
  return envUrl;
}

const API_URL = resolveApiBase();

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, headers = {}, ...rest } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.detail
      ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
      : `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};

export { API_URL };
