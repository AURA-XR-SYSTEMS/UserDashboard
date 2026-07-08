import { api, fmtDate, fmtMoney, hasPlanAccess, loadAccount } from "../lib/api.js";

function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function openBillingPortal() {
  const { url } = await api("/api/subscriptions/portal", { method: "POST" });
  if (!url) throw new Error("Billing portal response missing redirect URL");
  window.location.href = url;
}

function statusMeta(status) {
  if (status === "active") return { dot: "ok", label: "Active" };
  if (status === "trialing") return { dot: "ok", label: "Trial active" };
  if (status === "paused") return { dot: "warn", label: "Needs attention" };
  if (status === "canceled") return { dot: "bad", label: "Canceled" };
  return { dot: "warn", label: "No membership" };
}

function membershipKvHTML(billing, subscription) {
  const { dot, label } = statusMeta(billing.status);
  const rows = [
    ["Plan", subscription.name],
    ["Status", `<span class="status-dot ${dot}"></span>${label} <span class="muted">(${billing.status})</span>`],
    ["Price", `${fmtMoney(subscription.amountCents, subscription.currency)} / ${subscription.interval}`],
    ["Payment method", billing.method || "—"],
  ];
  if (billing.status === "trialing" && subscription.trialEnd) {
    rows.push(["Trial started", fmtDate(subscription.trialStart)]);
    rows.push(["Trial converts", fmtDate(subscription.trialEnd)]);
  }
  if (subscription.currentPeriodStart || subscription.currentPeriodEnd) {
    rows.push([
      "Current period",
      `${fmtDate(subscription.currentPeriodStart)} &rarr; ${fmtDate(subscription.currentPeriodEnd)}`,
    ]);
  }
  rows.push([
    "Auto-renew",
    subscription.cancelAtPeriodEnd
      ? `<span class="chip warn">Off — cancels at period end</span>`
      : `<span class="chip success">On</span>`,
  ]);
  return `<dl class="kv">${rows
    .map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd ?? "—"}</dd></div>`)
    .join("")}</dl>`;
}

function workspacesHTML(workspaces) {
  if (!workspaces?.length) return "";
  return workspaces
    .map(
      (w) => `
      <div class="ws-item">
        <span class="ws-name">${w.name || "Untitled workspace"}</span>
        <span class="ws-date">updated ${fmtDate(w.updatedAt || w.createdAt)}</span>
      </div>`
    )
    .join("");
}

function renderAccount(account) {
  const { email, firstName, lastName, createdAt, userType, billing, subscription, workspaces } = account;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const nameEl = document.querySelector("[data-username]");
  if (nameEl) nameEl.textContent = fullName || email;
  setText("account-subtitle", `Signed in as <span class="mono">${email}</span>`);

  // Profile
  setText("pf-name", fullName || "—");
  setText("pf-email", email || "—");
  setText("pf-created", createdAt ? fmtDate(createdAt) : "—");
  setText("pf-type", userType || "standard");

  // Membership
  const stateEl = document.getElementById("mb-state");
  const bodyEl = document.getElementById("membership-body");
  const startBtn = document.getElementById("mb-start");
  const manageBtn = document.getElementById("mb-manage");
  const isMember = hasPlanAccess(billing.status) && subscription;

  const { dot, label } = statusMeta(subscription ? billing.status : "onboarding");
  if (stateEl) {
    stateEl.innerHTML = `<span class="status-dot ${dot}"></span>${label}`;
    stateEl.classList.add(isMember ? "ok" : "attn");
  }

  if (subscription) {
    bodyEl.innerHTML = membershipKvHTML(billing, subscription);
    if (manageBtn) manageBtn.hidden = false;
    if (startBtn) startBtn.hidden = true;
  } else {
    bodyEl.innerHTML = `<div class="empty">No membership yet. Start one to unlock gateway downloads and client access${
      billing.trialAvailable ? " — your free trial is available" : ""
    }.</div>`;
    if (startBtn) startBtn.hidden = false;
    if (manageBtn) manageBtn.hidden = true;
  }

  // Workspaces
  const wsHTML = workspacesHTML(workspaces);
  if (wsHTML) setText("ws-list", wsHTML);
}

export async function initAccount() {
  const account = await loadAccount();
  if (account) renderAccount(account);

  document.getElementById("mb-manage")?.addEventListener("click", () =>
    openBillingPortal().catch((e) => alert(e.message))
  );

  const emailResetForm = document.getElementById("email-reset-form");
  const emailResetInput = document.getElementById("sec-email");
  emailResetInput.addEventListener("input", () =>
    emailResetInput.setCustomValidity("")
  );
  const secEmailBtn = document.getElementById("sec-email-save");
  secEmailBtn.addEventListener("click", async () => {
    const newEmail = (emailResetInput.value || "").trim();
    if (!newEmail) {
      emailResetInput.setCustomValidity("Invalid email");
      emailResetInput.reportValidity();
      emailResetInput.classList.add("invalid");
      return;
    }
    emailResetInput.setCustomValidity("");
    emailResetInput.classList.remove("invalid");

    try {
      await api("/api/auth/emailUpdate", {
        method: "POST",
        body: { newEmail },
      });
      alert("Email updated");
    } catch (e) {
      alert(e.message);
    }
  });

  emailResetForm.addEventListener("invalid", async (e) => {
    emailResetForm.classList.add("shake");
    setTimeout(() => emailResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  });

  const passwordResetForm = document.getElementById("pw-reset-form");
  const passwordResetButton = document.getElementById("sec-pass-save");
  const currentPasswordInput = document.getElementById("sec-current");
  const newPasswordInput = document.getElementById("sec-new");
  const confirmPasswordInput = document.getElementById("sec-new-confirm");

  [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach((input) => {
    input.addEventListener("input", () => input.setCustomValidity(""));
  });

  passwordResetForm.addEventListener("invalid", async (e) => {
    passwordResetForm.classList.add("shake");
    setTimeout(() => passwordResetForm.classList.remove("shake"), 300);
    e.target.classList.add("invalid");
  });

  passwordResetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (newPasswordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity("Passwords don't match");
      confirmPasswordInput.reportValidity();
      confirmPasswordInput.classList.add("invalid");
      return;
    }
    confirmPasswordInput.setCustomValidity("");
    confirmPasswordInput.classList.remove("invalid");

    try {
      const { token } = await api("api/auth/resetToken", {
        method: "POST",
        body: {
          previousPassword: currentPasswordInput.value,
          newPassword: confirmPasswordInput.value,
        },
      });

      await api("api/auth/reset", {
        method: "POST",
        body: { token, newPassword: confirmPasswordInput.value },
      });
      alert("Your password has been reset!");
    } catch (err) {
      console.error(err);
      alert(
        err?.message ||
          "Unable to reset your password at this time. Please contact the AURA team for assistance."
      );
      passwordResetButton.disabled = false;
      passwordResetButton.textContent = "Reset Password";
    }
  });
}
