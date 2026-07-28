// src/lib/api.js
const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// Ask AURA — the browser app. Lower barrier to entry than the desktop client,
// so it's the fastest path from "signed up" to "saw the product work".
export const ASKAURA_URL = (
  import.meta.env.VITE_ASKAURA_URL || "https://askaura.auraengine.com/"
).replace(/\/$/, "");

/** Send the user to Stripe checkout. Throws with a readable message. */
export async function startCheckout() {
  const { url } = await api("/api/subscriptions/checkout", { method: "POST" });
  if (!url) throw new Error("Checkout response missing redirect URL");
  window.location.href = url;
}

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

// Pages reachable without a session. Single source of truth: loadMe uses it to
// decide whether a failed /api/me should bounce to sign-in, and main.js uses it
// to keep authenticated-only chrome (the Ask AURA banner) off public pages.
const PUBLIC_PATHS = [
  "/",
  "/index.html",
  "/forgot-password.html",
  "/reset-password.html",
];

export function isPublicPage(path = window.location.pathname) {
  return PUBLIC_PATHS.some((p) => path.endsWith(p));
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
    if (!isPublicPage()) {
      window.location.href = "index.html";
      // TODO - show some type of alert to explain why they were redirected
    }
  }
}

// Several page modules plus the Ask AURA banner all need billing status on the
// same paint. Memoize the in-flight promise so one page load makes one call.
let accountPromise = null;

export function loadAccountCached() {
  if (!accountPromise) accountPromise = loadAccount();
  return accountPromise;
}

export function invalidateAccountCache() {
  accountPromise = null;
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
