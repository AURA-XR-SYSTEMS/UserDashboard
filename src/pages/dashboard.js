// src/pages/dashboard.js
import { creditPct, fmtDate, fmtInt, loadAccount, loadMe } from "../lib/api.js";

/**
 * Provided billing inforormation, returns relevant plan info
 * @returns {string} - HTML string representing the status
 */
const getStatusHTML = (status, planType, renewsAt) => {
  if (status === "onboarding") {
    return 'No active plan. <a href="plans.html">Choose a plan</a> to unlock downloads.';
  }
  const statusClass = status === "active" ? "success" : "warn";
  return ` <div class="row" style="flex-wrap:wrap; gap:8px;">
        <span class="chip">Plan: <strong>${planType}</strong></span>
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

  const user = await loadMe();

  const el = document.querySelector("[data-username]");
  if (el && user) el.textContent = user.firstName;

  const account = await loadAccount();
  console.log("displaying account in dashboard...", account);

  chipsEl.innerHTML = getStatusHTML(
    account.billing.status,
    account.credits.planType,
    fmtDate(account.credits.renewsAt)
  );

  // Credits meters
  const { allowanceAmount, allowanceRemaining, purchasedRemaining, balance } =
    account.credits;

  if (allowanceAmount > 0) {
    creditsMeter.style.width = `${creditPct(
      allowanceRemaining,
      allowanceAmount
    )}%`;
    creditsLabel.textContent = `${fmtInt(allowanceRemaining)} / ${fmtInt(
      allowanceAmount
    )} included this cycle`;
  } else {
    creditsMeter.style.width = "0%";
    creditsLabel.textContent = `${fmtInt(balance)} available`;
  }

  if (purchasedRemaining > 0) {
    purchasedMeter.style.width = "100%";
    purchasedLabel.textContent = `${fmtInt(
      purchasedRemaining
    )} additional credits available`;
  } else {
    purchasedMeter.style.width = "0%";
    purchasedLabel.textContent = `${fmtInt(
      purchasedRemaining
    )} additional credits available`;
  }

  creditsBlock.style.display = "block";
}
