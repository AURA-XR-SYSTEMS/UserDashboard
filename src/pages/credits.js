// src/pages/credits.js
import { api } from "../lib/api.js";
import { startCheckout, wireModalClose } from "../lib/stripe.js";

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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
  // Load balances
  try {
    const { account } = await api("/api/account");
    const credits = account?.credits;
    if (credits) {
      const incl = credits.includedAllowance || 0;
      const incBal = Number.isFinite(credits.includedRemaining)
        ? credits.includedRemaining
        : incl;
      const bal = credits.balance || 0;
      const purBal = credits.purchasedRemaining || 0;
      const purTot = credits.purchasedCycleTotal || 0;

      const incPct = incl > 0 ? (incBal / incl) * 100 : 0;
      setWidth("inc-meter", incPct);
      setText(
        "inc-label",
        incl > 0
          ? `${
              fmtInt(incBal) / $fmtInt(incl)
            } / ${incl.toLocaleString()} included this cycle`
          : `${fmtInt(bal)} available`
      );

      const purPct = purTot > 0 ? (purBal / purTot) * 100 : 0;
      setWidth("add-meter", purPct);
      setText("add-label", `${fmtInt(purBal)} / ${fmtInt(purTot)} this cycle`);
    }
  } catch (e) {
    console.warn("initCredits:", e.message);
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
