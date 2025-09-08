// src/pages/credits.js
import { api } from "../lib/api.js";
import { startCheckout, wireModalClose } from "../lib/stripe.js";

function fmtUSD(cents) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString();
}

export async function initBalance() {
  const creditsLabel = document.getElementById("credits-label");
  const creditsMeter = document.getElementById("credits-meter");
  const purchasedLabel = document.getElementById("purchased-label");
  const purchasedMeter = document.getElementById("purchased-meter");
  // Load balances
  const res = await api("/api/account");
  console.log(res);
  const { account } = res;
  console.log(account);
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
}

function renderPacks(container, packs) {
  const frag = document.createDocumentFragment();

  packs.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
  <div class="card-body">
    <div class="features">
      <div class="row" style="align-items:baseline; gap:8px;">
        <div class="price" style="font-size:28px; font-weight:700;">
          ${fmtUSD(p.cost_cents)}
        </div>
        <span class="badge">
          ${fmtInt(p.total_credits)} credits
        </span>
      </div>
    </div>
    <div class="hr"></div>
    <div class="card-actions">
      <button class="btn primary"
              data-pack-type="${p.type}"
              data-pack-credits="${p.total_credits}">
        Buy ${fmtInt(p.total_credits)}
      </button>
    </div>
  </div>
`;
    frag.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(frag);
}

async function initPacksAndWireButtons() {
  const container = document.getElementById("credit-options");
  if (!container) return;

  // Fetch packs (canonical route + fallback)
  let packsResp = await api("/api/credit-packs");
  const packs = packsResp?.packs || [];
  renderPacks(container, packs);

  // Delegate click handling for Buy buttons
  container.addEventListener("click", async (e) => {
    const btn = e.target?.closest("button[data-pack-type]");
    if (!btn) return;
    const packType = btn.dataset.packType; // "basic" | "intermediate" | "power"
    const packCredits = Number(btn.dataset.packCredits || 0);

    try {
      await startCheckout({ packType, packCredits }); // see stripe.js change below
    } catch (err) {
      alert(err.message || "Could not start checkout.");
    }
  });
}

export async function initCredits() {
  wireModalClose(); // modal close/backdrop
  await Promise.all([
    initBalance(), // fill meters
    initPacksAndWireButtons(), // render packs + wire buttons
  ]);
}
