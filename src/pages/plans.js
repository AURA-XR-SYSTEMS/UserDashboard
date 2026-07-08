import { api, fmtDate, fmtMoney, hasPlanAccess, loadAccount } from "../lib/api.js";

function intervalLabel(interval) {
  if (interval === "year") return "year";
  return "month";
}

async function openBillingPortal() {
  const { url } = await api("/api/subscriptions/portal", { method: "POST" });
  if (!url) throw new Error("Billing portal response missing redirect URL");
  window.location.href = url;
}

function activeBannerHTML(status, subscription) {
  const isTrial = status === "trialing";
  const dateLabel = isTrial
    ? `Trial converts to paid on <strong>${fmtDate(subscription.trialEnd)}</strong>`
    : `Renews on <strong>${fmtDate(subscription.currentPeriodEnd)}</strong>`;
  const cancelNote = subscription.cancelAtPeriodEnd
    ? ` &middot; <span class="chip warn">Cancels at period end</span>`
    : "";
  return `
    <div class="banner">
      <div>
        <div class="banner-title"><span class="status-dot ok"></span>Your membership is ${isTrial ? "in trial" : "active"}</div>
        <div class="banner-sub">${subscription.name} &middot; ${fmtMoney(subscription.amountCents, subscription.currency)}/${intervalLabel(subscription.interval)} &middot; ${dateLabel}${cancelNote}</div>
      </div>
      <div class="card-actions">
        <button class="btn primary" id="banner-manage-billing">Manage billing</button>
        <a class="btn ghost" href="downloads.html">Go to downloads</a>
      </div>
    </div>`;
}

function planCardHTML(plan, memberStatus) {
  const { amountCents, currency, description, interval, name, trialDays } = plan;
  const isMember = hasPlanAccess(memberStatus);
  const trialHtml =
    !isMember && trialDays > 0
      ? `<span class="chip success" style="margin-left:8px;">${trialDays}-day free trial</span>`
      : "";
  const currentHtml = isMember
    ? `<span class="chip success" style="margin-left:8px;">Current plan</span>`
    : "";

  const actions = isMember
    ? `<button class="btn ghost" data-manage-billing>Manage billing</button>
       <a class="btn ghost" href="account.html">View account</a>`
    : `<button class="btn primary" data-start-membership>Start membership</button>`;

  return `
    <div class="card-header">${name}${trialHtml}${currentHtml}</div>
    <div class="card-body">
      <div class="features">
        <div class="stat">
          <span class="stat-value">${fmtMoney(amountCents, currency)}</span>
          <span class="stat-unit">/ ${intervalLabel(interval)}</span>
        </div>
        <p class="muted" style="margin:10px 0 12px;">${description || "Membership access for Aura downloads and services."}</p>
        <div class="row" style="gap:12px; flex-wrap:wrap;">
          <span class="chip">Gateway downloads</span>
          <span class="chip">Client access</span>
          <span class="chip">Billing managed by Stripe</span>
        </div>
      </div>
      <div class="hr"></div>
      <div class="card-actions">${actions}</div>
    </div>`;
}

export async function loadPlans() {
  const list = document.querySelector("#plan-list");
  if (!list) return;

  const account = await loadAccount();
  const status = account?.billing?.status || "onboarding";
  const subscription = account?.subscription;
  const isMember = hasPlanAccess(status) && subscription;

  const bannerEl = document.getElementById("plan-banner");
  if (bannerEl && isMember) {
    bannerEl.innerHTML = activeBannerHTML(status, subscription);
    document
      .getElementById("banner-manage-billing")
      ?.addEventListener("click", () => openBillingPortal().catch((e) => alert(e.message)));
    const notice = document.getElementById("plan-notice");
    if (notice) {
      notice.innerHTML =
        "Your membership is managed through Stripe. Use <strong>Manage billing</strong> to update your payment method, view invoices, or cancel.";
    }
  }

  try {
    const { plans } = await api("/api/plans");
    list.innerHTML = "";
    plans.forEach((plan) => {
      const card = document.createElement("div");
      card.className = "card has-header";
      card.innerHTML = planCardHTML(plan, isMember ? status : "onboarding");
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = `<div class="empty">Couldn't load plan details (${e.message}). Refresh to retry.</div>`;
    return;
  }

  list.addEventListener("click", async (e) => {
    if (e.target?.hasAttribute("data-start-membership")) {
      try {
        const { url } = await api("/api/subscriptions/checkout", { method: "POST" });
        if (!url) throw new Error("Checkout response missing redirect URL");
        window.location.href = url;
      } catch (err) {
        alert(err.message);
      }
    }
    if (e.target?.hasAttribute("data-manage-billing")) {
      openBillingPortal().catch((err) => alert(err.message));
    }
  });
}
