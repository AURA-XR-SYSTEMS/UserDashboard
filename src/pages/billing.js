// src/pages/billing.js
import { api } from "../lib/api.js";
import { fmtDate } from "../lib/api.js";

export async function initBilling() {
  const el = document.getElementById("billing-info");
  if (!el) return;

  try {
    const { account } = await api("/api/account");
    const { billing, credits } = account;

    if (!billing || billing.status === "onboarding") {
      el.innerHTML = 'No active plan. <a href="plans.html">Choose a plan</a>.';
      return;
    }

    el.innerHTML = `
      <div><strong>Status:</strong> ${billing.status}</div>
      <div><strong>Plan:</strong> ${credits?.planType || "--"}</div>
      <div><strong>Renews:</strong> ${fmtDate(credits?.renewsAt)}</div>
      <div class="hr"></div>
      <a class="btn primary" href="downloads.html">Go to downloads</a>
    `;
  } catch (e) {
    el.textContent = `Error loading billing: ${e.message}`;
  }
}
