// src/pages/dashboard.js
import { api, loadMe } from "../lib/api.js";

/**
 * Provided billing inforormation, returns relevant plan info
 * @returns {string} - HTML string representing the status
 */
const getStatusHTML = (status, planId, renewsAt) => {
  if (status === "onboarding") {
    return 'No active plan. <a href="plans.html">Choose a plan</a> to unlock downloads.';
  }
  const statusClass = status === "active" ? "success" : "warn";
  return ` <div class="row" style="flex-wrap:wrap; gap:8px;">
        <span class="chip">Plan: <strong>${planId}</strong></span>
        <span class="chip ${statusClass}">Status: <strong>${status}</strong></span>
        <span class="chip muted">Renews: <strong>${renewsAt}</strong></span>
      </div>
    `;
};

export async function initDashboard() {
  const chipsEl = document.getElementById("status-chips");
  const creditsBlock = document.getElementById("credits-block");
  const creditsLabel = document.getElementById("credits-label");
  const creditsMeter = document.getElementById("credits-meter");
  const purchasedLabel = document.getElementById("purchased-label");
  const purchasedMeter = document.getElementById("purchased-meter");

  // const { user } = await api("/api/me");
  const user = await loadMe();

  const el = document.querySelector("[data-username]");
  if (el && user) el.textContent = user.firstName;

  const res = await api("/api/account");
  console.log(res);
  const { account } = res;
  console.log(account);

  chipsEl.innerHTML = getStatusHTML(
    account.billing.status,
    account.credits.planType,
    new Date(account.credits.renewsAt).toLocaleDateString()
  );

  // Credits meters
  const {
    active,
    allowanceAmount,
    allowanceRemaining,
    planType,
    purchasedTotal,
    purchasedRemaining,
    balance,
    renewsAt,
    startedAt,
  } = account.credits;

  if (allowanceRemaining > 0) {
    const percentage = (allowanceAmount / allowanceRemaining) * 100;
    creditsMeter.style.width = percentage + "%";
    creditsLabel.textContent = `${allowanceRemaining.toLocaleString()} / ${allowanceAmount.toLocaleString()} included this cycle`;
  } else {
    creditsMeter.style.width = "0%";
    creditsLabel.textContent = `${balance.toLocaleString()} available`;
  }

  if (purchasedTotal > 0) {
    const percentage = (purchasedRemaining / purchasedTotal) * 100;
    purchasedMeter.style.width = percentage + "%";
    purchasedLabel.textContent = `${purchasedRemaining.toLocaleString()} / ${purchasedTotal.toLocaleString()} this cycle`;
  } else {
    purchasedMeter.style.width = "0%";
    purchasedLabel.textContent = `${purchasedRemaining.toLocaleString()} additional credits available`;
  }

  creditsBlock.style.display = "block";
}
