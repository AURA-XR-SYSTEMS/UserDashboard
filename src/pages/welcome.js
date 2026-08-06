/**
 * The post-registration screen: one decision, taken immediately.
 *
 * Registration used to drop straight onto the 3-step dashboard, where the
 * membership CTA sat in card 2 underneath a software download — and across the
 * first three weeks of signups, zero registrants started a trial. This page
 * exists so the trial is the only thing on screen when intent is highest.
 */
import {
  api,
  fmtMoney,
  hasPlanAccess,
  loadAccountCached,
  loadMe,
  startCheckout,
} from "../lib/api.js";

function firstChargeLabel(trialDays) {
  const d = new Date(Date.now() + trialDays * 86400000);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Card-network + ROSCA rules: the recurring-charge terms belong next to the
 * button, not behind a link. Mirrors the disclosure on the plans page.
 */
function termsHTML(plan) {
  if (!plan) return "";
  const price = fmtMoney(plan.amountCents, plan.currency);
  const per = plan.interval === "year" ? "year" : "month";
  if (plan.trialDays > 0) {
    return `<strong>${plan.trialDays}-day free trial, then ${price} (USD) / ${per}.</strong>
      Your card will be charged <strong>${price} on ${firstChargeLabel(plan.trialDays)}</strong>
      unless you cancel before then. Cancel anytime from the
      <a href="billing.html">Billing</a> page.`;
  }
  return `<strong>${price} (USD) / ${per}, starting today.</strong>
    Your membership renews ${per}ly until cancelled — cancel anytime from the
    <a href="billing.html">Billing</a> page.`;
}

export async function initWelcome() {
  const user = await loadMe();
  const nameEl = document.querySelector("[data-username]");
  if (nameEl && user) nameEl.textContent = user.firstName || "there";

  // Someone who already has a plan has no business on a trial pitch.
  const account = await loadAccountCached();
  if (account && hasPlanAccess(account)) {
    location.replace("dashboard.html");
    return;
  }

  const btn = document.getElementById("welcome-start");
  const termsEl = document.getElementById("welcome-terms");

  let plan = null;
  try {
    const { plans } = await api("/api/plans");
    plan = plans?.[0] || null;
  } catch {
    // Plan lookup is presentational here — the button still works without it.
  }

  if (termsEl) termsEl.innerHTML = termsHTML(plan);
  // /api/plans is now trial-aware per user, so a returning visitor who already
  // spent their trial sees the right label instead of a phantom free offer.
  if (btn && plan && plan.trialDays === 0) btn.textContent = "Start membership";

  btn?.addEventListener("click", async () => {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    try {
      await startCheckout();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = original;
      alert(err.message);
    }
  });
}
