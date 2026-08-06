import {
  fmtDate,
  hasPlanAccess,
  isBillingExempt,
  loadAccountCached,
  loadMe,
  startCheckout,
} from "../lib/api.js";

function statusLineHTML(status, subscription, exempt) {
  // Exempt accounts have no subscription by design, so the "no membership yet"
  // copy below would be both wrong and un-actionable (checkout is refused).
  if (exempt) {
    return `<span class="status-dot ok"></span>Full access via your account type — no membership required.`;
  }
  if (!subscription || status === "onboarding") {
    return `<span class="status-dot warn"></span>No membership yet — start your free trial below.`;
  }
  if (status === "trialing") {
    return `<span class="status-dot ok"></span>Membership trial active — converts to paid on <strong>${fmtDate(subscription.trialEnd)}</strong>.`;
  }
  if (status === "active") {
    return `<span class="status-dot ok"></span>Membership active — renews <strong>${fmtDate(subscription.currentPeriodEnd)}</strong>.`;
  }
  return `<span class="status-dot bad"></span>Membership needs attention (status: ${status}) — check <a href="billing.html">billing</a>.`;
}

function membershipStep(account) {
  const { billing, subscription } = account;
  const status = billing.status;
  const exempt = isBillingExempt(account);
  const stateEl = document.getElementById("step-membership-state");
  const copyEl = document.getElementById("step-membership-copy");
  const actionsEl = document.getElementById("step-membership-actions");
  const card = document.getElementById("step-membership");
  if (!stateEl || !copyEl || !actionsEl || !card) return;

  if (exempt) {
    card.classList.add("done");
    stateEl.textContent = "Included";
    stateEl.classList.add("ok");
    copyEl.innerHTML = `Downloads and client access are unlocked for your <strong>${account.userType}</strong> account. No billing applies.`;
    actionsEl.innerHTML = `<a class="btn ghost" href="account.html">Account</a>`;
  } else if (hasPlanAccess(account)) {
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

/**
 * Without a membership, the 3-step setup checklist is answering a question the
 * visitor hasn't asked yet — they can't download or run anything until they
 * activate. So the trial gets the top of the page and the checklist moves below
 * it, under a heading that says what it's for.
 */
function trialPromptHTML() {
  return `
    <div class="trial-prompt">
      <div class="trial-prompt-copy">
        <div class="trial-prompt-title">Start your 30-day free trial</div>
        <div class="trial-prompt-sub">
          Unlock Ask AURA in the browser and the AURA Engine desktop client.
          Cancel anytime before the trial ends and you won't be charged.
        </div>
      </div>
      <div class="card-actions">
        <button class="btn primary" type="button" id="dash-start-trial">Start free trial</button>
        <a class="btn ghost" href="plans.html">See what's included</a>
      </div>
    </div>`;
}

function demoteSetupFlow() {
  const flow = document.querySelector(".flow");
  if (!flow || document.getElementById("setup-heading")) return;
  flow.classList.add("flow-secondary");
  const heading = document.createElement("h2");
  heading.id = "setup-heading";
  heading.className = "setup-heading";
  heading.textContent = "Once you're a member";
  flow.parentNode.insertBefore(heading, flow);
}

export async function initDashboard() {
  const user = await loadMe();
  const nameEl = document.querySelector("[data-username]");
  if (nameEl && user) nameEl.textContent = user.firstName || user.email;

  const account = await loadAccountCached();
  if (!account) return;
  const { billing, subscription } = account;

  const statusEl = document.getElementById("status-chips");
  if (statusEl) {
    statusEl.innerHTML = statusLineHTML(
      billing.status,
      subscription,
      isBillingExempt(account)
    );
  }

  membershipStep(account);

  if (!hasPlanAccess(account)) {
    const mount = document.getElementById("membership-banner");
    if (mount) {
      mount.innerHTML = trialPromptHTML();
      document
        .getElementById("dash-start-trial")
        ?.addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = "Opening checkout…";
          try {
            await startCheckout();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = "Start free trial";
            alert(err.message);
          }
        });
    }
    demoteSetupFlow();
  }
}
