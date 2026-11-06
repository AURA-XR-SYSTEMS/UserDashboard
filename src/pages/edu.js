// src/pages/edu.js
// AURA Education: the licence on this account, school-email verification, class
// and school codes, and (for verified teachers) class codes of their own.
//
// Links land here with the secret in the fragment, never the query, so it reaches
// no server log: edu.html#verify=<token> from the verification email, and
// edu.html#code=<code> from a teacher's class link. Both go to the API only in a
// POST body. If sign-in is needed first, the fragment waits in sessionStorage
// (sign-in returns to edu.html by name, which drops the fragment).
//
// Dark until the server's AURA_EDU_ENABLED is on: then every /api/edu route is a 404.
import { api, esc, fmtDate, loadAccountCached, redirectToSignIn } from "../lib/api.js";

const FRAGMENT_KEY = "aura-edu-fragment";
const FRAGMENT_TTL_MS = 60 * 60 * 1000;
// Mirrors AURA_EDU_CLASS_MAX_SEATS / AURA_EDU_CLASS_MAX_DAYS on the server; the
// server is the judge, these only shape the form.
const MAX_SEATS = 60;
const MAX_TERM_DAYS = 183;

// ---------------------------------------------------------------- fragment

function parseFragment(hash) {
  const m = /^#(verify|code)=([^&]+)/.exec(hash || "");
  if (!m) return null;
  try {
    return { kind: m[1], value: decodeURIComponent(m[2]), hash };
  } catch {
    return null;
  }
}

/** The #verify / #code this visit carries: from the address bar, else from before sign-in. */
function takeFragment() {
  const here = parseFragment(window.location.hash);
  if (here) {
    try {
      sessionStorage.setItem(FRAGMENT_KEY, JSON.stringify({ hash: here.hash, at: Date.now() }));
    } catch {}
    return here;
  }
  try {
    const kept = JSON.parse(sessionStorage.getItem(FRAGMENT_KEY) || "null");
    if (kept && Date.now() - kept.at < FRAGMENT_TTL_MS) {
      const back = parseFragment(kept.hash);
      if (back) {
        history.replaceState(null, "", window.location.pathname + window.location.search + back.hash);
        return back;
      }
    }
    sessionStorage.removeItem(FRAGMENT_KEY);
  } catch {}
  return null;
}

function forgetFragment() {
  try {
    sessionStorage.removeItem(FRAGMENT_KEY);
  } catch {}
}

function clearFragment() {
  forgetFragment();
  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

// ------------------------------------------------------------------ errors

const MESSAGES = {
  not_academic_email:
    "That address isn't on our list of school email domains. If it is your school's address, email edu@auraengine.com with proof of enrolment or employment and we'll check it by hand.",
  school_email_in_use:
    "That school email is already verified on another AURA account. Each school email can verify one account.",
  link_invalid:
    "This verification link doesn't work: it has expired, it was already used, or it was sent for a different AURA account. Sign in to the account you asked from, or ask for a new link below.",
  code_invalid: "That code isn't valid, or its class has ended. Check it with whoever gave it to you.",
  no_seats_left: "Every seat on that code is taken. Ask whoever gave it to you to add seats.",
  already_redeemed:
    "You've already used this code on this account, and the access it gave has ended. A code works once per account; ask whoever gave it to you for a new one.",
  not_verified_faculty:
    'Only verified teachers can create classes. Verify your school email with "I teach" ticked first.',
  class_limit: "You already have as many open classes as you can run at once. End one before creating another.",
  not_found: "We couldn't find that workspace or class. Reload the page and try again.",
  mail_failed: "We couldn't send the email just now. Please try again in a few minutes.",
};

const TOO_MANY = {
  verify: "You've asked for too many verification emails. Please try again in an hour.",
  redeem: "Too many wrong codes. Please try again in an hour.",
  other: "Too many tries. Please try again in an hour.",
};

function sentence(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const s = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

function errorText(err, context = "other") {
  if (err?.code === "too_many_requests" || err?.status === 429) return TOO_MANY[context] || TOO_MANY.other;
  // out_of_range covers several limits (seats, term, a workspace never saved);
  // the server's own sentence names the one that was hit.
  if (err?.code === "out_of_range") return sentence(err.message) || "Check the class details and try again.";
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  if (err?.status === 422) return "Please check the form and try again.";
  if (!err?.status) return "We couldn't reach AURA. Check your connection and try again.";
  return sentence(err?.message) || "Something went wrong. Please try again.";
}

/** A signed-out answer mid-page: off to sign in (back here after), else say so. */
function sessionEnded(el) {
  el.textContent = redirectToSignIn()
    ? "Your session has ended. Taking you to sign in…"
    : "We couldn't confirm your sign-in. Please e-mail support@auraengine.com and we'll sort it out.";
}

function showFormError(form, err, context) {
  const el = form.querySelector("[data-edu-error]");
  if (err?.status === 401) sessionEnded(el);
  else el.textContent = errorText(err, context);
  el.hidden = false;
}

function hideFormError(form) {
  const el = form.querySelector("[data-edu-error]");
  if (el) {
    el.hidden = true;
    el.textContent = "";
  }
}

// ----------------------------------------------------------------- render

const SOURCE = {
  domain: "Verified school email",
  code: "Class or school code",
  manual: "Granted by AURA",
};
const ROLE = { student: "Student", faculty: "Teacher" };

function fmtDateTime(value) {
  return value
    ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "--";
}

function block(id, title, body) {
  return `
    <section class="block" id="${id}" aria-labelledby="${id}-h">
      <h2 id="${id}-h">${title}</h2>
      <div class="block__body">${body}</div>
    </section>`;
}

function grantRows(grant) {
  if (!grant) {
    return `<div>You don't have AURA Education on this account yet. Verify a school email or enter a code below.</div>`;
  }
  const active = grant.status === "active";
  return `
    <div><strong>Status:</strong> ${active ? "Active" : "Ended"}</div>
    <div><strong>From:</strong> ${esc(SOURCE[grant.source] || grant.source)}</div>
    <div><strong>Role:</strong> ${esc(ROLE[grant.role] || grant.role)}</div>
    ${grant.institution ? `<div><strong>Institution:</strong> ${esc(grant.institution)}</div>` : ""}
    ${grant.schoolEmail ? `<div><strong>School email:</strong> ${esc(grant.schoolEmail)}</div>` : ""}
    <div><strong>${active ? "Ends" : "Ended"}:</strong> ${fmtDate(grant.expiresAt)}</div>`;
}

function renderStatus(state, notice = "") {
  const el = document.getElementById("edu-status");
  if (el) el.innerHTML = `${notice}${grantRows(state.grant)}`;
}

function verifyForm() {
  return `
    <form class="form" id="edu-verify">
      <p>We'll email a link to your school address. Open it in this browser, signed in to this account, to turn on AURA Education here.</p>
      <div>
        <label for="edu-school-email">School email</label>
        <input class="input" id="edu-school-email" name="schoolEmail" type="email" required maxlength="320" autocomplete="email" placeholder="name@school.edu" />
      </div>
      <div>
        <label class="legal-agree" for="edu-teaches">
          <input type="checkbox" id="edu-teaches" name="teaches" />
          <span>I teach (staff and faculty can create class codes)</span>
        </label>
      </div>
      <div>
        <label for="edu-institution">Institution (optional)</label>
        <input class="input" id="edu-institution" name="institution" maxlength="200" placeholder="Your school, college or university" />
      </div>
      <div class="form-error" data-edu-error hidden></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn primary" type="submit">Send the link</button>
      </div>
      <div id="edu-verify-result"></div>
    </form>`;
}

function redeemForm(prefill) {
  return `
    <form class="form" id="edu-redeem">
      <p>Your teacher or school gives you a code. Enter it here to join.</p>
      <div>
        <label for="edu-code">Code</label>
        <input class="input mono" id="edu-code" name="code" required minlength="4" maxlength="64" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(prefill)}" />
      </div>
      <div class="form-error" data-edu-error hidden></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn primary" type="submit">Use this code</button>
      </div>
      <div id="edu-redeem-result"></div>
    </form>`;
}

function isoDay(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function classForm(workspaces) {
  const today = new Date();
  const options = workspaces
    .map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`)
    .join("");
  return `
    <form class="form" id="edu-class">
      <h3>Create a class</h3>
      <div>
        <label for="edu-course">Course name</label>
        <input class="input" id="edu-course" name="courseName" required maxlength="120" placeholder="e.g. ARCH 210 Site Analysis" />
      </div>
      <div>
        <label for="edu-seats">Seats (up to ${MAX_SEATS})</label>
        <input class="input" id="edu-seats" name="seats" type="number" min="1" max="${MAX_SEATS}" required value="30" />
      </div>
      <div>
        <label for="edu-ends">Term ends (within ${MAX_TERM_DAYS} days)</label>
        <input class="input" id="edu-ends" name="endsAt" type="date" required min="${isoDay(today)}" max="${isoDay(addDays(today, MAX_TERM_DAYS - 1))}" value="${isoDay(addDays(today, 120))}" />
      </div>
      <div>
        <label for="edu-workspace">Class workspace (optional)</label>
        <select class="input" id="edu-workspace" name="workspaceId">
          <option value="">None</option>
          ${options}
        </select>
      </div>
      <p>${workspaces.length
        ? "Pick one of your own workspaces and each student who joins gets their own copy of it."
        : "You don't own a workspace yet. Make one in AURA to hand each student their own copy of it."}</p>
      <div class="form-error" data-edu-error hidden></div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn primary" type="submit">Create class</button>
      </div>
    </form>
    <div id="edu-class-result"></div>`;
}

function classLink(code) {
  // The class link opens this page with the code filled in.
  const url = new URL("edu.html", window.location.origin + window.location.pathname);
  url.hash = `code=${encodeURIComponent(code)}`;
  return url.toString();
}

function copyRow(id, value) {
  return `
    <input class="input mono" id="${id}" readonly value="${esc(value)}" />
    <button class="btn ghost" type="button" data-copy="${id}">Copy</button>`;
}

function wireCopy(root) {
  root.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const input = document.getElementById(b.dataset.copy);
      try {
        await navigator.clipboard.writeText(input.value);
        b.textContent = "Copied";
      } catch {
        input.select();
      }
    })
  );
}

function classCreated(res) {
  const code = res.code;
  return `
    <div class="notice success">
      <strong>${esc(code.courseName || "Your class")} is ready.</strong>
      Students join with the code <strong class="mono" data-class-code>${esc(code.code)}</strong>
      (${code.seats} seat${code.seats === 1 ? "" : "s"}, until ${fmtDate(code.expiresAt)}).
      <div class="hr"></div>
      <label for="edu-class-link">Class link: send this to your students</label>
      ${copyRow("edu-class-link", classLink(code.code))}
      ${res.shareToken
        ? `<div class="hr"></div>
           <label for="edu-app-link">AURA app link to the class workspace</label>
           ${copyRow("edu-app-link", `aura://open?share=${encodeURIComponent(res.shareToken)}`)}
           <p class="muted">This link is shown once. Copy it now: we can't show it again.</p>`
        : ""}
    </div>`;
}

function classRows(classes) {
  if (!classes.length) return `<p class="muted">No classes yet.</p>`;
  const rows = classes
    .map(
      (c) => `
      <tr>
        <td class="mono">${esc(c.code)}</td>
        <td>${esc(c.courseName || "")}</td>
        <td>${c.redeemed} of ${c.seats || "unlimited"}</td>
        <td>${fmtDate(c.expiresAt)}</td>
        <td>${c.active ? "Active" : "Ended"}</td>
        <td>${c.active ? `<button class="btn ghost" type="button" data-end-class="${esc(c.id)}" data-end-code="${esc(c.code)}">End class</button>` : ""}</td>
      </tr>`
    )
    .join("");
  return `
    <div style="overflow-x:auto">
      <table class="table" id="edu-class-table">
        <thead><tr><th>Code</th><th>Course</th><th>Seats used</th><th>Term ends</th><th>State</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="form-error" data-edu-list-error hidden></div>`;
}

// ------------------------------------------------------------------ flows

async function confirmLink(token, state) {
  let notice;
  try {
    const res = await api("/api/edu/confirm", { method: "POST", body: { token } });
    Object.assign(state, res);
    notice = `<div class="notice success" data-edu-confirm>Your school email is verified. AURA Education is on for this account until ${fmtDate(res.grant?.expiresAt)}.</div>`;
  } catch (err) {
    if (err.status === 401) return false;
    notice = `<div class="notice warn" data-edu-confirm>${esc(errorText(err))}</div>`;
  }
  // Spent or refused: either way the token is done with.
  clearFragment();
  renderStatus(state, notice);
  return true;
}

function wireVerify(form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError(form);
    const data = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await api("/api/edu/verify-email", {
        method: "POST",
        body: {
          schoolEmail: String(data.get("schoolEmail") || "").trim(),
          teaches: data.get("teaches") === "on",
          institution: String(data.get("institution") || "").trim() || null,
        },
      });
      form.querySelector("#edu-verify-result").innerHTML = `
        <div class="notice success">We sent a link to <strong>${esc(res.schoolEmail)}</strong>. It works once,
          until ${fmtDateTime(res.expiresAt)}. Open it in this browser while signed in to this account.
          Not there? Check the spam folder.</div>`;
    } catch (err) {
      showFormError(form, err, "verify");
    } finally {
      btn.disabled = false;
    }
  });
}

function wireRedeem(form, state) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError(form);
    const code = String(new FormData(form).get("code") || "").trim();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await api("/api/edu/redeem", { method: "POST", body: { code } });
      clearFragment();
      state.grant = res.grant;
      state.hasPlanAccess = res.hasPlanAccess;
      renderStatus(state);
      const where = [res.courseName, res.institution].filter(Boolean).map(esc).join(", ");
      const parts = [
        `<strong>${res.alreadyRedeemed ? "You've already joined with this code." : "You're in."}</strong>
         ${where ? `${where}. ` : ""}AURA Education is on for this account until ${fmtDate(res.grant?.expiresAt)}.`,
      ];
      if (res.classWorkspace) {
        parts.push(`Your copy of <strong>${esc(res.classWorkspace.name)}</strong> is in your workspaces; open AURA to start.`);
      }
      if (res.classSiteNote) parts.push(esc(sentence(res.classSiteNote)));
      form.querySelector("#edu-redeem-result").innerHTML = `
        <div class="notice success" data-redeem-result>${parts.join(" ")}</div>`;
    } catch (err) {
      showFormError(form, err, "redeem");
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadClasses(el) {
  try {
    const { classes } = await api("/api/edu/classes");
    el.innerHTML = classRows(classes || []);
  } catch (err) {
    if (err.status === 401) return sessionEnded(el);
    el.innerHTML = `<div class="form-error">${esc(errorText(err))}</div>`;
    return;
  }
  el.querySelectorAll("[data-end-class]").forEach((b) =>
    b.addEventListener("click", async () => {
      const ok = confirm(
        `End the class ${b.dataset.endCode}? No one new can join with its code, and its class workspace link stops working. Students who already joined keep their access until the term ends.`
      );
      if (!ok) return;
      b.disabled = true;
      try {
        await api("/api/edu/classes/end", { method: "POST", body: { id: b.dataset.endClass } });
        await loadClasses(el);
      } catch (err) {
        b.disabled = false;
        if (err.status === 401) return sessionEnded(el);
        const box = el.querySelector("[data-edu-list-error]");
        box.textContent = errorText(err);
        box.hidden = false;
      }
    })
  );
}

async function initFaculty(root) {
  let workspaces = [];
  const account = await loadAccountCached();
  if (account?.workspaces) workspaces = account.workspaces.filter((w) => w.role === "owner");
  root.insertAdjacentHTML(
    "beforeend",
    block("edu-classes", "Your classes", `${classForm(workspaces)}<div class="hr"></div><div id="edu-class-list">Loading…</div>`)
  );
  const form = document.getElementById("edu-class");
  const list = document.getElementById("edu-class-list");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormError(form);
    const data = new FormData(form);
    const [y, m, d] = String(data.get("endsAt") || "").split("-").map(Number);
    // The end of the chosen day, but never past the server's limit.
    const latest = Date.now() + MAX_TERM_DAYS * 86400000 - 5 * 60000;
    const endsAt = new Date(Math.min(new Date(y, m - 1, d, 23, 59, 0).getTime(), latest));
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await api("/api/edu/classes", {
        method: "POST",
        body: {
          courseName: String(data.get("courseName") || "").trim(),
          seats: Number(data.get("seats")),
          endsAt: endsAt.toISOString(),
          workspaceId: data.get("workspaceId") || null,
        },
      });
      const out = document.getElementById("edu-class-result");
      out.innerHTML = classCreated(res);
      wireCopy(out);
      form.reset();
      await loadClasses(list);
    } catch (err) {
      showFormError(form, err, "class");
    } finally {
      btn.disabled = false;
    }
  });
  await loadClasses(list);
}

function notOpen(root) {
  const lead = document.getElementById("edu-lead");
  if (lead) {
    lead.innerHTML = `AURA Education isn't open yet. To hear when it opens, or to ask about it for your
      school, email <a href="mailto:edu@auraengine.com">edu@auraengine.com</a>.`;
  }
  root.innerHTML = "";
}

export async function initEdu() {
  const root = document.getElementById("edu");
  if (!root) return;
  const fragment = takeFragment();

  let state;
  try {
    state = await api("/api/edu");
  } catch (err) {
    const body = root.querySelector(".features") || root;
    if (err.status === 404) {
      forgetFragment();
      return notOpen(root);
    }
    if (err.status === 401) return sessionEnded(body);
    body.textContent = `Error loading AURA Education: ${errorText(err)}`;
    return;
  }

  root.innerHTML =
    block("edu-status-b", "Your licence", `<div id="edu-status" class="features"></div>`) +
    block("edu-verify-b", "Verify a school email", verifyForm()) +
    block("edu-redeem-b", "Have a class or school code?", redeemForm(fragment?.kind === "code" ? fragment.value : ""));
  renderStatus(state);
  wireVerify(document.getElementById("edu-verify"));
  wireRedeem(document.getElementById("edu-redeem"), state);

  if (fragment?.kind === "verify") {
    if (!(await confirmLink(fragment.value, state))) {
      return sessionEnded(document.getElementById("edu-status"));
    }
  } else if (fragment?.kind === "code") {
    // Filled in; it's used when they press the button. Nothing to bring back after this.
    forgetFragment();
    document.getElementById("edu-redeem-b")?.scrollIntoView({ block: "start" });
    document.getElementById("edu-code")?.focus({ preventScroll: true });
  }

  if (state.canCreateClasses) await initFaculty(root);
}
