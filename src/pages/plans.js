import { api, fmtMoney } from "../lib/api.js";

function intervalLabel(interval) {
  if (interval === "year") return "year";
  return "month";
}

export async function loadPlans() {
  const list = document.querySelector("#plan-list");
  if (!list) return;

  const { plans } = await api("/api/plans");

  list.innerHTML = "";
  plans.forEach((plan) => {
    const card = document.createElement("div");
    card.className = "card has-header";
    const { amountCents, currency, description, interval, name, trialDays } = plan;
    const priceHtml = `
      <div class="row" style="align-items:baseline; gap:8px;">
        <div class="price" style="font-size:28px; font-weight:700;">
          ${fmtMoney(amountCents, currency)}
        </div>
        <span class="badge">/${intervalLabel(interval)}</span>
      </div>
    `;
    const trialHtml =
      trialDays > 0
        ? `<span class="chip success" style="margin-left:8px;">${trialDays}-day trial</span>`
        : "";

    card.innerHTML = `
      <div class="card-header">${name}${trialHtml}</div>
      <div class="card-body">
        <div class="features">
          ${priceHtml}
          <p class="muted" style="margin:8px 0 12px;">${description || "Membership access for Aura downloads and services."}</p>
          <div class="row" style="gap:12px; flex-wrap:wrap;">
            <span class="chip">Gateway downloads</span>
            <span class="chip">Client access</span>
            <span class="chip">Billing managed by Stripe</span>
          </div>
        </div>
        <div class="hr"></div>
        <div class="card-actions">
          <button class="btn primary" data-start-membership>Start membership</button>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.addEventListener("click", async (e) => {
    if (!e.target?.hasAttribute("data-start-membership")) return;
    try {
      const { url } = await api("/api/subscriptions/checkout", {
        method: "POST",
      });
      if (!url) throw new Error("Checkout response missing redirect URL");
      window.location.href = url;
    } catch (err) {
      alert(err.message);
    }
  });
}
