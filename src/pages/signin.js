// src/pages/signin.js
import { api } from "../lib/api.js";

/** Where to go after signing in: a page of this site by file name, never a URL. */
function nextPage() {
  const next = new URLSearchParams(location.search).get("next");
  return next && /^[a-z-]+\.html$/.test(next) ? next : null;
}

// The API is on another site, so the session is a third-party cookie. Safari,
// Brave and private windows refuse those: sign-in answers 200 and nothing sticks.
function cookieRefusedMessage(mode) {
  const lead = mode === "register" ? "Your account is created, but your" : "Your";
  const end = mode === "register" ? "then sign in" : "and sign in again";
  return `${lead} browser blocked the cookie that keeps you signed in. Please use Chrome or Edge, or allow third-party cookies in your browser's settings, ${end}.`;
}

export async function handleAuth(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const mode = form.dataset.mode || "login";
  const body = Object.fromEntries(new FormData(form).entries());

  const errorEl = form.querySelector("[data-auth-error]");
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn?.textContent;

  // reset error state
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = mode === "register" ? "Creating…" : "Signing in…";
  }

  try {
    const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    await api(path, { method: "POST", body });
    const { user } = await api("/api/me");
    if (!user) throw new Error(cookieRefusedMessage(mode));
    // A brand-new account goes to the trial offer, not the setup checklist —
    // intent is never higher than the second after signing up.
    location.assign(
      mode === "register" ? "/welcome.html" : `/${nextPage() || "dashboard.html"}`
    );
  } catch (err) {
    const msg = normalizeAuthError(err);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    // small UX: shake and highlight password
    form.classList.add("shake");
    setTimeout(() => form.classList.remove("shake"), 300);
    const pwd = form.querySelector('input[name="password"]');
    if (pwd) {
      pwd.value = "";
      pwd.classList.add("invalid");
      pwd.focus();
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}

function normalizeAuthError(err) {
  const text = (err?.message || "").toLowerCase();
  if (
    text.includes("401") ||
    text.includes("invalid credentials") ||
    text.includes("incorrect")
  ) {
    return "Incorrect email or password.";
  }
  if (text.includes("429"))
    return "Too many attempts. Please wait and try again.";
  if (text.includes("network"))
    return "Network error. Check your connection and try again.";
  return err?.message || "Sign-in failed. Please try again.";
}

export function initAuthFormUX() {
  if (nextPage()) {
    const notice = document.querySelector("#tab-login [data-auth-error]");
    if (notice) {
      notice.textContent = "Your session has ended. Please sign in again.";
      notice.hidden = false;
    }
  }
  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener(
      "input",
      () => {
        const err = form.querySelector("[data-auth-error]");
        if (err && !err.hidden) {
          err.hidden = true;
          err.textContent = "";
        }
        form
          .querySelectorAll(".invalid")
          .forEach((el) => el.classList.remove("invalid"));
      },
      { once: false }
    );
  });
}

export function initTabs() {
  const btns = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  btns.forEach((btn) =>
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.tabTarget);
      btns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      if (target) target.classList.add("active");
    })
  );
  // auraengine.com's Download button sends new users here as /#register
  if (location.hash === "#register") {
    btns.find((b) => b.dataset.tabTarget === "#tab-register")?.click();
    document
      .querySelector('#tab-register input[name="first_name"]')
      ?.focus();
  }
}

export async function handleLogout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Even if the server call fails (expired session, missing gateway
    // route, network error), always finish logging out locally.
  }
  location.href = "index.html";
}
