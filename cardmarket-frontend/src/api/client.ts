// Lokal: Vite proxied /api → FastAPI (VITE_API_BASE_URL nicht gesetzt)
// Produktion: VITE_API_BASE_URL=https://backend.railway.app (kein /api-Prefix nötig)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`API GET ${path} failed with status ${res.status}`);
  }

  return res.json();
}
