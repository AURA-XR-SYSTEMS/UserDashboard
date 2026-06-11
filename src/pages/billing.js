import { api, fmtDate, fmtMoney } from "../lib/api.js";

function checkoutNotice() {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  if (checkout === "success") {
    return `<div class="notice success">Checkout completed. Your membership status may take a moment to update.</div>`;
  }
  if (checkout === "cancelled") {
    return `<div class="notice">Checkout was canceled. No membership changes were made.</div>`;
  }
  return "";
}

export async function initBilling() {
  const el = document.getElementById("billing-info");
  if (!el) return;

  try {
    const { account } = await api("/api/account");
    const { billing, subscription } = account;

    if (!billing || billing.status === "onboarding" || !subscription) {
      el.innerHTML = `
        ${checkoutNotice()}
        <div>No active membership. <a href="plans.html">Start membership</a>.</div>
      `;
      return;
    }

    const periodLabel =
      billing.status === "trialing" ? "Trial ends" : "Current period ends";
    const periodDate =
      billing.status === "trialing"
        ? subscription.trialEnd
        : subscription.currentPeriodEnd;

    el.innerHTML = `
      ${checkoutNotice()}
      <div><strong>Status:</strong> ${billing.status}</div>
      <div><strong>Plan:</strong> ${subscription.name}</div>
      <div><strong>Price:</strong> ${fmtMoney(subscription.amountCents, subscription.currency)} / ${subscription.interval}</div>
      <div><strong>${periodLabel}:</strong> ${fmtDate(periodDate)}</div>
      <div class="hr"></div>
      <button class="btn primary" id="manage-billing">Manage billing</button>
      <a class="btn ghost" href="downloads.html">Go to downloads</a>
    `;

    document.getElementById("manage-billing")?.addEventListener("click", async () => {
      try {
        const { url } = await api("/api/subscriptions/portal", { method: "POST" });
        if (!url) throw new Error("Billing portal response missing redirect URL");
        window.location.href = url;
      } catch (e) {
        alert(e.message);
      }
    });
  } catch (e) {
    el.textContent = `Error loading billing: ${e.message}`;
  }
}
