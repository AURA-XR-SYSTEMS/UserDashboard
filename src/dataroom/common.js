// src/dataroom/common.js
// Shared by the data room pages (thread DR). Everything a client typed - file names, room
// names, emails - is put on the page with textContent through el(), never innerHTML.

const BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// Build-time switch, off unless the deploy sets VITE_DATAROOM_ENABLED=true. The API has its
// own switch (AURA_DATAROOM_ENABLED); both must be on for a room to open.
export const DATAROOM_ENABLED = import.meta.env.VITE_DATAROOM_ENABLED === "true";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Like lib/api.js, but keeps the server's {code, message} so pages can react to a code
// (nda_required, invite_invalid) and show the server's own sentence.
export async function dr(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const d = data?.detail;
    const message =
      (d && typeof d === "object" ? d.message : d) || data?.error || res.statusText || "Request failed";
    throw new ApiError(res.status, d?.code || null, message);
  }
  return data;
}

export async function currentUser() {
  try {
    const { user } = await dr("/api/me");
    return user || null;
  } catch {
    return null;
  }
}

export async function signIn(email, password) {
  return dr("/api/auth/login", { method: "POST", body: { email, password } });
}

export async function register({ firstName, lastName, email, password }) {
  return dr("/api/auth/register", {
    method: "POST",
    body: { first_name: firstName, last_name: lastName, email, password },
  });
}

export async function signOut() {
  try {
    await dr("/api/auth/logout", { method: "POST", body: {} });
  } catch {}
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function fmtBytes(n) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Number(n || 0);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtWhen(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "--";
}

// The portal's card pattern (as on the dashboard): a teal header band, then a padded body.
// .card itself has no padding, so content never goes straight inside it.
export function panel(title, ...body) {
  return el(
    "section",
    { class: "card has-header dr-panel" },
    el("div", { class: "card-header", text: title }),
    el("div", { class: "card-body" }, ...body)
  );
}

export function notAvailable(root) {
  root.replaceChildren(
    el(
      "div",
      { class: "dr-narrow" },
      panel(
        "Data room",
        el("p", { class: "muted", text: "The data room isn't available yet. If AURA sent you a link, please check back soon or reply to the person who invited you." })
      )
    )
  );
}

// Plain-language data-handling notice. The wording is Arthur's (2026-10-27) and awaits his
// final say; the NDA itself is the parties' document and is never read or summarised here.
export function handlingNotice() {
  return el(
    "div",
    { class: "dr-notice", role: "note" },
    el("strong", { text: "How AURA handles these files" }),
    el(
      "ul",
      {},
      el("li", { text: "Private to this room: only the people invited to it can see them." }),
      el("li", { text: "Never used to train AI models." }),
      el("li", { text: "Deleted on request, from storage as well as from this list." }),
      el("li", { text: "Every upload, view, download and deletion is recorded in this room's audit log." }),
      el("li", { text: "Each file is scanned for malware before anyone can open it." })
    )
  );
}

// The sign-in / create-account card both pages show to a signed-out visitor.
export function authCard({ title, email = "", lockEmail = false, intro, onSignedIn }) {
  const error = el("div", { class: "form-error", role: "alert", hidden: true });
  const show = (msg) => {
    error.textContent = msg;
    error.hidden = false;
  };
  const emailInput = (name) =>
    el("input", { class: "input", type: "email", name, required: true, value: email, readonly: lockEmail || undefined, autocomplete: "email" });

  const login = el(
    "form",
    { class: "form" },
    el("div", {}, el("label", { text: "Email" }), emailInput("email")),
    el("div", {}, el("label", { text: "Password" }), el("input", { class: "input", type: "password", name: "password", required: true, autocomplete: "current-password" })),
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit", text: "Sign in" }), el("a", { href: "forgot-password.html", class: "muted small", text: "Forgot your password?" }))
  );
  login.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    const f = new FormData(login);
    try {
      await signIn(f.get("email"), f.get("password"));
      onSignedIn();
    } catch (err) {
      show(err.status === 401 ? "Incorrect email or password." : err.message);
    }
  });

  const create = el(
    "form",
    { class: "form", hidden: true },
    el("div", {}, el("label", { text: "First name" }), el("input", { class: "input", name: "firstName", required: true, autocomplete: "given-name" })),
    el("div", {}, el("label", { text: "Last name" }), el("input", { class: "input", name: "lastName", required: true, autocomplete: "family-name" })),
    el("div", {}, el("label", { text: "Email" }), emailInput("email")),
    el("div", {}, el("label", { text: "Password" }), el("input", { class: "input", type: "password", name: "password", required: true, minlength: 8, autocomplete: "new-password" })),
    el("div", { class: "row" }, el("button", { class: "btn primary", type: "submit", text: "Create account" }))
  );
  create.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    const f = new FormData(create);
    try {
      await register({ firstName: f.get("firstName"), lastName: f.get("lastName"), email: f.get("email"), password: f.get("password") });
      onSignedIn();
    } catch (err) {
      show(err.status === 409 ? "That email already has an AURA account. Sign in instead." : err.message);
    }
  });

  const tabLogin = el("button", { class: "tab-btn active", type: "button", text: "Sign in" });
  const tabCreate = el("button", { class: "tab-btn", type: "button", text: "Create account" });
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabCreate.classList.remove("active");
    login.hidden = false;
    create.hidden = true;
  });
  tabCreate.addEventListener("click", () => {
    tabCreate.classList.add("active");
    tabLogin.classList.remove("active");
    create.hidden = false;
    login.hidden = true;
  });

  return el(
    "div",
    { class: "dr-narrow" },
    panel(
      title,
      intro,
      el("div", { class: "tab-header dr-tabs" }, tabLogin, tabCreate),
      el("div", { class: "dr-auth-body" }, error, login, create)
    )
  );
}

// replaceChildren, minus the null/false placeholders of optional sections (which the DOM
// would otherwise print as the text "null").
export function fill(node, ...children) {
  node.replaceChildren(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
}
