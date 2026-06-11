import { fmtDate, loadAccount, loadMe } from "../lib/api.js";

const getStatusHTML = (status, subscription) => {
  if (status === "onboarding" || !subscription) {
    return 'No active membership. <a href="plans.html">Start membership</a> to unlock downloads.';
  }
  const statusClass = ["active", "trialing"].includes(status) ? "success" : "warn";
  const periodLabel = status === "trialing" ? "Trial ends" : "Renews";
  const periodDate =
    status === "trialing"
      ? subscription.trialEnd
      : subscription.currentPeriodEnd;
  return ` <div class="row" style="flex-wrap:wrap; gap:8px;">
        <span class="chip">Plan: <strong>${subscription.name}</strong></span>
        <span class="chip ${statusClass}">Status: <strong>${status}</strong></span>
        <span class="chip muted">${periodLabel}: <strong>${fmtDate(periodDate)}</strong></span>
      </div>
    `;
};

export async function initDashboard() {
  const chipsEl = document.getElementById("status-chips");
  const user = await loadMe();

  const el = document.querySelector("[data-username]");
  if (el && user) el.textContent = user.firstName;

  const account = await loadAccount();
  chipsEl.innerHTML = getStatusHTML(account.billing.status, account.subscription);
}
