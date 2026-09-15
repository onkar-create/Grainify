const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
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
