import { fmtDate, hasPlanAccess, loadAccount, loadMe } from "../lib/api.js";

function statusLineHTML(status, subscription) {
  if (!subscription || status === "onboarding") {
    return `<span class="status-dot warn"></span>No active membership yet — activate in step 2 below.`;
  }
  if (status === "trialing") {
    return `<span class="status-dot ok"></span>Membership trial active — converts to paid on <strong>${fmtDate(subscription.trialEnd)}</strong>.`;
  }
  if (status === "active") {
    return `<span class="status-dot ok"></span>Membership active — renews <strong>${fmtDate(subscription.currentPeriodEnd)}</strong>.`;
  }
  return `<span class="status-dot bad"></span>Membership needs attention (status: ${status}) — check <a href="billing.html">billing</a>.`;
}

function membershipStep(status, subscription) {
  const stateEl = document.getElementById("step-membership-state");
  const copyEl = document.getElementById("step-membership-copy");
  const actionsEl = document.getElementById("step-membership-actions");
  const card = document.getElementById("step-membership");
  if (!stateEl || !copyEl || !actionsEl || !card) return;

  if (hasPlanAccess(status)) {
    card.classList.add("done");
    stateEl.textContent = status === "trialing" ? "Trial active" : "Active";
    stateEl.classList.add("ok");
    copyEl.innerHTML = `You're on <strong>${subscription?.name || "Aura Membership"}</strong>. Downloads and client access are unlocked.`;
    actionsEl.innerHTML = `
      <a class="btn ghost" href="billing.html">Manage billing</a>
      <a class="btn ghost" href="account.html">Account</a>`;
  } else if (subscription && status !== "onboarding") {
    stateEl.textContent = "Attention";
    stateEl.classList.add("attn");
    copyEl.innerHTML = `Your membership status is <strong>${status}</strong>. Update payment or review billing to restore access.`;
    actionsEl.innerHTML = `<a class="btn primary" href="billing.html">Review billing</a>`;
  } else {
    stateEl.textContent = "Action needed";
    stateEl.classList.add("attn");
  }
}

export async function initDashboard() {
  const user = await loadMe();
  const nameEl = document.querySelector("[data-username]");
  if (nameEl && user) nameEl.textContent = user.firstName || user.email;

  const account = await loadAccount();
  if (!account) return;
  const { billing, subscription } = account;

  const statusEl = document.getElementById("status-chips");
  if (statusEl) statusEl.innerHTML = statusLineHTML(billing.status, subscription);

  membershipStep(billing.status, subscription);
}
