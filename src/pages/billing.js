// src/pages/billing.js
import { api } from "../lib/api.js";

export async function initBilling() {
  const el = document.getElementById("billing-info");
  if (!el) return;

  try {
    const { user } = await api("/api/me");

    if (!user || !user.billing || user.billing.status === "none") {
      el.innerHTML = 'No active plan. <a href="plans.html">Choose a plan</a>.';
      return;
    }

    const { status, planId, renewsAt } = user.billing;

    const renewsAtTzAware = user.billing.renewsAt
      ? new Date(user.billing.renewsAt).toLocaleString()
      : "—";
    el.innerHTML = `
      <div><strong>Status:</strong> ${status}</div>
      <div><strong>Plan:</strong> ${planId || "—"}</div>
      <div><strong>Renews:</strong> ${renewsAtTzAware}</div>
      <div class="hr"></div>
      <a class="btn primary" href="downloads.html">Go to downloads</a>
    `;
  } catch (e) {
    el.textContent = `Error loading billing: ${e.message}`;
  }
}
