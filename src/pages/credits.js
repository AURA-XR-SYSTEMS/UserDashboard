// src/pages/credits.js
import { api } from '../lib/api.js';
import { startCheckout, wireModalClose } from '../lib/stripe.js';

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export async function initCredits() {
  // Load balances
  try {
    const { user } = await api('/api/account');
    const credits = user?.credits;
    if (credits) {
      const incl    = credits.includedAllowance || 0;
      const incBal  = Number.isFinite(credits.includedRemaining) ? credits.includedRemaining : incl;
      const bal     = credits.balance || 0;
      const purBal  = credits.purchasedRemaining || 0;
      const purTot  = credits.purchasedCycleTotal || 0;

      const incPct  = incl > 0 ? (incBal / incl) * 100 : 0;
      setWidth('inc-meter', incPct);
      setText('inc-label', incl > 0
        ? `${incBal.toLocaleString()} / ${incl.toLocaleString()} included this cycle`
        : `${bal.toLocaleString()} available`);

      const purPct  = purTot > 0 ? (purBal / purTot) * 100 : 0;
      setWidth('add-meter', purPct);
      setText('add-label', `${purBal.toLocaleString()} / ${purTot.toLocaleString()} this cycle`);
    }
  } catch (e) {
    console.warn('initCredits:', e.message);
  }

  // Wire up the modal "X"/backdrop close
  wireModalClose();

  // Buy buttons --> open Stripe modal
  const container = document.getElementById('credit-options');
  if (container) {
    container.addEventListener('click', async (e) => {
      const amt = e.target?.dataset?.buy;
      if (!amt) return;
      try {
        /* Version 2 - Stripe*/
        await startCheckout({ packCredits: Number(amt)})

      } catch (err) {
        alert(err.message);
      }
    });
  }
}
