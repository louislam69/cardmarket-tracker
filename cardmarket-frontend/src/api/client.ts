// Lokal: Vite proxied /api → FastAPI (VITE_API_BASE_URL nicht gesetzt)
// Produktion: VITE_API_BASE_URL=https://backend.railway.app (kein /api-Prefix nötig)
import supabase from "../lib/supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });

  if (!res.ok) {
    throw new Error(`API GET ${path} failed with status ${res.status}`);
  }

  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API POST ${path} failed with status ${res.status}`);
  }

  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API PATCH ${path} failed with status ${res.status}`);
  }

  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE", headers });

  if (!res.ok) {
    throw new Error(`API DELETE ${path} failed with status ${res.status}`);
  }
}
