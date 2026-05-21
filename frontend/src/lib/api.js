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
  // Iter 43: backoffice escolhe tenant ativo via dropdown — guardado em localStorage
  // 'admin_tenant'. Frontend publico nao seta esse valor (deixa o backend resolver pelo Host).
  // Iter 43.5: query param ?as_tenant=X sobrescreve tudo (modo PREVIEW). Salva em sessionStorage
  // para sobreviver navegacao entre paginas durante o preview.
  let previewTenant = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('as_tenant');
    if (fromUrl) {
      sessionStorage.setItem('preview_tenant', fromUrl);
      previewTenant = fromUrl;
    } else {
      previewTenant = sessionStorage.getItem('preview_tenant');
    }
  } catch { /* ignore */ }

  const adminTenant = previewTenant || localStorage.getItem('admin_tenant');
  const tenantHeader = adminTenant && adminTenant !== 'all' ? { 'X-Tenant': adminTenant } : {};
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...tenantHeader,
      ...headers,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Resposta nao-JSON (ex: nginx/cloudflare retornando "Internal Server Error" puro).
      data = { detail: text.length > 300 ? `Erro ${res.status}` : text };
    }
  }
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
  delete: (path) => request(path, { method: 'DELETE' }),
};

export { API_URL };
