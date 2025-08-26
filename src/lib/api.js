// src/lib/api.js
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export async function api(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: opts.body
      ? { "Content-Type": "application/json", ...(opts.headers || {}) }
      : opts.headers,
    credentials: "include", // keep cookie auth behavior
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
