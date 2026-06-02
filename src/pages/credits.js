// src/pages/credits.js
import { api, creditPct, fmtInt } from "../lib/api.js";
import { startCheckout, wireModalClose } from "../lib/stripe.js";

function fmtUSD(cents) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
export async function initBalance() {
  const creditsLabel = document.getElementById("credits-label");
  const creditsMeter = document.getElementById("credits-meter");
  const purchasedLabel = document.getElementById("purchased-label");
  const purchasedMeter = document.getElementById("purchased-meter");
  // Load balances
  const { account } = await api("/api/account");
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
          ${fmtUSD(p.costCents)}
        </div>
        <span class="badge">
          ${fmtInt(p.totalCredits)} credits
        </span>
      </div>
    </div>
    <div class="hr"></div>
    <div class="card-actions">
      <button class="btn primary"
              data-pack-type="${p.type}"
              data-pack-credits="${p.totalCredits}">
        Buy ${fmtInt(p.totalCredits)}
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
