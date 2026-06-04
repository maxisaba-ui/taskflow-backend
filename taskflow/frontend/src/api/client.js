// frontend/src/api/client.js
// Cliente HTTP centralizado — todas las llamadas al backend pasan por aquí

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

function obtenerToken() {
  return localStorage.getItem("taskflow_token");
}

async function request(metodo, endpoint, body = null) {
  const token = obtenerToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opciones = { method: metodo, headers };
  if (body) opciones.body = JSON.stringify(body);

  let resp;
  try {
    resp = await fetch(`${BASE_URL}${endpoint}`, opciones);
  } catch (netErr) {
    throw new Error(`No se pudo conectar al servidor (${netErr.message})`);
  }

  if (resp.status === 401) {
    // Token expirado — redirigir al login
    localStorage.removeItem("taskflow_token");
    window.location.href = "/login";
    return;
  }

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ detail: `Error ${resp.status}` }));
    throw new Error(error.detail || `Error ${resp.status}`);
  }

  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  get:    (endpoint)         => request("GET",    endpoint),
  post:   (endpoint, body)   => request("POST",   endpoint, body),
  put:    (endpoint, body)   => request("PUT",    endpoint, body),
  delete: (endpoint)         => request("DELETE", endpoint),
};

// ── Auth de Google ──
export async function loginConGoogle(credencialGoogle) {
  const resp = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: credencialGoogle }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || "Error al iniciar sesión");
  }
  const data = await resp.json();
  localStorage.setItem("taskflow_token", data.access_token);
  return data;
}

export function logout() {
  localStorage.removeItem("taskflow_token");
}

// Alias para compatibilidad con páginas que usan apiGet/apiPost
export const apiGet  = (endpoint)       => api.get(endpoint);
export const apiPost = (endpoint, body) => api.post(endpoint, body);
export const apiPut  = (endpoint, body) => api.put(endpoint, body);
export const apiDelete = (endpoint)     => api.delete(endpoint);
