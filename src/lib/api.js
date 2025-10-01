// src/lib/api.js
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const REQUIRE_AUTH = import.meta.env.VITE_ALLOW_NO_AUTH === "false";

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

  debugger;
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  } else if (res.status == 204) return {};
  else return res.json();
}

export async function loadMe() {
  try {
    const { user } = await api("/api/me");
    console.log("Found user in loadMe...", user);
    return user;
  } catch (error) {
    console.log("Caught error in loadMe...", error);
    const path = window.location.pathname;
    if (REQUIRE_AUTH && !["/", "/index.html"].some((p) => path.endsWith(p))) {
      window.location.href = "index.html";
      // TODO - show some type of alert to explain why they were redirected
    }
  }
}

export async function loadAccount() {
  try {
    const { account } = await api("/api/account");
    document.querySelectorAll("[data-requires-plan]").forEach((n) => {
      const status = account.billing.status;
      if (["active", "trial"].includes(status) == false) {
        n.disabled = true;
      }
    });
    return account;
  } catch (error) {
    console.log("Caught error in loadAccount...", error);
    // TODO - handle scenario where user might be authenticated, but there was a problem
    // with their account
  }
}
