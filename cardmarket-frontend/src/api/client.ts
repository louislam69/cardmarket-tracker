// Wir nutzen jetzt nur noch relative Pfade, Vite proxied /api → FastAPI
const API_BASE_URL = "/api";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`API GET ${path} failed with status ${res.status}`);
  }

  return res.json();
}
