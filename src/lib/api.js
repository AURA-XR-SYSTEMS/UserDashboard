// src/lib/api.js
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function fmtInt(n) {
  return Number(n || 0).toLocaleString();
}

export function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString() : "--";
}

export function fmtMoney(cents, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(Number(cents || 0) / 100);
}

export function hasPlanAccess(status) {
  return ["active", "trialing"].includes(status);
}

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
      const body = await res.json();
      msg = body.error || body.detail || msg;
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
    if (
      ![
        "/",
        "/index.html",
        "/forgot-password.html",
        "/reset-password.html",
      ].some((p) => path.endsWith(p))
    ) {
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
      if (!hasPlanAccess(status)) {
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

export async function onForgotSubmit(email, onSuccess, onErr) {
  try {
    await api("/api/auth/forgot", {
      method: "POST",
      body: { email },
    });
    onSuccess(email);
  } catch (err) {
    if (err?.status === 429) {
      // TODO - handle rate limiting
    }
    else if (err) {
      onErr();
    }
  }
}
