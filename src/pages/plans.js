// src/pages/plans.js
import { api } from "../lib/api.js";

export async function loadPlans() {
  const list = document.querySelector("#plan-list");
  if (!list) return;

  const { plans } = await api("/api/plans");
  const { account } = await api("/api/account");
  console.log({
    plans,
    account,
  });

  const { method, status, trialAvailable: showTrialOnBasic } = account.billing;

  list.innerHTML = "";
  plans.forEach((plan) => {
    const card = document.createElement("div");
    card.className = "card has-header";
    const {
      cost_cents,
      credits,
      deactivated,
      description,
      features,
      name,
      period,
      type: planType,
      users,
      workspaces,
    } = plan;
    const isBasic = planType === "basic";
    const price = cost_cents / 1000;

    const priceHtml =
      showTrialOnBasic && isBasic
        ? `<div class="row" style="align-items:baseline; gap:8px;"><div class="price" style="font-size:28px; font-weight:700;"><s>$${price}</s> $0</div><span class="badge">/14 days</span></div>`
        : `<div class="row" style="align-items:baseline; gap:8px;"><div class="price" style="font-size:28px; font-weight:700;">$${price}</div><span class="badge">/${period}</span></div>`;

    const bannerHtml =
      showTrialOnBasic && isBasic
        ? `<span class="chip success" style="margin-left:8px;">14-day free trial</span>`
        : "";
    const ctaHtml =
      showTrialOnBasic && isBasic
        ? `<button class="btn primary" data-start-trial>Start free trial</button>`
        : `<button class="btn primary" data-choose="${planType}">Choose ${name}</button>`;

    card.innerHTML = `
      <div class="card-header">${name}${bannerHtml}</div>
      <div class="card-body">
        <div class="features">
          ${priceHtml}
          <p class="muted" style="margin:8px 0 12px;">${description}</p>
          <div class="row" style="gap:12px; flex-wrap:wrap;">
            <span class="chip">${credits.toLocaleString()} credits/mo</span>
            <span class="chip">${workspaces} workspaces</span>
            <span class="chip">${users} users</span>
          </div>
          <div style="margin-top:12px;">
            <ul style="margin:0; padding-left:18px;">
              ${features.map((f) => `<li>${f}</li>`).join("")}
            </ul>
          </div>
        </div>
        <div class="hr"></div>
        <div class="card-actions">
          ${ctaHtml}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  list.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.choose;
    if (id) {
      try {
        await api("/api/subscribe", {
          method: "POST",
          body: { planId: id, method: "test" },
        });
        location.href = "downloads.html";
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    if (e.target?.hasAttribute("data-start-trial")) {
      try {
        await api("/api/trial/start", { method: "POST" });
        location.href = "downloads.html";
      } catch (err) {
        alert(err.message);
      }
    }
  });
}

export async function handleLogout() {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "index.html";
}
