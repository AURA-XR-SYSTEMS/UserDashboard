// src/pages/join.js
// Invitee sign-up: the link in a team invite lands here (join.html#invite=<token>).
// The token sits in the URL fragment, so it never reaches a server or a log; it
// goes to the API only in a POST body.
import { api, esc, loadMe } from "../lib/api.js";

function tokenFromHash() {
  const m = /(?:^|[#&])invite=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]) : "";
}

function setHead(title, sub) {
  document.getElementById("join-title").textContent = title;
  document.getElementById("join-sub").textContent = sub;
}

async function join(token, el) {
  const res = await api("/api/teams/join", { method: "POST", body: { token } });
  // The token is spent; drop it from the address bar.
  history.replaceState(null, "", "join.html");
  setHead(`You're on ${res.team.name}`, "Your seat is active. Download AURA Engine and sign in with this account.");
  el.innerHTML = `
    ${res.personalPlanActive ? `<div class="notice">You also have your own paid membership. Your team seat covers you now, so you can cancel it from <a href="billing.html">Billing</a>.</div>` : ""}
    <a class="btn primary" href="downloads.html">Go to downloads</a>
    <a class="btn ghost" href="dashboard.html">Open the portal</a>`;
}

function authForms(invite) {
  return `
    <form class="form" id="join-register" data-mode="register">
      <h3>New to AURA? Create your account</h3>
      <div><label>First Name</label><input class="input" name="first_name" required /></div>
      <div><label>Last Name</label><input class="input" name="last_name" required /></div>
      <div><label>Email</label><input class="input" name="email" type="email" readonly value="${esc(invite.email)}" /></div>
      <div><label>Password</label><input class="input" name="password" type="password" required minlength="8" placeholder="Create a password" /></div>
      <div class="form-error" data-join-error hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="submit">Create account and join</button></div>
    </form>
    <div class="hr"></div>
    <form class="form" id="join-login" data-mode="login">
      <h3>Already have an AURA account?</h3>
      <div><label>Email</label><input class="input" name="email" type="email" readonly value="${esc(invite.email)}" /></div>
      <div><label>Password</label><input class="input" name="password" type="password" required /></div>
      <div class="form-error" data-join-error hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="submit">Sign in and join</button></div>
    </form>`;
}

export async function initJoin() {
  const el = document.getElementById("join");
  if (!el) return;
  const token = tokenFromHash();
  if (!token) {
    setHead("This invite link is incomplete", "Ask the person who invited you to send the link again.");
    return;
  }

  let invite;
  try {
    invite = await api("/api/teams/invites/preview", { method: "POST", body: { token } });
  } catch (e) {
    setHead("This invite can't be used", e.message);
    el.innerHTML = `<a class="btn ghost" href="index.html">Go to sign in</a>`;
    return;
  }
  setHead(
    `Join ${invite.teamName} on AURA`,
    `${invite.inviterName} has a paid seat for you on AURA Engine. It's for ${invite.email}.`
  );

  const me = await loadMe();
  if (me) {
    if (me.email.toLowerCase() !== invite.email) {
      el.innerHTML = `<div class="notice">You're signed in as ${esc(me.email)}, but this invite is for ${esc(invite.email)}.
        Log out and sign in (or sign up) with that address.</div>
        <button class="btn" id="join-logout">Log out</button>`;
      document.getElementById("join-logout").addEventListener("click", async () => {
        try {
          await api("/api/auth/logout", { method: "POST" });
        } catch {}
        location.reload();
      });
      return;
    }
    el.innerHTML = `<button class="btn primary" id="join-now">Join as ${esc(me.email)}</button>
      <div class="form-error" data-join-error hidden></div>`;
    document.getElementById("join-now").addEventListener("click", async () => {
      try {
        await join(token, el);
      } catch (err) {
        const e = el.querySelector("[data-join-error]");
        e.textContent = err.message;
        e.hidden = false;
      }
    });
    return;
  }

  el.innerHTML = authForms(invite);
  el.querySelectorAll("form").forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form).entries());
      const path = form.dataset.mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api(path, { method: "POST", body });
        await join(token, el);
      } catch (err) {
        const errEl = form.querySelector("[data-join-error]");
        errEl.textContent = err.message;
        errEl.hidden = false;
        btn.disabled = false;
      }
    })
  );
}
