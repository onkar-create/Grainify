import { getToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.detail)
      ? body.detail.map((d) => d.msg).join(", ")
      : body.detail || `Request failed: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  register: (username, password) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => request("/api/auth/me"),

  getDistricts: () => request("/api/districts"),
  getWarehouses: () => request("/api/warehouses"),
  getScenarios: () => request("/api/scenarios"),
  runScenario: (scenario) =>
    request("/api/run-scenario", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    }),
  getHistory: (limit = 20) => request(`/api/history?limit=${limit}`),
  getRunDetail: (id) => request(`/api/history/${id}`),
};
