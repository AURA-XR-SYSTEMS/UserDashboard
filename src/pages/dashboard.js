import {
  ASKAURA_URL,
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

/** The AURA Engine card: download is always step one; the state chip and the
 *  secondary action reflect membership. */
function engineCard(account) {
  const { billing, subscription } = account;
  const status = billing.status;
  const exempt = isBillingExempt(account);
  const stateEl = document.getElementById("engine-state");
  const copyEl = document.getElementById("engine-copy");
  const actionsEl = document.getElementById("engine-actions");
  if (!stateEl || !copyEl || !actionsEl) return;

  const lede = `The full real-time 3D environment — GIS, BIM, and AI over photoreal digital twins.`;
  const download = `<a class="btn primary" href="downloads.html">Download for Windows</a>`;

  if (exempt) {
    stateEl.textContent = "Included";
    stateEl.classList.add("ok");
    copyEl.innerHTML = `${lede} Unlocked for your <strong>${account.userType}</strong> account — no billing applies.`;
    actionsEl.innerHTML = `${download}<a class="btn ghost" href="account.html">Account</a>`;
  } else if (hasPlanAccess(account)) {
    stateEl.textContent = status === "trialing" ? "Trial active" : "Active";
    stateEl.classList.add("ok");
    copyEl.innerHTML = `${lede} You're on <strong>${subscription?.name || "Aura Membership"}</strong> — downloads and client access are unlocked.`;
    actionsEl.innerHTML = `${download}<a class="btn ghost" href="billing.html">Manage billing</a>`;
  } else if (subscription && status !== "onboarding") {
    stateEl.textContent = "Attention";
    stateEl.classList.add("attn");
    copyEl.innerHTML = `Your membership status is <strong>${status}</strong>. Update payment or review billing to restore access.`;
    actionsEl.innerHTML = `<a class="btn primary" href="billing.html">Review billing</a><a class="btn ghost" href="downloads.html">Downloads</a>`;
  } else {
    stateEl.textContent = "Membership required";
    stateEl.classList.add("attn");
    copyEl.innerHTML = `${lede} Start your free trial above to unlock the client.`;
    actionsEl.innerHTML = `<a class="btn ghost" href="downloads.html">Downloads</a><a class="btn ghost" href="plans.html">See the plan</a>`;
  }
}

/** The Ask AURA card CTA — same two destinations as the sitewide banner:
 *  members go straight into the app, everyone else to checkout (Ask AURA
 *  gates on the same status and would bounce them anyway). */
function askAuraCard(account) {
  const btn = document.getElementById("askaura-open");
  if (!btn) return;
  const isMember = hasPlanAccess(account);
  if (!isMember) btn.textContent = "Start free trial";

  btn.addEventListener("click", async () => {
    if (isMember) {
      window.open(ASKAURA_URL, "_blank", "noopener");
      return;
    }
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

  engineCard(account);
  askAuraCard(account);

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
  }
}
